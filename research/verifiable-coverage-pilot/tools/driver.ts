import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Session } from 'node:inspector/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'ts6'
import { canonical } from './canonical.ts'
import { type Contract, clauses, holdsFor, resultClaim } from './contracts.ts'
import type { Dimension, Obligation, Value } from './inventory.ts'
import { sameNumber } from './conversion.ts'
import { type Project, loadProject, rootFrom } from './project.ts'
import { probeValue } from './unknown-classifier.ts'

let project: Project = loadProject(rootFrom([]))
let profiler: Session | undefined

function ownReturns(running: string): number[] {
  const source = ts.createSourceFile(
    'running.js',
    running,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.JS,
  )
  const root = source.statements[0]
  const found: number[] = []
  const look = (node: ts.Node): void => {
    if (node !== root && ts.isFunctionLike(node)) return
    if (ts.isReturnStatement(node)) found.push(node.getStart(source))
    ts.forEachChild(node, look)
  }
  if (root) look(root)
  return found
}

async function returnsTaken(
  o: Extract<Obligation, { kind: 'handler' }>,
  handler: unknown,
): Promise<boolean[] | string> {
  if (!profiler) return 'this process has no V8 inspector'
  const running = Function.prototype.toString.call(handler)
  const returns = ownReturns(running)
  const { result } = await profiler.post('Profiler.takePreciseCoverage')
  const candidates = result.flatMap((script) =>
    script.functions
      .filter((fn) => {
        const whole = fn.ranges[0]
        return (
          fn.functionName === o.name &&
          whole !== undefined &&
          whole.endOffset - whole.startOffset === running.length
        )
      })
      .map((fn) => ({ url: script.url, ranges: fn.ranges })),
  )
  const inFile = candidates.filter((c) => c.url.endsWith(o.file))
  const found = inFile.length > 0 ? inFile : candidates
  if (found.length === 0)
    return `V8 reports no function ${o.name} of ${running.length} characters`
  if (
    returns.length !== o.guards.length &&
    returns.length !== o.guards.length + 1
  )
    return `the running code of ${o.name} has ${returns.length} return statements for ${o.guards.length} guards`
  return o.guards.map((_guard, index) =>
    found.some(({ ranges }) => {
      const at = (ranges[0]?.startOffset ?? 0) + (returns[index] ?? 0)
      return (
        ranges.some((r) => r.count > 0) &&
        !ranges.some(
          (r) => r.count === 0 && at >= r.startOffset && at < r.endOffset,
        )
      )
    }),
  )
}

type Module = Record<string, unknown>
type Row = { input: unknown; outcome: unknown }

function product(dimensions: Dimension[]): Value[][] {
  return dimensions.reduce<Value[][]>(
    (acc, d) => acc.flatMap((prefix) => d.values.map((v) => [...prefix, v])),
    [[]],
  )
}

function keyOf(dimensions: Dimension[], style: string, input: unknown): string {
  const values =
    style === 'record'
      ? dimensions.map((d) => (input as Record<string, unknown>)[d.name])
      : (input as unknown[])
  return canonical(values)
}

async function checkDecision(
  o: Extract<Obligation, { kind: 'decision' }>,
  mod: Module,
  spec: Module,
): Promise<number> {
  const fn = mod[o.name] as (...args: unknown[]) => unknown
  const rows = new Map<string, unknown>()
  for (const row of spec.rows as Row[]) {
    const key = keyOf(o.dimensions, o.style, row.input)
    assert.ok(!rows.has(key), `spec lists ${key} twice`)
    rows.set(key, row.outcome)
  }
  if (spec.otherwise !== undefined) {
    const domain = Object.fromEntries(
      o.dimensions.map((d) => [d.name, d.values.map(canonical).sort()]),
    )
    const reviewed = Object.fromEntries(
      Object.entries(spec.reviewedDomain as Record<string, unknown[]>).map(
        ([name, values]) => [name, values.map(canonical).sort()],
      ),
    )
    assert.deepEqual(
      domain,
      reviewed,
      'the domain changed since the default outcome was reviewed',
    )
  }
  const failures: string[] = []
  const seen = new Set<string>()
  const combinations = product(o.dimensions)
  for (const values of combinations) {
    const key = canonical(values)
    seen.add(key)
    const expected = rows.has(key) ? rows.get(key) : spec.otherwise
    if (expected === undefined) {
      failures.push(`spec has no outcome for ${key}`)
      continue
    }
    const args =
      o.style === 'record'
        ? [Object.fromEntries(o.dimensions.map((d, i) => [d.name, values[i]]))]
        : values
    const actual = fn(...args)
    if (canonical(actual) !== canonical(expected))
      failures.push(
        `${key}: expected ${canonical(expected)}, got ${canonical(actual)}`,
      )
  }
  for (const key of rows.keys())
    if (!seen.has(key)) failures.push(`spec row ${key} is outside the domain`)
  assert.deepEqual(failures, [])
  return combinations.length
}

async function checkClassifier(
  o: Extract<Obligation, { kind: 'classifier' }>,
  mod: Module,
  spec: Module,
): Promise<number> {
  const failures: string[] = []
  if (o.input === 'string') {
    const fn = mod[o.name] as (x: string | undefined) => unknown
    const expected = spec.expected as (x: string | undefined) => unknown
    for (const probe of o.probes) {
      const x = probe ?? undefined
      const want = expected(x)
      const actual = fn(x)
      if (actual !== want)
        failures.push(
          `${JSON.stringify(probe)}: expected ${String(want)}, got ${String(actual)}`,
        )
    }
    assert.deepEqual(failures, [])
    return o.probes.length
  }
  if (o.input === 'numbers' || o.input === 'unknown') {
    const fn = mod[o.name] as (...args: unknown[]) => unknown
    const expected = spec.expected as (...args: unknown[]) => unknown
    const inputs: Array<[unknown, unknown[]]> =
      o.input === 'numbers'
        ? o.probes.map((probe) => [probe, probe.map((x) => x ?? undefined)])
        : o.probes.map((probe) => [probe, [probeValue(probe)]])
    for (const [probe, args] of inputs) {
      const want = expected(...args)
      const actual = fn(...args)
      if (actual !== want)
        failures.push(
          `${JSON.stringify(probe)}: expected ${String(want)}, got ${String(actual)}`,
        )
    }
    assert.deepEqual(failures, [])
    return o.probes.length
  }
  const fn = mod[o.name] as (x: number) => unknown
  const intervals = spec.intervals as Array<{
    min: number
    max: number
    outcome: unknown
  }>
  for (const x of o.probes) {
    const expected = intervals.find(
      ({ min, max }) => x >= min && x <= max,
    )?.outcome
    const actual = fn(x)
    if (actual !== expected)
      failures.push(`${x}: expected ${String(expected)}, got ${String(actual)}`)
  }
  assert.deepEqual(failures, [])
  return o.probes.length
}

async function checkAdapter(
  o: Extract<Obligation, { kind: 'adapter' }>,
  mod: Module,
  spec: Module,
): Promise<number> {
  const fn = mod[o.name] as (
    db: unknown,
    ...args: unknown[]
  ) => Promise<unknown>
  type Fake = (failure: () => Error | undefined) => {
    db: unknown
    calls: unknown[]
  }
  const fake = spec.fake as Fake | undefined
  assert.ok(
    fake,
    `${project.path(project.spec(o.name, o.file))} must export fake(failure) returning { db, calls } for this adapter's port`,
  )
  const provoke = spec.provoke as Record<string, () => Error | undefined>
  const args = spec.args as unknown[]
  const expected = spec.expected as Record<string, unknown> | undefined
  if (o.carriesData)
    assert.ok(
      expected,
      `${project.path(project.spec(o.name, o.file))} must export expected: the full result for each variant`,
    )
  for (const variant of o.variants) {
    const failure = provoke[variant]
    assert.ok(failure, `spec cannot provoke ${variant}`)
    const { db, calls } = fake(failure)
    if (expected)
      assert.ok(variant in expected, `spec has no result for ${variant}`)
    assert.deepEqual(
      await fn(db, ...args),
      expected ? expected[variant] : variant,
    )
    assert.deepEqual(calls, [(spec.portArgs as unknown[] | undefined) ?? args])
  }
  if (!o.rethrows) return o.variants.length
  const unnamed = spec.unnamed as (() => Error) | undefined
  assert.ok(
    unnamed,
    `${project.path(project.spec(o.name, o.file))} must export unnamed(): an error the adapter must rethrow`,
  )
  const error = unnamed()
  const { db } = fake(() => error)
  await assert.rejects(
    async () => fn(db, ...args),
    (thrown) => thrown === error,
  )
  return o.variants.length + 1
}

async function checkRoute(
  o: Extract<Obligation, { kind: 'route' }>,
  mod: Module,
  spec: Module,
): Promise<number> {
  const map = mod[o.name] as Record<string, unknown>
  const expected = spec.expected as Record<string, unknown>
  const observe = spec.observe as
    | ((value: unknown) => Promise<unknown>)
    | undefined
  for (const key of o.keys.map(String)) {
    assert.ok(key in expected, `spec has no expectation for ${o.name}.${key}`)
    const observed = observe ? await observe(map[key]) : map[key]
    assert.deepEqual(observed, expected[key], `${o.name}.${key}`)
  }
  return o.keys.length
}

async function checkHandler(
  o: Extract<Obligation, { kind: 'handler' }>,
  mod: Module,
  spec: Module,
): Promise<number> {
  type Row = {
    observe: (handler: unknown) => Promise<unknown>
    expected: unknown
  }
  const text = readFileSync(join(project.root, o.file), 'utf8')
  const sandboxed =
    project.root.includes('/.stryker-tmp/') || text.includes('stryMutAct_')
  assert.ok(
    sandboxed ||
      o.guards.every(
        (g) =>
          text.includes(g.statement) &&
          text.indexOf(g.statement) === text.lastIndexOf(g.statement),
      ),
    `the guards of ${o.name} differ from the inventory; rerun the inventory`,
  )
  const taken = async (expected: number, label: string) => {
    if (o.guards.length === 0) return
    const seen = await returnsTaken(o, mod[o.name])
    assert.ok(
      typeof seen !== 'string',
      `no proof of which exit ${o.name} took: ${String(seen)}`,
    )
    assert.deepEqual(
      seen,
      o.guards.map((_g, i) => i === expected),
      `the check for ${label} left ${o.name} through another exit`,
    )
  }
  const observe = spec.observe as Row['observe']
  await returnsTaken(o, mod[o.name])
  assert.deepEqual(await observe(mod[o.name]), spec.expected)
  await taken(-1, 'the path past every guard')
  const rows = (spec.exits ?? {}) as Record<string, Record<string, Row>>
  if (o.guards.length > 0)
    assert.deepEqual(
      o.guards.map((g) => g.subject),
      spec.order,
      `${project.path(project.spec(o.name, o.file))} must export order: the guards in the order the requirement gives them`,
    )
  const computed = new Set<string>()
  for (const [index, guard] of o.guards.entries())
    for (const exit of guard.exits) {
      const row = rows[guard.subject]?.[exit]
      assert.ok(row, `spec has no check for ${guard.subject} being ${exit}`)
      assert.deepEqual(
        await row.observe(mod[o.name]),
        row.expected,
        `${guard.subject} being ${exit}`,
      )
      await taken(index, `${guard.subject} being ${exit}`)
      computed.add(`${guard.subject} being ${exit}`)
    }
  for (const [subject, byExit] of Object.entries(rows))
    for (const exit of Object.keys(byExit))
      assert.ok(
        computed.has(`${subject} being ${exit}`),
        `spec checks ${subject} being ${exit}, which is not an exit of the code`,
      )
  return 1 + computed.size
}

async function checkConversion(
  o: Extract<Obligation, { kind: 'conversion' }>,
  mod: Module,
  spec: Module,
): Promise<number> {
  const fn = mod[o.name] as (...args: unknown[]) => unknown
  const expected = spec.expected as (...args: unknown[]) => unknown
  const failures: string[] = []
  for (const probe of o.probes) {
    const args = () =>
      probe.map((value, i) =>
        o.inputs[i] === 'date'
          ? new Date(value === 'invalid' ? Number.NaN : value)
          : o.inputs[i] === 'digits'
            ? String(value)
            : value,
      )
    const want = expected(...args())
    const actual = fn(...args())
    if (!sameNumber(actual, want))
      failures.push(
        `${JSON.stringify(probe)}: expected ${String(want)}, got ${String(actual)}`,
      )
  }
  assert.deepEqual(failures, [])
  return o.probes.length
}

async function checkContract(
  o: Extract<Obligation, { kind: 'contract' }>,
  mod: Module,
): Promise<number> {
  const contract = mod.contract as Contract
  assert.deepEqual(
    clauses(contract),
    o.clauses,
    'the contract changed since the inventory was computed',
  )
  let executed = 0
  for (const [name, member] of Object.entries(contract.members)) {
    for (const thrown of member.throws) {
      const raised: unknown = thrown.error
      const isClass =
        raised === Error ||
        (raised as { prototype?: unknown }).prototype instanceof Error
      await assert.rejects(
        async () => thrown.provoke(),
        (error) =>
          isClass
            ? error instanceof (raised as new () => Error)
            : (raised as (error: unknown) => boolean)(error),
        `${name} must throw ${thrown.error.name} when ${thrown.when}`,
      )
      executed++
    }
    const claims = member.ensures.filter((e) => e.result !== undefined)
    for (const ensured of member.ensures) {
      const value = await ensured.check()
      if (claims.length > 0)
        assert.notEqual(
          value,
          undefined,
          `${name}: a result claim speaks about every call, so every check of ${name} must return what ${name} returned; the check for "${ensured.claim}" returns nothing`,
        )
      for (const claim of claims)
        assert.ok(
          claim.result === undefined || holdsFor(value, claim.result),
          claim === ensured
            ? `${name}: the check for "${claim.claim}" must return what ${name} returned, and ${claim.result ? resultClaim(claim.result) : ''} does not hold for what it returned`
            : `${name}: the contract contradicts itself: the check for "${ensured.claim}" got a result for which "${claim.claim}" (${claim.result ? resultClaim(claim.result) : ''}) does not hold`,
        )
      executed++
    }
  }
  return executed
}

export type Register = (name: string, run: () => Promise<void>) => unknown

export async function register(
  test: Register,
  root: string = rootFrom([]),
): Promise<void> {
  project = loadProject(root)
  const inventory: { obligations: Obligation[] } = JSON.parse(
    readFileSync(process.env.OBLIGATIONS ?? project.obligations, 'utf8'),
  )
  if (process.env.VITEST === undefined) await import('./ts-specifiers.ts')
  if (!profiler) {
    profiler = new Session()
    profiler.connect()
    await profiler.post('Profiler.enable')
    await profiler.post('Profiler.startPreciseCoverage', {
      callCount: true,
      detailed: true,
    })
  }
  const loaded = new Map<string, Module>()
  const load = async (path: string): Promise<Module> => {
    const known = loaded.get(path)
    if (known) return known
    const module: Module = await import(pathToFileURL(path).href)
    loaded.set(path, module)
    return module
  }
  for (const o of inventory.obligations) {
    await load(join(project.root, o.file))
    if (o.kind !== 'contract') await load(project.spec(o.name, o.file))
  }
  for (const o of inventory.obligations) {
    test(`${o.kind} ${o.name}: ${o.cases} cases`, async () => {
      const mod = await load(join(project.root, o.file))
      const spec =
        o.kind === 'contract' ? mod : await load(project.spec(o.name, o.file))
      const executed =
        o.kind === 'contract'
          ? await checkContract(o, mod)
          : o.kind === 'decision'
            ? await checkDecision(o, mod, spec)
            : o.kind === 'classifier'
              ? await checkClassifier(o, mod, spec)
              : o.kind === 'adapter'
                ? await checkAdapter(o, mod, spec)
                : o.kind === 'route'
                  ? await checkRoute(o, mod, spec)
                  : o.kind === 'conversion'
                    ? await checkConversion(o, mod, spec)
                    : await checkHandler(o, mod, spec)
      assert.equal(
        executed,
        o.cases,
        'executed cases differ from the inventory',
      )
    })
  }
}
