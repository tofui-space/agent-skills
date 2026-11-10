import { parseArgs } from 'node:util'
import type { WordParser } from '../adapters/desk-command.ts'

export const deskWords: WordParser = {
  parse: (words) => ({
    ...parseArgs({
      args: [...words],
      options: { card: { type: 'string' }, renew: { type: 'boolean' } },
      strict: true,
      allowPositionals: false,
    }).values,
  }),
}
