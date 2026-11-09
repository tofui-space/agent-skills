import { test } from 'vitest'
import { register } from '../../../tools/driver.ts'

await register(test, import.meta.dirname)
