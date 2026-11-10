import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import ts from 'ts6'
import type { CharSet } from './regex.ts'

export type Bound = {
  readonly n: number
  readonly measured: (input: unknown) => number
  readonly exact: (k: number) => string | undefined
}
export type Atom = {
  readonly kind: 'atom'
  readonly smt: string
  readonly text: string
  readonly test: (input: unknown) => boolean
  readonly sets?: readonly CharSet[]
  readonly constants?: readonly number[]
  readonly bound?: Bound
  readonly neighbours?: readonly Neighbour[]
}
export type Neighbour = {
  readonly smt: string
  readonly text: string
  readonly test: (input: unknown) => boolean
  readonly sets: readonly CharSet[]
}
export type Formula =
  | Atom
  | { readonly kind: 'not'; readonly arg: Formula }
  | {
      readonly kind: 'and' | 'or'
      readonly left: Formula
      readonly right: Formula
    }
export type Branch = {
  readonly condition: Formula | undefined
  readonly outcome: string
}
export type Classifier = {
  readonly undefinedOutcome: string | undefined
  readonly branches: Branch[]
}
export type Problem = { readonly node: ts.Node; readonly rule: string }
export type Leaf = Formula | { readonly problem: string } | undefined

const predicates = new Set([
  'isInteger',
  'isSafeInteger',
  'isFinite',
  'isNaN',
  'isArray',
])
const stringMethods = new Set([
  'startsWith',
  'endsWith',
  'includes',
  'slice',
  'split',
])

export function isVocabularyCall(node: ts.CallExpression): boolean {
  const callee = node.expression
  if (!ts.isPropertyAccessExpression(callee)) return false
  const name = callee.name.text
  const receiver = callee.expression
  if (name === 'test') return ts.isRegularExpressionLiteral(receiver)
  if (predicates.has(name))
    return (
      ts.isIdentifier(receiver) &&
      (receiver.text === 'Number' || receiver.text === 'Array')
    )
  return stringMethods.has(name)
}

export function isVocabularyReceiver(id: ts.Identifier): boolean {
  const access = id.parent
  return (
    (id.text === 'Number' || id.text === 'Array') &&
    ts.isPropertyAccessExpression(access) &&
    access.expression === id &&
    ts.isCallExpression(access.parent) &&
    isVocabularyCall(access.parent)
  )
}

export const comparisonText: Record<number, string> = {
  [ts.SyntaxKind.LessThanToken]: '<',
  [ts.SyntaxKind.LessThanEqualsToken]: '<=',
  [ts.SyntaxKind.GreaterThanToken]: '>',
  [ts.SyntaxKind.GreaterThanEqualsToken]: '>=',
  [ts.SyntaxKind.EqualsEqualsEqualsToken]: '===',
  [ts.SyntaxKind.ExclamationEqualsEqualsToken]: '!==',
}
export const flipped: Record<string, string> = {
  '<': '>',
  '<=': '>=',
  '>': '<',
  '>=': '<=',
  '===': '===',
  '!==': '!==',
}

export function holds(op: string, x: number, c: number): boolean {
  if (op === '<') return x < c
  if (op === '<=') return x <= c
  if (op === '>') return x > c
  if (op === '>=') return x >= c
  if (op === '===') return x === c
  return x !== c
}

export function readBranches(
  fn: ts.FunctionDeclaration,
  source: ts.SourceFile,
  options: {
    readonly leaf: (expr: ts.Expression) => Leaf
    readonly local?: (statement: ts.VariableStatement) => string | undefined
    readonly undefinedGuard?: string
    readonly conditions: string
    readonly statements: string
  },
): { classifier: Classifier; problems: Problem[] } {
  const problems: Problem[] = []
  const branches: Branch[] = []
  let undefinedOutcome: string | undefined
  let reason: string | undefined

  const formula = (expr: ts.Expression): Formula | undefined => {
    if (ts.isParenthesizedExpression(expr)) return formula(expr.expression)
    if (
      ts.isPrefixUnaryExpression(expr) &&
      expr.operator === ts.SyntaxKind.ExclamationToken
    ) {
      const arg = formula(expr.operand)
      return arg ? { kind: 'not', arg } : undefined
    }
    if (
      ts.isBinaryExpression(expr) &&
      (expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        expr.operatorToken.kind === ts.SyntaxKind.BarBarToken)
    ) {
      const left = formula(expr.left)
      const right = formula(expr.right)
      return left && right
        ? {
            kind:
              expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
                ? 'and'
                : 'or',
            left,
            right,
          }
        : undefined
    }
    const found = options.leaf(expr)
    if (found && 'problem' in found) {
      reason ??= found.problem
      return undefined
    }
    return found
  }
  const condition = (expr: ts.Expression): Formula | undefined => {
    reason = undefined
    return formula(expr)
  }
  const outcomeOf = (expr: ts.Expression | undefined): string | undefined => {
    if (!expr) return undefined
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr))
      return expr.text
    if (expr.kind === ts.SyntaxKind.TrueKeyword) return 'true'
    if (expr.kind === ts.SyntaxKind.FalseKeyword) return 'false'
    return undefined
  }
  const returned = (statement: ts.Statement): string | undefined => {
    const only =
      ts.isBlock(statement) && statement.statements.length === 1
        ? statement.statements[0]
        : statement
    return only && ts.isReturnStatement(only)
      ? outcomeOf(only.expression)
      : undefined
  }
  const unsupported = (node: ts.Node, text: string, what: string) =>
    problems.push({
      node,
      rule:
        reason ??
        `unsupported ${what}: ${text}; supported conditions: ${options.conditions}; supported statements: ${options.statements}`,
    })

  const statements = fn.body?.statements ?? ts.factory.createNodeArray()
  statements.forEach((statement, index) => {
    const last = index === statements.length - 1
    reason = undefined
    if (index === 0 && options.undefinedGuard !== undefined) {
      const guard =
        ts.isIfStatement(statement) &&
        !statement.elseStatement &&
        ts.isBinaryExpression(statement.expression) &&
        statement.expression.operatorToken.kind ===
          ts.SyntaxKind.EqualsEqualsEqualsToken &&
        ts.isIdentifier(statement.expression.left) &&
        statement.expression.left.text === options.undefinedGuard &&
        statement.expression.right.getText(source) === 'undefined'
      undefinedOutcome = guard ? returned(statement.thenStatement) : undefined
      if (undefinedOutcome === undefined)
        problems.push({
          node: statement,
          rule: `the first statement must be: if (${options.undefinedGuard} === undefined) return '<outcome>'`,
        })
      return
    }
    if (ts.isVariableStatement(statement) && options.local) {
      const problem = options.local(statement)
      if (problem) problems.push({ node: statement, rule: problem })
      return
    }
    if (ts.isIfStatement(statement) && !statement.elseStatement) {
      const found = condition(statement.expression)
      const outcome = returned(statement.thenStatement)
      if (!found || outcome === undefined) {
        unsupported(
          statement,
          statement.expression.getText(source),
          'condition or return',
        )
        return
      }
      branches.push({ condition: found, outcome })
      return
    }
    if (ts.isReturnStatement(statement) && last && statement.expression) {
      const expr = statement.expression
      const plain = outcomeOf(expr)
      if (plain !== undefined) {
        branches.push({ condition: undefined, outcome: plain })
        return
      }
      if (ts.isConditionalExpression(expr)) {
        const found = condition(expr.condition)
        const yes = outcomeOf(expr.whenTrue)
        const no = outcomeOf(expr.whenFalse)
        if (found && yes !== undefined && no !== undefined) {
          branches.push({ condition: found, outcome: yes })
          branches.push({ condition: undefined, outcome: no })
          return
        }
      } else {
        const found = condition(expr)
        if (found) {
          branches.push({ condition: found, outcome: 'true' })
          branches.push({ condition: undefined, outcome: 'false' })
          return
        }
      }
    }
    unsupported(
      statement,
      statement.getText(source).split('\n')[0] ?? '',
      'statement',
    )
  })
  if (branches.at(-1)?.condition !== undefined)
    problems.push({
      node: fn,
      rule: 'a classifier ends with an unconditional return',
    })
  return { classifier: { undefinedOutcome, branches }, problems }
}

type Literal = { readonly smt: string; readonly value: boolean }
type Evaluation = { readonly value: boolean; readonly literals: Literal[] }

function evaluations(f: Formula): Evaluation[] {
  if (f.kind === 'atom')
    return [
      { value: true, literals: [{ smt: f.smt, value: true }] },
      { value: false, literals: [{ smt: f.smt, value: false }] },
    ]
  if (f.kind === 'not')
    return evaluations(f.arg).map((e) => ({ ...e, value: !e.value }))
  const shortCircuitsOn = f.kind === 'or'
  return evaluations(f.left).flatMap((l) =>
    l.value === shortCircuitsOn
      ? [l]
      : evaluations(f.right).map((r) => ({
          value: r.value,
          literals: [...l.literals, ...r.literals],
        })),
  )
}

function atomsOf(f: Formula | undefined, into: Map<string, Atom>) {
  if (!f) return
  if (f.kind === 'atom') into.set(f.smt, f)
  else if (f.kind === 'not') atomsOf(f.arg, into)
  else {
    atomsOf(f.left, into)
    atomsOf(f.right, into)
  }
}

export const maxAtoms = 12
export const queryMilliseconds = Number(
  process.env.VERIFIABLE_QUERY_MS ?? 20_000,
)

export function atomList(...classifiers: Classifier[]): Atom[] {
  const atoms = new Map<string, Atom>()
  for (const c of classifiers)
    for (const b of c.branches) atomsOf(b.condition, atoms)
  const list = [...atoms.values()]
  if (list.length > maxAtoms)
    throw new Error(
      `${list.length} atoms exceed ${maxAtoms}; split the classifier into classifiers joined by an intermediate finite type`,
    )
  return list
}

export function pathCount(c: Classifier): number {
  let count = c.undefinedOutcome !== undefined ? 1 : 0
  let open = 1
  for (const branch of c.branches) {
    if (!branch.condition) {
      count += open
      break
    }
    const ev = evaluations(branch.condition)
    count += open * ev.filter((e) => e.value).length
    open *= ev.filter((e) => !e.value).length
  }
  return count
}

type Z3Context = {
  Solver: new () => {
    set(key: string, value: number): void
    fromString(smt: string): void
    check(): Promise<'sat' | 'unsat' | 'unknown'>
    model(): {
      decls(): Array<{ name(): string | number; call(): unknown }>
      eval(expr: unknown): { toString(): string }
    }
  }
}

let context: Promise<Z3Context> | undefined
async function z3(): Promise<Z3Context> {
  context ??= import('z3-solver').then(async (mod) => {
    const { Context } = await mod.init()
    return Context('main') as unknown as Z3Context
  })
  return context
}

export function smtString(text: string): string {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code === 0x22) out += '""'
    else if (code >= 0x20 && code < 0x7f && code !== 0x5c) out += text[i]
    else out += `\\u{${code.toString(16)}}`
  }
  return `"${out}"`
}

function decode(raw: string): string | number {
  if (raw.startsWith('"'))
    return raw
      .slice(1, -1)
      .replace(/""/g, '"')
      .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_m, hex: string) =>
        String.fromCharCode(Number.parseInt(hex, 16)),
      )
  if (raw === 'true' || raw === 'false') return raw
  const negative = /^\(- (\d+)\)$/.exec(raw)
  return negative ? -Number(negative[1]) : Number(raw)
}

export type Model = Record<string, string | number>
type Answer = {
  result: 'sat' | 'unsat' | 'unknown'
  model?: Model
  witness?: string
}

function solverVersion(): string {
  const require = createRequire(import.meta.url)
  return (require('z3-solver/package.json') as { version: string }).version
}

const not = (smt: string) => `(not ${smt})`

export async function ask(
  cacheFile: string,
  query: string,
): Promise<{ result: 'sat' | 'unsat' | 'unknown'; model?: Model }> {
  const key = createHash('sha256')
    .update(`${solverVersion()}\n${query}`)
    .digest('hex')
  const cache: Record<string, Answer> = existsSync(cacheFile)
    ? JSON.parse(readFileSync(cacheFile, 'utf8'))
    : {}
  const hit = cache[key]
  if (hit) return hit
  const Z3 = await z3()
  const solver = new Z3.Solver()
  solver.set('timeout', queryMilliseconds)
  solver.fromString(query)
  const result = await solver.check()
  const answer: Answer = { result }
  if (result === 'unknown') return answer
  if (result === 'sat') {
    const model = solver.model()
    answer.model = Object.fromEntries(
      model
        .decls()
        .map((d) => [
          String(d.name()),
          decode(model.eval(d.call()).toString()),
        ]),
    )
  }
  cache[key] = answer
  mkdirSync(dirname(cacheFile), { recursive: true })
  writeFileSync(cacheFile, `${JSON.stringify(cache)}\n`)
  return answer
}

export type Cells<W> = {
  readonly atoms: string[]
  readonly probes: W[]
  readonly infeasible: number
  readonly unknown: number
  readonly boundary: number
  readonly mismatches: string[]
}

export async function solveCells<W>(options: {
  readonly atoms: readonly Atom[]
  readonly preamble: string
  readonly cacheFile: string
  readonly witness: (model: Model) => W
  readonly candidates: Iterable<W>
}): Promise<Cells<W>> {
  const list = options.atoms
  const version = solverVersion()
  const cache: Record<string, Answer> = existsSync(options.cacheFile)
    ? JSON.parse(readFileSync(options.cacheFile, 'utf8'))
    : {}
  let added = 0
  const save = () => {
    mkdirSync(dirname(options.cacheFile), { recursive: true })
    writeFileSync(options.cacheFile, `${JSON.stringify(cache)}\n`)
  }
  const solve = async (assertions: string[]): Promise<Answer> => {
    const query = `${options.preamble}\n${assertions.map((a) => `(assert ${a})`).join('\n')}`
    const key = createHash('sha256')
      .update(`${version}\n${query}`)
      .digest('hex')
    const hit = cache[key]
    if (hit)
      return hit.witness !== undefined && !hit.model
        ? { result: hit.result, model: { s: hit.witness } }
        : hit
    const Z3 = await z3()
    const solver = new Z3.Solver()
    solver.set('timeout', queryMilliseconds)
    solver.fromString(query)
    const result = await solver.check()
    const answer: Answer = { result }
    if (result === 'unknown') return answer
    if (result === 'sat') {
      const model = solver.model()
      answer.model = Object.fromEntries(
        model
          .decls()
          .map((d) => [
            String(d.name()),
            decode(model.eval(d.call()).toString()),
          ]),
      )
    }
    cache[key] = answer
    if (++added % 25 === 0) save()
    return answer
  }

  const probes: W[] = []
  const inCell = new Map<number, W[]>()
  const seen = new Set<string>()
  const mismatches: string[] = []
  const verdicts: Array<'sat' | 'unsat' | 'unknown'> = []
  let infeasible = 0
  let unknown = 0
  let boundary = 0
  const vectorOf = (w: W) =>
    list.reduce((bits, a, i) => (a.test(w) ? bits | (1 << i) : bits), 0)
  const bounds = list.flatMap((a) => (a.bound ? [a.bound] : []))
  const place = (w: W) =>
    bounds.map((b) => Math.max(-2, Math.min(2, b.measured(w) - b.n))).join(',')
  const accept = (w: W, vector: number): boolean => {
    const actual = vectorOf(w)
    if (actual !== vector) {
      const atom = list.find(
        (_a, i) => ((actual >> i) & 1) !== ((vector >> i) & 1),
      )
      mismatches.push(
        `the solver and JavaScript disagree on ${atom?.text ?? '?'} for the input ${JSON.stringify(w)}`,
      )
      return false
    }
    const key = `${vector}|${place(w)}`
    if (seen.has(key)) return false
    seen.add(key)
    probes.push(w)
    inCell.set(vector, [...(inCell.get(vector) ?? []), w])
    return true
  }
  for (let vector = 0; vector < 2 ** list.length; vector++) {
    const cell = list.map((a, i) => ((vector >> i) & 1 ? a.smt : not(a.smt)))
    const answer = await solve(cell)
    verdicts.push(answer.result)
    if (answer.result === 'unsat') infeasible++
    else if (answer.result === 'unknown') unknown++
    if (!answer.model) continue
    accept(options.witness(answer.model), vector)
    for (const b of bounds)
      for (const k of [b.n - 1, b.n, b.n + 1]) {
        const exact = b.exact(k)
        if (exact === undefined) continue
        const edge = await solve([...cell, exact])
        if (edge.result === 'unknown') unknown++
        if (edge.model && accept(options.witness(edge.model), vector))
          boundary++
      }
    for (const [i, atom] of list.entries())
      for (const near of atom.neighbours ?? []) {
        const differs = (w: W) => near.test(w) !== atom.test(w)
        if ((inCell.get(vector) ?? []).some(differs)) continue
        const edge = await solve([
          ...cell,
          (vector >> i) & 1 ? not(near.smt) : near.smt,
        ])
        if (edge.result === 'unknown') unknown++
        if (!edge.model) continue
        const w = options.witness(edge.model)
        if (!differs(w) || vectorOf(w) !== vector) {
          mismatches.push(
            `the solver and JavaScript disagree on ${near.text}, a neighbour of ${atom.text}, for the input ${JSON.stringify(w)}`,
          )
          continue
        }
        seen.add(JSON.stringify(w))
        probes.push(w)
        inCell.set(vector, [...(inCell.get(vector) ?? []), w])
        boundary++
      }
  }
  for (const candidate of options.candidates) {
    const vector = vectorOf(candidate)
    if (verdicts[vector] === 'unsat')
      mismatches.push(
        `the solver calls a cell infeasible that the input ${JSON.stringify(candidate)} reaches`,
      )
  }
  save()
  return {
    atoms: list.map((a) => a.text),
    probes,
    infeasible,
    unknown,
    boundary,
    mismatches: [...new Set(mismatches)].slice(0, 5),
  }
}
