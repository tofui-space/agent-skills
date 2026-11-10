import ts from 'ts6'
import {
  type Cells,
  type Classifier,
  type Formula,
  type Leaf,
  type Problem,
  atomList,
  comparisonText,
  holds,
  pathCount,
  readBranches,
  solveCells,
} from './branches.ts'

const conditions =
  'comparisons (< <= > >= === !==) between sums and differences of the inputs and integer literals, <input> === undefined for an input that may be undefined, joined by && || !'
const statements =
  "if (<condition>) return '<literal>', and a final return of a literal or <condition> ? '<a>' : '<b>'"

type Arguments = ReadonlyArray<number | null>
type Linear = {
  readonly smt: string
  readonly js: (args: Arguments) => number
  readonly constants: readonly number[]
  readonly uses: readonly number[]
}

const smtOp: Record<string, string> = {
  '<': '<',
  '<=': '<=',
  '>': '>',
  '>=': '>=',
  '===': '=',
}

export function translateNumbers(
  fn: ts.FunctionDeclaration,
  source: ts.SourceFile,
  optional: readonly boolean[] = [],
): { classifier: Classifier; problems: Problem[] } {
  const positions = new Map<string, number>()
  fn.parameters.forEach((p, i) => {
    if (ts.isIdentifier(p.name)) positions.set(p.name.text, i)
  })

  const linear = (expr: ts.Expression): Linear | undefined => {
    if (ts.isParenthesizedExpression(expr)) return linear(expr.expression)
    if (ts.isIdentifier(expr)) {
      const i = positions.get(expr.text)
      return i === undefined
        ? undefined
        : {
            smt: `v${i}`,
            js: (args) => args[i] ?? Number.NaN,
            constants: [],
            uses: [i],
          }
    }
    if (ts.isNumericLiteral(expr)) {
      const n = Number(expr.text)
      return Number.isSafeInteger(n)
        ? { smt: String(n), js: () => n, constants: [n], uses: [] }
        : undefined
    }
    if (
      ts.isPrefixUnaryExpression(expr) &&
      expr.operator === ts.SyntaxKind.MinusToken
    ) {
      const arg = linear(expr.operand)
      return arg
        ? {
            smt: `(- ${arg.smt})`,
            js: (args) => -arg.js(args),
            constants: arg.constants,
            uses: arg.uses,
          }
        : undefined
    }
    if (ts.isBinaryExpression(expr)) {
      const plus = expr.operatorToken.kind === ts.SyntaxKind.PlusToken
      const minus = expr.operatorToken.kind === ts.SyntaxKind.MinusToken
      if (!plus && !minus) return undefined
      const left = linear(expr.left)
      const right = linear(expr.right)
      return left && right
        ? {
            smt: `(${plus ? '+' : '-'} ${left.smt} ${right.smt})`,
            js: (args) =>
              plus
                ? left.js(args) + right.js(args)
                : left.js(args) - right.js(args),
            constants: [...left.constants, ...right.constants],
            uses: [...left.uses, ...right.uses],
          }
        : undefined
    }
    return undefined
  }

  const leaf = (expr: ts.Expression): Leaf => {
    if (!ts.isBinaryExpression(expr)) return undefined
    const op = comparisonText[expr.operatorToken.kind]
    if (!op) return undefined
    for (const [subject, other] of [
      [expr.left, expr.right],
      [expr.right, expr.left],
    ] as const) {
      const name = ts.isIdentifier(subject) ? subject.text : undefined
      const i = name === undefined ? undefined : positions.get(name)
      if (
        i !== undefined &&
        optional[i] &&
        ts.isIdentifier(other) &&
        other.text === 'undefined' &&
        (op === '===' || op === '!==')
      ) {
        const missing: Formula = {
          kind: 'atom',
          smt: `u${i}`,
          text: `${name} === undefined`,
          test: (input) => (input as Arguments)[i] === null,
        }
        return op === '===' ? missing : { kind: 'not', arg: missing }
      }
    }
    const left = linear(expr.left)
    const right = linear(expr.right)
    if (!left || !right) return undefined
    const present = [...new Set([...left.uses, ...right.uses])]
      .filter((i) => optional[i])
      .map((i) => `(not u${i})`)
    const whenPresent = (smt: string) =>
      present.length === 0 ? smt : `(and ${present.join(' ')} ${smt})`
    const difference = `(- ${left.smt} ${right.smt})`
    return {
      kind: 'atom',
      smt:
        op === '!=='
          ? `(not ${whenPresent(`(= ${left.smt} ${right.smt})`)})`
          : whenPresent(`(${smtOp[op]} ${left.smt} ${right.smt})`),
      text: expr.getText(source),
      test: (input) =>
        holds(op, left.js(input as Arguments), right.js(input as Arguments)),
      constants: [...left.constants, ...right.constants],
      bound: {
        exact: (k) => whenPresent(`(= ${difference} ${k})`),
        n: 0,
        measured: (input) =>
          left.js(input as Arguments) - right.js(input as Arguments),
      },
    }
  }

  return readBranches(fn, source, { leaf, conditions, statements })
}

function* tuples(
  values: readonly number[],
  optional: readonly boolean[],
): Iterable<Array<number | null>> {
  if ((values.length + 1) ** optional.length > 200_000) return
  let level: Array<Array<number | null>> = [[]]
  for (const mayBeMissing of optional)
    level = level.flatMap((prefix) =>
      [...values, ...(mayBeMissing ? [null] : [])].map((v) => [...prefix, v]),
    )
  yield* level
}

export async function numberCells(
  code: Classifier,
  spec: Classifier,
  optional: readonly boolean[],
  cacheFile: string,
): Promise<Cells<Array<number | null>> & { paths: number }> {
  const atoms = atomList(code, spec)
  const names = optional.map((_, i) => `v${i}`)
  const base = new Set([-1, 0, 1])
  for (const a of atoms)
    for (const c of a.constants ?? []) for (const x of [c, -c]) base.add(x)
  const values = new Set<number>()
  for (const x of base) for (const y of base) values.add(x + y)
  const cells = await solveCells<Array<number | null>>({
    atoms,
    preamble: [
      ...names.map((n) => `(declare-const ${n} Int)`),
      ...optional.flatMap((mayBeMissing, i) =>
        mayBeMissing ? [`(declare-const u${i} Bool)`] : [],
      ),
    ].join('\n'),
    cacheFile,
    witness: (model) =>
      names.map((n, i) =>
        model[`u${i}`] === 'true' ? null : Number(model[n] ?? 0),
      ),
    candidates: tuples([...values], optional),
  })
  const unsafe = cells.probes.filter(
    (p) => !p.every((x) => x === null || Number.isSafeInteger(x)),
  )
  return {
    ...cells,
    mismatches: [
      ...cells.mismatches,
      ...unsafe.map(
        (p) => `the witness ${JSON.stringify(p)} is not a safe integer`,
      ),
    ],
    paths: pathCount(code),
  }
}
