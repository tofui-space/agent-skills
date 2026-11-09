import { parseArgs } from 'node:util'

export function deskWords(words: readonly string[]): {
  card?: string | undefined
} {
  return {
    ...parseArgs({
      args: [...words],
      options: { card: { type: 'string' } },
      strict: true,
    }).values,
  }
}
