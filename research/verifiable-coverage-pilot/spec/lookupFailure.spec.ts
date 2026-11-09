export const requirement =
  'A card without an open loan is answered with 404 and an unreachable catalog with 503.'

export const expected: Record<string, number> = {
  none: 404,
  unavailable: 503,
}
