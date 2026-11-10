import { appendFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'ts6'
import { type Atom, atomList, holds } from './branches.ts'
import { canonical } from './canonical.ts'
import {
  type Contract,
  type Member,
  holdsFor,
  resultClaim,
} from './contracts.ts'
import type { Obligation, Value } from './inventory.ts'
import { translateNumbers } from './number-classifier.ts'
import {
  type Leaf,
  changedValue,
  refuted,
  returns,
  scopeRefuted,
  throwsWhen,
  unlisted,
} from './ports.ts'
import { type Project, loadProject } from './project.ts'
import { translate } from './string-classifier.ts'
import { probeValue, translateUnknown } from './unknown-classifier.ts'

export type Cell = { readonly cell: string; readonly label: string }
export type Change = {
  readonly unit: string
  readonly cell: string
  readonly to: number
}
type Flip = {
  readonly all?: boolean
  readonly changes?: readonly Change[]
}
type Counted = Exclude<
  Obligation,
  { kind: 'handler' | 'contract' | 'conversion' }
>

let running: Project | undefined
const runningProject = () => {
  running ??= loadProject()
  return running
}
const flip: Flip | undefined = process.env.VERIFIABLE_FLIP
  ? JSON.parse(process.env.VERIFIABLE_FLIP)
  : undefined
const reached = process.env.VERIFIABLE_REACHED

let units: Map<string, Counted> | undefined
function unitNamed(name: string): Counted | undefined {
  if (!units) {
    const all: Obligation[] = JSON.parse(
      readFileSync(runningProject().obligations, 'utf8'),
    ).obligations
    units = new Map(
      all.flatMap((o) =>
        o.kind === 'handler' || o.kind === 'contract' || o.kind === 'conversion'
          ? []
          : [[o.name, o]],
      ),
    )
  }
  return units.get(name)
}

function declared(path: string, name: string) {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.ES2022,
    true,
  )
  const fn = source.statements.find(
    (s): s is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(s) &&
      (s.name?.text === name || s.name?.text === `${name}__counted`),
  )
  if (!fn) throw new Error(`${path} has no function ${name}`)
  return { fn, source }
}

const atomsByUnit = new Map<string, readonly Atom[]>()
function atomsOf(
  o: Extract<Counted, { kind: 'classifier' }>,
  project: Project,
): readonly Atom[] {
  const key = `${project.root}\n${o.name}`
  const known = atomsByUnit.get(key)
  if (known) return known
  const code = declared(join(project.root, o.file), o.name)
  const spec = declared(project.spec(o.name, o.file), 'expected')
  const mayBeMissing = code.fn.parameters.map(
    (p) => p.type?.getText(code.source).includes('undefined') ?? false,
  )
  const read = (d: typeof code) =>
    (o.input === 'string'
      ? translate(d.fn, d.source, mayBeMissing[0] ?? false)
      : o.input === 'numbers'
        ? translateNumbers(d.fn, d.source, mayBeMissing)
        : translateUnknown(d.fn, d.source)
    ).classifier
  const atoms = atomList(read(code), read(spec))
  atomsByUnit.set(key, atoms)
  return atoms
}

export function cellOf(
  o: Counted,
  args: unknown[],
  result: unknown,
  project: Project,
): string {
  if (o.kind === 'decision')
    return canonical(
      o.style === 'record'
        ? o.dimensions.map((d) => (args[0] as Record<string, unknown>)[d.name])
        : args,
    )
  if (o.kind === 'adapter')
    return typeof result === 'string'
      ? result
      : String((result as { kind?: unknown } | undefined)?.kind)
  if (o.kind === 'route') return String(args[0])
  if (o.input === 'number') {
    const x = Number(args[0])
    const within = o.intervals.findIndex(
      ({ min, max }) =>
        (min === null || x >= min) && (max === null || x <= max),
    )
    return `${o.comparisons.map((c) => (holds(c.op, x, c.constant) ? 'T' : 'F')).join('')}|${within}`
  }
  if (o.input === 'string' && args[0] === undefined) return 'undefined'
  const input =
    o.input === 'numbers' ? args.map((x) => x ?? null) : (args[0] as unknown)
  return atomsOf(o, project)
    .map((a) => (a.test(input) ? 'T' : 'F'))
    .join('')
}

export function cellsOf(o: Counted, project: Project): Cell[] {
  const cells = new Map<string, string>()
  const add = (cell: string, label: string) => {
    if (!cells.has(cell)) cells.set(cell, label)
  }
  if (o.kind === 'decision') {
    let combinations: Value[][] = [[]]
    for (const d of o.dimensions)
      combinations = combinations.flatMap((prefix) =>
        d.values.map((v) => [...prefix, v]),
      )
    for (const values of combinations) add(canonical(values), canonical(values))
  } else if (o.kind === 'adapter') {
    for (const v of o.variants) add(v, v)
    if (o.rethrows) add(unnamed, unnamed)
  } else if (o.kind === 'route')
    for (const k of o.keys) add(String(k), String(k))
  else if (o.input === 'number')
    for (const p of o.probes) add(cellOf(o, [p], undefined, project), String(p))
  else if (o.input === 'string')
    for (const p of o.probes)
      add(cellOf(o, [p ?? undefined], undefined, project), JSON.stringify(p))
  else if (o.input === 'numbers')
    for (const p of o.probes)
      add(
        cellOf(
          o,
          p.map((x) => x ?? undefined),
          undefined,
          project,
        ),
        JSON.stringify(p),
      )
  else
    for (const p of o.probes)
      add(cellOf(o, [probeValue(p)], undefined, project), JSON.stringify(p))
  return [...cells].map(([cell, label]) => ({ cell, label }))
}

export const unnamed = 'an error it does not name'
export const outside = '#outside'

export function alternatives(o: Counted, cell: string): number {
  if (o.kind === 'adapter')
    return Math.max(
      1,
      cell === unnamed ? o.variants.length : o.variants.length - 1,
    )
  if (o.kind === 'route') return o.keys.length
  return Math.max(1, o.outcomes.length - 1)
}

export function alternativeLabel(
  o: Counted,
  cell: string,
  outcome: string | undefined,
  to: number,
): string {
  if (o.kind === 'adapter') {
    const others = o.variants.filter((v) => v !== cell)
    return (
      others[to % Math.max(others.length, 1)] ?? 'an outcome outside its type'
    )
  }
  if (o.kind === 'route')
    return to < o.keys.length - 1
      ? `the value of another key`
      : 'a value no key has'
  const others = o.outcomes
    .map((v) => canonical(v))
    .filter((v) => v !== outcome)
  return (
    others[to % Math.max(others.length, 1)] ?? 'an outcome outside its type'
  )
}

function note(unit: string, cell: string, outcome: string) {
  if (reached)
    appendFileSync(reached, `${JSON.stringify([unit, cell, outcome])}\n`)
}

const outsideType = (unit: string, cell: string) => note(outside, unit, cell)

function chosen(unit: string, cell: string): Change | undefined {
  if (!flip) return undefined
  if (flip.all) return { unit, cell, to: 0 }
  return flip.changes?.find((c) => c.unit === unit && c.cell === cell)
}

async function otherVariant(
  o: Extract<Counted, { kind: 'adapter' }>,
  tag: string,
  value: unknown,
  to: number,
): Promise<unknown> {
  const others = o.variants.filter((v) => v !== tag)
  const next = others[to % Math.max(others.length, 1)]
  const asData =
    o.carriesData || (value !== undefined && typeof value !== 'string')
  if (next === undefined) {
    outsideType(o.name, tag)
    return asData ? { kind: '__changed__' } : '__changed__'
  }
  if (!o.carriesData) return next
  if (o.bare.includes(next)) return { kind: next }
  if (!o.asynchronous) {
    outsideType(o.name, tag)
    return { kind: '__changed__' }
  }
  const spec: { expected?: Record<string, unknown> } = await import(
    pathToFileURL(runningProject().spec(o.name, o.file)).href
  )
  if (!spec.expected || !(next in spec.expected))
    throw new Error(`the spec of ${o.name} has no expected result for ${next}`)
  return spec.expected[next]
}

function otherOutcome(
  o: Exclude<Counted, { kind: 'adapter' | 'route' }>,
  value: unknown,
  to: number,
): unknown {
  const others = o.outcomes.filter((v) => canonical(v) !== canonical(value))
  if (others.length === 0) {
    outsideType(o.name, canonical(value))
    return '__changed__'
  }
  return others[to % others.length]
}

export function flipped(
  unit: string,
  original: (...args: unknown[]) => unknown,
  args: unknown[],
): unknown {
  const o =
    (flip || reached) && !shared.unobserved ? unitNamed(unit) : undefined
  if (!o || o.kind === 'route') return original(...args)
  const finish = (value: unknown) => {
    const cell = cellOf(o, args, value, runningProject())
    note(unit, cell, o.kind === 'adapter' ? cell : canonical(value))
    const change = chosen(unit, cell)
    if (!change) return value
    if (o.kind !== 'adapter') return otherOutcome(o, value, change.to)
    if (o.asynchronous) return otherVariant(o, cell, value, change.to)
    const others = o.variants.filter((v) => v !== cell)
    const next = others[change.to % Math.max(others.length, 1)]
    if (next !== undefined && !o.carriesData) return next
    if (next !== undefined && o.bare.includes(next)) return { kind: next }
    outsideType(unit, cell)
    return o.carriesData ? { kind: '__changed__' } : '__changed__'
  }
  const failed = (error: unknown) => {
    if (o.kind !== 'adapter' || !o.rethrows) throw error
    note(unit, unnamed, 'the error, unchanged')
    const change = chosen(unit, unnamed)
    if (!change || flip?.all) throw error
    if (o.asynchronous) return otherVariant(o, unnamed, undefined, change.to)
    const next = o.variants[change.to % o.variants.length]
    if (next !== undefined && !o.carriesData) return next
    if (next !== undefined && o.bare.includes(next)) return { kind: next }
    outsideType(unit, unnamed)
    return { kind: '__changed__' }
  }
  let result: unknown
  try {
    result = original(...args)
  } catch (error) {
    return failed(error)
  }
  return result instanceof Promise
    ? result.then(finish, failed)
    : finish(result)
}

export function flippedMap<M extends Record<string, unknown>>(
  unit: string,
  map: M,
): M {
  if (!flip && !reached) return map
  const keys = Object.keys(map)
  return new Proxy(map, {
    get(target, key, receiver) {
      if (typeof key !== 'string' || !keys.includes(key))
        return Reflect.get(target, key, receiver)
      const current = target[key]
      note(unit, key, canonical(current))
      const change = chosen(unit, key)
      if (!change) return current
      const others = [
        ...new Map(
          keys
            .map((k) => target[k])
            .filter((v) => canonical(v) !== canonical(current))
            .map((v) => [canonical(v), v]),
        ).values(),
      ]
      if (change.to < keys.length - 1 && others.length > 0)
        return others[change.to % others.length]
      const numbers = keys
        .map((k) => target[k])
        .filter((v) => typeof v === 'number')
      if (typeof current === 'number') return Math.max(...numbers) + 1
      if (typeof current === 'string') return `${current} (changed)`
      if (typeof current === 'boolean') return !current
      outsideType(unit, key)
      return { changed: unit }
    },
  })
}

export type PortTable = Record<
  string,
  {
    readonly member: string
    readonly contractFile: string
    readonly excluded: readonly string[]
    readonly options: Record<string, readonly Leaf[]>
  }
>

const portsFile = process.env.VERIFIABLE_PORTS
const missing = Symbol.for('verifiable.clause-not-provoked')
type Shared = {
  ports?: PortTable
  loading?: Promise<void>
  unobserved: boolean
  readonly members: Map<string, Member>
  readonly provoked: Map<string, unknown[]>
}
const globals = globalThis as { [key: symbol]: Shared | undefined }
const sharedKey = Symbol.for('verifiable.ports')
const created: Shared = {
  unobserved: false,
  members: new Map(),
  provoked: new Map(),
}
const shared: Shared = globals[sharedKey] ?? created
globals[sharedKey] = shared
const { members, provoked } = shared

async function loadPorts(file: string): Promise<void> {
  const table: PortTable = JSON.parse(readFileSync(file, 'utf8'))
  for (const [id, site] of Object.entries(table)) {
    const key = `${site.contractFile}\n${site.member}`
    if (!members.has(key)) {
      const loaded: { contract: Contract } = await import(
        pathToFileURL(site.contractFile).href
      )
      const member = loaded.contract.members[site.member]
      if (!member)
        throw new Error(`${site.contractFile} has no member ${site.member}`)
      members.set(key, member)
    }
    const member = members.get(key)
    if (!member || provoked.has(key)) continue
    if (!flip?.changes?.some((change) => change.unit === id)) continue
    const errors: unknown[] = []
    shared.unobserved = true
    for (const thrown of member.throws) {
      try {
        await thrown.provoke()
        errors.push(missing)
      } catch (error) {
        errors.push(error)
      }
    }
    shared.unobserved = false
    provoked.set(key, errors)
  }
  shared.ports = table
}

export function portsReady(): Promise<void> {
  if (!portsFile) return Promise.resolve()
  shared.loading ??= loadPorts(portsFile)
  return shared.loading
}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) return canonical(String(error))
  const code = (error as { code?: unknown }).code
  return `${error.name}${typeof code === 'string' ? ` [${code}]` : ''}: ${error.message.split('\n')[0]?.slice(0, 80)}`
}

export function ported(id: string, call: () => unknown): unknown {
  const site = shared.ports?.[id]
  const key = site ? `${site.contractFile}\n${site.member}` : ''
  const member = members.get(key)
  if (!site || !member) return call()
  const clauses = member.throws.map((thrown) => throwsWhen(thrown.when))
  const raise = (unit: string, cell: string, index: number | undefined) => {
    const error = index === undefined ? missing : provoked.get(key)?.[index]
    if (error !== missing && error !== undefined) return error
    outsideType(unit, cell)
    return new Error('an error the reconciliation made up')
  }
  const returned = (value: unknown) => {
    note(id, returns, returns)
    for (const ensured of member.ensures)
      if (ensured.result && !holdsFor(value, ensured.result))
        note(
          id,
          refuted,
          `it returned a value for which this guarantee does not hold: ${ensured.claim} (${resultClaim(ensured.result)})`,
        )
    const change = flip?.all ? undefined : chosen(id, returns)
    if (!change) return value
    throw raise(id, returns, clauses.length > 0 ? change.to : undefined)
  }
  const threw = (error: unknown): never => {
    shared.unobserved = true
    const matched = member.throws.flatMap((thrown, index) => {
      const raised: unknown = thrown.error
      const isClass =
        raised === Error ||
        (raised as { prototype?: unknown }).prototype instanceof Error
      const fits = isClass
        ? error instanceof (raised as new () => Error)
        : (raised as (error: unknown) => boolean)(error)
      return fits ? [index] : []
    })
    shared.unobserved = false
    if (matched.length === 0) {
      note(id, unlisted, describeError(error))
      throw error
    }
    const cell = matched.map((index) => clauses[index]).join(' / ')
    note(id, cell, cell)
    for (const index of matched) {
      const when = member.throws[index]?.when ?? ''
      if (site.excluded.includes(when))
        note(
          id,
          scopeRefuted,
          `it threw ${describeError(error)} (${when}), which the contract rules out for this call by the type of an argument`,
        )
    }
    const change = flip?.all ? undefined : chosen(id, cell)
    if (!change) throw error
    const others = clauses
      .map((_clause, index) => index)
      .filter((index) => !matched.includes(index))
    throw raise(id, cell, others[change.to])
  }
  let result: unknown
  try {
    result = call()
  } catch (error) {
    return threw(error)
  }
  return result instanceof Promise
    ? result.then(returned, threw)
    : returned(result)
}

export function options(id: string, unit: string, value: unknown): unknown {
  const leaves = shared.ports?.[id]?.options[unit]
  if (!leaves) return value
  let out = value
  for (const leaf of leaves) {
    const cell = leaf.keys.join('.')
    note(unit, cell, leaf.text)
    const change = flip?.all ? undefined : chosen(unit, cell)
    if (!change) continue
    const rewrite = (holder: unknown, keys: readonly string[]): unknown => {
      const [key, ...rest] = keys
      if (key === undefined || typeof holder !== 'object' || holder === null)
        return holder
      if (Array.isArray(holder)) {
        const list = [...holder]
        const at = Number(key)
        if (rest.length > 0) list[at] = rewrite(list[at], rest)
        else if (change.to === 0 || leaf.value === null) list.splice(at, 1)
        else list[at] = changedValue(leaf.value, change.to)
        return list
      }
      const copy: Record<string, unknown> = { ...holder }
      if (rest.length > 0) copy[key] = rewrite(copy[key], rest)
      else if (change.to === 0 || leaf.value === null) delete copy[key]
      else copy[key] = changedValue(leaf.value, change.to)
      return copy
    }
    out = rewrite(out, leaf.keys)
  }
  return out
}
