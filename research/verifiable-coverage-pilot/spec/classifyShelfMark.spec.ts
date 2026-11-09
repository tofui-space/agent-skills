import type { ShelfKind } from '../src/types.ts'

export const requirement =
  'A shelf mark is three capital letters, a space, a title of at least one character without line breaks, a space and a four-digit year. A title that begins with REF and a space is reference stock; every other readable mark is lending stock.'

export function expected(mark: string): ShelfKind {
  if (/^[A-Z][A-Z][A-Z] REF .* \d\d\d\d$/.test(mark)) return 'reference'
  if (/^[A-Z][A-Z][A-Z] .+ \d\d\d\d$/.test(mark)) return 'lending'
  return 'unreadable'
}
