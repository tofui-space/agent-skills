import type { AuthorizationHeader, CredentialKind } from '../types.ts'

export function classifyCredential(
  header: AuthorizationHeader | undefined,
): CredentialKind {
  if (header === undefined) return 'session'
  if (!header.startsWith('Bearer ')) return 'session'
  const token = header.slice(7)
  if (
    token.includes('\n') ||
    token.includes('\r') ||
    token.includes('\u2028') ||
    token.includes('\u2029')
  )
    return 'session'
  return token.split('.').length === 3 ? 'jwt' : 'session'
}
