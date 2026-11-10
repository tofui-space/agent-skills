export const requirement =
  'A library card is eight characters: M- and six digits for a member, or S-, two capital letters and four digits for staff. Anything else, including a missing header, is not a card.'

export function expected(header: string | undefined): boolean {
  if (header === undefined) return false
  if (header.length !== 8) return false
  if (/^M-\d+$/.test(header)) return true
  return /^S-[A-Z][A-Z]\d+$/.test(header)
}
