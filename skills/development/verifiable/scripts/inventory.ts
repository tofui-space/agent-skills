import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'ts6'
import { canonical } from './canonical.ts'
import {
  type InputKind,
  type ProbeValue,
  conversionProbes,
  translateConversion,
  vocabulary,
} from './conversion.ts'
import {
  type Clause,
  argumentScope,
  clauses,
  loadContracts,
} from './contracts.ts'
import {
  type Classifier,
  type Problem,
  isVocabularyCall,
  isVocabularyReceiver,
} from './branches.ts'
import { numberCells, translateNumbers } from './number-classifier.ts'
import { type MemberCall, excludedAt, findSites } from './ports.ts'
import { type Project, loadProject, rootFrom } from './project.ts'
import { exportedNames, exportedValue } from './static-value.ts'
import {
  acceptsOnly,
  digits,
  stringCells,
  translate,
} from './string-classifier.ts'
import {
  type Compared,
  type Read,
  type UnknownProbe,
  translateUnknown,
  unknownCells,
} from './unknown-classifier.ts'

export type Value = string | boolean | { readonly [key: string]: Value }
export type Dimension = { readonly name: string; readonly values: Value[] }
export type Comparison = { readonly op: string; readonly constant: number }
export type Obligation =
  | {
      kind: 'decision'
      file: string
      name: string
      outcomes: Value[]
      style: 'record' | 'positional'
      dimensions: Dimension[]
      cases: number
    }
  | {
      kind: 'classifier'
      input: 'number'
      file: string
      name: string
      outcomes: Value[]
      comparisons: Comparison[]
      intervals: Array<{ min: number | null; max: number | null }>
      probes: number[]
      assumes?: string[]
      cases: number
    }
  | {
      kind: 'classifier'
      input: 'string'
      file: string
      name: string
      outcomes: Value[]
      atoms: string[]
      paths: number
      infeasible: number
      boundary: number
      probes: Array<string | null>
      cases: number
    }
  | {
      kind: 'classifier'
      input: 'numbers'
      file: string
      name: string
      outcomes: Value[]
      atoms: string[]
      paths: number
      infeasible: number
      boundary: number
      probes: Array<Array<number | null>>
      assumes?: string[]
      cases: number
    }
  | {
      kind: 'classifier'
      input: 'unknown'
      file: string
      name: string
      outcomes: Value[]
      atoms: string[]
      paths: number
      probes: UnknownProbe[]
      cases: number
    }
  | {
      kind: 'adapter'
      file: string
      name: string
      variants: string[]
      bare: string[]
      asynchronous: boolean
      carriesData: boolean
      rethrows: boolean
      cases: number
    }
  | { kind: 'route'; file: string; name: string; keys: Value[]; cases: number }
  | {
      kind: 'contract'
      file: string
      name: string
      clauses: Clause[]
      cases: number
    }
  | {
      kind: 'handler'
      file: string
      name: string
      guards: Guard[]
      cases: number
    }
  | {
      kind: 'conversion'
      file: string
      name: string
      inputs: InputKind[]
      neighbours: number
      equivalent: number
      probes: ProbeValue[][]
      assumes: string[]
      cases: number
    }
export type PortUse = { readonly contract: string; readonly member: string }
export type Guard = {
  readonly subject: string
  readonly exits: string[]
  readonly statement: string
}
export type Violation = { file: string; line: number; rule: string }
export type Partition = 'code' | 'code+spec'

const loops = new Set([
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
])
const logical = new Set([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
])
const comparisons: Record<number, string> = {
  [ts.SyntaxKind.LessThanToken]: '<',
  [ts.SyntaxKind.LessThanEqualsToken]: '<=',
  [ts.SyntaxKind.GreaterThanToken]: '>',
  [ts.SyntaxKind.GreaterThanEqualsToken]: '>=',
  [ts.SyntaxKind.EqualsEqualsEqualsToken]: '===',
  [ts.SyntaxKind.ExclamationEqualsEqualsToken]: '!==',
}
const flipped: Record<string, string> = {
  '<': '>',
  '<=': '>=',
  '>': '<',
  '>=': '<=',
  '===': '===',
  '!==': '!==',
}

function isExported(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some(
      (m) => m.kind === ts.SyntaxKind.ExportKeyword,
    )
  )
}

function isAssignment(kind: ts.SyntaxKind): boolean {
  return (
    kind >= ts.SyntaxKind.FirstAssignment &&
    kind <= ts.SyntaxKind.LastAssignment
  )
}

function within(inner: ts.Node, outer: ts.Node): boolean {
  return inner.pos >= outer.pos && inner.end <= outer.end
}

function numericLiteral(node: ts.Expression): number | undefined {
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return -Number(node.operand.text)
  }
  return undefined
}

function holds(op: string, x: number, c: number): boolean {
  if (op === '<') return x < c
  if (op === '<=') return x <= c
  if (op === '>') return x > c
  if (op === '>=') return x >= c
  if (op === '===') return x === c
  return x !== c
}

type Interval = {
  readonly min: number
  readonly max: number
  readonly outcome: unknown
}

export function classifierProbes(
  found: Comparison[],
  intervals: readonly Interval[] | undefined,
): number[] {
  const candidates = new Set<number>()
  for (const { constant } of found)
    for (const d of [-1, 0, 1]) candidates.add(constant + d)
  for (const { min, max } of intervals ?? []) {
    if (Number.isFinite(min)) for (const x of [min - 1, min]) candidates.add(x)
    if (Number.isFinite(max)) for (const x of [max, max + 1]) candidates.add(x)
  }
  if (candidates.size === 0) candidates.add(0)
  const cells = new Map<string, number>()
  for (const x of [...candidates].sort((a, b) => a - b)) {
    const code = found
      .map(({ op, constant }) => (holds(op, x, constant) ? 'T' : 'F'))
      .join('')
    const spec = intervals
      ? intervals.findIndex(({ min, max }) => x >= min && x <= max)
      : -1
    const cell = `${code}|${spec}`
    if (!cells.has(cell)) cells.set(cell, x)
  }
  return [...cells.values()]
}

export async function computeInventory(options: {
  partition: Partition
  maxDomain: number
  project: Project
}) {
  const { project } = options
  const shapeOf = project.shapeOf
  const files = project.files()
  const configured = existsSync(project.tsconfig)
    ? ts.getParsedCommandLineOfConfigFile(
        project.tsconfig,
        {},
        { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined },
      )?.options
    : undefined
  const program = ts.createProgram(files, {
    ...(configured ?? {
      strict: true,
      allowImportingTsExtensions: true,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2022,
    }),
    noEmit: true,
  })
  const checker = program.getTypeChecker()
  const obligations: Obligation[] = []
  const violations: Violation[] = []
  const outside: string[] = []
  const strictNulls =
    program.getCompilerOptions().strictNullChecks ??
    program.getCompilerOptions().strict ??
    false
  if (!strictNulls)
    violations.push({
      file: project.path(project.tsconfig),
      line: 1,
      rule: 'the project compiles without strictNullChecks, so undefined and null belong to every type and no input is finite; nothing else was looked at; found: turn on strict',
    })
  const unsettled: Array<{ file: string; unit: string; text: string }> = []
  if (!strictNulls) return { obligations, violations, outside, unsettled }
  const contracts = loadContracts(project)
  for (const loaded of contracts) {
    for (const problem of loaded.problems)
      violations.push({
        file: loaded.file,
        line: 1,
        rule: `${problem}; found: ${loaded.id}`,
      })
    if (loaded.contract && loaded.problems.length === 0) {
      const listed = clauses(loaded.contract)
      obligations.push({
        kind: 'contract',
        file: loaded.file,
        name: loaded.id,
        clauses: listed,
        cases: listed.length,
      })
    }
  }
  const afterEveryFile: Array<(calls: readonly MemberCall[]) => void> = []

  for (const file of files) {
    const source = program.getSourceFile(file)
    if (!source) continue
    const rel = project.path(file)
    if (project.isOutside(file)) {
      outside.push(rel)
      continue
    }
    const specOf = (unit: string) => project.spec(unit, rel)
    const shape = shapeOf(file)
    const flag = (node: ts.Node, rule: string) => {
      const found = node.getText(source).split('\n')[0]?.trim() ?? ''
      violations.push({
        file: rel,
        line:
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        rule: rule.includes('found:')
          ? rule
          : `${rule}; found: ${found.length > 80 ? `${found.slice(0, 77)}...` : found}`,
      })
    }

    const walk = (node: ts.Node, visit: (n: ts.Node) => void) => {
      if (
        ts.isTypeNode(node) ||
        ts.isImportDeclaration(node) ||
        ts.isExportDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isInterfaceDeclaration(node)
      )
        return
      visit(node)
      ts.forEachChild(node, (child) => walk(child, visit))
    }

    const finiteValues = (type: ts.Type, depth = 0): Value[] | undefined => {
      if (type.flags & ts.TypeFlags.BooleanLiteral)
        return [checker.typeToString(type) === 'true']
      if (type.isStringLiteral()) return [type.value]
      if (type.isUnion()) {
        const parts = type.types.map((part) => finiteValues(part, depth))
        return parts.every((part) => part !== undefined)
          ? parts.flat()
          : undefined
      }
      const isPlainObject =
        Boolean(type.flags & ts.TypeFlags.Object) &&
        checker.getSignaturesOfType(type, ts.SignatureKind.Call).length === 0 &&
        checker.getSignaturesOfType(type, ts.SignatureKind.Construct).length ===
          0
      const props = isPlainObject ? checker.getPropertiesOfType(type) : []
      if (props.length === 0 || depth >= 3) return undefined
      let records: Array<{ [key: string]: Value }> = [{}]
      for (const prop of props) {
        const values = finiteValues(
          checker.getTypeOfSymbolAtLocation(prop, source),
          depth + 1,
        )
        if (!values) return undefined
        records = records.flatMap((r) =>
          values.map((v) => ({ ...r, [prop.name]: v })),
        )
      }
      return records
    }

    const isNumberLike = (type: ts.Type): boolean =>
      Boolean(type.flags & ts.TypeFlags.Number) ||
      (type.isIntersection() &&
        type.types.some((part) => Boolean(part.flags & ts.TypeFlags.Number)))

    const declaredIn = (id: ts.Identifier): ts.Declaration[] => {
      let symbol = checker.getSymbolAtLocation(id)
      if (symbol && symbol.flags & ts.SymbolFlags.Alias)
        symbol = checker.getAliasedSymbol(symbol)
      return symbol?.declarations ?? []
    }

    const isNameOnly = (id: ts.Identifier): boolean => {
      const parent = id.parent
      return (
        (ts.isPropertyAccessExpression(parent) && parent.name === id) ||
        (ts.isPropertyAssignment(parent) && parent.name === id) ||
        (ts.isParameter(parent) && parent.name === id) ||
        (ts.isFunctionDeclaration(parent) && parent.name === id)
      )
    }

    const pureBody = (fn: ts.FunctionDeclaration) => {
      walk(fn, (node) => {
        if (loops.has(node.kind)) flag(node, 'loop in a pure shape')
        if (ts.isTryStatement(node)) flag(node, 'try in a pure shape')
        if (ts.isAwaitExpression(node)) flag(node, 'await in a pure shape')
        if (
          (ts.isCallExpression(node) &&
            !(shape === 'classifiers' && isVocabularyCall(node))) ||
          ts.isNewExpression(node)
        )
          flag(node, 'call in a pure shape')
        if (ts.isElementAccessExpression(node))
          flag(node, 'computed access in a pure shape')
        if (node.kind === ts.SyntaxKind.ThisKeyword)
          flag(node, 'this in a pure shape')
        if (
          ts.isBinaryExpression(node) &&
          isAssignment(node.operatorToken.kind)
        )
          flag(node, 'assignment in a pure shape')
        if (
          (ts.isPrefixUnaryExpression(node) ||
            ts.isPostfixUnaryExpression(node)) &&
          (node.operator === ts.SyntaxKind.PlusPlusToken ||
            node.operator === ts.SyntaxKind.MinusMinusToken)
        ) {
          flag(node, 'mutation in a pure shape')
        }
        if (
          ts.isIdentifier(node) &&
          !isNameOnly(node) &&
          !isVocabularyReceiver(node) &&
          node.text !== 'undefined'
        ) {
          const declarations = declaredIn(node)
          if (
            declarations.length > 0 &&
            !declarations.some((d) => within(d, fn))
          )
            flag(node, `reads ${node.text} from outside the function`)
        }
      })
    }

    const brandings = new Set<ts.Node>()
    if (shape === 'conversions')
      for (const statement of source.statements) {
        const only = ts.isFunctionDeclaration(statement)
          ? statement.body?.statements[0]
          : undefined
        const returned =
          only && ts.isReturnStatement(only) ? only.expression : undefined
        const top =
          returned && ts.isParenthesizedExpression(returned)
            ? returned.expression
            : returned
        if (
          top &&
          ts.isAsExpression(top) &&
          isNumberLike(checker.getTypeFromTypeNode(top.type))
        )
          brandings.add(top)
      }
    walk(source, (node) => {
      const cast =
        (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) &&
        node.type.getText(source) !== 'const' &&
        !brandings.has(node)
      if (cast || ts.isNonNullExpression(node))
        flag(
          node,
          'a cast or non-null assertion bypasses the types the counts rest on; narrow with a classifier that returns a type predicate, or brand a number in a conversion',
        )
    })

    if (!shape) {
      for (const statement of source.statements) {
        const typeOnly =
          ts.isTypeAliasDeclaration(statement) ||
          ts.isInterfaceDeclaration(statement) ||
          ts.isExportDeclaration(statement) ||
          ts.isImportDeclaration(statement)
        if (!typeOnly) flag(statement, 'runtime code outside the shapes')
      }
      continue
    }

    if (shape === 'conversions') {
      for (const statement of source.statements) {
        if (
          ts.isImportDeclaration(statement) ||
          ts.isTypeAliasDeclaration(statement) ||
          ts.isInterfaceDeclaration(statement)
        )
          continue
        if (
          !ts.isFunctionDeclaration(statement) ||
          !isExported(statement) ||
          !statement.name
        ) {
          flag(statement, 'only exported functions may sit in conversions')
          continue
        }
        const fn = statement
        const name = statement.name.text
        const types = fn.parameters.map((p) => checker.getTypeAtLocation(p))
        const isDate = (type: ts.Type) =>
          type.symbol?.name === 'Date' &&
          (type.symbol.declarations ?? []).every((d) =>
            program.isSourceFileDefaultLibrary(d.getSourceFile()),
          )
        const isBrandedText = (type: ts.Type) =>
          type.isIntersection() &&
          type.types.some((part) =>
            Boolean(part.flags & ts.TypeFlags.StringLike),
          )
        const kinds = types.map((type): InputKind | undefined =>
          isDate(type)
            ? 'date'
            : isNumberLike(type)
              ? 'number'
              : isBrandedText(type)
                ? 'digits'
                : undefined,
        )
        for (const [i, type] of types.entries()) {
          if (kinds[i] !== 'digits') continue
          const wanted = checker.typeToString(type)
          const input = fn.parameters[i]?.name.getText(source) ?? '?'
          const predicates = program
            .getSourceFiles()
            .filter((file) => shapeOf(file.fileName) === 'classifiers')
            .flatMap((file) =>
              file.statements.flatMap((s) =>
                ts.isFunctionDeclaration(s) &&
                s.type &&
                ts.isTypePredicateNode(s.type) &&
                s.type.type &&
                checker.typeToString(
                  checker.getTypeFromTypeNode(s.type.type),
                ) === wanted
                  ? [{ predicate: s, file }]
                  : [],
              ),
            )
          const made = predicates[0]
          if (!made) {
            flag(
              fn,
              `${input} is text of the type ${wanted}, and no classifier gives that type through a type predicate; only text that a classifier has shown to be 1 to 15 digits is read as a number`,
            )
            continue
          }
          const read = translate(made.predicate, made.file, true)
          const only =
            read.problems.length > 0
              ? 'unknown'
              : await acceptsOnly(read.classifier, digits, project.cache)
          if (only === 'unknown')
            flag(
              fn,
              `whether every ${wanted} is 1 to 15 digits came back unknown, so the claim is blocked; found: ${input}`,
            )
          if (typeof only === 'object')
            flag(
              fn,
              `the text ${JSON.stringify(only.accepted)} passes ${made.predicate.name?.text} and is not 1 to 15 digits, so Number() of it is not a whole number that JavaScript represents exactly; found: ${input}`,
            )
        }
        const signature = checker.getSignatureFromDeclaration(fn)
        const returned = signature
          ? checker.getReturnTypeOfSignature(signature)
          : undefined
        const inputs = kinds.flatMap((kind) => (kind ? [kind] : []))
        if (
          inputs.length === 0 ||
          inputs.length !== kinds.length ||
          !returned ||
          !isNumberLike(returned)
        ) {
          flag(
            fn,
            'a conversion takes numbers and text of digits, each with its own type, and dates, and returns a number',
          )
          continue
        }
        const typeNames = types.map((type) => checker.typeToString(type))
        if (new Set(typeNames).size !== typeNames.length)
          flag(
            fn,
            'two inputs share a type, so swapped arguments would compile',
          )
        const code = translateConversion(fn, source, inputs)
        for (const p of code.problems) flag(p.node, p.rule)
        if (code.cast && inputs.includes('date'))
          flag(
            code.cast,
            'a date may be invalid, and then this conversion gives NaN, which would carry the branded type into a classifier that counts whole numbers only; return a plain number, and let a predicate that tests Number.isSafeInteger give it its type, so that the invalid date gets an exit of its own',
          )
        let spec = code.expr
        if (options.partition === 'code+spec') {
          spec = undefined
          const specPath = specOf(name)
          const written = fn.parameters
            .map((p) => p.name.getText(source))
            .join(', ')
          if (!existsSync(specPath)) {
            flag(
              fn,
              `no spec: write ${project.path(specPath)} exporting function expected(${written}) built from ${vocabulary}`,
            )
            continue
          }
          const specSource = ts.createSourceFile(
            specPath,
            readFileSync(specPath, 'utf8'),
            ts.ScriptTarget.ES2022,
            true,
          )
          const expected = specSource.statements.find(
            (s): s is ts.FunctionDeclaration =>
              ts.isFunctionDeclaration(s) && s.name?.text === 'expected',
          )
          if (!expected || expected.parameters.length !== inputs.length) {
            flag(
              fn,
              `the spec of ${name} needs function expected(${written}) with the same ${inputs.length} inputs`,
            )
            continue
          }
          const read = translateConversion(expected, specSource, inputs)
          for (const p of read.problems)
            violations.push({
              file: project.path(specPath),
              line:
                specSource.getLineAndCharacterOfPosition(
                  p.node.getStart(specSource),
                ).line + 1,
              rule: p.rule,
            })
          spec = read.expr
        }
        if (!code.expr || !spec) continue
        const found = await conversionProbes(
          code.expr,
          spec,
          inputs,
          project.cache,
        )
        if (found.unknown > 0)
          flag(
            fn,
            `${found.unknown} questions came back unknown from the solver, so the claim is blocked`,
          )
        for (const mismatch of found.mismatches)
          flag(fn, `${mismatch}, so the claim is blocked; found: ${name}`)
        if (found.fraction)
          flag(
            fn,
            `the conversion gives ${found.fraction.value} for (${found.fraction.args.join(', ')}), and the classifiers that read its result count whole numbers only; round the result`,
          )
        obligations.push({
          kind: 'conversion',
          file: rel,
          name,
          inputs,
          neighbours: found.neighbours,
          equivalent: found.equivalent,
          probes: found.probes,
          assumes: fn.parameters.flatMap((p, i) => {
            const text = p.name.getText(source)
            return inputs[i] === 'number' && !types[i]?.isIntersection()
              ? [`${text} is a whole number`]
              : []
          }),
          cases: found.probes.length,
        })
      }
      continue
    }

    if (shape === 'decisions' || shape === 'classifiers') {
      for (const statement of source.statements) {
        if (
          ts.isImportDeclaration(statement) ||
          ts.isTypeAliasDeclaration(statement) ||
          ts.isInterfaceDeclaration(statement)
        )
          continue
        if (
          !ts.isFunctionDeclaration(statement) ||
          !isExported(statement) ||
          !statement.name
        ) {
          flag(statement, `only exported functions may sit in ${shape}`)
          continue
        }
        const fn = statement
        const name = statement.name.text
        const signature = checker.getSignatureFromDeclaration(fn)
        if (!signature) continue
        const outcomes =
          finiteValues(checker.getReturnTypeOfSignature(signature)) ?? []
        if (outcomes.length === 0) flag(fn, 'return type is not a finite union')
        pureBody(fn)

        if (shape === 'decisions') {
          const params = fn.parameters.map((p) => ({
            name: p.name.getText(source),
            type: checker.getTypeAtLocation(p),
          }))
          const first = params[0]
          const record =
            params.length === 1 &&
            first !== undefined &&
            Boolean(first.type.flags & ts.TypeFlags.Object)
          const dimensions: Dimension[] = []
          const sources =
            record && first
              ? checker.getPropertiesOfType(first.type).map((prop) => ({
                  name: prop.name,
                  type: checker.getTypeOfSymbolAtLocation(prop, fn),
                }))
              : params
          for (const input of sources) {
            const values = finiteValues(input.type)
            if (values) dimensions.push({ name: input.name, values })
            else flag(fn, `input ${input.name} is not a finite union`)
          }
          const signatures = dimensions.map((d) =>
            JSON.stringify(d.values.map(canonical).sort()),
          )
          if (new Set(signatures).size !== signatures.length)
            flag(
              fn,
              'two inputs share a type, so swapped arguments would compile',
            )
          const cases = dimensions.reduce(
            (product, d) => product * d.values.length,
            1,
          )
          if (cases > options.maxDomain)
            flag(
              fn,
              `domain of ${cases} exceeds ${options.maxDomain}; split into decisions joined by an intermediate finite type`,
            )
          obligations.push({
            kind: 'decision',
            file: rel,
            name,
            outcomes,
            style: record ? 'record' : 'positional',
            dimensions,
            cases,
          })
        } else {
          const param = fn.parameters[0]
          const paramTypes = fn.parameters.map((p) =>
            checker.getTypeAtLocation(p),
          )
          const paramType = paramTypes[0]
          const parts = paramType?.isUnion()
            ? paramType.types
            : paramType
              ? [paramType]
              : []
          const isUndefined = (t: ts.Type) =>
            Boolean(t.flags & ts.TypeFlags.Undefined)
          const isStringLike = (t: ts.Type): boolean =>
            Boolean(t.flags & ts.TypeFlags.StringLike) ||
            (t.isIntersection() && t.types.some(isStringLike))
          const cacheFile = project.cache
          const readBoth = (
            read: (
              f: ts.FunctionDeclaration,
              s: ts.SourceFile,
            ) => { classifier: Classifier; problems: Problem[] },
            vocabulary: string,
          ): { code: Classifier; spec: Classifier } | undefined => {
            const code = read(fn, source)
            for (const p of code.problems) flag(p.node, p.rule)
            if (options.partition === 'code')
              return code.problems.length > 0
                ? undefined
                : { code: code.classifier, spec: code.classifier }
            const specPath = specOf(name)
            const inputs = fn.parameters
              .map((p) => p.name.getText(source))
              .join(', ')
            if (!existsSync(specPath)) {
              flag(
                fn,
                `no spec: write ${project.path(specPath)} exporting function expected(${inputs}) in the same ${vocabulary} vocabulary`,
              )
              return undefined
            }
            const specSource = ts.createSourceFile(
              specPath,
              readFileSync(specPath, 'utf8'),
              ts.ScriptTarget.ES2022,
              true,
            )
            const expected = specSource.statements.find(
              (s): s is ts.FunctionDeclaration =>
                ts.isFunctionDeclaration(s) && s.name?.text === 'expected',
            )
            if (!expected) {
              flag(fn, `no spec function expected(${inputs}) for ${name}`)
              return undefined
            }
            if (expected.parameters.length !== fn.parameters.length) {
              flag(
                fn,
                `spec function expected() for ${name} takes ${expected.parameters.length} inputs and the code takes ${fn.parameters.length}`,
              )
              return undefined
            }
            const spec = read(expected, specSource)
            for (const p of spec.problems)
              violations.push({
                file: project.path(specPath),
                line:
                  specSource.getLineAndCharacterOfPosition(
                    p.node.getStart(specSource),
                  ).line + 1,
                rule: p.rule,
              })
            return code.problems.length + spec.problems.length > 0
              ? undefined
              : { code: code.classifier, spec: spec.classifier }
          }
          const blocked = (cells: {
            unknown: number
            mismatches: string[]
          }) => {
            if (cells.unknown > 0)
              flag(
                fn,
                `${cells.unknown} cells came back unknown from the solver, so the claim is blocked`,
              )
            for (const mismatch of cells.mismatches)
              flag(fn, `${mismatch}, so the claim is blocked; found: ${name}`)
          }
          if (
            fn.parameters.length === 1 &&
            parts.some(isStringLike) &&
            parts.every((t) => isStringLike(t) || isUndefined(t))
          ) {
            const allowsUndefined = parts.some(isUndefined)
            const both = readBoth(
              (f, s) => translate(f, s, allowsUndefined),
              'string',
            )
            if (!both) continue
            const cells = await stringCells(both.code, both.spec, cacheFile)
            blocked(cells)
            obligations.push({
              kind: 'classifier',
              input: 'string',
              file: rel,
              name,
              outcomes,
              atoms: cells.atoms,
              paths: cells.paths,
              infeasible: cells.infeasible,
              boundary: cells.boundary,
              probes: cells.probes,
              cases: cells.probes.length,
            })
            continue
          }
          if (
            fn.parameters.length === 1 &&
            paramType !== undefined &&
            paramType.flags & ts.TypeFlags.Unknown
          ) {
            const reads: Read[] = []
            const compared: Compared[] = []
            const both = readBoth((f, s) => {
              const read = translateUnknown(f, s)
              reads.push(...read.reads)
              compared.push(...read.compared)
              return read
            }, 'type-test')
            if (!both) continue
            const cells = unknownCells(both.code, both.spec, reads, compared)
            obligations.push({
              kind: 'classifier',
              input: 'unknown',
              file: rel,
              name,
              outcomes,
              atoms: cells.atoms,
              paths: cells.paths,
              probes: cells.probes,
              cases: cells.probes.length,
            })
            continue
          }
          const optional = paramTypes.map(
            (t) =>
              t.isUnion() &&
              t.types.some(isUndefined) &&
              t.types.some(isNumberLike) &&
              t.types.every((part) => isUndefined(part) || isNumberLike(part)),
          )
          if (
            paramTypes.every((t, i) => optional[i] || isNumberLike(t)) &&
            (fn.parameters.length > 1 || optional[0])
          ) {
            const typeNames = paramTypes.map((t) => checker.typeToString(t))
            if (new Set(typeNames).size !== typeNames.length)
              flag(
                fn,
                'two inputs share a type, so swapped arguments would compile',
              )
            const both = readBoth(
              (f, s) => translateNumbers(f, s, optional),
              'comparison',
            )
            if (!both) continue
            const cells = await numberCells(
              both.code,
              both.spec,
              optional,
              cacheFile,
            )
            blocked(cells)
            obligations.push({
              kind: 'classifier',
              input: 'numbers',
              file: rel,
              name,
              outcomes,
              atoms: cells.atoms,
              paths: cells.paths,
              infeasible: cells.infeasible,
              boundary: cells.boundary,
              probes: cells.probes,
              ...(() => {
                const plain = fn.parameters.flatMap((p, i) => {
                  const type = paramTypes[i]
                  const parts = type?.isUnion() ? type.types : [type]
                  return parts.some((part) => part?.isIntersection())
                    ? []
                    : [`${p.name.getText(source)} is a whole number`]
                })
                return plain.length > 0 ? { assumes: plain } : {}
              })(),
              cases: cells.probes.length,
            })
            continue
          }
          if (
            fn.parameters.length !== 1 ||
            !param ||
            !ts.isIdentifier(param.name) ||
            !isNumberLike(checker.getTypeAtLocation(param))
          ) {
            flag(
              fn,
              'a classifier takes one string (with or without undefined), one unknown value, or one or more numbers (each with or without undefined) that each have their own type',
            )
            continue
          }
          const paramSymbol = checker.getSymbolAtLocation(param.name)
          const found: Comparison[] = []
          walk(fn.body ?? fn, (node) => {
            if (
              !ts.isIdentifier(node) ||
              checker.getSymbolAtLocation(node) !== paramSymbol
            )
              return
            const parent = node.parent
            const op = ts.isBinaryExpression(parent)
              ? comparisons[parent.operatorToken.kind]
              : undefined
            const other = ts.isBinaryExpression(parent)
              ? parent.left === node
                ? parent.right
                : parent.left
              : undefined
            const constant = other ? numericLiteral(other) : undefined
            if (
              !op ||
              constant === undefined ||
              !ts.isBinaryExpression(parent)
            ) {
              flag(
                node,
                `${param.name.getText(source)} is used other than in a comparison with a number literal`,
              )
              return
            }
            found.push({
              op: parent.left === node ? op : (flipped[op] ?? op),
              constant,
            })
          })
          let intervals: readonly Interval[] | undefined
          if (options.partition === 'code+spec') {
            const written = existsSync(specOf(name))
              ? exportedValue(specOf(name), 'intervals')
              : undefined
            intervals = Array.isArray(written)
              ? written.flatMap((entry) => {
                  const row = entry as { min?: unknown; max?: unknown }
                  return typeof row.min === 'number' &&
                    typeof row.max === 'number'
                    ? [{ min: row.min, max: row.max, outcome: undefined }]
                    : []
                })
              : undefined
            if (Array.isArray(written) && intervals?.length !== written.length)
              intervals = undefined
            if (!intervals) flag(fn, `no spec intervals for ${name}`)
            const covers =
              intervals !== undefined &&
              intervals[0]?.min === Number.NEGATIVE_INFINITY &&
              intervals.at(-1)?.max === Number.POSITIVE_INFINITY &&
              intervals.every(
                (iv, i) =>
                  i === 0 ||
                  iv.min === (intervals?.[i - 1]?.max ?? Number.NaN) + 1,
              )
            if (intervals && !covers)
              flag(
                fn,
                `spec intervals for ${name} do not cover every integer exactly once`,
              )
          }
          const probes = classifierProbes(found, intervals)
          obligations.push({
            kind: 'classifier',
            input: 'number',
            file: rel,
            name,
            outcomes,
            comparisons: found,
            intervals: (intervals ?? []).map(({ min, max }) => ({
              min: Number.isFinite(min) ? min : null,
              max: Number.isFinite(max) ? max : null,
            })),
            probes,
            ...(checker.getTypeAtLocation(param).isIntersection()
              ? {}
              : {
                  assumes: [`${param.name.getText(source)} is a whole number`],
                }),
            cases: probes.length,
          })
        }
      }
    }

    if (shape === 'adapters') {
      for (const statement of source.statements) {
        if (
          ts.isImportDeclaration(statement) ||
          ts.isExportDeclaration(statement) ||
          ts.isTypeAliasDeclaration(statement) ||
          ts.isInterfaceDeclaration(statement)
        )
          continue
        const errorClass =
          ts.isClassDeclaration(statement) &&
          statement.members.length === 0 &&
          (statement.heritageClauses ?? []).some(
            (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword,
          )
        if (errorClass) continue
        if (
          !ts.isFunctionDeclaration(statement) ||
          !isExported(statement) ||
          !statement.name
        ) {
          flag(
            statement,
            'an adapter file holds exported adapters, the error classes they name (class <Name> extends <ErrorClass> {}) and types',
          )
          continue
        }
        const fn = statement
        const body = fn.body?.statements ?? ts.factory.createNodeArray()
        const only = body[0]
        if (
          body.length !== 1 ||
          !only ||
          !ts.isTryStatement(only) ||
          !only.catchClause
        ) {
          flag(fn, 'an adapter body is exactly one try/catch')
          continue
        }
        walk(only.tryBlock, (node) => {
          if (
            ts.isIfStatement(node) ||
            ts.isConditionalExpression(node) ||
            loops.has(node.kind) ||
            ts.isSwitchStatement(node)
          )
            flag(node, 'branch inside an adapter try block')
        })
        const catchClause = only.catchClause
        const caught =
          catchClause.variableDeclaration &&
          ts.isIdentifier(catchClause.variableDeclaration.name)
            ? catchClause.variableDeclaration.name.text
            : 'error'
        const handlers = catchClause.block.statements
        const last = handlers.at(-1)
        const rethrows =
          last !== undefined &&
          ts.isThrowStatement(last) &&
          ts.isIdentifier(last.expression) &&
          last.expression.text === caught
        if (!rethrows)
          flag(
            catchClause,
            `the catch must end with: throw ${caught}, so an error it doesn't name (a TypeError, for instance) isn't reported as a variant`,
          )
        const errorNamed = (handler: ts.Statement): string | undefined => {
          if (!ts.isIfStatement(handler) || handler.elseStatement)
            return undefined
          const test = handler.expression
          if (
            ts.isBinaryExpression(test) &&
            test.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword &&
            ts.isIdentifier(test.left) &&
            test.left.text === caught
          )
            return test.right.getText(source)
          const argument = ts.isCallExpression(test)
            ? test.arguments[0]
            : undefined
          if (
            ts.isCallExpression(test) &&
            ts.isIdentifier(test.expression) &&
            test.arguments.length === 1 &&
            argument &&
            ts.isIdentifier(argument) &&
            argument.text === caught
          ) {
            const target = declaredIn(test.expression)[0]
            if (
              target &&
              shapeOf(target.getSourceFile().fileName) === 'classifiers'
            )
              return test.expression.text
          }
          return undefined
        }
        const named = handlers
          .slice(0, rethrows ? -1 : undefined)
          .map((handler) => {
            const error = errorNamed(handler)
            if (error === undefined)
              flag(
                handler,
                `each catch statement must be: if (${caught} instanceof <ErrorClass>) return <variant>, or if (<a classifier of the error>(${caught})) return <variant>; found: ${handler.getText(source).split('\n')[0]}`,
              )
            return error
          })
          .flatMap((error) => (error === undefined ? [] : [error]))
        const specPath = specOf(fn.name?.text ?? '')
        const stated = existsSync(specPath)
          ? exportedValue(specPath, 'port')
          : undefined
        const use = stated as
          | { contract?: unknown; member?: unknown }
          | undefined
        const port: PortUse | undefined =
          typeof use?.contract === 'string' && typeof use.member === 'string'
            ? { contract: use.contract, member: use.member }
            : undefined
        if (stated !== undefined && !port)
          flag(
            fn,
            "the spec's port must be { contract: '<id>', member: '<name>' }",
          )
        if (port) {
          const backing = contracts.find((c) => c.id === port.contract)
          const member = backing?.contract?.members[port.member]
          if (!backing || backing.problems.length > 0 || !member)
            flag(
              fn,
              `the spec says this adapter stands on ${port.member} of the contract ${port.contract}, and no accepted contract has that member`,
            )
          else
            afterEveryFile.push((memberCalls) => {
              const direct = memberCalls.filter(
                (call) =>
                  call.contract === port.contract &&
                  call.member === port.member,
              )
              const through: ts.CallExpression[] = []
              const passedIn = fn.parameters[0]?.name.getText(source)
              walk(only.tryBlock, (node) => {
                if (!ts.isCallExpression(node)) return
                let receiver = node.expression
                while (ts.isPropertyAccessExpression(receiver))
                  receiver = receiver.expression
                if (
                  receiver !== node.expression &&
                  ts.isIdentifier(receiver) &&
                  receiver.text === passedIn
                )
                  through.push(node)
              })
              const own = through[0]
              const calls: MemberCall[] =
                direct.length > 0 || through.length !== 1 || !own
                  ? direct
                  : [
                      {
                        contract: port.contract,
                        member: port.member,
                        at: `${rel}:${source.getLineAndCharacterOfPosition(own.getStart(source)).line + 1}, the adapter's own call through the object passed in, the only call of the member in the project`,
                        excluded: excludedAt(checker, own, member.throws).map(
                          ({ thrown }) => thrown.when,
                        ),
                      },
                    ]
              const ruledOut = member.throws.filter(
                (t) =>
                  calls.length > 0 &&
                  calls.every((call) => call.excluded.includes(t.when)),
              )
              const declared = member.throws
                .filter((t) => !ruledOut.includes(t))
                .map((t) => t.error)
              for (const error of declared)
                if (!named.includes(error))
                  flag(
                    fn,
                    `the contract ${port.contract} says ${port.member} throws ${error}, and the catch has no statement for it`,
                  )
              for (const error of named) {
                if (declared.includes(error)) continue
                const scope = ruledOut.find((t) => t.error === error)?.argument
                flag(
                  fn,
                  scope
                    ? `the catch names ${error}, which no call of ${port.member} in this project can get: the contract ${port.contract} says it is thrown ${argumentScope(scope)}, and every one of the ${calls.length} calls (${calls.map((call) => call.at).join(', ')}) passes one; remove the statement and its variant`
                    : `the catch names ${error}, which the contract ${port.contract} does not list for ${port.member}`,
                )
              }
            })
        }
        const returned = new Map<string, number>()
        walk(fn, (node) => {
          if (!ts.isReturnStatement(node) || !node.expression) return
          const value = node.expression
          const tag = ts.isObjectLiteralExpression(value)
            ? value.properties.find(
                (p): p is ts.PropertyAssignment =>
                  ts.isPropertyAssignment(p) &&
                  p.name.getText(source) === 'kind',
              )?.initializer
            : value
          if (tag && ts.isStringLiteral(tag))
            returned.set(tag.text, (returned.get(tag.text) ?? 0) + 1)
        })
        const signature = checker.getSignatureFromDeclaration(fn)
        const promised = signature
          ? checker.getAwaitedType(checker.getReturnTypeOfSignature(signature))
          : undefined
        const members = promised?.isUnion()
          ? promised.types
          : promised
            ? [promised]
            : []
        const variants = members.map((member) => {
          if (member.isStringLiteral())
            return { tag: member.value, carriesData: false, bare: true }
          const kind = checker.getPropertyOfType(member, 'kind')
          const kindType = kind
            ? checker.getTypeOfSymbolAtLocation(kind, fn)
            : undefined
          return kindType?.isStringLiteral()
            ? {
                tag: kindType.value,
                carriesData: true,
                bare: checker.getPropertiesOfType(member).length === 1,
              }
            : undefined
        })
        const tags = variants.flatMap((v) => (v ? [v.tag] : []))
        if (
          tags.length === 0 ||
          tags.length !== members.length ||
          new Set(tags).size !== tags.length
        ) {
          const resolved = promised ? checker.typeToString(promised) : 'unknown'
          flag(
            fn,
            `an adapter resolves to a union of string literals, or of objects that each carry their own literal kind; found: Promise<${resolved}>`,
          )
          continue
        }
        for (const tag of tags) {
          const places = returned.get(tag) ?? 0
          if (places === 0) flag(fn, `variant ${tag} is never returned`)
          if (places > 1)
            flag(
              fn,
              `variant ${tag} is returned in ${places} places, and one check per variant covers one return; give each return its own variant`,
            )
        }
        obligations.push({
          kind: 'adapter',
          file: rel,
          name: fn.name?.text ?? '?',
          variants: tags,
          bare: variants.flatMap((v) => (v?.bare ? [v.tag] : [])),
          asynchronous:
            signature !== undefined &&
            checker.getReturnTypeOfSignature(signature) !== promised,
          carriesData: variants.some((v) => v?.carriesData),
          rethrows,
          cases: tags.length + (rethrows ? 1 : 0),
        })
      }
    }

    if (shape === 'wiring') {
      const maps = new Map<ts.Symbol, ts.Node>()
      for (const statement of source.statements) {
        const admittedStatement =
          ts.isImportDeclaration(statement) ||
          ts.isExportDeclaration(statement) ||
          ts.isTypeAliasDeclaration(statement) ||
          ts.isInterfaceDeclaration(statement) ||
          ts.isVariableStatement(statement) ||
          (ts.isFunctionDeclaration(statement) && isExported(statement))
        if (!admittedStatement)
          flag(
            statement,
            'a wiring file holds exported handlers, exported dispatch maps and types',
          )
        if (!ts.isVariableStatement(statement)) continue
        if (!isExported(statement))
          flag(
            statement,
            'a dispatch map is exported, so that its check can read it',
          )
        for (const decl of statement.declarationList.declarations) {
          const annotation = decl.type
          const keyNode =
            annotation &&
            ts.isTypeReferenceNode(annotation) &&
            annotation.typeName.getText(source) === 'Record'
              ? annotation.typeArguments?.[0]
              : undefined
          const symbol = checker.getSymbolAtLocation(decl.name)
          if (
            !keyNode ||
            !decl.initializer ||
            !symbol ||
            !(statement.declarationList.flags & ts.NodeFlags.Const)
          ) {
            flag(
              decl,
              'module-level values in wiring are const Record<FiniteKey, V> dispatch maps',
            )
            continue
          }
          const keys = finiteValues(checker.getTypeFromTypeNode(keyNode))
          if (!keys) {
            flag(decl, 'dispatch map key is not a finite union')
            continue
          }
          maps.set(symbol, decl.initializer)
          obligations.push({
            kind: 'route',
            file: rel,
            name: decl.name.getText(source),
            keys,
            cases: keys.length,
          })
        }
      }
      const inMap = (node: ts.Node) =>
        [...maps.values()].some((init) => within(node, init))
      const guards = new Map<ts.Node, Guard>()
      const guardLiterals = new Set<ts.Node>()
      const isPath = (expr: ts.Expression): boolean =>
        ts.isIdentifier(expr) ||
        (ts.isPropertyAccessExpression(expr) &&
          !expr.questionDotToken &&
          isPath(expr.expression))
      const guardOf = (statement: ts.IfStatement): Guard | undefined => {
        const then = statement.thenStatement
        const only =
          ts.isBlock(then) && then.statements.length === 1
            ? then.statements[0]
            : then
        if (statement.elseStatement || !only || !ts.isReturnStatement(only))
          return undefined
        const place = { statement: statement.getText(source) }
        const negated =
          ts.isPrefixUnaryExpression(statement.expression) &&
          statement.expression.operator === ts.SyntaxKind.ExclamationToken
        const test = ts.isPrefixUnaryExpression(statement.expression)
          ? statement.expression.operand
          : statement.expression
        if (ts.isCallExpression(test)) {
          const called = checker.getResolvedSignature(test)
          const returns = called
            ? checker.getReturnTypeOfSignature(called)
            : undefined
          return returns && returns.flags & ts.TypeFlags.Boolean
            ? {
                subject: test.getText(source),
                exits: [negated ? 'false' : 'true'],
                ...place,
              }
            : undefined
        }
        if (negated || !ts.isBinaryExpression(test)) return undefined
        const equal =
          test.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
        if (
          !equal &&
          test.operatorToken.kind !== ts.SyntaxKind.ExclamationEqualsEqualsToken
        )
          return undefined
        const literal = ts.isStringLiteral(test.right)
          ? test.right
          : ts.isStringLiteral(test.left)
            ? test.left
            : undefined
        const subject = literal === test.right ? test.left : test.right
        if (!literal || !(isPath(subject) || ts.isCallExpression(subject)))
          return undefined
        const values = finiteValues(checker.getTypeAtLocation(subject))
        if (!values?.includes(literal.text)) return undefined
        guardLiterals.add(literal)
        return {
          subject: subject.getText(source),
          exits: equal
            ? [literal.text]
            : values.filter((v) => v !== literal.text).map(String),
          ...place,
        }
      }
      for (const statement of source.statements) {
        if (!ts.isFunctionDeclaration(statement) || !isExported(statement))
          continue
        for (const inner of statement.body?.statements ?? []) {
          const guard = ts.isIfStatement(inner) ? guardOf(inner) : undefined
          if (guard) guards.set(inner, guard)
        }
      }
      walk(source, (node) => {
        if (
          (ts.isIfStatement(node) && !guards.has(node)) ||
          ts.isConditionalExpression(node) ||
          ts.isSwitchStatement(node) ||
          loops.has(node.kind)
        )
          flag(
            node,
            "branch in wiring; the one branch wiring admits is a guard written as a statement of the handler: if (<value> !== '<literal>') return ..., if (<value> === '<literal>') return ..., or if (!<predicate>(<value>)) return ...",
          )
        if (ts.isTryStatement(node)) flag(node, 'try in wiring')
        if (ts.isBinaryExpression(node) && logical.has(node.operatorToken.kind))
          flag(node, 'short-circuit branch in wiring')
        if (
          (ts.isPropertyAccessExpression(node) ||
            ts.isElementAccessExpression(node) ||
            ts.isCallExpression(node)) &&
          node.questionDotToken
        )
          flag(node, 'optional chaining in wiring')
        const literal =
          ts.isStringLiteral(node) ||
          ts.isNumericLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node) ||
          ts.isTemplateExpression(node) ||
          node.kind === ts.SyntaxKind.TrueKeyword ||
          node.kind === ts.SyntaxKind.FalseKeyword ||
          node.kind === ts.SyntaxKind.NullKeyword
        const tag =
          node.parent !== undefined &&
          ts.isPropertyAssignment(node.parent) &&
          node.parent.initializer === node &&
          ts.isStringLiteral(node) &&
          ts.isReturnStatement(node.parent.parent.parent)
        if (literal && !inMap(node) && !guardLiterals.has(node) && !tag)
          flag(node, 'literal in wiring outside a dispatch map')
        if (ts.isElementAccessExpression(node)) {
          const target = ts.isIdentifier(node.expression)
            ? checker.getSymbolAtLocation(node.expression)
            : undefined
          if (!target || !maps.has(target))
            flag(node, 'computed access to something other than a dispatch map')
        }
        if (ts.isCallExpression(node)) {
          const callee = node.expression
          const holder =
            ts.isPropertyAccessExpression(callee) &&
            ts.isIdentifier(callee.expression)
              ? checker.getSymbolAtLocation(callee.expression)
              : undefined
          const viaMap =
            ts.isElementAccessExpression(callee) ||
            (holder !== undefined && maps.has(holder))
          const target = ts.isIdentifier(callee)
            ? declaredIn(callee)[0]
            : undefined
          const admitted =
            target !== undefined &&
            ['decisions', 'classifiers', 'adapters', 'conversions'].includes(
              shapeOf(target.getSourceFile().fileName) ?? '',
            )
          if (!viaMap && !admitted)
            flag(
              node,
              `call to ${callee.getText(source)}, which is not an admitted function or dispatch map`,
            )
        }
      })
      for (const statement of source.statements) {
        if (
          !ts.isFunctionDeclaration(statement) ||
          !isExported(statement) ||
          !statement.name
        )
          continue
        for (const param of statement.parameters) {
          const type = checker.getTypeAtLocation(param)
          const fields =
            type.flags & ts.TypeFlags.Object
              ? checker.getPropertiesOfType(type)
              : []
          const props = fields.map((p) =>
            checker.typeToString(
              checker.getTypeOfSymbolAtLocation(p, statement),
            ),
          )
          if (new Set(props).size !== props.length)
            flag(
              param,
              `${param.name.getText(source)} has two fields of one type, so a swap would compile`,
            )
        }
        const stages = (statement.body?.statements ?? []).flatMap((inner) => {
          const guard = guards.get(inner)
          return guard ? [guard] : []
        })
        obligations.push({
          kind: 'handler',
          file: rel,
          name: statement.name.text,
          guards: stages,
          cases: 1 + stages.reduce((n, g) => n + g.exits.length, 0),
        })
      }
    }
  }
  const memberCalls =
    afterEveryFile.length > 0
      ? findSites(project, contracts, program).calls
      : []
  for (const check of afterEveryFile) check(memberCalls)
  if (options.partition === 'code+spec')
    for (const o of obligations) {
      const needed =
        o.kind === 'decision'
          ? ['rows']
          : o.kind === 'route'
            ? ['expected']
            : o.kind === 'adapter'
              ? [
                  'args',
                  'fake',
                  'provoke',
                  ...(o.rethrows ? ['unnamed'] : []),
                  ...(o.carriesData ? ['expected'] : []),
                ]
              : o.kind === 'handler'
                ? [
                    'observe',
                    'expected',
                    ...(o.guards.length > 0 ? ['order', 'exits'] : []),
                  ]
                : []
      if (needed.length === 0) continue
      const specPath = project.spec(o.name, o.file)
      const written = existsSync(specPath)
        ? exportedNames(specPath)
        : new Set<string>()
      const missing = needed.filter((name) => !written.has(name))
      if (missing.length > 0)
        violations.push({
          file: o.file,
          line: 1,
          rule: existsSync(specPath)
            ? `the spec of ${o.name} (${project.path(specPath)}) does not export ${missing.join(', ')}, which the checks of ${o.kind === 'route' ? 'a dispatch map' : `a ${o.kind}`} need; found: ${o.name}`
            : `no spec: write ${project.path(specPath)} exporting ${needed.join(', ')}; found: ${o.name}`,
        })
    }
  const names = obligations.map((o) => o.name)
  for (const o of obligations)
    if (names.indexOf(o.name) !== names.lastIndexOf(o.name))
      violations.push({
        file: o.file,
        line: 1,
        rule: `two units are named ${o.name}, and a spec is found by the name of its unit; found: ${o.name}`,
      })
  for (const o of obligations) {
    if (o.kind === 'contract') continue
    const specPath = project.spec(o.name, o.file)
    const open = existsSync(specPath)
      ? exportedValue(specPath, 'unsettled')
      : undefined
    for (const text of Array.isArray(open) ? open : [])
      if (typeof text === 'string')
        unsettled.push({
          file: project.path(specPath),
          unit: o.name,
          text,
        })
  }
  return { obligations, violations, outside, unsettled }
}

function argument(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const partition: Partition =
    argument('partition') === 'code' ? 'code' : 'code+spec'
  const project = loadProject(rootFrom())
  const root = project.root
  const named = argument('out')
  const out = named ? resolve(root, named) : project.obligations
  const result = await computeInventory({
    partition,
    maxDomain: Number(argument('max-domain') ?? 4096),
    project,
  })
  const json = `${JSON.stringify({ partition, obligations: result.obligations }, null, 2)}\n`
  const rejected = new Set(result.violations.map((v) => v.file))
  const isAdmitted = (o: Obligation) =>
    !rejected.has(o.file) &&
    !rejected.has(project.path(project.spec(o.name, o.file)))
  for (const o of result.obligations)
    console.log(
      isAdmitted(o)
        ? `${o.kind.padEnd(10)} ${o.name.padEnd(22)} ${String(o.cases).padStart(4)} cases`
        : `${o.kind.padEnd(10)} ${o.name.padEnd(22)} not counted: its file or its spec has a REJECTED line`,
    )
  console.log(
    `${(rejected.size > 0 ? 'total, admitted units only' : 'total').padEnd(33)} ${String(
      result.obligations.filter(isAdmitted).reduce((n, o) => n + o.cases, 0),
    ).padStart(4)} cases`,
  )
  for (const v of result.violations)
    console.log(`REJECTED ${v.file}:${v.line} ${v.rule}`)
  for (const o of result.obligations)
    if ('assumes' in o)
      for (const assumed of o.assumes ?? [])
        console.log(`ASSUMES ${o.file} ${o.name}: ${assumed}`)
  for (const point of result.unsettled)
    console.log(`UNSETTLED ${point.file} ${point.unit}: ${point.text}`)
  if (result.unsettled.length > 0)
    console.log(
      `${result.unsettled.length} points of the requirement are unsettled; the checks that rest on them repeat the code until a person settles them`,
    )
  for (const file of result.outside) console.log(`OUTSIDE ${file}`)
  if (result.outside.length > 0)
    console.log(
      `${result.outside.length} files are declared outside the claim; nothing above says anything about them`,
    )
  if (process.argv.includes('--check')) {
    const current = JSON.stringify(JSON.parse(readFileSync(out, 'utf8')))
    if (current !== JSON.stringify(JSON.parse(json))) {
      console.log(
        `STALE ${project.path(out)} differs from the code; rerun the inventory`,
      )
      process.exitCode = 1
    }
  } else {
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, json)
  }
  if (result.violations.length > 0) process.exitCode = 1
  process.exit()
}
