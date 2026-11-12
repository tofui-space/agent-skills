import { existsSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'ts6'
import {
  type LoadedContract,
  type ResultType,
  argumentScope,
  loadContracts,
} from './contracts.ts'
import { backing, excludedAt } from './ports.ts'
import { translateNumbers } from './number-classifier.ts'
import { type Shape, loadProject, rootFrom, settingsFile } from './project.ts'
import { translate } from './string-classifier.ts'
import { translateUnknown } from './unknown-classifier.ts'

export type SourceKind =
  | 'finite input'
  | 'open input'
  | 'literal'
  | 'builtin call'
  | 'library call'
  | 'project call'
  | 'outside state'
  | 'thrown value'
  | 'clock or random read'
  | 'pure project call'
  | 'counted call'
  | 'adapter call'
  | 'conversion call'
  | 'untraced variable'
export type Exit = {
  readonly line: number
  readonly kind: 'return' | 'throw' | 'may throw'
  readonly text: string
  readonly conditions: string[]
  readonly decidable: boolean
  readonly never?: string
}
export type Source = {
  readonly kind: SourceKind
  readonly text: string
  readonly line: number
  readonly type?: string
}
export type Branch = {
  readonly line: number
  readonly construct: string
  readonly text: string
  readonly sources: Source[]
  readonly computable: boolean
  readonly twoInputs: boolean
}
export type Merge = {
  readonly line: number
  readonly text: string
  readonly into: string
  readonly from: 'condition' | 'handler'
}
export type Site = { readonly line: number; readonly text: string }
export type FunctionReport = {
  readonly name: string
  readonly line: number
  readonly exits: Exit[]
  readonly branches: Branch[]
  readonly merges: Merge[]
  readonly effects: Site[]
  readonly outside: Source[]
  readonly reshape: string[]
  readonly dead: Site[]
  readonly ruledOut: Site[]
}

const closedKinds = new Set<SourceKind>([
  'finite input',
  'literal',
  'counted call',
  'adapter call',
])
const short = (text: string) => {
  const flat = text.replace(/\s+/g, ' ')
  return flat.length > 70 ? `${flat.slice(0, 67)}...` : flat
}

function loadProgram(file: string): ts.Program {
  const config = ts.findConfigFile(dirname(file), ts.sys.fileExists)
  if (!config) return ts.createProgram([file], { strict: true, noEmit: true })
  const host: ts.ParseConfigFileHost = {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: () => undefined,
  }
  const parsed = ts.getParsedCommandLineOfConfigFile(config, {}, host)
  const names = parsed?.fileNames.includes(file)
    ? parsed.fileNames
    : [...(parsed?.fileNames ?? []), file]
  return ts.createProgram(names, parsed?.options ?? { strict: true })
}

function nameOf(fn: ts.SignatureDeclaration): string | undefined {
  if (fn.name && ts.isIdentifier(fn.name)) return fn.name.text
  const parent = fn.parent
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name))
    return parent.name.text
  if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name))
    return parent.name.text
  return undefined
}

export function diagnose(
  path: string,
  at?: number,
  contracts: readonly LoadedContract[] = [],
  matched: Map<string, number> = new Map(),
  shapeOf?: (file: string) => Shape | undefined,
): FunctionReport[] {
  const file = resolve(path)
  const program = loadProgram(file)
  const checker = program.getTypeChecker()
  const source = program.getSourceFile(file)
  if (!source) throw new Error(`${path} is not part of its TypeScript program`)
  const lineOf = (node: ts.Node) =>
    source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1

  const isFiniteType = (type: ts.Type): boolean => {
    const literal =
      ts.TypeFlags.BooleanLiteral |
      ts.TypeFlags.StringLiteral |
      ts.TypeFlags.NumberLiteral |
      ts.TypeFlags.Undefined |
      ts.TypeFlags.Null |
      ts.TypeFlags.Void |
      ts.TypeFlags.EnumLiteral
    if (type.flags & literal) return true
    return type.isUnion() && type.types.every(isFiniteType)
  }

  const declarationOf = (id: ts.Identifier): ts.Declaration | undefined => {
    let symbol = checker.getSymbolAtLocation(id)
    if (symbol && symbol.flags & ts.SymbolFlags.Alias)
      symbol = checker.getAliasedSymbol(symbol)
    return symbol?.declarations?.[0]
  }

  const within = (inner: ts.Node, outer: ts.Node) =>
    inner.pos >= outer.pos && inner.end <= outer.end

  const isModuleConstant = (d: ts.Node): boolean =>
    ts.isVariableDeclaration(d) &&
    ts.isVariableDeclarationList(d.parent) &&
    Boolean(d.parent.flags & ts.NodeFlags.Const) &&
    ts.isVariableStatement(d.parent.parent) &&
    ts.isSourceFile(d.parent.parent.parent) &&
    d.initializer !== undefined &&
    (ts.isObjectLiteralExpression(d.initializer) ||
      ts.isArrayLiteralExpression(d.initializer) ||
      ts.isLiteralExpression(d.initializer))

  const isNumberLike = (type: ts.Type): boolean =>
    Boolean(type.flags & ts.TypeFlags.NumberLike) ||
    (type.isIntersection() &&
      type.types.some((part) => Boolean(part.flags & ts.TypeFlags.NumberLike)))

  const isNamed = (node: ts.Node): node is ts.FunctionLikeDeclaration =>
    (ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node)) &&
    nameOf(node) !== undefined

  const ambientReads = new Set([
    'Date.now',
    'Math.random',
    'crypto.randomUUID',
    'performance.now',
  ])
  const isAmbientRead = (node: ts.Node): boolean =>
    (ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'Date' &&
      (node.arguments?.length ?? 0) === 0) ||
    (ts.isCallExpression(node) &&
      ambientReads.has(node.expression.getText(source)))
  const conversions = new Set(['String', 'Number', 'Boolean'])

  const purity = new Map<ts.Node, boolean>()
  const callKind = (call: ts.CallExpression | ts.NewExpression): SourceKind => {
    const declaration = checker.getResolvedSignature(call)?.declaration
    const fileName = declaration?.getSourceFile().fileName ?? ''
    if (
      declaration &&
      program.isSourceFileDefaultLibrary(declaration.getSourceFile())
    )
      return 'builtin call'
    if (fileName.includes('/typescript/lib/lib.')) return 'builtin call'
    if (fileName.includes('/node_modules/')) return 'library call'
    const placed = shapeOf?.(fileName)
    if (placed === 'wiring' || placed === 'adapters') return 'adapter call'
    if (placed === 'classifiers' || placed === 'decisions')
      return 'counted call'
    if (placed === 'conversions') return 'conversion call'
    const body =
      declaration && 'body' in declaration
        ? (declaration as ts.FunctionLikeDeclaration).body
        : undefined
    if (!body) return 'project call'
    const callee = declaration as ts.FunctionLikeDeclaration
    if (isAdapterShape(callee)) return 'adapter call'
    if (isStringClassifier(callee)) return 'counted call'
    if (!purity.has(body)) {
      purity.set(body, false)
      let pure = true
      const check = (node: ts.Node): void => {
        if (ts.isAwaitExpression(node)) pure = false
        if (
          (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
          callKind(node) !== 'builtin call'
        )
          pure = false
        if (pure) ts.forEachChild(node, check)
      }
      check(body)
      purity.set(body, pure)
    }
    if (!purity.get(body)) return 'project call'
    const finite =
      callee.parameters.every((p) =>
        isFiniteType(checker.getTypeAtLocation(p)),
      ) && isFiniteType(checker.getTypeAtLocation(call))
    return finite ? 'counted call' : 'pure project call'
  }

  const isAdapterShape = (fn: ts.FunctionLikeDeclaration): boolean => {
    const signature = checker.getSignatureFromDeclaration(fn)
    const resolved = signature
      ? checker.getAwaitedType(checker.getReturnTypeOfSignature(signature))
      : undefined
    const statements = fn.body && ts.isBlock(fn.body) ? fn.body.statements : []
    const carriesKind = (type: ts.Type): boolean => {
      const kind = checker.getPropertyOfType(type, 'kind')
      return (
        kind !== undefined &&
        checker.getTypeOfSymbolAtLocation(kind, fn).isStringLiteral()
      )
    }
    return (
      resolved !== undefined &&
      (isFiniteType(resolved) ||
        (resolved.isUnion()
          ? resolved.types.every(carriesKind)
          : carriesKind(resolved))) &&
      statements.length === 1 &&
      statements[0] !== undefined &&
      ts.isTryStatement(statements[0])
    )
  }

  const rootOf = (node: ts.Expression): ts.Expression => {
    let current = node
    while (
      ts.isPropertyAccessExpression(current) ||
      ts.isElementAccessExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isParenthesizedExpression(current)
    )
      current = current.expression
    return current
  }

  const sourcesOf = (
    start: ts.Node,
    fn: ts.FunctionLikeDeclaration,
    seen = new Set<ts.Node>(),
  ): Source[] => {
    const out: Source[] = []
    const visit = (node: ts.Node): void => {
      if (ts.isTypeNode(node) || seen.has(node)) return
      seen.add(node)
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ['then', 'catch', 'finally'].includes(node.expression.name.text)
      ) {
        visit(node.expression.expression)
        return
      }
      if (isAmbientRead(node)) {
        out.push({
          kind: 'clock or random read',
          text: short(node.getText(source)),
          line: lineOf(node),
        })
        return
      }
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        conversions.has(node.expression.text) &&
        node.arguments.length === 1 &&
        node.arguments[0]
      ) {
        visit(node.arguments[0])
        return
      }
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        const kind = callKind(node)
        out.push({
          kind,
          text: short(node.expression.getText(source)),
          line: lineOf(node),
        })
        const callee = node.expression
        if (
          kind === 'builtin call' &&
          (ts.isPropertyAccessExpression(callee) ||
            ts.isElementAccessExpression(callee))
        )
          visit(callee.expression)
        return
      }
      if (
        (ts.isPropertyAccessExpression(node) ||
          ts.isElementAccessExpression(node)) &&
        ts.isIdentifier(rootOf(node))
      ) {
        const root = rootOf(node) as ts.Identifier
        const declaration = declarationOf(root)
        if (
          declaration &&
          ts.isParameter(declaration) &&
          declaration.parent === fn
        ) {
          const type = checker.getTypeAtLocation(node)
          out.push({
            kind: isFiniteType(type) ? 'finite input' : 'open input',
            text: short(node.getText(source)),
            line: lineOf(node),
            type: short(checker.typeToString(type)),
          })
          return
        }
        visit(node.expression)
        if (ts.isElementAccessExpression(node)) visit(node.argumentExpression)
        return
      }
      if (ts.isIdentifier(node)) {
        if (node.text === 'undefined') {
          out.push({ kind: 'literal', text: 'undefined', line: lineOf(node) })
          return
        }
        const declaration = declarationOf(node)
        if (!declaration) return
        if (ts.isParameter(declaration)) {
          if (declaration.parent === fn) {
            const type = checker.getTypeAtLocation(node)
            out.push({
              kind: isFiniteType(type) ? 'finite input' : 'open input',
              text: node.text,
              line: lineOf(node),
              type: short(checker.typeToString(type)),
            })
          } else if (within(declaration, fn)) {
            const callback = declaration.parent
            const call = callback.parent
            if (ts.isCallExpression(call)) visit(call)
          } else {
            out.push({
              kind: 'outside state',
              text: node.text,
              line: lineOf(node),
            })
          }
          return
        }
        const variable = ts.isBindingElement(declaration)
          ? ts.findAncestor(declaration, ts.isVariableDeclaration)
          : declaration
        if (variable && ts.isVariableDeclaration(variable)) {
          if (ts.isCatchClause(variable.parent)) {
            out.push({
              kind: 'thrown value',
              text: node.text,
              line: lineOf(node),
            })
          } else if (isModuleConstant(variable)) {
            out.push({ kind: 'literal', text: node.text, line: lineOf(node) })
          } else if (within(variable, fn)) {
            const fixed =
              ts.isVariableDeclarationList(variable.parent) &&
              Boolean(variable.parent.flags & ts.NodeFlags.Const) &&
              variable.initializer !== undefined
            if (fixed && variable.initializer) visit(variable.initializer)
            else
              out.push({
                kind: 'untraced variable',
                text: node.text,
                line: lineOf(node),
              })
          } else {
            out.push({
              kind: 'outside state',
              text: node.text,
              line: lineOf(node),
            })
          }
        }
        return
      }
      if (
        ts.isStringLiteral(node) ||
        ts.isNumericLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isRegularExpressionLiteral(node) ||
        node.kind === ts.SyntaxKind.TrueKeyword ||
        node.kind === ts.SyntaxKind.FalseKeyword ||
        node.kind === ts.SyntaxKind.NullKeyword
      ) {
        out.push({
          kind: 'literal',
          text: short(node.getText(source)),
          line: lineOf(node),
        })
        return
      }
      if (isNamed(node)) return
      ts.forEachChild(node, visit)
    }
    visit(start)
    return out
  }

  const constant = (node: ts.Node | undefined): string | undefined => {
    if (!node) return 'undefined'
    if (ts.isBlock(node)) {
      const only = node.statements[0]
      if (node.statements.length === 0) return 'undefined'
      if (node.statements.length === 1 && only && ts.isReturnStatement(only))
        return constant(only.expression)
      return undefined
    }
    if (ts.isParenthesizedExpression(node)) return constant(node.expression)
    if (
      (ts.isIdentifier(node) && node.text === 'undefined') ||
      ts.isLiteralExpression(node) ||
      node.kind === ts.SyntaxKind.NullKeyword ||
      node.kind === ts.SyntaxKind.FalseKeyword ||
      node.kind === ts.SyntaxKind.TrueKeyword ||
      ts.isVoidExpression(node)
    )
      return node.getText(source)
    if (
      ts.isObjectLiteralExpression(node) &&
      node.properties.every(
        (p) =>
          ts.isPropertyAssignment(p) && constant(p.initializer) !== undefined,
      )
    )
      return short(node.getText(source))
    return undefined
  }

  const numberCell = (
    condition: ts.Node,
    fn: ts.FunctionLikeDeclaration,
  ): boolean => {
    if (!ts.isBinaryExpression(condition)) return false
    const comparison = [
      ts.SyntaxKind.LessThanToken,
      ts.SyntaxKind.LessThanEqualsToken,
      ts.SyntaxKind.GreaterThanToken,
      ts.SyntaxKind.GreaterThanEqualsToken,
      ts.SyntaxKind.EqualsEqualsEqualsToken,
      ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ].includes(condition.operatorToken.kind)
    const isLiteral = (e: ts.Expression) =>
      ts.isNumericLiteral(e) ||
      (ts.isPrefixUnaryExpression(e) && ts.isNumericLiteral(e.operand))
    const other = isLiteral(condition.right)
      ? condition.left
      : isLiteral(condition.left)
        ? condition.right
        : undefined
    if (!comparison || !other) return false
    const root = rootOf(other)
    const declaration = ts.isIdentifier(root) ? declarationOf(root) : undefined
    return (
      declaration !== undefined &&
      ts.isParameter(declaration) &&
      declaration.parent === fn &&
      isNumberLike(checker.getTypeAtLocation(other))
    )
  }

  const unwrap = (node: ts.Node): ts.Node =>
    ts.isParenthesizedExpression(node) ||
    (ts.isPrefixUnaryExpression(node) &&
      node.operator === ts.SyntaxKind.ExclamationToken)
      ? unwrap(
          ts.isParenthesizedExpression(node) ? node.expression : node.operand,
        )
      : node

  const isStringClassifier = (fn: ts.FunctionLikeDeclaration): boolean => {
    const param = fn.parameters[0]
    if (!param || !fn.body) return false
    const declaration = fn as unknown as ts.FunctionDeclaration
    const numberLike = (t: ts.Type): boolean =>
      Boolean(t.flags & ts.TypeFlags.NumberLike) ||
      (t.isIntersection() && t.types.some(numberLike))
    const missing = (t: ts.Type) => Boolean(t.flags & ts.TypeFlags.Undefined)
    const optional = fn.parameters.map((p) => {
      const t = checker.getTypeAtLocation(p)
      return (
        t.isUnion() &&
        t.types.some(missing) &&
        t.types.some(numberLike) &&
        t.types.every((part) => missing(part) || numberLike(part))
      )
    })
    if (
      fn.parameters.every(
        (p, i) => optional[i] || numberLike(checker.getTypeAtLocation(p)),
      ) &&
      (fn.parameters.length > 1 || optional[0])
    )
      return (
        translateNumbers(declaration, declaration.getSourceFile(), optional)
          .problems.length === 0
      )
    if (fn.parameters.length !== 1) return false
    const type = checker.getTypeAtLocation(param)
    if (type.flags & ts.TypeFlags.Unknown)
      return (
        translateUnknown(declaration, declaration.getSourceFile()).problems
          .length === 0
      )
    const parts = type.isUnion() ? type.types : [type]
    const stringLike = (t: ts.Type): boolean =>
      Boolean(t.flags & ts.TypeFlags.StringLike) ||
      (t.isIntersection() && t.types.some(stringLike))
    const undefinedPart = (t: ts.Type) =>
      Boolean(t.flags & ts.TypeFlags.Undefined)
    if (
      !parts.some(stringLike) ||
      !parts.every((t) => stringLike(t) || undefinedPart(t))
    )
      return false
    return (
      translate(
        declaration,
        declaration.getSourceFile(),
        parts.some(undefinedPart),
      ).problems.length === 0
    )
  }

  const behindOptional = (node: ts.Node, depth = 0): boolean => {
    if (depth > 8) return false
    const core = unwrap(node)
    let found = false
    const look = (n: ts.Node): void => {
      if (found || ts.isFunctionLike(n)) return
      if (
        (ts.isPropertyAccessExpression(n) ||
          ts.isElementAccessExpression(n) ||
          ts.isCallExpression(n)) &&
        n.questionDotToken
      )
        found = true
      else ts.forEachChild(n, look)
    }
    look(core)
    if (found) return true
    if (!ts.isIdentifier(core)) return false
    const declaration = declarationOf(core)
    const variable =
      declaration && ts.isBindingElement(declaration)
        ? ts.findAncestor(declaration, ts.isVariableDeclaration)
        : declaration
    return (
      variable !== undefined &&
      ts.isVariableDeclaration(variable) &&
      variable.initializer !== undefined &&
      behindOptional(variable.initializer, depth + 1)
    )
  }

  const causes = (node: ts.Node): number => {
    const core = unwrap(node)
    if (
      ts.isBinaryExpression(core) &&
      (core.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
        core.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
    )
      return causes(core.left) + causes(core.right)
    return behindOptional(core) ? 2 : 1
  }

  const report = (fn: ts.FunctionLikeDeclaration): FunctionReport => {
    const branches: Branch[] = []
    const merges: Merge[] = []
    const effects: Site[] = []
    const exits: Exit[] = []
    const outside = new Map<string, Source>()
    const stringCells = isStringClassifier(fn)
    const dead: Site[] = []
    const ruledOut: Site[] = []
    const unshaped: Site[] = []
    type Fact = { is: ResultType; because: string }
    const facts = new Map<string, Fact>()
    const pathText = (node: ts.Node) =>
      node
        .getText(source)
        .replace(/\s+/g, '')
        .replace(/\?\./g, '.')
        .replace(/!(?=\.|$)/g, '')
    const learn = (node: ts.Node): void => {
      if (node !== fn && isNamed(node)) return
      ts.forEachChild(node, learn)
      if (
        !ts.isVariableDeclaration(node) ||
        !node.initializer ||
        !ts.isVariableDeclarationList(node.parent) ||
        !(node.parent.flags & ts.NodeFlags.Const)
      )
        return
      let value: ts.Expression = node.initializer
      while (ts.isAwaitExpression(value) || ts.isParenthesizedExpression(value))
        value = value.expression
      if (!ts.isCallExpression(value) && !ts.isNewExpression(value)) return
      const kind = callKind(value)
      const callee = value.expression.getText(source)
      for (const contract of backing(
        checker,
        value,
        source,
        kind === 'builtin call' || kind === 'library call' ? kind : undefined,
        contracts,
      ).applied)
        for (const ensured of contract.contract?.members[callee]?.ensures ??
          []) {
          if (!ensured.result) continue
          const path = ensured.result.path ?? ''
          const fact = {
            is: ensured.result.is,
            because: `${ensured.claim} [contract ${contract.id}]`,
          }
          if (ts.isIdentifier(node.name))
            facts.set(`${node.name.text}${path ? `.${path}` : ''}`, fact)
          if (ts.isObjectBindingPattern(node.name))
            for (const element of node.name.elements) {
              const property = (element.propertyName ?? element.name).getText(
                source,
              )
              if (!ts.isIdentifier(element.name)) continue
              if (path === property || path.startsWith(`${property}.`))
                facts.set(
                  `${element.name.text}${path.slice(property.length)}`,
                  fact,
                )
            }
        }
    }
    if (fn.body) learn(fn.body)
    const known = (
      node: ts.Node,
    ): { value: boolean; because: string } | undefined => {
      if (facts.size === 0) return undefined
      if (ts.isParenthesizedExpression(node)) return known(node.expression)
      if (
        ts.isPrefixUnaryExpression(node) &&
        node.operator === ts.SyntaxKind.ExclamationToken
      ) {
        const inner = known(node.operand)
        return inner ? { ...inner, value: !inner.value } : undefined
      }
      if (ts.isBinaryExpression(node)) {
        const op = node.operatorToken.kind
        const equal =
          op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
          op === ts.SyntaxKind.EqualsEqualsToken
        const unequal =
          op === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
          op === ts.SyntaxKind.ExclamationEqualsToken
        if (!equal && !unequal) return undefined
        for (const [subject, other] of [
          [node.left, node.right],
          [node.right, node.left],
        ] as const) {
          const absent =
            other.kind === ts.SyntaxKind.NullKeyword ||
            (ts.isIdentifier(other) && other.text === 'undefined')
          const fact = facts.get(pathText(subject))
          if (absent && fact) return { value: unequal, because: fact.because }
          if (
            ts.isTypeOfExpression(subject) &&
            (ts.isStringLiteral(other) ||
              ts.isNoSubstitutionTemplateLiteral(other))
          ) {
            const typed = facts.get(pathText(subject.expression))
            if (!typed || typed.is === 'defined') continue
            const reported = typed.is === 'array' ? 'object' : typed.is
            return {
              value: (reported === other.text) === equal,
              because: typed.because,
            }
          }
        }
        return undefined
      }
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(source) === 'Array.isArray' &&
        node.arguments[0]
      ) {
        const fact = facts.get(pathText(node.arguments[0]))
        if (!fact || fact.is === 'defined' || fact.is === 'object')
          return undefined
        return { value: fact.is === 'array', because: fact.because }
      }
      const fact = facts.get(pathText(node))
      return fact && (fact.is === 'object' || fact.is === 'array')
        ? { value: true, because: fact.because }
        : undefined
    }
    const optionalReceivers = new Set<string>()
    const open = (node: ts.Node) =>
      sourcesOf(node, fn).some((s) => !closedKinds.has(s.kind))
    const addBranch = (
      node: ts.Node,
      construct: string,
      condition: ts.Node,
    ) => {
      const sources = sourcesOf(condition, fn)
      for (const s of sources)
        if (s.kind === 'outside state') outside.set(s.text, s)
      const settled =
        construct === '??' || construct === '?.'
          ? facts.get(pathText(condition))
          : known(condition)
      if (settled)
        dead.push({
          line: lineOf(node),
          text:
            'value' in settled
              ? `${short(condition.getText(source))} is always ${settled.value} if the contract holds: ${settled.because}`
              : `${short(condition.getText(source))} is never undefined or null if the contract holds, so ${construct} does not take its other side: ${settled.because}`,
        })
      const cell = numberCell(condition, fn)
      const comparisonKinds = [
        ts.SyntaxKind.LessThanToken,
        ts.SyntaxKind.LessThanEqualsToken,
        ts.SyntaxKind.GreaterThanToken,
        ts.SyntaxKind.GreaterThanEqualsToken,
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
      ]
      let twoInputs = false
      const findComparison = (n: ts.Node): void => {
        if (twoInputs || isNamed(n)) return
        if (
          ts.isBinaryExpression(n) &&
          comparisonKinds.includes(n.operatorToken.kind) &&
          open(n.left) &&
          open(n.right)
        ) {
          twoInputs = true
          return
        }
        ts.forEachChild(n, findComparison)
      }
      findComparison(condition)
      const label = cell
        ? `${construct} (number cell)`
        : stringCells
          ? `${construct} (classifier cell)`
          : construct
      branches.push({
        line: lineOf(node),
        construct: label,
        text: short(condition.getText(source)),
        sources,
        computable:
          cell || stringCells || sources.every((s) => closedKinds.has(s.kind)),
        twoInputs,
      })
    }

    type Condition = { nodes: ts.Node[]; text: string; never?: string }
    const alwaysExits = (s: ts.Statement): boolean => {
      if (ts.isReturnStatement(s) || ts.isThrowStatement(s)) return true
      if (ts.isBlock(s)) return s.statements.some(alwaysExits)
      if (ts.isIfStatement(s))
        return (
          s.elseStatement !== undefined &&
          alwaysExits(s.thenStatement) &&
          alwaysExits(s.elseStatement)
        )
      if (ts.isTryStatement(s))
        return (
          alwaysExits(s.tryBlock) &&
          (!s.catchClause || alwaysExits(s.catchClause.block))
        )
      return false
    }
    const flat = (n: ts.Node) => n.getText(source).replace(/\s+/g, ' ')
    const ownedExits = (scope: ts.Node): ts.Node[] => {
      const found: ts.Node[] = []
      const look = (n: ts.Node): void => {
        if (n !== scope && ts.isFunctionLike(n)) return
        if (ts.isReturnStatement(n) || ts.isThrowStatement(n)) found.push(n)
        ts.forEachChild(n, look)
      }
      look(scope)
      return found
    }
    const conditionsBetween = (node: ts.Node, stop: ts.Node): Condition[] => {
      const levels: Condition[][] = []
      let child: ts.Node = node
      let parent: ts.Node | undefined = node.parent
      while (parent && child !== stop) {
        const found: Condition[] = []
        levels.push(found)
        if (ts.isTryStatement(parent)) {
          if (child === parent.tryBlock)
            found.push({
              nodes: [parent.tryBlock],
              text: 'nothing in the try block has thrown',
            })
          if (child === parent.catchClause)
            found.push({
              nodes: [parent.tryBlock],
              text: 'a call in the try block threw',
            })
        }
        const branchOn = (condition: ts.Node, negated: boolean) => {
          const core = unwrap(condition)
          const compound =
            ts.isBinaryExpression(core) &&
            (core.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
              core.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
          const text = flat(condition)
          const settled = known(condition)
          found.push({
            nodes: [condition],
            text: negated
              ? `not (${text})`
              : compound && !text.startsWith('(')
                ? `(${text})`
                : text,
            ...(settled && settled.value === negated
              ? { never: settled.because }
              : {}),
          })
        }
        if (ts.isIfStatement(parent)) {
          if (child === parent.thenStatement) branchOn(parent.expression, false)
          if (child === parent.elseStatement) branchOn(parent.expression, true)
        }
        if (ts.isConditionalExpression(parent)) {
          if (child === parent.whenTrue) branchOn(parent.condition, false)
          if (child === parent.whenFalse) branchOn(parent.condition, true)
        }
        if (
          ts.isBinaryExpression(parent) &&
          child === parent.right &&
          (parent.operatorToken.kind ===
            ts.SyntaxKind.AmpersandAmpersandToken ||
            parent.operatorToken.kind === ts.SyntaxKind.BarBarToken)
        )
          branchOn(
            parent.left,
            parent.operatorToken.kind === ts.SyntaxKind.BarBarToken,
          )
        if (ts.isBlock(parent) || ts.isSourceFile(parent)) {
          for (const sibling of parent.statements) {
            if (sibling === child) break
            if (
              ts.isIfStatement(sibling) &&
              !sibling.elseStatement &&
              alwaysExits(sibling.thenStatement)
            ) {
              const settled = known(sibling.expression)
              found.push({
                nodes: [sibling.expression],
                text: `not (${flat(sibling.expression)})`,
                ...(settled?.value ? { never: settled.because } : {}),
              })
              continue
            }
            for (const earlier of ownedExits(sibling)) {
              const inner = conditionsBetween(earlier, sibling)
              if (inner.length === 0) continue
              found.push({
                nodes: inner.flatMap((c) => c.nodes),
                text: `not (${inner.map((c) => c.text).join(' and ')})`,
              })
            }
          }
        }
        child = parent
        parent = parent.parent
      }
      return levels.reverse().flat()
    }
    const owner = (node: ts.Node) =>
      ts.findAncestor(node.parent, (n) => ts.isFunctionLike(n))
    const addExit = (node: ts.Node, kind: Exit['kind'], text: string) => {
      const conditions = conditionsBetween(node, fn)
      const same = exits.find(
        (e) =>
          kind === 'may throw' &&
          e.kind === 'may throw' &&
          e.line === lineOf(node) &&
          e.conditions.join('\n') === conditions.map((c) => c.text).join('\n'),
      )
      if (same) {
        ;(same as { text: string }).text = short(
          `${same.text.replace(/ throws or rejects$/, '')}, ${text}`,
        )
        return
      }
      exits.push({
        line: lineOf(node),
        kind,
        text: text.includes('[contract ') ? text : short(text),
        conditions: conditions.map((c) => c.text),
        ...(conditions.some((c) => c.never)
          ? { never: conditions.find((c) => c.never)?.never ?? '' }
          : {}),
        decidable:
          kind !== 'may throw' &&
          (stringCells ||
            conditions.every((c) =>
              c.nodes.every((n) => numberCell(n, fn) || !open(n)),
            )),
      })
    }
    const returnArms = (expr: ts.Expression): void => {
      const core = ts.isParenthesizedExpression(expr) ? expr.expression : expr
      if (ts.isConditionalExpression(core)) {
        returnArms(core.whenTrue)
        returnArms(core.whenFalse)
        return
      }
      const builtText =
        ts.isTemplateExpression(core) ||
        (ts.isBinaryExpression(core) &&
          core.operatorToken.kind === ts.SyntaxKind.PlusToken &&
          Boolean(
            checker.getTypeAtLocation(core).flags & ts.TypeFlags.StringLike,
          ))
      if (builtText)
        unshaped.push({
          line: lineOf(core),
          text: short(core.getText(source)),
        })
      addExit(core, 'return', core.getText(source))
    }
    const insideTry = (node: ts.Node): boolean => {
      let current: ts.Node | undefined = node.parent
      let child: ts.Node = node
      while (current && current !== fn) {
        if (ts.isTryStatement(current) && child === current.tryBlock)
          return true
        child = current
        current = current.parent
      }
      return false
    }
    const rejectionHandled = (call: ts.Node): boolean => {
      const access = call.parent
      if (!access || !ts.isPropertyAccessExpression(access)) return false
      const outer = access.parent
      return (
        ts.isCallExpression(outer) &&
        ((access.name.text === 'catch' && outer.arguments.length >= 1) ||
          (access.name.text === 'then' && outer.arguments.length >= 2))
      )
    }

    const visit = (node: ts.Node): void => {
      if (node !== fn && isNamed(node)) return
      if (ts.isReturnStatement(node) && owner(node) === fn) {
        if (node.expression) returnArms(node.expression)
        else addExit(node, 'return', 'undefined')
      }
      if (ts.isThrowStatement(node) && owner(node) === fn)
        addExit(node, 'throw', node.expression.getText(source))
      if (
        (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
        !isAmbientRead(node)
      ) {
        const kind = callKind(node)
        const isPromiseMethod =
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          ['then', 'catch', 'finally'].includes(node.expression.name.text)
        const callee = node.expression.getText(source)
        const { applied: backings, sameText } = backing(
          checker,
          node,
          source,
          kind === 'builtin call' || kind === 'library call' ? kind : undefined,
          contracts,
        )
        for (const c of sameText) {
          const key = backings.includes(c)
            ? `${c.id} ${callee}`
            : `${c.id} ${callee} elsewhere`
          matched.set(key, (matched.get(key) ?? 0) + 1)
        }
        const member = backings.length > 0
        for (const backing of backings) {
          const throws = backing.contract?.members[callee]?.throws ?? []
          const excluded = excludedAt(checker, node, throws)
          for (const { thrown, type } of excluded)
            ruledOut.push({
              line: lineOf(node),
              text: `${callee}(…) gets no exit for ${thrown.error} (${thrown.when}): its contract says it is thrown ${thrown.argument ? argumentScope(thrown.argument) : ''}, and here that is ${type} [contract ${backing.id}]`,
            })
          if (insideTry(node) || rejectionHandled(node)) continue
          for (const thrown of throws)
            if (!excluded.some((e) => e.thrown === thrown))
              addExit(
                node,
                'throw',
                `${callee}(…) throws ${thrown.error} when ${thrown.when} [contract ${backing.id}]`,
              )
        }
        if (
          !member &&
          (kind === 'library call' ||
            kind === 'project call' ||
            kind === 'adapter call') &&
          !isPromiseMethod &&
          !insideTry(node) &&
          !rejectionHandled(node)
        )
          addExit(
            node,
            'may throw',
            kind === 'adapter call'
              ? `${node.expression.getText(source)}(…) lets through an error it does not name`
              : `${node.expression.getText(source)}(…) throws or rejects`,
          )
      }
      if (
        ts.isConditionalExpression(node) &&
        ts.isBinaryExpression(unwrap(node.condition))
      ) {
        const cond = unwrap(node.condition) as ts.BinaryExpression
        const and =
          cond.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
        const or = cond.operatorToken.kind === ts.SyntaxKind.BarBarToken
        const merged = and
          ? constant(node.whenFalse)
          : or
            ? constant(node.whenTrue)
            : undefined
        if (merged !== undefined && open(cond) && !stringCells)
          merges.push({
            line: lineOf(node),
            text: `${cond.getText(source).replace(/\s+/g, ' ')} returns ${merged} for ${causes(cond)} causes`,
            into: merged,
            from: 'condition',
          })
      }
      if (
        ts.isIfStatement(node) &&
        ts.isBinaryExpression(unwrap(node.expression)) &&
        (unwrap(node.expression) as ts.BinaryExpression).operatorToken.kind ===
          ts.SyntaxKind.BarBarToken
      ) {
        const then = ts.isBlock(node.thenStatement)
          ? node.thenStatement.statements[0]
          : node.thenStatement
        const merged =
          then && ts.isReturnStatement(then)
            ? constant(then.expression)
            : undefined
        if (merged !== undefined && open(node.expression) && !stringCells)
          merges.push({
            line: lineOf(node),
            text: `${node.expression.getText(source).replace(/\s+/g, ' ')} returns ${merged} for ${causes(node.expression)} causes`,
            into: merged,
            from: 'condition',
          })
      }
      if (ts.isIfStatement(node)) addBranch(node, 'if', node.expression)
      if (ts.isConditionalExpression(node))
        addBranch(node, '?:', node.condition)
      if (ts.isSwitchStatement(node)) addBranch(node, 'switch', node.expression)
      if (
        ts.isForStatement(node) ||
        ts.isForInStatement(node) ||
        ts.isForOfStatement(node) ||
        ts.isWhileStatement(node) ||
        ts.isDoStatement(node)
      )
        addBranch(node, 'loop', node)
      if (
        ts.isBinaryExpression(node) &&
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(node.operatorToken.kind)
      )
        addBranch(node, node.operatorToken.getText(source), node.left)
      if (
        (ts.isPropertyAccessExpression(node) ||
          ts.isElementAccessExpression(node) ||
          ts.isCallExpression(node)) &&
        node.questionDotToken
      ) {
        const receiver = node.expression.getText(source)
        if (!optionalReceivers.has(receiver)) {
          optionalReceivers.add(receiver)
          addBranch(node, '?.', node.expression)
        }
      }
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression)
      ) {
        const method = node.expression.name.text
        const handler =
          method === 'catch'
            ? node.arguments[0]
            : method === 'then'
              ? node.arguments[1]
              : undefined
        if (handler) {
          addBranch(node, `promise .${method}`, node.expression.expression)
          const body =
            ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)
              ? handler.body
              : undefined
          const into = body ? constant(body) : undefined
          if (into !== undefined)
            merges.push({
              line: lineOf(node),
              text: short(node.getText(source)),
              into,
              from: 'handler',
            })
        }
      }
      if (ts.isTryStatement(node) && node.catchClause) {
        addBranch(node, 'try/catch', node.tryBlock)
        const variable = node.catchClause.variableDeclaration?.name
        const used =
          variable !== undefined &&
          ts.isIdentifier(variable) &&
          node.catchClause.block.getText(source).includes(variable.text)
        if (!used)
          merges.push({
            line: lineOf(node.catchClause),
            text: 'catch without reading the error',
            into: 'one catch path',
            from: 'handler',
          })
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        (ts.isPropertyAccessExpression(node.left) ||
          ts.isElementAccessExpression(node.left))
      ) {
        const root = rootOf(node.left)
        const declaration = ts.isIdentifier(root)
          ? declarationOf(root)
          : undefined
        if (
          !declaration ||
          !within(declaration, fn) ||
          ts.isParameter(declaration)
        )
          effects.push({
            line: lineOf(node),
            text: short(node.getText(source)),
          })
      }
      if (ts.isExpressionStatement(node)) {
        const expression = ts.isAwaitExpression(node.expression)
          ? node.expression.expression
          : node.expression
        if (ts.isCallExpression(expression))
          effects.push({
            line: lineOf(node),
            text: short(expression.getText(source)),
          })
      }
      if (ts.isIdentifier(node) && node !== fn.name) {
        const declaration = declarationOf(node)
        const variable =
          declaration && ts.isBindingElement(declaration)
            ? ts.findAncestor(declaration, ts.isVariableDeclaration)
            : declaration
        const isState =
          variable !== undefined &&
          (ts.isVariableDeclaration(variable) || ts.isParameter(variable)) &&
          !within(variable, fn) &&
          !isModuleConstant(variable) &&
          variable.getSourceFile() === source
        if (isState && !outside.has(node.text))
          outside.set(node.text, {
            kind: 'outside state',
            text: node.text,
            line: lineOf(node),
          })
      }
      ts.forEachChild(node, visit)
    }
    if (fn.body) ts.forEachChild(fn.body, visit)

    const adapterShape = isAdapterShape(fn)
    const reshape = new Set<string>()
    if (adapterShape)
      reshape.add(
        'none: already in the adapter shape (one try/catch resolving to a finite union, or to objects that each carry a literal kind)',
      )
    const lines = new Map<string, Set<number>>()
    const regexMethods = new Set(['match', 'test', 'replace', 'search', 'exec'])
    const inputAdvice = (s: Source): string => {
      const type = s.type ?? ''
      if (/\bunknown\b|\bany\b/.test(type))
        return `type-test classifier: narrow ${s.text} (${type}) with typeof, === null, === undefined, Array.isArray and the Number.is* tests, returning a type predicate; reading its properties has no shape yet`
      if (/string/.test(type))
        return `string classifier: classify ${s.text} (${type}) with startsWith, endsWith, includes, ===, length, split(c).length and /pattern/.test()`
      if (/number/.test(type))
        return `number classifier: compare ${s.text} (${type}) only with number literals and with other inputs that have their own type`
      return `classifier: turn ${s.text} (${type}) into a finite union before any branch reads it`
    }
    if (!stringCells)
      for (const b of adapterShape ? [] : branches) {
        if (b.twoInputs)
          lines.set(
            `number classifier: ${b.text} compares two inputs; give each its own type and classify them together`,
            (
              lines.get(
                `number classifier: ${b.text} compares two inputs; give each its own type and classify them together`,
              ) ?? new Set()
            ).add(b.line),
          )
        for (const s of b.sources) {
          const method = s.text.split('.').at(-1) ?? ''
          const key =
            s.kind === 'open input'
              ? inputAdvice(s)
              : s.kind === 'builtin call'
                ? regexMethods.has(method)
                  ? method === 'test'
                    ? `string classifier: move ${s.text} into a classifier; /pattern/.test(<input>) is counted for patterns without backreferences, lookaround inside a group, or flags other than i and s`
                    : `string classifier: ${s.text} reads what a regular expression captured, which has no shape yet; test the pattern in a classifier and cut the value with slice`
                  : method === 'getTime'
                    ? `conversion: ${s.text} turns a date into a number; do that in a conversion (one return, arithmetic and rounding only) and classify the result`
                    : `classifier: the string or array work in ${s.text} belongs in a classifier`
                : s.kind === 'clock or random read'
                  ? `dependency: ${s.text} reads the clock or a random source; pass the value in`
                  : s.kind === 'pure project call'
                    ? `classifier: ${s.text} is a pure function of its input; classify its input instead of wrapping it`
                    : s.kind === 'untraced variable'
                      ? `dependency: ${s.text} is not a const with one value, so what it holds is not followed and every branch on it stays open; make it a const from one expression`
                      : s.kind === 'conversion call'
                        ? `number classifier: ${s.text} converts a value; compare its result in a classifier, not here`
                        : s.kind === 'library call' || s.kind === 'project call'
                          ? `adapter: wrap ${s.text} so each outcome is a named variant`
                          : undefined
          if (key) lines.set(key, (lines.get(key) ?? new Set()).add(s.line))
        }
      }
    for (const [step, at] of lines)
      reshape.add(`${step} (line ${[...at].sort((a, b) => a - b).join(', ')})`)
    for (const m of merges)
      reshape.add(
        m.from === 'handler'
          ? `adapter: line ${m.line} turns every failure into ${m.into}; give each cause its own variant`
          : `classifier: line ${m.line} gives ${m.into} for several causes; if the requirement tells them apart, give each its own outcome`,
      )
    for (const u of unshaped)
      reshape.add(
        `no shape: line ${u.line} builds the text ${u.text} from a value, and no shape returns such a text; return the value as data beside a literal tag, and build the text in a file declared outside the claim`,
      )
    for (const o of outside.values())
      reshape.add(
        `dependency: ${o.text} is read from outside the function; pass it in`,
      )
    for (const e of adapterShape ? [] : effects)
      reshape.add(
        `wiring: the effect at line ${e.line} runs inside the logic; return it as a planned effect and run it after the decision`,
      )
    return {
      name: nameOf(fn) ?? '(anonymous)',
      line: lineOf(fn),
      exits,
      branches,
      merges,
      effects,
      outside: [...outside.values()],
      reshape: [...reshape],
      dead,
      ruledOut,
    }
  }

  const functions: ts.FunctionLikeDeclaration[] = []
  const collect = (node: ts.Node): void => {
    if (isNamed(node)) functions.push(node)
    ts.forEachChild(node, collect)
  }
  collect(source)
  const lastLineOf = (node: ts.Node) =>
    source.getLineAndCharacterOfPosition(node.getEnd()).line + 1
  const around =
    at === undefined
      ? functions
      : functions.filter((fn) => lineOf(fn) <= at && at <= lastLineOf(fn))
  const selected = at === undefined ? around : around.slice(-1)
  return selected.map(report)
}

export function printReport(path: string, reports: FunctionReport[]): void {
  for (const r of reports) {
    const computable = r.branches.filter((b) => b.computable).length
    console.log(
      `\n${relative(process.cwd(), resolve(path)).split(sep).join('/')}:${r.line} ${r.name}`,
    )
    const decidableExits = r.exits.filter((e) => e.decidable).length
    const never = r.exits.filter((e) => e.never !== undefined).length
    console.log(
      `  exits ${r.exits.length}, reached only through decidable conditions ${decidableExits}${never > 0 ? `, not taken if a contract holds ${never}` : ''}; branch points ${r.branches.length}, decidable ${computable}; merged failure sites ${r.merges.length}; effects ${r.effects.length}; outside reads ${r.outside.length}`,
    )
    r.exits.forEach((e, i) => {
      const when =
        e.conditions.length > 0 ? e.conditions.join(' and ') : 'always'
      console.log(
        `  exit ${String(i + 1).padStart(2)} line ${e.line} ${e.kind} ${e.text} ${e.never !== undefined ? '[not taken if the contract holds]' : e.decidable ? '[decidable]' : '[open]'}\n          when ${when}${e.never !== undefined ? `\n          given ${e.never}` : ''}`,
      )
    })
    for (const d of r.dead) console.log(`  given  line ${d.line} ${d.text}`)
    for (const x of r.ruledOut) console.log(`  scoped line ${x.line} ${x.text}`)
    if (r.dead.length + r.ruledOut.length > 0)
      console.log(
        '  a given or scoped line rests on what a contract declares and its checks sample; it explains an exit, and is no ground for removing a check; this report reads the contract without running it, so run its computed checks and the reconciliation first: a contract they refute gives wrong lines here',
      )
    for (const b of r.branches.filter((x) => x.computable))
      console.log(`  decided line ${b.line} ${b.construct} ${b.text}`)
    for (const b of r.branches.filter((x) => !x.computable)) {
      const open = b.sources.filter((s) => !closedKinds.has(s.kind))
      const why = open
        .map((s) => `${s.kind} ${s.text}${s.type ? ` : ${s.type}` : ''}`)
        .filter((v, i, all) => all.indexOf(v) === i)
        .join('; ')
      console.log(
        `  open   line ${b.line} ${b.construct} ${b.text}\n         depends on ${why}`,
      )
    }
    for (const m of r.merges)
      console.log(`  merge  line ${m.line} ${m.text} -> ${m.into}`)
    for (const e of r.effects) console.log(`  effect line ${e.line} ${e.text}`)
    if (r.reshape.length > 0) console.log('  reshape')
    for (const step of r.reshape) console.log(`    - ${step}`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) {
    console.log(
      'usage: node diagnose.ts <file.ts> [--at=<a line inside the function>] [--root=<project>]; a relative file is looked for in the working directory, then under --root',
    )
    process.exit(2)
  }
  const named = process.argv[2] ?? ''
  const underRoot = process.argv.some((a) => a.startsWith('--root='))
    ? resolve(rootFrom(), named)
    : resolve(named)
  const target = existsSync(resolve(named)) ? resolve(named) : underRoot
  if (!existsSync(target)) {
    console.log(`no such file: ${named}`)
    process.exit(2)
  }
  const at = process.argv.find((a) => a.startsWith('--at='))?.slice(5)
  const settings = ts.findConfigFile(
    dirname(resolve(target)),
    ts.sys.fileExists,
    settingsFile,
  )
  const config = ts.findConfigFile(dirname(resolve(target)), ts.sys.fileExists)
  const project = loadProject(
    process.argv.some((a) => a.startsWith('--root='))
      ? rootFrom()
      : settings
        ? dirname(settings)
        : config
          ? dirname(config)
          : process.cwd(),
  )
  const contracts = loadContracts(project)
  for (const c of contracts)
    for (const problem of c.problems)
      console.log(`contract ${c.id} is not used: ${problem}`)
  const matched = new Map<string, number>()
  const reports = diagnose(
    target,
    at === undefined ? undefined : Number(at),
    contracts,
    matched,
    project.shapeOf,
  )
  if (at !== undefined && reports.length === 0) {
    console.log(`no function holds line ${at} of ${named}`)
    process.exit(2)
  }
  printReport(target, reports)
  for (const c of contracts.filter((x) => x.problems.length === 0))
    for (const member of Object.keys(c.contract?.members ?? {})) {
      const calls = matched.get(`${c.id} ${member}`) ?? 0
      const elsewhere = matched.get(`${c.id} ${member} elsewhere`) ?? 0
      console.log(
        calls > 0
          ? `contract ${c.id}: ${member} applied to ${calls} call${calls === 1 ? '' : 's'}`
          : elsewhere > 0
            ? `contract ${c.id}: ${member} is written the same as ${elsewhere} call${elsewhere === 1 ? '' : 's'} here, but nothing in the call comes from ${c.contract?.package}; not applied`
            : `contract ${c.id}: ${member} matches no call in this file; a member is matched by the call as written, such as JSON.parse or client.send`,
      )
    }
}
