import { existsSync, globSync, readFileSync } from 'node:fs'
import {
  dirname,
  isAbsolute,
  join,
  matchesGlob,
  relative,
  resolve,
  sep,
} from 'node:path'

export const shapes = [
  'decisions',
  'classifiers',
  'adapters',
  'wiring',
] as const
export const laterShapes = ['conversions'] as const
export type Shape = (typeof shapes)[number] | (typeof laterShapes)[number]
export type Settings = {
  readonly include: readonly string[]
  readonly exclude: readonly string[]
  readonly outside: readonly string[]
  readonly shapes: Readonly<Record<Shape, readonly string[]>>
  readonly specs: string
  readonly contracts: string
  readonly obligations: string
  readonly equivalents: string
  readonly cache: string
  readonly tsconfig: string
}
export type Project = {
  readonly root: string
  readonly settings: Settings
  readonly files: () => string[]
  readonly shapeOf: (file: string) => Shape | undefined
  readonly isOutside: (file: string) => boolean
  readonly spec: (unit: string, file: string) => string
  readonly contracts: string
  readonly obligations: string
  readonly equivalents: string
  readonly cache: string
  readonly tsconfig: string
  readonly path: (file: string) => string
}

export const settingsFile = 'verifiable.json'

const defaults: Settings = {
  include: ['src/**/*.ts'],
  exclude: [],
  outside: [],
  shapes: {
    decisions: ['src/decisions/*.ts'],
    classifiers: ['src/classifiers/*.ts'],
    adapters: ['src/adapters/*.ts'],
    wiring: ['src/wiring/*.ts'],
    conversions: ['src/conversions/*.ts'],
  },
  specs: 'spec',
  contracts: '',
  obligations: 'obligations.json',
  equivalents: '',
  cache: '.verifiable-cache/z3.json',
  tsconfig: 'tsconfig.json',
}

function patterns(value: unknown, key: string): string[] {
  const list = typeof value === 'string' ? [value] : value
  if (!Array.isArray(list) || !list.every((p) => typeof p === 'string'))
    throw new Error(`${settingsFile}: ${key} must be a glob or a list of globs`)
  return list
}

function text(value: unknown, key: string): string {
  if (typeof value !== 'string')
    throw new Error(`${settingsFile}: ${key} must be a path`)
  return value
}

function readSettings(root: string): Settings {
  const path = join(root, settingsFile)
  if (!existsSync(path)) return defaults
  const written: Record<string, unknown> = JSON.parse(
    readFileSync(path, 'utf8'),
  )
  const unknown = Object.keys(written).filter((key) => !(key in defaults))
  if (unknown.length > 0)
    throw new Error(
      `${settingsFile}: unknown setting ${unknown.join(', ')}; the settings are ${Object.keys(defaults).join(', ')}`,
    )
  const shapeGlobs = (written.shapes ?? defaults.shapes) as Record<
    string,
    unknown
  >
  const missing = shapes.filter((shape) => !(shape in shapeGlobs))
  const extra = Object.keys(shapeGlobs).filter(
    (key) => ![...shapes, ...laterShapes].some((shape) => shape === key),
  )
  if (missing.length + extra.length > 0)
    throw new Error(
      `${settingsFile}: shapes must name ${shapes.join(', ')}, and may name ${laterShapes.join(', ')}`,
    )
  return {
    include: patterns(written.include ?? defaults.include, 'include'),
    exclude: patterns(written.exclude ?? defaults.exclude, 'exclude'),
    outside: patterns(written.outside ?? defaults.outside, 'outside'),
    shapes: {
      decisions: patterns(shapeGlobs.decisions, 'shapes.decisions'),
      classifiers: patterns(shapeGlobs.classifiers, 'shapes.classifiers'),
      adapters: patterns(shapeGlobs.adapters, 'shapes.adapters'),
      wiring: patterns(shapeGlobs.wiring, 'shapes.wiring'),
      conversions: patterns(shapeGlobs.conversions ?? [], 'shapes.conversions'),
    },
    specs: text(written.specs ?? defaults.specs, 'specs'),
    contracts: text(written.contracts ?? defaults.contracts, 'contracts'),
    obligations: text(
      written.obligations ?? defaults.obligations,
      'obligations',
    ),
    equivalents: text(
      written.equivalents ?? defaults.equivalents,
      'equivalents',
    ),
    cache: text(written.cache ?? defaults.cache, 'cache'),
    tsconfig: text(written.tsconfig ?? defaults.tsconfig, 'tsconfig'),
  }
}

export function rootFrom(argv: readonly string[] = process.argv): string {
  const flag = argv
    .find((a) => a.startsWith('--root='))
    ?.slice('--root='.length)
  return resolve(flag ?? process.env.VERIFIABLE_ROOT ?? process.cwd())
}

export function loadProject(root: string = rootFrom()): Project {
  const settings = readSettings(root)
  const slashed = (file: string) =>
    relative(root, isAbsolute(file) ? file : join(root, file))
      .split(sep)
      .join('/')
  const matches = (file: string, globs: readonly string[]) =>
    globs.some((glob) => matchesGlob(slashed(file), glob))
  const beside = settings.specs.includes('{name}')
  return {
    root,
    settings,
    files: () =>
      [
        ...new Set(
          settings.include.flatMap((glob) => globSync(glob, { cwd: root })),
        ),
      ]
        .filter((file) => !matches(file, settings.exclude))
        .map((file) => join(root, file))
        .sort(),
    shapeOf: (file) =>
      matches(file, settings.exclude)
        ? undefined
        : [...shapes, ...laterShapes].find((shape) =>
            matches(file, settings.shapes[shape]),
          ),
    isOutside: (file) => matches(file, settings.outside),
    spec: (unit, file) =>
      beside
        ? join(
            root,
            settings.specs
              .replaceAll('{name}', unit)
              .replaceAll('{dir}', dirname(slashed(file))),
          )
        : join(root, settings.specs, `${unit}.spec.ts`),
    contracts: join(
      root,
      settings.contracts ||
        (beside ? 'contracts' : join(settings.specs, 'contracts')),
    ),
    obligations: join(root, settings.obligations),
    equivalents: join(
      root,
      settings.equivalents ||
        (beside
          ? 'equivalent-mutants.json'
          : join(settings.specs, 'equivalent-mutants.json')),
    ),
    cache: join(root, settings.cache),
    tsconfig: join(root, settings.tsconfig),
    path: slashed,
  }
}
