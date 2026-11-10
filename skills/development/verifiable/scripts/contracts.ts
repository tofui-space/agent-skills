import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative } from 'node:path'
import { type Static, exportedValue, isNamed } from './static-value.ts'

export type Raised =
  | (abstract new (
      ...args: never[]
    ) => Error)
  | ((error: unknown) => boolean)
export const typeNames = ['string', 'number', 'boolean'] as const
export type TypeName = (typeof typeNames)[number]
export const resultTypes = [...typeNames, 'object', 'array', 'defined'] as const
export type ResultType = (typeof resultTypes)[number]
export type ArgumentScope = {
  readonly index: number
  readonly path?: string
  readonly isNot: TypeName
}
export type ResultClaim = { readonly path?: string; readonly is: ResultType }
export type Thrown = {
  readonly error: Raised
  readonly when: string
  readonly provoke: () => unknown
  readonly argument?: ArgumentScope
}
export type Ensured = {
  readonly claim: string
  readonly check: () => unknown
  readonly result?: ResultClaim
}
export type Member = {
  readonly throws: readonly Thrown[]
  readonly ensures: readonly Ensured[]
}
export type Source = { readonly file: string; readonly sha256: string }
export type Contract = {
  readonly package: string
  readonly version: string
  readonly via?: string
  readonly source?: Source | readonly Source[]
  readonly members: Readonly<Record<string, Member>>
}
export type Clause = {
  readonly member: string
  readonly kind: 'throws' | 'ensures'
  readonly text: string
  readonly scope?: string
}
export type ReadMember = {
  readonly throws: ReadonlyArray<{
    readonly error: string
    readonly when: string
    readonly argument?: ArgumentScope
  }>
  readonly ensures: ReadonlyArray<{
    readonly claim: string
    readonly result?: ResultClaim
  }>
}
export type ReadContract = {
  readonly package: string
  readonly version: string
  readonly members: Readonly<Record<string, ReadMember>>
}
export type LoadedContract = {
  readonly id: string
  readonly file: string
  readonly contract: ReadContract | undefined
  readonly problems: string[]
}

const fields = (
  value: Static | undefined,
): Record<string, Static> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, Static>)
    : undefined

function packageDirectory(name: string, from: string): string | undefined {
  const require = createRequire(join(from, 'package.json'))
  let directory: string
  try {
    directory = dirname(require.resolve(name))
  } catch {
    return undefined
  }
  while (!existsSync(join(directory, 'package.json'))) {
    if (dirname(directory) === directory) return undefined
    directory = dirname(directory)
  }
  return directory
}

function installed(
  name: string,
  via: string | undefined,
  root: string,
): { version: string; directory: string | undefined } | undefined {
  if (name === 'node')
    return { version: process.versions.node, directory: undefined }
  const from = via ? packageDirectory(via, root) : root
  const directory = from ? packageDirectory(name, from) : undefined
  if (!directory) return undefined
  const manifest: { version?: string } = JSON.parse(
    readFileSync(join(directory, 'package.json'), 'utf8'),
  )
  return manifest.version ? { version: manifest.version, directory } : undefined
}

export function loadContracts(
  root: string,
  directory: string,
): LoadedContract[] {
  if (!existsSync(directory)) return []
  const loaded: LoadedContract[] = []
  for (const name of readdirSync(directory).sort()) {
    if (!name.endsWith('.ts')) continue
    const id = name.slice(0, -3)
    const file = relative(root, join(directory, name))
    const written = fields(exportedValue(join(directory, name), 'contract'))
    const members = fields(written?.members)
    if (
      !written ||
      typeof written.package !== 'string' ||
      typeof written.version !== 'string' ||
      !members
    ) {
      loaded.push({
        id,
        file,
        contract: undefined,
        problems: [
          'a contract file exports const contract as an object literal with package, version and members, so that it can be read without running it',
        ],
      })
      continue
    }
    const problems: string[] = []
    const read: Record<string, ReadMember> = {}
    for (const [member, value] of Object.entries(members)) {
      const throws = fields(value)?.throws
      const ensures = fields(value)?.ensures
      const thrown = (Array.isArray(throws) ? throws : []).map((t) => {
        const entry = fields(t)
        if (!isNamed(entry?.error) || typeof entry?.when !== 'string')
          return undefined
        const scope = fields(entry.argument)
        if (entry.argument === undefined)
          return { error: entry.error.$name, when: entry.when }
        const isNot = typeNames.find((name) => name === scope?.isNot)
        if (
          typeof scope?.index !== 'number' ||
          !isNot ||
          (scope.path !== undefined && typeof scope.path !== 'string')
        )
          return undefined
        return {
          error: entry.error.$name,
          when: entry.when,
          argument:
            typeof scope.path === 'string'
              ? { index: scope.index, path: scope.path, isNot }
              : { index: scope.index, isNot },
        }
      })
      const ensured = (Array.isArray(ensures) ? ensures : []).map((e) => {
        const entry = fields(e)
        if (typeof entry?.claim !== 'string') return undefined
        const result = fields(entry.result)
        if (entry.result === undefined) return { claim: entry.claim }
        const is = resultTypes.find((name) => name === result?.is)
        if (
          !is ||
          (result?.path !== undefined && typeof result.path !== 'string')
        )
          return undefined
        return {
          claim: entry.claim,
          result:
            typeof result?.path === 'string'
              ? { path: result.path, is }
              : { is },
        }
      })
      if (
        !Array.isArray(throws) ||
        !Array.isArray(ensures) ||
        thrown.some((t) => t === undefined) ||
        ensured.some((e) => e === undefined)
      )
        problems.push(
          `${member} needs throws: [{ error: <a class or a predicate, by name>, when: '<text>', provoke, argument?: { index, path?: '<a.b>', isNot: ${typeNames.map((n) => `'${n}'`).join(' | ')} } }] and ensures: [{ claim: '<text>', check, result?: { path?: '<a.b>', is: ${resultTypes.map((n) => `'${n}'`).join(' | ')} } }]`,
        )
      read[member] = {
        throws: thrown.flatMap((t) => (t ? [t] : [])),
        ensures: ensured.flatMap((e) => (e ? [e] : [])),
      }
    }
    const { version } = written
    const via = typeof written.via === 'string' ? written.via : undefined
    if (id !== `${written.package}@${version}`)
      problems.push(
        `the file must be named ${written.package}@${version}.ts, after the package and the version it was reviewed against`,
      )
    const found = installed(written.package, via, root)
    if (!found)
      problems.push(
        `${written.package} cannot be found from ${via ?? 'the project root'}, so nothing backs the contract; for a package that only another package depends on, name that package as via`,
      )
    else if (
      found.version !== version &&
      !found.version.startsWith(`${version}.`)
    )
      problems.push(
        `the contract was reviewed against ${written.package} ${version} and ${found.version} is installed; review it against the installed version`,
      )
    const sources = Array.isArray(written.source)
      ? written.source
      : written.source === undefined
        ? []
        : [written.source]
    for (const source of sources) {
      const entry = fields(source)
      if (typeof entry?.file !== 'string' || typeof entry.sha256 !== 'string') {
        problems.push('a source is { file, sha256 }')
        continue
      }
      if (!found?.directory) continue
      const path = join(found.directory, entry.file)
      const actual = existsSync(path)
        ? createHash('sha256').update(readFileSync(path)).digest('hex')
        : 'missing'
      if (actual !== entry.sha256)
        problems.push(
          `${entry.file} of ${written.package} has sha256 ${actual}, and the contract was reviewed against ${entry.sha256}`,
        )
    }
    loaded.push({
      id,
      file,
      contract: { package: written.package, version, members: read },
      problems,
    })
  }
  return loaded
}

export const argumentScope = (scope: ArgumentScope): string =>
  `only when argument ${scope.index + 1}${scope.path ? ` at ${scope.path}` : ''} is not a ${scope.isNot}`

export const resultClaim = (result: ResultClaim): string =>
  `the result${result.path ? ` at ${result.path}` : ''} is ${result.is === 'defined' ? 'neither undefined nor null' : result.is === 'array' || result.is === 'object' ? `an ${result.is}` : `a ${result.is}`}`

export function clauses(contract: {
  readonly members: Readonly<
    Record<
      string,
      {
        readonly throws: ReadonlyArray<{
          readonly when: string
          readonly argument?: ArgumentScope
        }>
        readonly ensures: ReadonlyArray<{
          readonly claim: string
          readonly result?: ResultClaim
        }>
      }
    >
  >
}): Clause[] {
  return Object.entries(contract.members).flatMap(
    ([member, { throws, ensures }]) => [
      ...throws.map(
        (t): Clause => ({
          member,
          kind: 'throws',
          text: t.when,
          ...(t.argument ? { scope: argumentScope(t.argument) } : {}),
        }),
      ),
      ...ensures.map(
        (e): Clause => ({
          member,
          kind: 'ensures',
          text: e.claim,
          ...(e.result ? { scope: resultClaim(e.result) } : {}),
        }),
      ),
    ],
  )
}

export function holdsFor(value: unknown, result: ResultClaim): boolean {
  let at: unknown = value
  for (const key of result.path ? result.path.split('.') : []) {
    if (typeof at !== 'object' || at === null) return false
    at = (at as Record<string, unknown>)[key]
  }
  if (result.is === 'defined') return at !== undefined && at !== null
  if (result.is === 'array') return Array.isArray(at)
  if (result.is === 'object') return typeof at === 'object' && at !== null
  return typeof at === result.is
}
