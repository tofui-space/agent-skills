import { readFileSync } from 'node:fs'
import ts from 'ts6'

export type Static =
  | string
  | number
  | boolean
  | null
  | Static[]
  | { readonly [key: string]: Static }
export type Named = { readonly $name: string }
export type Code = { readonly $code: string }

export const isNamed = (value: Static | undefined): value is Named =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  typeof value.$name === 'string'

export function parsed(path: string): ts.SourceFile {
  return ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.ES2022,
    true,
  )
}

export function exportedConst(
  source: ts.SourceFile,
  name: string,
): ts.Expression | undefined {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue
    const exported = (ts.getModifiers(statement) ?? []).some(
      (m) => m.kind === ts.SyntaxKind.ExportKeyword,
    )
    for (const d of statement.declarationList.declarations)
      if (exported && ts.isIdentifier(d.name) && d.name.text === name)
        return d.initializer
  }
  return undefined
}

export function staticValue(
  expr: ts.Expression,
  source: ts.SourceFile,
): Static | undefined {
  if (
    ts.isAsExpression(expr) ||
    ts.isSatisfiesExpression(expr) ||
    ts.isParenthesizedExpression(expr)
  )
    return staticValue(expr.expression, source)
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr))
    return expr.text
  if (ts.isNumericLiteral(expr)) return Number(expr.text)
  if (expr.kind === ts.SyntaxKind.TrueKeyword) return true
  if (expr.kind === ts.SyntaxKind.FalseKeyword) return false
  if (expr.kind === ts.SyntaxKind.NullKeyword) return null
  if (
    ts.isPrefixUnaryExpression(expr) &&
    expr.operator === ts.SyntaxKind.MinusToken
  ) {
    const inner = staticValue(expr.operand, source)
    return typeof inner === 'number' ? -inner : undefined
  }
  if (ts.isArrayLiteralExpression(expr)) {
    const items = expr.elements.map((e) => staticValue(e, source))
    return items.every((item) => item !== undefined)
      ? (items as Static[])
      : undefined
  }
  if (ts.isObjectLiteralExpression(expr)) {
    const out: Record<string, Static> = {}
    for (const p of expr.properties) {
      if (ts.isShorthandPropertyAssignment(p)) {
        out[p.name.text] = { $name: p.name.text }
        continue
      }
      if (ts.isMethodDeclaration(p) && ts.isIdentifier(p.name)) {
        out[p.name.text] = { $code: p.getText(source) }
        continue
      }
      if (
        !ts.isPropertyAssignment(p) ||
        !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))
      )
        return undefined
      const value = staticValue(p.initializer, source)
      if (value === undefined) return undefined
      out[p.name.text] = value
    }
    return out
  }
  if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr))
    return { $code: expr.getText(source) }
  const text = expr.getText(source)
  if (text === 'Number.NEGATIVE_INFINITY') return Number.NEGATIVE_INFINITY
  if (text === 'Number.POSITIVE_INFINITY') return Number.POSITIVE_INFINITY
  if (ts.isIdentifier(expr) || ts.isPropertyAccessExpression(expr))
    return { $name: text }
  return undefined
}

export function exportedValue(path: string, name: string): Static | undefined {
  const source = parsed(path)
  const expr = exportedConst(source, name)
  return expr ? staticValue(expr, source) : undefined
}

export function exportedNames(path: string): Set<string> {
  const names = new Set<string>()
  for (const statement of parsed(path).statements) {
    const exported =
      ts.canHaveModifiers(statement) &&
      (ts.getModifiers(statement) ?? []).some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword,
      )
    if (!exported) continue
    if (ts.isFunctionDeclaration(statement) && statement.name)
      names.add(statement.name.text)
    if (ts.isVariableStatement(statement))
      for (const d of statement.declarationList.declarations)
        if (ts.isIdentifier(d.name)) names.add(d.name.text)
  }
  return names
}
