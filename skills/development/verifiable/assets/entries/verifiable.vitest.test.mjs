import { join } from 'node:path'
import { test } from 'vitest'
import { fileURLToPath, pathToFileURL } from 'node:url'

const tools = process.env.VERIFIABLE_TOOLS
if (!tools)
  throw new Error(
    'set VERIFIABLE_TOOLS to the scripts folder of the verifiable skill',
  )
const { register } = await import(pathToFileURL(join(tools, 'driver.ts')).href)

await register(test, fileURLToPath(new URL('./', import.meta.url)))
