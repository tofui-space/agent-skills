import ts from 'ts6'
import {
  type Atom,
  type Classifier,
  type Formula,
  type Leaf,
  type Problem,
  atomList,
  pathCount,
  readBranches,
} from './branches.ts'

const conditions =
  "typeof <value> === '<type>', <value> === null, <value> === undefined, Array.isArray, Number.isInteger, Number.isSafeInteger, Number.isFinite, Number.isNaN, <value> === a string, number or boolean literal, where <value> is the input or a property path under it, and '<property>' in <value>, joined by && || !"
const statements =
  "if (<condition>) return '<literal>', and a final return of a literal, a condition, or <condition> ? '<a>' : '<b>'"

export const universe: Readonly<Record<string, unknown>> = {
  undefined: undefined,
  null: null,
  boolean: true,
  'not a number': Number.NaN,
  infinity: Number.POSITIVE_INFINITY,
  fraction: 0.5,
  'safe integer': 0,
  'unsafe integer': 2 ** 53,
  string: 'a',
  bigint: BigInt(1),
  symbol: Symbol('probe'),
  function: () => undefined,
  array: [],
  object: {},
}

export type Literal = string | number | boolean
export type UnknownProbe =
  | string
  | readonly ['literal', Literal]
  | { readonly [property: string]: UnknownProbe }
export type Read = { readonly atom: string; readonly path: readonly string[] }
export type Compared = {
  readonly path: readonly string[]
  readonly value: Literal
}

export const maxCells = 4096

export function probeValue(probe: UnknownProbe): unknown {
  if (typeof probe === 'string') {
    if (!(probe in universe)) throw new Error(`no probe value named ${probe}`)
    return universe[probe]
  }
  if (Array.isArray(probe)) return probe[1]
  return Object.fromEntries(
    Object.entries(probe)
      .filter(([, inner]) => inner !== 'absent')
      .map(([property, inner]) => [property, probeValue(inner)]),
  )
}

const predicates: Record<string, ((value: unknown) => boolean) | undefined> = {
  'Array.isArray': Array.isArray,
  'Number.isInteger': Number.isInteger,
  'Number.isSafeInteger': Number.isSafeInteger,
  'Number.isFinite': Number.isFinite,
  'Number.isNaN': Number.isNaN,
}

const holdsProperties = (value: unknown): value is Record<string, unknown> =>
  (typeof value === 'object' && value !== null) || typeof value === 'function'

function readPath(input: unknown, path: readonly string[]): unknown {
  let value = input
  for (const property of path)
    value = holdsProperties(value) ? value[property] : undefined
  return value
}

type Subject = { readonly text: string; readonly path: readonly string[] }

export function translateUnknown(
  fn: ts.FunctionDeclaration,
  source: ts.SourceFile,
): {
  classifier: Classifier
  problems: Problem[]
  reads: Read[]
  compared: Compared[]
} {
  const param = fn.parameters[0]
  const paramName =
    param && ts.isIdentifier(param.name) ? param.name.text : undefined
  const reads: Read[] = []
  const compared: Compared[] = []
  const subjectOf = (expr: ts.Expression): Subject | undefined => {
    if (ts.isIdentifier(expr) && expr.text === paramName)
      return { text: 'input', path: [] }
    if (!ts.isPropertyAccessExpression(expr) || expr.questionDotToken)
      return undefined
    const parent = subjectOf(expr.expression)
    return parent
      ? {
          text: `${parent.text}.${expr.name.text}`,
          path: [...parent.path, expr.name.text],
        }
      : undefined
  }

  const leaf = (expr: ts.Expression): Leaf => {
    const atom = (
      key: string,
      path: readonly string[],
      test: (input: unknown) => boolean,
    ): Atom => {
      reads.push({ atom: key, path })
      return { kind: 'atom', smt: key, text: key, test }
    }
    const about = (
      subject: Subject,
      key: string,
      holds: (value: unknown) => boolean,
    ) =>
      atom(key, subject.path, (input) => holds(readPath(input, subject.path)))
    if (ts.isCallExpression(expr)) {
      const name = expr.expression.getText(source)
      const predicate = predicates[name]
      const argument = expr.arguments[0]
      const subject = argument ? subjectOf(argument) : undefined
      return predicate && expr.arguments.length === 1 && subject
        ? about(subject, `${name}(${subject.text})`, predicate)
        : undefined
    }
    if (!ts.isBinaryExpression(expr)) return undefined
    const kind = expr.operatorToken.kind
    if (kind === ts.SyntaxKind.InKeyword && ts.isStringLiteral(expr.left)) {
      const holder = subjectOf(expr.right)
      if (!holder) return undefined
      const property = expr.left.text
      return atom(
        `'${property}' in ${holder.text}`,
        [...holder.path, property],
        (input) => {
          const value = readPath(input, holder.path)
          return holdsProperties(value) && property in value
        },
      )
    }
    const equal = kind === ts.SyntaxKind.EqualsEqualsEqualsToken
    if (!equal && kind !== ts.SyntaxKind.ExclamationEqualsEqualsToken)
      return undefined
    const signed = (found: Atom): Formula =>
      equal ? found : { kind: 'not', arg: found }
    for (const [left, other] of [
      [expr.left, expr.right],
      [expr.right, expr.left],
    ] as const) {
      const typed = ts.isTypeOfExpression(left)
        ? subjectOf(left.expression)
        : undefined
      if (typed && ts.isStringLiteral(other)) {
        const type = other.text
        return signed(
          about(
            typed,
            `typeof ${typed.text} === '${type}'`,
            (value) => typeof value === type,
          ),
        )
      }
      const subject = subjectOf(left)
      if (!subject) continue
      if (other.kind === ts.SyntaxKind.NullKeyword)
        return signed(
          about(subject, `${subject.text} === null`, (value) => value === null),
        )
      if (ts.isIdentifier(other) && other.text === 'undefined')
        return signed(
          about(
            subject,
            `${subject.text} === undefined`,
            (value) => value === undefined,
          ),
        )
      const literal: Literal | undefined =
        ts.isStringLiteral(other) || ts.isNoSubstitutionTemplateLiteral(other)
          ? other.text
          : ts.isNumericLiteral(other)
            ? Number(other.text)
            : other.kind === ts.SyntaxKind.TrueKeyword
              ? true
              : other.kind === ts.SyntaxKind.FalseKeyword
                ? false
                : undefined
      if (literal !== undefined) {
        compared.push({ path: subject.path, value: literal })
        return signed(
          about(
            subject,
            `${subject.text} === ${JSON.stringify(literal)}`,
            (value) => value === literal,
          ),
        )
      }
    }
    return undefined
  }

  const read = readBranches(fn, source, { leaf, conditions, statements })
  return { ...read, reads, compared }
}

const startsWith = (path: readonly string[], prefix: readonly string[]) =>
  prefix.every((property, i) => path[i] === property)

function embedded(path: readonly string[], value: unknown): unknown {
  return path.reduceRight<unknown>(
    (inner, property) => ({ [property]: inner }),
    value,
  )
}

export function unknownCells(
  code: Classifier,
  spec: Classifier,
  reads: readonly Read[],
  compared: readonly Compared[],
) {
  const atoms = atomList(code, spec)
  const pathOf = new Map(reads.map((r) => [r.atom, r.path]))
  const paths = reads.map((r) => r.path)
  const representatives = (at: readonly string[]): UnknownProbe[] => {
    const below = atoms.filter((a) => startsWith(pathOf.get(a.smt) ?? [], at))
    const children = [
      ...new Set(
        paths
          .filter((p) => p.length > at.length && startsWith(p, at))
          .map((p) => p[at.length] ?? ''),
      ),
    ].sort()
    let objects: Array<Record<string, UnknownProbe>> = [{}]
    for (const child of children) {
      const states: UnknownProbe[] = [
        'absent',
        ...representatives([...at, child]),
      ]
      if (objects.length * states.length > 200_000)
        throw new Error(
          `the properties under ${['input', ...at].join('.')} combine into more than 200000 objects; classify part of it in a classifier of its own`,
        )
      objects = objects.flatMap((partial) =>
        states.map((state) => ({ ...partial, [child]: state })),
      )
    }
    const literals = compared
      .filter((c) => c.path.join('.') === at.join('.'))
      .map((c): UnknownProbe => ['literal', c.value])
    const candidates: UnknownProbe[] = [
      ...Object.keys(universe).filter(
        (label) => children.length === 0 || label !== 'object',
      ),
      ...literals,
      ...(children.length === 0 ? [] : objects),
    ]
    const cells = new Map<string, UnknownProbe>()
    for (const probe of candidates) {
      const value = embedded(at, probeValue(probe))
      const vector = below.map((a) => (a.test(value) ? 'T' : 'F')).join('')
      if (!cells.has(vector)) cells.set(vector, probe)
    }
    return [...cells.values()]
  }
  const probes = representatives([])
  if (probes.length > maxCells)
    throw new Error(
      `${probes.length} cells exceed ${maxCells}; classify part of the object in a classifier of its own`,
    )
  return {
    atoms: atoms.map((a) => a.text),
    probes,
    paths: pathCount(code),
  }
}
