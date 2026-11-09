import type { CredentialKind } from '../src/types.ts'

export const requirement =
  'A request carries a JWT when its Authorization header matches /^Bearer (.+)$/ and the captured token has exactly three dot-separated parts. Every other request, including one without the header, goes to the session check.'

export function expected(header: string | undefined): CredentialKind {
  if (header === undefined) return 'session'
  const token = header.slice(7)
  if (/^Bearer .+$/.test(header) && token.split('.').length === 3) return 'jwt'
  return 'session'
}
