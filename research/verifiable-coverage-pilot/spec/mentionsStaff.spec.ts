export const requirement =
  'A note mentions staff when the word staff stands on its own in it, in any mix of capital and small letters: the note starts or a character other than a letter, a digit or an underscore comes before it, and the note ends or such a character comes after it.'

export function expected(note: string): boolean {
  return /^staff$|^staff[^A-Za-z0-9_]|[^A-Za-z0-9_]staff$|[^A-Za-z0-9_]staff[^A-Za-z0-9_]/i.test(
    note,
  )
}
