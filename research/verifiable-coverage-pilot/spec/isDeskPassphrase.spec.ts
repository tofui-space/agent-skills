export const requirement =
  'A desk passphrase has at least eight characters, at least one digit and one small letter, and no white space.'

export function expected(text: string): boolean {
  if (text.length < 8) return false
  if (/\s/.test(text)) return false
  return /[0-9]/.test(text) && /[a-z]/.test(text)
}
