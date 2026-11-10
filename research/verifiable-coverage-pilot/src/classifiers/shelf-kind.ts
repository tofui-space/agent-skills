import type { ShelfKind } from '../types.ts'

export function classifyShelfMark(mark: string): ShelfKind {
  if (!/^[A-Z]{3} .+ [0-9]{4}$/.test(mark)) return 'unreadable'
  const title = mark.slice(4, -5)
  return title.startsWith('REF ') ? 'reference' : 'lending'
}
