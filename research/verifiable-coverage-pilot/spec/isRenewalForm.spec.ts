export const requirement =
  'A renewal form is an object with a card that is text and a day that is a whole number JavaScript represents exactly. Anything else is not a form.'

export function expected(input: unknown): boolean {
  if (typeof input !== 'object' || input === null) return false
  if (!('card' in input)) return false
  if (typeof input.card !== 'string') return false
  if (!('today' in input)) return false
  return typeof input.today === 'number' && Number.isSafeInteger(input.today)
}
