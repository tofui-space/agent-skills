export const requirement =
  'A hold request is an object whose kind is the text hold and whose book is an object with a copy number, a whole number JavaScript represents exactly. Anything else is not a hold request.'

export function expected(input: unknown): boolean {
  if (typeof input !== 'object' || input === null) return false
  if (!('book' in input) || !('kind' in input)) return false
  if (typeof input.book !== 'object' || input.book === null) return false
  if (!('copy' in input.book)) return false
  if (typeof input.book.copy !== 'number') return false
  return Number.isSafeInteger(input.book.copy) && input.kind === 'hold'
}
