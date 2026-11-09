import ts from 'ts6'
import { type Problem, ask } from './branches.ts'

export type InputKind = 'number' | 'date' | 'digits'
export type Rounding = 'floor' | 'ceil' | 'round' | 'trunc'
export type Operator = '+' | '-' | '*' | '/' | '%'
export type Num =
  | { readonly k: 'input'; readonly index: number }
  | { readonly k: 'literal'; readonly n: number }
  | { readonly k: 'negated'; readonly e: Num }
  | {
      readonly k: 'binary'
      readonly op: Operator
      readonly l: Num
      readonly r: Num
    }
  | { readonly k: 'rounded'; readonly f: Rounding; readonly e: Num }
export type ProbeValue = number | 'invalid'

export const vocabulary =
  'the inputs, <date>.getTime(), Number(<text of digits>), whole-number literals, + - * / %, Math.floor, Math.ceil, Math.round, Math.trunc, and one cast to a branded number around the whole result'

const operators: Record<number, Operator> = {
  [ts.SyntaxKind.PlusToken]: '+',
  [ts.SyntaxKind.MinusToken]: '-',
  [ts.SyntaxKind.AsteriskToken]: '*',
  [ts.SyntaxKind.SlashToken]: '/',
  [ts.SyntaxKind.PercentToken]: '%',
}
const roundings: readonly Rounding[] = ['floor', 'ceil', 'round', 'trunc']

const constant = (e: Num): boolean =>
  e.k === 'literal' ||
  (e.k === 'negated' && constant(e.e)) ||
  (e.k === 'binary' && constant(e.l) && constant(e.r)) ||
  (e.k === 'rounded' && constant(e.e))

export const sameNumber = (a: unknown, b: unknown): boolean =>
  a === b || (Number.isNaN(a) && Number.isNaN(b))

export function evaluate(e: Num, args: readonly number[]): number {
  if (e.k === 'input') return args[e.index] ?? Number.NaN
  if (e.k === 'literal') return e.n
  if (e.k === 'negated') return -evaluate(e.e, args)
  if (e.k === 'rounded') return Math[e.f](evaluate(e.e, args))
  const l = evaluate(e.l, args)
  const r = evaluate(e.r, args)
  if (e.op === '+') return l + r
  if (e.op === '-') return l - r
  if (e.op === '*') return l * r
  if (e.op === '/') return l / r
  return l % r
}

export function translateConversion(
  fn: ts.FunctionDeclaration,
  source: ts.SourceFile,
  inputs: readonly InputKind[],
): { expr: Num | undefined; cast: ts.Node | undefined; problems: Problem[] } {
  const problems: Problem[] = []
  const positions = new Map<string, number>()
  fn.parameters.forEach((p, i) => {
    if (ts.isIdentifier(p.name)) positions.set(p.name.text, i)
  })
  const only = fn.body?.statements[0]
  if (
    fn.body?.statements.length !== 1 ||
    !only ||
    !ts.isReturnStatement(only) ||
    !only.expression
  ) {
    problems.push({
      node: fn,
      rule: 'a conversion is one statement: return <expression>, with no branch',
    })
    return { expr: undefined, cast: undefined, problems }
  }
  const unsupported = (node: ts.Node, why?: string): undefined => {
    problems.push({
      node,
      rule: `${why ?? `unsupported in a conversion: ${node.getText(source)}`}; a conversion is built from ${vocabulary}`,
    })
    return undefined
  }
  const read = (expr: ts.Expression): Num | undefined => {
    if (ts.isParenthesizedExpression(expr)) return read(expr.expression)
    if (ts.isIdentifier(expr)) {
      const index = positions.get(expr.text)
      if (index === undefined) return unsupported(expr)
      if (inputs[index] === 'digits')
        return unsupported(
          expr,
          `${expr.text} is text, and it is read as Number(${expr.text})`,
        )
      return inputs[index] === 'date'
        ? unsupported(
            expr,
            `${expr.text} is a date, and only ${expr.text}.getTime() is read from a date`,
          )
        : { k: 'input', index }
    }
    if (ts.isNumericLiteral(expr)) {
      const n = Number(expr.text)
      return Number.isSafeInteger(n)
        ? { k: 'literal', n }
        : unsupported(expr, `${expr.getText(source)} is not a whole number`)
    }
    if (
      ts.isPrefixUnaryExpression(expr) &&
      expr.operator === ts.SyntaxKind.MinusToken
    ) {
      const e = read(expr.operand)
      return e ? { k: 'negated', e } : undefined
    }
    if (ts.isBinaryExpression(expr)) {
      const op = operators[expr.operatorToken.kind]
      if (!op) return unsupported(expr)
      const l = read(expr.left)
      const r = read(expr.right)
      if (!l || !r) return undefined
      if (op === '*' && !constant(l) && !constant(r))
        return unsupported(expr, 'the product of two inputs is not counted')
      if ((op === '/' || op === '%') && !constant(r))
        return unsupported(expr, 'the divisor must be made of literals only')
      if ((op === '/' || op === '%') && evaluate(r, []) === 0)
        return unsupported(expr, 'the divisor is zero')
      return { k: 'binary', op, l, r }
    }
    if (ts.isCallExpression(expr)) {
      const callee = expr.expression
      const argument = expr.arguments[0]
      if (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression)
      ) {
        const index = positions.get(callee.expression.text)
        if (
          callee.name.text === 'getTime' &&
          index !== undefined &&
          inputs[index] === 'date' &&
          expr.arguments.length === 0
        )
          return { k: 'input', index }
        const f = roundings.find((name) => name === callee.name.text)
        if (
          callee.expression.text === 'Math' &&
          f &&
          argument &&
          expr.arguments.length === 1
        ) {
          const e = read(argument)
          return e ? { k: 'rounded', f, e } : undefined
        }
      }
      if (
        ts.isIdentifier(callee) &&
        callee.text === 'Number' &&
        argument &&
        expr.arguments.length === 1
      ) {
        const index = ts.isIdentifier(argument)
          ? positions.get(argument.text)
          : undefined
        return index !== undefined && inputs[index] === 'digits'
          ? { k: 'input', index }
          : read(argument)
      }
    }
    return unsupported(expr)
  }
  const top = ts.isParenthesizedExpression(only.expression)
    ? only.expression.expression
    : only.expression
  const cast = ts.isAsExpression(top) ? top : undefined
  return { expr: read(cast ? cast.expression : top), cast, problems }
}

type Fraction = { readonly n: number; readonly d: number }
type Term = { readonly num: string; readonly den: number }

const whole = (n: number) => (n < 0 ? `(- ${-n})` : String(n))

function folded(e: Num): Fraction {
  if (e.k === 'literal') return { n: e.n, d: 1 }
  if (e.k === 'input') return { n: Number.NaN, d: 1 }
  if (e.k === 'negated') {
    const inner = folded(e.e)
    return { n: -inner.n, d: inner.d }
  }
  if (e.k === 'rounded') {
    const inner = folded(e.e)
    return { n: Math[e.f](inner.n / inner.d), d: 1 }
  }
  const l = folded(e.l)
  const r = folded(e.r)
  if (e.op === '+') return { n: l.n * r.d + r.n * l.d, d: l.d * r.d }
  if (e.op === '-') return { n: l.n * r.d - r.n * l.d, d: l.d * r.d }
  if (e.op === '*') return { n: l.n * r.n, d: l.d * r.d }
  const flip = r.n < 0 ? -1 : 1
  if (e.op === '/') return { n: flip * l.n * r.d, d: flip * l.d * r.n }
  const quotient = Math.trunc((l.n * r.d) / (l.d * r.n))
  return { n: l.n * r.d - quotient * r.n * l.d, d: l.d * r.d }
}

const floored = (t: Term) => `(div ${t.num} ${t.den})`
const ceiled = (t: Term) => `(- (div (- ${t.num}) ${t.den}))`
const truncated = (t: Term) =>
  `(ite (>= ${t.num} 0) ${floored(t)} ${ceiled(t)})`

function over(t: Term, c: Fraction): Term {
  const flip = c.n < 0 ? -1 : 1
  return {
    num: `(* ${whole(flip * c.d)} ${t.num})`,
    den: t.den * flip * c.n,
  }
}

function term(e: Num): Term {
  if (constant(e)) {
    const value = folded(e)
    return { num: whole(value.n), den: value.d }
  }
  if (e.k === 'input') return { num: `v${e.index}`, den: 1 }
  if (e.k === 'literal') return { num: whole(e.n), den: 1 }
  if (e.k === 'negated') {
    const inner = term(e.e)
    return { num: `(- ${inner.num})`, den: inner.den }
  }
  if (e.k === 'rounded') {
    const inner = term(e.e)
    if (e.f === 'floor') return { num: floored(inner), den: 1 }
    if (e.f === 'ceil') return { num: ceiled(inner), den: 1 }
    if (e.f === 'trunc') return { num: truncated(inner), den: 1 }
    return {
      num: `(div (+ (* 2 ${inner.num}) ${inner.den}) ${2 * inner.den})`,
      den: 1,
    }
  }
  if (e.op === '*') {
    const [fixed, other] = constant(e.l) ? [e.l, e.r] : [e.r, e.l]
    const c = folded(fixed)
    const t = term(other)
    return { num: `(* ${whole(c.n)} ${t.num})`, den: t.den * c.d }
  }
  const l = term(e.l)
  if (e.op === '/') return over(l, folded(e.r))
  if (e.op === '%') {
    const c = folded(e.r)
    const times = truncated(over(l, c))
    return {
      num: `(- (* ${c.d} ${l.num}) (* ${whole(c.n * l.den)} ${times}))`,
      den: l.den * c.d,
    }
  }
  const r = term(e.r)
  return {
    num: `(${e.op} (* ${r.den} ${l.num}) (* ${l.den} ${r.num}))`,
    den: l.den * r.den,
  }
}

const differ = (a: Num, b: Num): string => {
  const [x, y] = [term(a), term(b)]
  return `(not (= (* ${y.den} ${x.num}) (* ${x.den} ${y.num})))`
}

const notWholeNumber = (e: Num): string => {
  const t = term(e)
  return `(not (= (mod ${t.num} ${t.den}) 0))`
}

function neighbours(e: Num, inputs: readonly InputKind[]): Num[] {
  if (e.k === 'input')
    return inputs.flatMap((kind, index): Num[] =>
      index !== e.index && kind === inputs[e.index]
        ? [{ k: 'input', index }]
        : [],
    )
  if (e.k === 'literal')
    return [
      { k: 'literal', n: e.n + 1 },
      { k: 'literal', n: e.n - 1 },
    ]
  if (e.k === 'negated')
    return [e.e, ...neighbours(e.e, inputs).map((n): Num => ({ ...e, e: n }))]
  if (e.k === 'rounded')
    return [
      e.e,
      ...roundings.filter((f) => f !== e.f).map((f): Num => ({ ...e, f })),
      ...neighbours(e.e, inputs).map((n): Num => ({ ...e, e: n })),
    ]
  const swapped: Partial<Record<Operator, Operator>> = {
    '+': '-',
    '-': '+',
    '*': '/',
    '/': '*',
  }
  const other = swapped[e.op]
  const divides = (op: Operator) => op === '/' || op === '%'
  return [
    ...(other ? [{ ...e, op: other }] : []),
    ...neighbours(e.l, inputs).map((l): Num => ({ ...e, l })),
    ...neighbours(e.r, inputs).map((r): Num => ({ ...e, r })),
  ].filter(
    (n) =>
      n.k !== 'binary' ||
      !divides(n.op) ||
      (constant(n.r) && evaluate(n.r, []) !== 0),
  )
}

const bounds = [1_000, 1_000_000, 8_640_000_000_000_000]

export async function conversionProbes(
  code: Num,
  spec: Num,
  inputs: readonly InputKind[],
  cacheFile: string,
): Promise<{
  probes: ProbeValue[][]
  neighbours: number
  equivalent: number
  unknown: number
  mismatches: string[]
  fraction: { args: number[]; value: number } | undefined
}> {
  const declared = inputs.map((_kind, i) => `(declare-const v${i} Int)`)
  const witness = async (
    assertion: string,
  ): Promise<number[] | 'none' | 'unknown'> => {
    let open = false
    for (const bound of bounds) {
      const within = inputs.map((kind, i) =>
        kind === 'digits'
          ? `(assert (and (<= 0 v${i}) (<= v${i} ${Math.min(bound, 999_999_999_999_999)})))`
          : `(assert (and (<= (- ${bound}) v${i}) (<= v${i} ${bound})))`,
      )
      const answer = await ask(
        cacheFile,
        [...declared, ...within, `(assert ${assertion})`].join('\n'),
      )
      if (answer.result === 'unknown') open = true
      if (answer.model) {
        const model = answer.model
        return inputs.map((_kind, i) => Number(model[`v${i}`] ?? 0))
      }
    }
    return open ? 'unknown' : 'none'
  }
  const mismatches: string[] = []
  let unknown = 0
  let equivalent = 0
  const probes: number[][] = [inputs.map(() => 0)]
  const add = (args: number[]) => {
    if (!probes.some((p) => JSON.stringify(p) === JSON.stringify(args)))
      probes.push(args)
  }
  const notWhole = await witness(notWholeNumber(code))
  if (notWhole === 'unknown') unknown++
  const fraction =
    typeof notWhole === 'object'
      ? { args: notWhole, value: evaluate(code, notWhole) }
      : undefined
  if (fraction && Number.isInteger(fraction.value))
    mismatches.push(
      `the solver and JavaScript disagree on whether the conversion gives a whole number for ${JSON.stringify(fraction.args)}`,
    )
  const differing = await witness(differ(code, spec))
  if (differing === 'unknown') unknown++
  if (typeof differing === 'object') add(differing)
  const near = neighbours(code, inputs)
  for (const neighbour of near) {
    const differs = (args: readonly number[]) =>
      !sameNumber(evaluate(code, args), evaluate(neighbour, args))
    if (probes.some(differs)) continue
    const found = await witness(differ(code, neighbour))
    if (found === 'unknown') unknown++
    if (found === 'none') equivalent++
    if (typeof found !== 'object') continue
    if (!differs(found)) {
      mismatches.push(
        `the solver and JavaScript disagree on the conversion for ${JSON.stringify(found)}`,
      )
      continue
    }
    add(found)
  }
  return {
    probes: [
      ...probes,
      ...inputs.flatMap((kind, at): ProbeValue[][] =>
        kind === 'date'
          ? [inputs.map((_kind, i) => (i === at ? 'invalid' : 0))]
          : [],
      ),
    ],
    neighbours: near.length,
    equivalent,
    unknown,
    mismatches,
    fraction:
      fraction && !Number.isInteger(fraction.value) ? fraction : undefined,
  }
}
