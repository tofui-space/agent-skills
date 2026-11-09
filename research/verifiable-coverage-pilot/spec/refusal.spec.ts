export const requirement =
  'An unreadable card is answered with 401 and a malformed day with 400.'

export const expected: Record<string, number> = {
  unreadableCard: 401,
  malformedDay: 400,
}
