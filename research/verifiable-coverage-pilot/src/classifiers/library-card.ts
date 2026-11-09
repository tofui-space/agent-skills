import type { LibraryCard } from '../types.ts'

export function isLibraryCard(
  header: string | undefined,
): header is LibraryCard {
  if (header === undefined) return false
  return /^(M-[0-9]{6}|S-[A-Z]{2}[0-9]{4})$/.test(header)
}
