export function isDeskPassphrase(text: string): boolean {
  return /^(?=.*[0-9])(?=.*[a-z])(?!.*\s).{8,}$/.test(text)
}
