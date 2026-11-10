import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import './ts-specifiers.ts'
import { portsReady } from './flip.ts'

const wrapped: Record<string, string> = process.env.VERIFIABLE_WRAPPED
  ? JSON.parse(readFileSync(process.env.VERIFIABLE_WRAPPED, 'utf8'))
  : {}

registerHooks({
  load(url, context, nextLoad) {
    const source = url.startsWith('file:')
      ? wrapped[fileURLToPath(url)]
      : undefined
    return source === undefined
      ? nextLoad(url, context)
      : { format: 'module-typescript', source, shortCircuit: true }
  },
})

await portsReady()
