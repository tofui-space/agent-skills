import ts from 'ts6'
import {
  type Atom,
  type Bound,
  type Cells,
  type Classifier,
  type Formula,
  type Leaf,
  type Problem,
  ask,
  atomList,
  comparisonText,
  flipped,
  holds,
  pathCount,
  readBranches,
  smtString,
  solveCells,
} from './branches.ts'
import {
  type CharSet,
  neighbours,
  parseRegex,
  regexSmt,
  regexSource,
  regexSubset,
  representatives,
  setsOf,
} from './regex.ts'

const conditions = `startsWith, endsWith, includes, === 'literal', .length and .split('c').length compared with an integer, and /pattern/.test(<input>) with ${regexSubset}`
const statements =
  "an undefined guard first, const x = input.slice(n) or input.slice(n, -m), if (<condition>) return '<literal>', and a final return of a literal or <condition> ? '<a>' : '<b>'"

const not = (smt: string) => `(not ${smt})`
const anything = '(re.* re.allchar)'
const text = (literal: string) => `(str.to_re ${smtString(literal)})`
const exactly = (n: number) =>
  n === 0 ? text('') : `((_ re.loop ${n} ${n}) re.allchar)`
const upTo = (n: number) =>
  n < 0 ? 're.none' : `((_ re.loop 0 ${n}) re.allchar)`
const atLeast = (n: number) =>
  n <= 0 ? anything : `(re.++ ${exactly(n)} ${anything})`

function lengthLanguage(op: string, n: number): string {
  if (op === '<') return upTo(n - 1)
  if (op === '<=') return upTo(n)
  if (op === '>') return atLeast(n + 1)
  if (op === '>=') return atLeast(n)
  return n < 0 ? 're.none' : exactly(n)
}

const except = (d: string) => `(re.diff re.allchar ${text(d)})`
const countAtLeast = (d: string, m: number) =>
  m <= 0
    ? anything
    : `(re.++ ((_ re.loop ${m} ${m}) (re.++ (re.* ${except(d)}) ${text(d)})) ${anything})`
const countAtMost = (d: string, m: number) =>
  m < 0
    ? 're.none'
    : `(re.++ ((_ re.loop 0 ${m}) (re.++ (re.* ${except(d)}) ${text(d)})) (re.* ${except(d)}))`
const countExactly = (d: string, m: number) =>
  m < 0 ? 're.none' : `(re.inter ${countAtLeast(d, m)} ${countAtMost(d, m)})`

function partsLanguage(d: string, op: string, n: number): string {
  if (op === '>') return countAtLeast(d, n)
  if (op === '>=') return countAtLeast(d, n - 1)
  if (op === '<') return countAtMost(d, n - 2)
  if (op === '<=') return countAtMost(d, n - 1)
  return countExactly(d, n - 1)
}

type Term = { readonly offset: number; readonly tail: number }

const cut = (term: Term, s: string) =>
  term.tail === 0 ? s.slice(term.offset) : s.slice(term.offset, -term.tail)

function fromOffset(
  language: string,
  term: Term,
  acceptsEmpty: boolean,
): string {
  const { offset, tail } = term
  if (offset === 0 && tail === 0) return language
  const shifted =
    tail === 0
      ? `(re.++ ${exactly(offset)} ${language})`
      : `(re.++ ${offset === 0 ? '' : `${exactly(offset)} `}${language} ${exactly(tail)})`
  return acceptsEmpty
    ? `(re.union ${shifted} ${upTo(offset + tail - 1)})`
    : shifted
}

function captureAdvice(
  call: ts.CallExpression,
  source: ts.SourceFile,
): string | undefined {
  if (!ts.isPropertyAccessExpression(call.expression)) return undefined
  const method = call.expression.name.text
  if (method !== 'match' && method !== 'search' && method !== 'exec')
    return undefined
  const receiver = call.expression.expression
  const argument = call.arguments[0]
  const literal = ts.isRegularExpressionLiteral(receiver)
    ? receiver
    : argument && ts.isRegularExpressionLiteral(argument)
      ? argument
      : undefined
  const subject = (literal === receiver ? argument : receiver)?.getText(source)
  const reads = `${call.getText(source)} reads what a regular expression captured, and only /pattern/.test(<input>) is counted`
  if (!literal || !subject) return reads
  const end = literal.text.lastIndexOf('/')
  const parsed = parseRegex(
    literal.text.slice(1, end),
    literal.text.slice(end + 1),
  )
  if ('error' in parsed || !parsed.captures)
    return `${reads}; where a group of this pattern starts or ends depends on the text, so its value has no fixed place to cut`
  const slices = parsed.captures.map(
    ({ offset, tail }) =>
      `${subject}.slice(${offset}${tail === 0 ? '' : `, -${tail}`})`,
  )
  return `${reads}; whenever this pattern matches, ${slices.map((cut, i) => `group ${i + 1} is ${cut}`).join(', ')}, so write: if (!${literal.text}.test(${subject})) return '<outcome>', then ${slices.map((cut, i) => `const <name${slices.length > 1 ? i + 1 : ''}> = ${cut}`).join(', ')}`
}

const singles = (literal: string): CharSet[] =>
  [...literal].map((_c, i) => [[literal.charCodeAt(i), literal.charCodeAt(i)]])

export function translate(
  fn: ts.FunctionDeclaration,
  source: ts.SourceFile,
  allowsUndefined: boolean,
): { classifier: Classifier; problems: Problem[] } {
  const param = fn.parameters[0]
  const paramName =
    param && ts.isIdentifier(param.name) ? param.name.text : undefined
  const terms = new Map<string, Term>()
  if (paramName) terms.set(paramName, { offset: 0, tail: 0 })

  const termOf = (expr: ts.Expression): Term | undefined =>
    ts.isIdentifier(expr) ? terms.get(expr.text) : undefined
  const stringLiteral = (expr: ts.Expression | undefined) =>
    expr &&
    (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr))
      ? expr.text
      : undefined
  const numberLiteral = (expr: ts.Expression) =>
    ts.isNumericLiteral(expr) ? Number(expr.text) : undefined

  const leaf = (expr: ts.Expression): Leaf => {
    const inLanguage = (
      term: Term,
      language: string,
      accepts: (value: string) => boolean,
    ) => `(str.in_re s ${fromOffset(language, term, accepts(''))})`
    const atom = (
      term: Term,
      language: string,
      accepts: (value: string) => boolean,
      sets: readonly CharSet[],
      negated = false,
      bound?: Bound,
    ): Atom => {
      const inside = inLanguage(term, language, accepts)
      return {
        kind: 'atom',
        smt: negated ? not(inside) : inside,
        text: expr.getText(source),
        test: (input) => accepts(cut(term, input as string)) !== negated,
        sets,
        ...(bound ? { bound } : {}),
      }
    }
    if (ts.isBinaryExpression(expr)) {
      const written = comparisonText[expr.operatorToken.kind]
      if (!written) return undefined
      const literalOnRight =
        stringLiteral(expr.right) !== undefined ||
        numberLiteral(expr.right) !== undefined
      const subject = literalOnRight ? expr.left : expr.right
      const other = literalOnRight ? expr.right : expr.left
      const op = literalOnRight ? written : (flipped[written] ?? written)
      const negated = op === '!=='
      const positive = negated ? '===' : op
      const literal = stringLiteral(other)
      const term = termOf(subject)
      if (literal !== undefined && term && positive === '===')
        return atom(
          term,
          text(literal),
          (value) => value === literal,
          singles(literal),
          negated,
        )
      const n = numberLiteral(other)
      if (
        n !== undefined &&
        Number.isInteger(n) &&
        ts.isPropertyAccessExpression(subject) &&
        subject.name.text === 'length'
      ) {
        const base = subject.expression
        const direct = termOf(base)
        if (direct)
          return atom(
            direct,
            lengthLanguage(positive, n),
            (value) => holds(positive, value.length, n),
            [],
            negated,
            {
              n,
              measured: (s) => cut(direct, s as string).length,
              exact: (k) =>
                k < 0
                  ? undefined
                  : inLanguage(
                      direct,
                      exactly(k),
                      (value) => value.length === k,
                    ),
            },
          )
        if (
          ts.isCallExpression(base) &&
          ts.isPropertyAccessExpression(base.expression) &&
          base.expression.name.text === 'split'
        ) {
          const on = termOf(base.expression.expression)
          const d = stringLiteral(base.arguments[0])
          if (
            on &&
            d !== undefined &&
            d.length === 1 &&
            base.arguments.length === 1
          )
            return atom(
              on,
              partsLanguage(d, positive, n),
              (value) => holds(positive, value.split(d).length, n),
              singles(d),
              negated,
              {
                n: n - 1,
                measured: (s) => cut(on, s as string).split(d).length - 1,
                exact: (k) =>
                  k < 0
                    ? undefined
                    : inLanguage(
                        on,
                        countExactly(d, k),
                        (value) => value.split(d).length - 1 === k,
                      ),
              },
            )
        }
      }
      return undefined
    }
    if (
      !ts.isCallExpression(expr) ||
      !ts.isPropertyAccessExpression(expr.expression) ||
      expr.arguments.length !== 1
    )
      return undefined
    const method = expr.expression.name.text
    const receiver = expr.expression.expression
    const argument = expr.arguments[0]
    if (ts.isRegularExpressionLiteral(receiver) && method === 'test') {
      const term = argument ? termOf(argument) : undefined
      if (!term) return undefined
      const end = receiver.text.lastIndexOf('/')
      const pattern = receiver.text.slice(1, end)
      const flags = receiver.text.slice(end + 1)
      const parsed = parseRegex(pattern, flags)
      if ('error' in parsed)
        return {
          problem: `${receiver.text} uses ${parsed.error}, which the regular expression subset does not cover; the subset is: ${regexSubset}`,
        }
      const compiled = new RegExp(pattern, flags)
      return {
        ...atom(
          term,
          regexSmt(parsed),
          (value) => compiled.test(value),
          setsOf(parsed),
        ),
        neighbours: neighbours(parsed).map((near) => {
          const nearby = new RegExp(regexSource(near))
          const accepts = (value: string) => nearby.test(value)
          return {
            smt: inLanguage(term, regexSmt(near), accepts),
            text: `/${regexSource(near)}/`,
            test: (input) => accepts(cut(term, input as string)),
            sets: setsOf(near),
          }
        }),
      }
    }
    const advice = captureAdvice(expr, source)
    if (advice) return { problem: advice }
    const term = termOf(receiver)
    const literal = stringLiteral(argument)
    if (!term || literal === undefined) return undefined
    if (method === 'startsWith')
      return atom(
        term,
        `(re.++ ${text(literal)} ${anything})`,
        (value) => value.startsWith(literal),
        singles(literal),
      )
    if (method === 'endsWith')
      return atom(
        term,
        `(re.++ ${anything} ${text(literal)})`,
        (value) => value.endsWith(literal),
        singles(literal),
      )
    if (method === 'includes')
      return atom(
        term,
        `(re.++ ${anything} ${text(literal)} ${anything})`,
        (value) => value.includes(literal),
        singles(literal),
      )
    return undefined
  }

  const local = (statement: ts.VariableStatement): string | undefined => {
    const decl = statement.declarationList.declarations[0]
    const init = decl?.initializer
    const call =
      statement.declarationList.flags & ts.NodeFlags.Const &&
      statement.declarationList.declarations.length === 1 &&
      decl &&
      ts.isIdentifier(decl.name) &&
      init &&
      ts.isCallExpression(init) &&
      ts.isPropertyAccessExpression(init.expression) &&
      init.expression.name.text === 'slice' &&
      (init.arguments.length === 1 || init.arguments.length === 2)
        ? init
        : undefined
    let advice: string | undefined
    const seek = (node: ts.Node): void => {
      if (advice === undefined && ts.isCallExpression(node))
        advice = captureAdvice(node, source)
      if (advice === undefined) ts.forEachChild(node, seek)
    }
    if (init) seek(init)
    if (advice) return advice
    const base =
      call && ts.isPropertyAccessExpression(call.expression)
        ? termOf(call.expression.expression)
        : undefined
    const first = call?.arguments[0]
    const second = call?.arguments[1]
    const from = first ? numberLiteral(first) : undefined
    const back =
      second === undefined
        ? 0
        : ts.isPrefixUnaryExpression(second) &&
            second.operator === ts.SyntaxKind.MinusToken
          ? numberLiteral(second.operand)
          : undefined
    if (
      !decl ||
      !ts.isIdentifier(decl.name) ||
      !base ||
      from === undefined ||
      from < 0 ||
      !Number.isInteger(from) ||
      back === undefined ||
      !Number.isInteger(back) ||
      (second !== undefined && back < 1)
    )
      return 'a local value must be: const <name> = <input>.slice(<non-negative integer>) or <input>.slice(<non-negative integer>, -<positive integer>)'
    terms.set(decl.name.text, {
      offset: base.offset + from,
      tail: base.tail + back,
    })
    return undefined
  }

  const read = readBranches(fn, source, {
    leaf,
    local,
    ...(allowsUndefined && paramName ? { undefinedGuard: paramName } : {}),
    conditions,
    statements,
  })
  const captures: Problem[] = []
  const seek = (node: ts.Node): void => {
    const advice = ts.isCallExpression(node)
      ? captureAdvice(node, source)
      : undefined
    if (advice) captures.push({ node, rule: advice })
    ts.forEachChild(node, seek)
  }
  if (fn.body) seek(fn.body)
  const told = new Set<string>()
  return {
    classifier: read.classifier,
    problems:
      captures.length === 0
        ? read.problems
        : captures.filter((p) => !told.has(p.rule) && told.add(p.rule)),
  }
}

function* shortStrings(alphabet: readonly string[]): Iterable<string> {
  let length = 0
  let total = 1
  while (total * alphabet.length <= 60_000 && length < 5) {
    total *= alphabet.length
    length++
  }
  let level = ['']
  yield ''
  for (let i = 0; i < length; i++) {
    level = level.flatMap((prefix) => alphabet.map((c) => prefix + c))
    yield* level
  }
}

export async function stringCells(
  code: Classifier,
  spec: Classifier,
  cacheFile: string,
): Promise<Cells<string | null> & { paths: number }> {
  const atoms = atomList(code, spec)
  const alphabet = representatives(
    atoms.flatMap((a) => [
      ...(a.sets ?? []),
      ...(a.neighbours ?? []).flatMap((near) => near.sets),
    ]),
  ).map((c) => String.fromCharCode(c))
  const cells = await solveCells<string>({
    atoms,
    preamble: `(declare-const s String)\n(assert (str.in_re s (re.* (re.union ${alphabet.map((c) => text(c)).join(' ')} ${text('')}))))`,
    cacheFile,
    witness: (model) => String(model.s ?? ''),
    candidates: shortStrings(alphabet),
  })
  const withUndefined =
    code.undefinedOutcome !== undefined || spec.undefinedOutcome !== undefined
  return {
    ...cells,
    probes: withUndefined ? [null, ...cells.probes] : cells.probes,
    paths: pathCount(code),
  }
}

function formulaSmt(f: Formula): string {
  if (f.kind === 'atom') return f.smt
  if (f.kind === 'not') return not(formulaSmt(f.arg))
  return `(${f.kind} ${formulaSmt(f.left)} ${formulaSmt(f.right)})`
}

export const digits = '((_ re.loop 1 15) (re.range "0" "9"))'

export async function acceptsOnly(
  classifier: Classifier,
  language: string,
  cacheFile: string,
): Promise<'yes' | 'unknown' | { readonly accepted: string }> {
  const earlier: string[] = []
  const accepting: string[] = []
  for (const branch of classifier.branches) {
    const condition = branch.condition ? formulaSmt(branch.condition) : 'true'
    if (branch.outcome === 'true')
      accepting.push(`(and ${[condition, ...earlier.map(not)].join(' ')})`)
    earlier.push(condition)
  }
  if (accepting.length === 0) return 'yes'
  const answer = await ask(
    cacheFile,
    `(declare-const s String)\n(assert (or false ${accepting.join(' ')}))\n(assert (not (str.in_re s ${language})))`,
  )
  if (answer.result === 'unknown') return 'unknown'
  return answer.model ? { accepted: String(answer.model.s ?? '') } : 'yes'
}
