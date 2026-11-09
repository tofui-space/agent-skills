export function importShelfList(text: string): string[] {
  const value = JSON.parse(text)
  if (!Array.isArray(value)) return []
  return value
}
