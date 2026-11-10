import { existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'ts6'
import type { LoadedContract, ReadMember, TypeName } from './contracts.ts'
import type { Project } from './project.ts'

export type LibraryKind = 'builtin call' | 'library call'
export type Call = ts.CallExpression | ts.NewExpression

export function libraryKind(
  program: ts.Program,
  checker: ts.TypeChecker,
  call: Call,
): LibraryKind | undefined {
  const declaration = checker.getResolvedSignature(call)?.declaration
  const fileName = declaration?.getSourceFile().fileName ?? ''
  if (
    declaration &&
    program.isSourceFileDefaultLibrary(declaration.getSourceFile())
  )
    return 'builtin call'
  if (fileName.includes('/typescript/lib/lib.')) return 'builtin call'
  if (fileName.includes('/node_modules/')) return 'library call'
  return undefined
}

export function backing(
  checker: ts.TypeChecker,
  call: Call,
  source: ts.SourceFile,
  kind: LibraryKind | undefined,
  contracts: readonly LoadedContract[],
): { applied: LoadedContract[]; sameText: LoadedContract[] } {
  if (!kind) return { applied: [], sameText: [] }
  const callee = call.expression.getText(source)
  const sameText = contracts.filter(
    (c) => c.problems.length === 0 && c.contract?.members[callee] !== undefined,
  )
  if (sameText.length === 0) return { applied: [], sameText }
  const origins = new Set<string>()
  const origin = (declarations: readonly ts.Declaration[] | undefined) => {
    for (const d of declarations ?? []) origins.add(d.getSourceFile().fileName)
  }
  const declared = checker.getResolvedSignature(call)?.declaration
  if (declared) origin([declared])
  for (let part: ts.Expression = call.expression; ; part = part.expression) {
    origin(checker.getSymbolAtLocation(part)?.declarations)
    const type = checker.getTypeAtLocation(part)
    origin(type.symbol?.declarations)
    origin(type.aliasSymbol?.declarations)
    if (
      !ts.isPropertyAccessExpression(part) &&
      !ts.isElementAccessExpression(part)
    )
      break
  }
  const comesFrom = (name: string) =>
    name === 'node'
      ? kind === 'builtin call' ||
        [...origins].some((f) => f.includes('/@types/node/'))
      : [...origins].some((f) => f.includes(`/node_modules/${name}/`))
  return {
    applied: sameText.filter((c) => comesFrom(c.contract?.package ?? '')),
    sameText,
  }
}

export type Leaf = {
  readonly keys: readonly string[]
  readonly text: string
  readonly value: boolean | number | string | null
  readonly inList?: boolean
}
export type OptionObject = {
  readonly unit: string
  readonly start: number
  readonly end: number
  readonly leaves: readonly Leaf[]
}
export type Site = {
  readonly id: string
  readonly file: string
  readonly member: string
  readonly contract: string
  readonly contractFile: string
  readonly clauses: readonly string[]
  readonly excluded: readonly string[]
  readonly start: number
  readonly end: number
  readonly objects: readonly OptionObject[]
}
export type Unobserved = { readonly at: string; readonly why: string }
export type MemberCall = {
  readonly contract: string
  readonly member: string
  readonly at: string
  readonly excluded: readonly string[]
}

export function typeIs(type: ts.Type, name: TypeName): boolean {
  if (
    type.flags &
    (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never)
  )
    return false
  if (type.isUnion()) return type.types.every((part) => typeIs(part, name))
  if (type.isIntersection())
    return type.types.some((part) => typeIs(part, name))
  const flag =
    name === 'string'
      ? ts.TypeFlags.StringLike
      : name === 'number'
        ? ts.TypeFlags.NumberLike
        : ts.TypeFlags.BooleanLike
  return Boolean(type.flags & flag)
}

export function excludedAt(
  checker: ts.TypeChecker,
  call: Call,
  throws: ReadMember['throws'],
): Array<{ thrown: ReadMember['throws'][number]; type: string }> {
  const given = call.arguments ?? []
  return throws.flatMap((thrown) => {
    const scope = thrown.argument
    const argument = scope ? given[scope.index] : undefined
    if (
      !scope ||
      !argument ||
      given.slice(0, scope.index + 1).some(ts.isSpreadElement)
    )
      return []
    let type = checker.getTypeAtLocation(argument)
    for (const key of scope.path ? scope.path.split('.') : []) {
      const property = type.isUnion() ? undefined : type.getProperty(key)
      if (!property) return []
      type = checker.getTypeOfSymbolAtLocation(property, argument)
    }
    return typeIs(type, scope.isNot)
      ? [{ thrown, type: checker.typeToString(type) }]
      : []
  })
}

const unwrapped = (expr: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(expr) ||
  ts.isAsExpression(expr) ||
  ts.isSatisfiesExpression(expr)
    ? unwrapped(expr.expression)
    : expr

function valueLeaves(
  expression: ts.Expression,
  source: ts.SourceFile,
  keys: readonly string[],
  inList: boolean,
): Leaf[] {
  const written = unwrapped(expression)
  if (ts.isObjectLiteralExpression(written) && written.properties.length > 0)
    return leavesOf(written, source, keys)
  const flat = written.getText(source).replace(/\s+/g, ' ')
  const text = flat.length > 60 ? `${flat.slice(0, 57)}...` : flat
  const negative =
    ts.isPrefixUnaryExpression(written) &&
    written.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(written.operand)
      ? -Number(written.operand.text)
      : undefined
  const value =
    written.kind === ts.SyntaxKind.TrueKeyword
      ? true
      : written.kind === ts.SyntaxKind.FalseKeyword
        ? false
        : ts.isNumericLiteral(written)
          ? Number(written.text)
          : negative !== undefined
            ? negative
            : ts.isStringLiteral(written) ||
                ts.isNoSubstitutionTemplateLiteral(written)
              ? written.text
              : null
  const own: Leaf = inList
    ? { keys, text, value, inList }
    : { keys, text, value }
  const listed =
    ts.isArrayLiteralExpression(written) &&
    !written.elements.some(ts.isSpreadElement)
      ? written.elements.flatMap((element, index) =>
          valueLeaves(element, source, [...keys, String(index)], true),
        )
      : []
  return [own, ...listed]
}

function leavesOf(
  literal: ts.ObjectLiteralExpression,
  source: ts.SourceFile,
  prefix: readonly string[] = [],
): Leaf[] {
  return literal.properties.flatMap((property): Leaf[] => {
    if (ts.isShorthandPropertyAssignment(property))
      return [
        {
          keys: [...prefix, property.name.text],
          text: property.name.text,
          value: null,
        },
      ]
    if (
      !ts.isPropertyAssignment(property) ||
      !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
    )
      return []
    return valueLeaves(
      property.initializer,
      source,
      [...prefix, property.name.text],
      false,
    )
  })
}

export function findSites(
  project: Project,
  contracts: readonly LoadedContract[],
  loaded?: ts.Program,
): { sites: Site[]; unobserved: Unobserved[]; calls: MemberCall[] } {
  const usable = contracts.filter((c) => c.problems.length === 0)
  if (usable.length === 0) return { sites: [], unobserved: [], calls: [] }
  const files = project.files()
  const configured = existsSync(project.tsconfig)
    ? ts.getParsedCommandLineOfConfigFile(
        project.tsconfig,
        {},
        { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined },
      )?.options
    : undefined
  const program =
    loaded ??
    ts.createProgram(files, {
      ...(configured ?? { strict: true, allowImportingTsExtensions: true }),
      noEmit: true,
    })
  const checker = program.getTypeChecker()
  const sites: Site[] = []
  const unobserved: Unobserved[] = []
  const calls: MemberCall[] = []
  const taken = new Set<string>()
  for (const file of files) {
    const source = program.getSourceFile(file)
    if (!source) continue
    const visit = (node: ts.Node): void => {
      if (ts.isTypeNode(node)) return
      ts.forEachChild(node, visit)
      if (!ts.isCallExpression(node) && !ts.isNewExpression(node)) return
      const kind = libraryKind(program, checker, node)
      const member = node.expression.getText(source)
      const position = source.getLineAndCharacterOfPosition(
        node.getStart(source),
      )
      const place = `${project.path(file)}:${position.line + 1}`
      const contract = backing(checker, node, source, kind, usable).applied[0]
      const alike = usable.find(
        (c) => c.contract?.members[member] !== undefined,
      )
      if (!contract?.contract && alike)
        unobserved.push({
          at: `${member} at ${place}`,
          why: `it is written like a member of the contract ${alike.id}, and nothing in the call comes from ${alike.contract?.package}; if it should, check that the types of the package load`,
        })
      if (!contract?.contract) return
      calls.push({
        contract: contract.id,
        member,
        at: place,
        excluded: excludedAt(
          checker,
          node,
          contract.contract.members[member]?.throws ?? [],
        ).map(({ thrown }) => thrown.when),
      })
      const plain = `${member} at ${place}`
      const id = taken.has(plain) ? `${plain}:${position.character + 1}` : plain
      taken.add(plain)
      let suspends = false
      const look = (inner: ts.Node): void => {
        if (ts.isFunctionLike(inner)) return
        if (ts.isAwaitExpression(inner) || ts.isYieldExpression(inner))
          suspends = true
        ts.forEachChild(inner, look)
      }
      for (const argument of node.arguments ?? []) look(argument)
      if (suspends || node.flags & ts.NodeFlags.OptionalChain) {
        unobserved.push({
          at: id,
          why: suspends
            ? 'an argument awaits, so the call cannot be wrapped'
            : 'the call is part of an optional chain',
        })
        return
      }
      const literals = (node.arguments ?? []).flatMap((argument, index) =>
        ts.isObjectLiteralExpression(unwrapped(argument))
          ? [{ argument, index }]
          : [],
      )
      sites.push({
        id,
        file,
        member,
        contract: contract.id,
        contractFile: join(project.root, contract.file),
        clauses: (contract.contract.members[member]?.throws ?? []).map(
          (thrown) => thrown.when,
        ),
        excluded: calls.at(-1)?.excluded ?? [],
        start: node.getStart(source),
        end: node.getEnd(),
        objects: literals.map(({ argument, index }) => ({
          unit:
            literals.length > 1
              ? `${id}, options in argument ${index + 1}`
              : `${id}, options`,
          start: argument.getStart(source),
          end: argument.getEnd(),
          leaves: leavesOf(
            unwrapped(argument) as ts.ObjectLiteralExpression,
            source,
          ),
        })),
      })
    }
    visit(source)
  }
  for (const contract of usable)
    for (const member of Object.keys(contract.contract?.members ?? {}))
      if (
        !calls.some(
          (call) => call.contract === contract.id && call.member === member,
        )
      )
        unobserved.push({
          at: `${member} of the contract ${contract.id}`,
          why: 'no call in the project is written as this member and comes from its package, so nothing about it is observed; a library that is passed in as an object is called through that object, not as the member',
        })
  return { sites, unobserved, calls }
}

export const refuted = 'returns what its contract says it never returns'
export const scopeRefuted =
  'throws an error that its contract rules out for this call'
export const returns = 'returns'
export const unlisted = 'throws an error the contract does not list'
export const throwsWhen = (when: string) => `throws when ${when}`

export type LibraryUnit = {
  readonly name: string
  readonly cells: ReadonlyArray<{ cell: string; label: string }>
  readonly alternatives: (cell: string) => number
  readonly alternativeLabel: (cell: string, to: number) => string
}

export const removed = 'removed, so the default applies'
export const removedFromList = 'removed from its list'

export function changedValue(
  value: boolean | number | string,
  to: number,
): boolean | number | string {
  if (typeof value === 'boolean') return !value
  if (typeof value === 'string') return `${value} (changed)`
  return to === 1 ? (value === 0 ? 1 : 0) : value + 1
}

export function libraryUnits(sites: readonly Site[]): LibraryUnit[] {
  return sites.flatMap((site): LibraryUnit[] => {
    const thrown = site.clauses.map(throwsWhen)
    const port: LibraryUnit = {
      name: site.id,
      cells: [returns, ...thrown].map((cell) => ({ cell, label: cell })),
      alternatives: (cell) =>
        cell === returns
          ? thrown.length
          : thrown.includes(cell)
            ? Math.max(1, thrown.length - 1)
            : 0,
      alternativeLabel: (cell, to) =>
        thrown.filter((other) => other !== cell)[to] ?? unlisted,
    }
    const options = site.objects.map((object): LibraryUnit => {
      const leaf = (cell: string) =>
        object.leaves.find((l) => l.keys.join('.') === cell)
      return {
        name: object.unit,
        cells: object.leaves.map((l) => ({
          cell: l.keys.join('.'),
          label: l.keys.join('.'),
        })),
        alternatives: (cell) => {
          const value = leaf(cell)?.value
          return value === undefined
            ? 0
            : value === null
              ? 1
              : typeof value === 'number'
                ? 3
                : 2
        },
        alternativeLabel: (cell, to) => {
          const found = leaf(cell)
          const value = found?.value
          return to === 0 || value === undefined || value === null
            ? found?.inList
              ? removedFromList
              : removed
            : `changed to ${JSON.stringify(changedValue(value, to))}`
        },
      }
    })
    return [port, ...options]
  })
}
