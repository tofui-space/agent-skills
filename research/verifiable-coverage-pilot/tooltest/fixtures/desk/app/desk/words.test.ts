import { expect, test, vi } from 'vitest'
import { deskWords } from './words.port.ts'

test('reads the card', () => {
  expect(deskWords(['--card', 'M-000001'])).toEqual({ card: 'M-000001' })
})

test('refuses an option the desk does not know', () => {
  expect(() => deskWords(['--shelf'])).toThrow(TypeError)
})

test('answers with an object', () => {
  expect(typeof deskWords([])).toBe('object')
})

test('reads the card after the modules are loaded again', async () => {
  vi.resetModules()
  const again = await import('./words.port.ts')
  expect(again.deskWords(['--card', 'M-000002'])).toEqual({
    card: 'M-000002',
  })
})
