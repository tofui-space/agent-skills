export const requirement =
  'A day is a whole number that JavaScript represents exactly. Text, fractions, NaN and infinity are not days.'

export function expected(input: unknown): boolean {
  if (typeof input !== 'number') return false
  return Number.isSafeInteger(input)
}
