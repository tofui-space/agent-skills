export type CharSet = ReadonlyArray<readonly [number, number]>
export type RegexNode =
  | {
      readonly kind: 'set'
      readonly set: CharSet
      readonly bracket?: {
        readonly negated: boolean
        readonly ignoreCase: boolean
        readonly items: ReadonlyArray<readonly [number, number]>
      }
    }
  | { readonly kind: 'seq'; readonly items: readonly RegexNode[] }
  | { readonly kind: 'alt'; readonly options: readonly RegexNode[] }
  | {
      readonly kind: 'repeat'
      readonly item: RegexNode
      readonly min: number
      readonly max: number | undefined
    }
  | {
      readonly kind: 'look'
      readonly ahead: boolean
      readonly negative: boolean
      readonly alternatives: readonly Alternative[]
    }
  | { readonly kind: 'boundary'; readonly negated: boolean }
export type Alternative = {
  readonly fromStart: boolean
  readonly toEnd: boolean
  readonly body: RegexNode
}
export type CaptureSlice = { readonly offset: number; readonly tail: number }
export type ParsedRegex = {
  readonly alternatives: readonly Alternative[]
  readonly captures?: readonly CaptureSlice[]
}

export const regexSubset =
  'literal characters, ., \\d \\w \\s and their negations, [classes] with ranges, groups, |, the quantifiers ? * + {n} {n,} {n,m}, ^ at the start and $ at the end of the pattern, lookahead and lookbehind and \\b outside groups, and the flags i and s'

const top = 0xffff

function normalize(ranges: Array<readonly [number, number]>): CharSet {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  const out: Array<[number, number]> = []
  for (const [lo, hi] of sorted) {
    const last = out.at(-1)
    if (last && lo <= last[1] + 1) last[1] = Math.max(last[1], hi)
    else out.push([lo, hi])
  }
  return out
}

function complement(set: CharSet): CharSet {
  const out: Array<[number, number]> = []
  let next = 0
  for (const [lo, hi] of set) {
    if (lo > next) out.push([next, lo - 1])
    next = hi + 1
  }
  if (next <= top) out.push([next, top])
  return out
}

const digits: CharSet = [[0x30, 0x39]]
const word: CharSet = normalize([
  [0x30, 0x39],
  [0x41, 0x5a],
  [0x5f, 0x5f],
  [0x61, 0x7a],
])
const space: CharSet = normalize([
  [0x09, 0x0d],
  [0x20, 0x20],
  [0xa0, 0xa0],
  [0x1680, 0x1680],
  [0x2000, 0x200a],
  [0x2028, 0x2029],
  [0x202f, 0x202f],
  [0x205f, 0x205f],
  [0x3000, 0x3000],
  [0xfeff, 0xfeff],
])
const lineTerminators: CharSet = normalize([
  [0x0a, 0x0a],
  [0x0d, 0x0d],
  [0x2028, 0x2029],
])
const classEscapes: Record<string, CharSet> = {
  d: digits,
  D: complement(digits),
  w: word,
  W: complement(word),
  s: space,
  S: complement(space),
}
const controlEscapes: Record<string, number> = {
  n: 0x0a,
  r: 0x0d,
  t: 0x09,
  f: 0x0c,
  v: 0x0b,
}
const syntaxCharacters = new Set([...'^$\\.*+?()[]{}|/-'])

class Unsupported extends Error {}

function intersect(a: CharSet, b: CharSet): CharSet {
  return complement(normalize([...complement(a), ...complement(b)]))
}

const maxBoundaries = 4

function isLook(
  node: RegexNode | undefined,
  ahead: boolean,
): node is Extract<RegexNode, { kind: 'look' }> {
  return node?.kind === 'look' && node.ahead === ahead
}

function widthOf(node: RegexNode): number | undefined {
  if (node.kind === 'set') return 1
  if (node.kind === 'look' || node.kind === 'boundary') return 0
  if (node.kind === 'repeat') {
    const inner = widthOf(node.item)
    return inner !== undefined && node.min === node.max
      ? inner * node.min
      : undefined
  }
  const widths = (node.kind === 'seq' ? node.items : node.options).map(widthOf)
  if (widths.some((w) => w === undefined)) return undefined
  if (node.kind === 'seq')
    return widths.reduce<number>((n, w) => n + (w ?? 0), 0)
  return widths.every((w) => w === widths[0]) ? widths[0] : undefined
}

function withBoundaries(alternative: Alternative): Alternative[] {
  if (alternative.body.kind !== 'seq') return [alternative]
  const wordSet: RegexNode = { kind: 'set', set: word }
  const look = (ahead: boolean, negative: boolean): RegexNode => ({
    kind: 'look',
    ahead,
    negative,
    alternatives: [
      {
        fromStart: false,
        toEnd: false,
        body: { kind: 'seq', items: [wordSet] },
      },
    ],
  })
  let variants: RegexNode[][] = [[]]
  for (const item of alternative.body.items) {
    if (item.kind !== 'boundary') {
      variants = variants.map((items) => [...items, item])
      continue
    }
    variants = variants.flatMap((items) =>
      [true, false].map((wordBefore) => [
        ...items,
        look(false, !wordBefore),
        look(true, item.negated ? !wordBefore : wordBefore),
      ]),
    )
  }
  return variants.map((items) => ({
    ...alternative,
    body: { kind: 'seq', items },
  }))
}

function resolved(alternative: Alternative): Alternative {
  if (alternative.body.kind !== 'seq') return alternative
  const items: RegexNode[] = []
  for (const item of alternative.body.items) {
    const only = isLook(item, false) ? item.alternatives[0] : undefined
    const inner =
      only && !only.fromStart && !only.toEnd && only.body.kind === 'seq'
        ? only.body.items
        : []
    const tested = inner.length === 1 ? inner[0] : undefined
    const previous = items.at(-1)
    if (
      !isLook(item, false) ||
      item.alternatives.length !== 1 ||
      tested?.kind !== 'set'
    ) {
      items.push(item)
      continue
    }
    const allowed = item.negative ? complement(tested.set) : tested.set
    if (previous?.kind === 'set') {
      items[items.length - 1] = {
        kind: 'set',
        set: intersect(previous.set, allowed),
      }
      continue
    }
    if (
      previous?.kind === 'repeat' &&
      previous.item.kind === 'set' &&
      previous.min >= 1
    ) {
      items[items.length - 1] = {
        ...previous,
        min: previous.min - 1,
        max: previous.max === undefined ? undefined : previous.max - 1,
      }
      items.push({ kind: 'set', set: intersect(previous.item.set, allowed) })
      continue
    }
    items.push(item)
  }
  const firstAhead = items.findIndex((item) => isLook(item, true))
  const lastBehind = items.findLastIndex((item) => isLook(item, false))
  if (firstAhead !== -1 && lastBehind > firstAhead)
    throw new Unsupported(
      'a lookbehind or word boundary after a lookahead or word boundary, where the item just before it is not one character class, alone or repeated at least once',
    )
  return { ...alternative, body: { kind: 'seq', items } }
}

let caseTable: { canonical: number[]; members: Map<number, number[]> }

function eitherCase(set: CharSet): CharSet {
  if (!caseTable) {
    const canonical = Array.from({ length: top + 1 }, (_, code) => {
      const upper = String.fromCharCode(code).toUpperCase()
      const folded = upper.length === 1 ? upper.charCodeAt(0) : code
      return code >= 128 && folded < 128 ? code : folded
    })
    const members = new Map<number, number[]>()
    canonical.forEach((to, code) => {
      members.set(to, [...(members.get(to) ?? []), code])
    })
    caseTable = { canonical, members }
  }
  const reached = new Set<number>()
  for (const [lo, hi] of set)
    for (let code = lo; code <= hi; code++)
      reached.add(caseTable.canonical[code] ?? code)
  return normalize(
    [...reached].flatMap((to) =>
      (caseTable.members.get(to) ?? []).map((code) => [code, code] as const),
    ),
  )
}

function bracketNode(
  negated: boolean,
  ignoreCase: boolean,
  items: ReadonlyArray<readonly [number, number]>,
): RegexNode {
  const written = normalize([...items])
  const positive = ignoreCase ? eitherCase(written) : written
  return {
    kind: 'set',
    set: negated ? complement(positive) : positive,
    bracket: { negated, ignoreCase, items },
  }
}

export function parseRegex(
  pattern: string,
  flags: string,
): ParsedRegex | { readonly error: string } {
  let at = 0
  let depth = 0
  const captured = new Set<RegexNode>()
  const peek = () => pattern[at]
  const fail = (what: string): never => {
    throw new Unsupported(what)
  }
  const ignoreCase = flags.includes('i')
  const cased = (set: CharSet): RegexNode => ({
    kind: 'set',
    set: ignoreCase ? eitherCase(set) : set,
  })
  const single = (code: number): RegexNode => cased([[code, code]])
  const hex = (length: number): number => {
    const text = pattern.slice(at, at + length)
    if (!new RegExp(`^[0-9a-fA-F]{${length}}$`).test(text))
      fail('an incomplete hexadecimal escape')
    at += length
    return Number.parseInt(text, 16)
  }
  const escaped = (inClass: boolean): CharSet => {
    const ch = pattern[at++]
    if (ch === undefined) return fail('a trailing backslash')
    const named = classEscapes[ch]
    if (named) return named
    const control = controlEscapes[ch]
    if (control !== undefined) return [[control, control]]
    if (ch === '0' && !/[0-9]/.test(peek() ?? '')) return [[0, 0]]
    if (ch === 'x') {
      const code = hex(2)
      return [[code, code]]
    }
    if (ch === 'u') {
      const code = hex(4)
      return [[code, code]]
    }
    if (ch === 'b' && inClass) return [[8, 8]]
    if (/[1-9]/.test(ch) || ch === 'k')
      return fail('a backreference, which no regular language can express')
    if (ch === 'p' || ch === 'P') return fail('a Unicode property escape')
    if (syntaxCharacters.has(ch)) {
      const code = ch.charCodeAt(0)
      return [[code, code]]
    }
    return fail(`the escape \\${ch}`)
  }
  const bracket = (): RegexNode => {
    const negated = peek() === '^'
    if (negated) at++
    const ranges: Array<readonly [number, number]> = []
    const item = (): CharSet => {
      const ch = pattern[at++]
      if (ch === undefined) return fail('an unclosed character class')
      if (ch === '\\') return escaped(true)
      const code = ch.charCodeAt(0)
      return [[code, code]]
    }
    while (peek() !== ']') {
      if (peek() === undefined) fail('an unclosed character class')
      const first = item()
      if (peek() === '-' && pattern[at + 1] !== ']') {
        at++
        const second = item()
        const lo = first[0]
        const hi = second[0]
        if (
          first.length !== 1 ||
          second.length !== 1 ||
          !lo ||
          !hi ||
          lo[0] !== lo[1] ||
          hi[0] !== hi[1] ||
          lo[0] > hi[0]
        )
          return fail('a character range whose ends are not single characters')
        ranges.push([lo[0], hi[0]])
      } else ranges.push(...first)
    }
    at++
    return bracketNode(negated, ignoreCase, ranges)
  }
  const quantified = (item: RegexNode): RegexNode => {
    const ch = peek()
    let min: number
    let max: number | undefined
    if (ch === '*') {
      min = 0
      at++
    } else if (ch === '+') {
      min = 1
      at++
    } else if (ch === '?') {
      min = 0
      max = 1
      at++
    } else if (ch === '{') {
      const match = /^\{(\d+)(,(\d*))?\}/.exec(pattern.slice(at))
      if (!match) return fail('a { that is not a quantifier')
      min = Number(match[1])
      max =
        match[2] === undefined
          ? min
          : match[3] === ''
            ? undefined
            : Number(match[3])
      if (max !== undefined && max < min)
        return fail('a quantifier whose maximum is below its minimum')
      at += match[0].length
    } else return item
    if (peek() === '?') at++
    if (peek() === '*' || peek() === '+' || peek() === '{')
      return fail('a quantifier applied to a quantifier')
    if (item.kind === 'look' || item.kind === 'boundary')
      return fail('a quantifier applied to a lookaround or word boundary')
    return { kind: 'repeat', item, min, max }
  }
  const atom = (): RegexNode => {
    const ch = pattern[at++]
    if (ch === '(') {
      const opener = /^\?(<?[=!])/.exec(pattern.slice(at))
      if (opener) {
        if (depth > 0)
          return fail('a lookaround inside a group or another lookaround')
        at += opener[0].length
        const ahead = !opener[1]?.startsWith('<')
        depth++
        const alternatives = alternation(ahead ? 'ahead' : 'behind')
        depth--
        if (pattern[at++] !== ')') return fail('an unclosed lookaround')
        return {
          kind: 'look',
          ahead,
          negative: opener[1]?.endsWith('!') ?? false,
          alternatives,
        }
      }
      const name = /^\?<[A-Za-z_$][\w$]*>/.exec(pattern.slice(at))
      const capturing = peek() !== '?' || name !== null
      if (name) at += name[0].length
      else if (peek() === '?') {
        if (pattern[at + 1] !== ':') return fail('an unknown group type')
        at += 2
      }
      depth++
      const inner = alternation('inner')
      depth--
      if (pattern[at++] !== ')') return fail('an unclosed group')
      if (capturing) captured.add(inner)
      return inner
    }
    if (ch === '[') return bracket()
    if (ch === '.')
      return {
        kind: 'set',
        set: flags.includes('s') ? [[0, top]] : complement(lineTerminators),
      }
    if (ch === '\\' && (peek() === 'b' || peek() === 'B')) {
      if (depth > 0) return fail('a word boundary inside a group')
      return { kind: 'boundary', negated: pattern[at++] === 'B' }
    }
    if (ch === '\\') return cased(escaped(false))
    if (ch === '^' || ch === '$')
      return fail(`${ch} somewhere other than the start or end of the pattern`)
    if (ch === undefined || '*+?{}])'.includes(ch))
      return fail(`an unexpected ${ch ?? 'end of pattern'}`)
    return single(ch.charCodeAt(0))
  }
  type Place = 'outer' | 'inner' | 'ahead' | 'behind'
  const sequence = (
    place: Place,
  ): { node: RegexNode; fromStart: boolean; toEnd: boolean } => {
    const items: RegexNode[] = []
    let fromStart = false
    let toEnd = false
    if ((place === 'outer' || place === 'behind') && peek() === '^') {
      fromStart = true
      at++
    }
    while (peek() !== undefined && peek() !== '|' && peek() !== ')') {
      const after = pattern[at + 1]
      if (
        peek() === '$' &&
        ((place === 'outer' && (after === undefined || after === '|')) ||
          (place === 'ahead' && (after === ')' || after === '|')))
      ) {
        toEnd = true
        at++
        break
      }
      items.push(quantified(atom()))
    }
    return { node: { kind: 'seq', items }, fromStart, toEnd }
  }
  function alternation(place: 'inner'): RegexNode
  function alternation(place: 'outer' | 'ahead' | 'behind'): Alternative[]
  function alternation(place: Place): RegexNode | Alternative[] {
    const parts = [sequence(place)]
    while (peek() === '|') {
      at++
      parts.push(sequence(place))
    }
    if (place !== 'inner')
      return parts.map((p) => ({
        fromStart: p.fromStart,
        toEnd: p.toEnd,
        body: p.node,
      }))
    return { kind: 'alt', options: parts.map((p) => p.node) }
  }
  const slices = (
    alternatives: readonly Alternative[],
  ): CaptureSlice[] | undefined => {
    const only = alternatives[0]
    if (
      alternatives.length !== 1 ||
      !only ||
      !only.fromStart ||
      !only.toEnd ||
      only.body.kind !== 'seq'
    )
      return undefined
    const items = only.body.items
    const groups = items.flatMap((item, index) =>
      captured.has(item) ? [index] : [],
    )
    if (groups.length === 0 || groups.length !== captured.size) return undefined
    const widths = items.map(widthOf)
    const total = (from: number, to: number) => {
      const part = widths.slice(from, to)
      return part.some((w) => w === undefined)
        ? undefined
        : part.reduce<number>((n, w) => n + (w ?? 0), 0)
    }
    const found = groups.map((index) => ({
      offset: total(0, index),
      tail: total(index + 1, items.length),
    }))
    return found.every(
      (f): f is CaptureSlice => f.offset !== undefined && f.tail !== undefined,
    )
      ? found
      : undefined
  }

  const unsupported = [...flags].find((flag) => flag !== 'i' && flag !== 's')
  if (unsupported) return { error: `the flag ${unsupported}` }
  try {
    const written = alternation('outer')
    if (at < pattern.length) fail(`an unexpected ${peek()}`)
    const boundaries = written.map(
      (a) =>
        (a.body.kind === 'seq' ? a.body.items : []).filter(
          (item) => item.kind === 'boundary',
        ).length,
    )
    if (boundaries.some((count) => count > maxBoundaries))
      fail(`more than ${maxBoundaries} word boundaries in one alternative`)
    const looks = written.some(
      (a) =>
        a.body.kind === 'seq' &&
        a.body.items.some(
          (item) => item.kind === 'look' || item.kind === 'boundary',
        ),
    )
    const captures = looks ? undefined : slices(written)
    return {
      alternatives: written.flatMap(withBoundaries).map(resolved),
      ...(captures ? { captures } : {}),
    }
  } catch (error) {
    if (error instanceof Unsupported) return { error: error.message }
    throw error
  }
}

function smtChar(code: number): string {
  if (code === 0x22) return '""""'
  if (code >= 0x20 && code < 0x7f && code !== 0x5c)
    return `"${String.fromCharCode(code)}"`
  return `"\\u{${code.toString(16)}}"`
}

function setSmt(set: CharSet): string {
  const parts = set.map(([lo, hi]) =>
    lo === hi
      ? `(str.to_re ${smtChar(lo)})`
      : `(re.range ${smtChar(lo)} ${smtChar(hi)})`,
  )
  if (parts.length === 0) return 're.none'
  return parts.length === 1 ? (parts[0] ?? '') : `(re.union ${parts.join(' ')})`
}

const everything = '(re.* re.allchar)'

function joined(parts: string[]): string {
  if (parts.length === 0) return '(str.to_re "")'
  return parts.length === 1 ? (parts[0] ?? '') : `(re.++ ${parts.join(' ')})`
}

function lookSmt(look: Extract<RegexNode, { kind: 'look' }>): string {
  const languages = look.alternatives.map((a) =>
    joined(
      look.ahead
        ? [nodeSmt(a.body), ...(a.toEnd ? [] : [everything])]
        : [...(a.fromStart ? [] : [everything]), nodeSmt(a.body)],
    ),
  )
  const language =
    languages.length === 1
      ? (languages[0] ?? '')
      : `(re.union ${languages.join(' ')})`
  return look.negative ? `(re.comp ${language})` : language
}

function nodeSmt(node: RegexNode): string {
  if (node.kind === 'look' || node.kind === 'boundary')
    throw new Error('a lookaround is translated with the sequence around it')
  if (node.kind === 'set') return setSmt(node.set)
  if (node.kind === 'seq') {
    const parts = node.items.map(nodeSmt)
    if (parts.length === 0) return '(str.to_re "")'
    return parts.length === 1 ? (parts[0] ?? '') : `(re.++ ${parts.join(' ')})`
  }
  if (node.kind === 'alt') {
    const parts = node.options.map(nodeSmt)
    return parts.length === 1
      ? (parts[0] ?? '')
      : `(re.union ${parts.join(' ')})`
  }
  const item = nodeSmt(node.item)
  if (node.max === undefined)
    return node.min === 0
      ? `(re.* ${item})`
      : `(re.++ ((_ re.loop ${node.min} ${node.min}) ${item}) (re.* ${item}))`
  return `((_ re.loop ${node.min} ${node.max}) ${item})`
}

function withLooks(a: Alternative, items: readonly RegexNode[]): string {
  const lastBehind = items.findLastIndex((item) => isLook(item, false))
  let left = a.fromStart ? '(str.to_re "")' : everything
  for (const item of items.slice(0, lastBehind + 1))
    left =
      item.kind === 'look'
        ? `(re.inter ${left} ${lookSmt(item)})`
        : `(re.++ ${left} ${nodeSmt(item)})`
  let rest = a.toEnd ? '(str.to_re "")' : everything
  for (const item of items.slice(lastBehind + 1).reverse())
    rest =
      item.kind === 'look'
        ? `(re.inter ${rest} ${lookSmt(item)})`
        : `(re.++ ${nodeSmt(item)} ${rest})`
  return `(re.++ ${left} ${rest})`
}

export function regexSmt(parsed: ParsedRegex): string {
  const anything = everything
  const parts = parsed.alternatives.map((a) => {
    if (
      a.body.kind === 'seq' &&
      a.body.items.some((item) => item.kind === 'look')
    )
      return withLooks(a, a.body.items)
    const pieces = [
      ...(a.fromStart ? [] : [anything]),
      nodeSmt(a.body),
      ...(a.toEnd ? [] : [anything]),
    ]
    return pieces.length === 1
      ? (pieces[0] ?? '')
      : `(re.++ ${pieces.join(' ')})`
  })
  return parts.length === 1 ? (parts[0] ?? '') : `(re.union ${parts.join(' ')})`
}

const preferred = [
  ...'xyzqjkw0123456789',
  ...Array.from({ length: 0x7f - 0x21 }, (_, i) =>
    String.fromCharCode(0x21 + i),
  ),
].map((c) => c.charCodeAt(0))

export function representatives(sets: readonly CharSet[]): number[] {
  const cuts = new Set<number>([0, top + 1])
  for (const set of sets)
    for (const [lo, hi] of set) {
      cuts.add(lo)
      cuts.add(hi + 1)
    }
  const points = [...cuts].sort((a, b) => a - b)
  const contains = (set: CharSet, code: number) =>
    set.some(([lo, hi]) => code >= lo && code <= hi)
  const signature = (code: number) =>
    sets.map((set) => (contains(set, code) ? '1' : '0')).join('')
  const regions = new Map<string, Array<readonly [number, number]>>()
  for (let i = 0; i + 1 < points.length; i++) {
    const lo = points[i] ?? 0
    const hi = (points[i + 1] ?? 0) - 1
    const key = signature(lo)
    regions.set(key, [...(regions.get(key) ?? []), [lo, hi]])
  }
  return [...regions.values()].map((region) => {
    const inRegion = (code: number) => contains(region, code)
    return preferred.find(inRegion) ?? region[0]?.[0] ?? 0
  })
}

function nodesOf(node: RegexNode): RegexNode[] {
  if (node.kind === 'set' || node.kind === 'boundary') return [node]
  if (node.kind === 'repeat') return [node, ...nodesOf(node.item)]
  if (node.kind === 'look')
    return [node, ...node.alternatives.flatMap((a) => nodesOf(a.body))]
  return [
    node,
    ...(node.kind === 'seq' ? node.items : node.options).flatMap(nodesOf),
  ]
}

export function setsOf(parsed: ParsedRegex): CharSet[] {
  return parsed.alternatives
    .flatMap((a) => nodesOf(a.body))
    .flatMap((node) => (node.kind === 'set' ? [node.set] : []))
}

function replaced(
  node: RegexNode,
  target: RegexNode,
  by: RegexNode,
): RegexNode {
  if (node === target) return by
  if (node.kind === 'set' || node.kind === 'boundary') return node
  if (node.kind === 'repeat')
    return { ...node, item: replaced(node.item, target, by) }
  if (node.kind === 'look')
    return {
      ...node,
      alternatives: node.alternatives.map((a) => ({
        ...a,
        body: replaced(a.body, target, by),
      })),
    }
  if (node.kind === 'seq')
    return { ...node, items: node.items.map((n) => replaced(n, target, by)) }
  return { ...node, options: node.options.map((n) => replaced(n, target, by)) }
}

export function neighbours(parsed: ParsedRegex): ParsedRegex[] {
  const out: ParsedRegex[] = []
  const withAlternative = (index: number, change: Partial<Alternative>) =>
    out.push({
      alternatives: parsed.alternatives.map((a, i) =>
        i === index ? { ...a, ...change } : a,
      ),
    })
  parsed.alternatives.forEach((alternative, index) => {
    if (alternative.fromStart) withAlternative(index, { fromStart: false })
    if (alternative.toEnd) withAlternative(index, { toEnd: false })
    const swap = (target: RegexNode, by: RegexNode) =>
      withAlternative(index, { body: replaced(alternative.body, target, by) })
    for (const node of nodesOf(alternative.body)) {
      if (node.kind === 'repeat') {
        const { min, max } = node
        if (min > 0) swap(node, { ...node, min: min - 1 })
        if (max === undefined || min + 1 <= max)
          swap(node, { ...node, min: min + 1 })
        if (max !== undefined) swap(node, { ...node, max: max + 1 })
        if (max !== undefined && max - 1 >= min)
          swap(node, { ...node, max: max - 1 })
      }
      if (node.kind === 'set' && node.bracket) {
        const { negated, ignoreCase, items } = node.bracket
        items.forEach(([lo, hi], j) => {
          if (lo === hi) return
          const variants: Array<readonly [number, number]> = [
            [lo + 1, hi],
            [lo, hi - 1],
            ...(lo > 0 ? [[lo - 1, hi] as const] : []),
            ...(hi < top ? [[lo, hi + 1] as const] : []),
          ]
          for (const variant of variants)
            swap(
              node,
              bracketNode(
                negated,
                ignoreCase,
                items.map((item, k) => (k === j ? variant : item)),
              ),
            )
        })
      }
    }
  })
  return out
}

const unit = (code: number) => `\\u${code.toString(16).padStart(4, '0')}`

function nodeSource(node: RegexNode): string {
  if (node.kind === 'set')
    return `[${node.set.map(([lo, hi]) => (lo === hi ? unit(lo) : `${unit(lo)}-${unit(hi)}`)).join('')}]`
  if (node.kind === 'seq') return node.items.map(nodeSource).join('')
  if (node.kind === 'alt')
    return `(?:${node.options.map(nodeSource).join('|')})`
  if (node.kind === 'boundary') return node.negated ? '\\B' : '\\b'
  if (node.kind === 'look')
    return `(?${node.ahead ? '' : '<'}${node.negative ? '!' : '='}${alternativesSource(node.alternatives)})`
  return `(?:${nodeSource(node.item)}){${node.min},${node.max ?? ''}}`
}

function alternativesSource(alternatives: readonly Alternative[]): string {
  return alternatives
    .map(
      (a) =>
        `${a.fromStart ? '^' : ''}${nodeSource(a.body)}${a.toEnd ? '$' : ''}`,
    )
    .join('|')
}

export function regexSource(parsed: ParsedRegex): string {
  return alternativesSource(parsed.alternatives)
}
