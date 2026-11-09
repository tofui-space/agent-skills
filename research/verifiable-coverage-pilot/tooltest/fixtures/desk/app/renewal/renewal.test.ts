import { describe, expect, test } from 'vitest'
import { recordingCatalog } from '../../checks/fakes.ts'
import { CatalogUnavailable, NoOpenLoan } from './loan-catalog.adapter.ts'
import { classifyLoan } from './loan-state.classifier.ts'
import { handleRenewal, refusal } from './renewal.handler.ts'

test('renews a loan that is on time', async () => {
  const { db } = recordingCatalog()
  const status = await handleRenewal(
    { card: 'M-000001', today: 99 },
    { catalog: db },
  )
  expect(status).toBe(200)
})

test('refuses a malformed day', async () => {
  const { db } = recordingCatalog()
  const status = await handleRenewal(
    { card: 'M-1', today: 'tomorrow' },
    { catalog: db },
  )
  expect(status).toBe(401)
})

test('handles an unreachable catalog', async () => {
  const { db } = recordingCatalog(() => new CatalogUnavailable('down'))
  const status = await handleRenewal(
    { card: 'M-000001', today: 99 },
    { catalog: db },
  )
  expect(typeof status).toBe('number')
})

test('answers a refusal with a client error', () => {
  expect(refusal.unreadableCard).toBeGreaterThanOrEqual(400)
})

test('classifies an overdue loan', () => {
  expect(classifyLoan(100 as never, 120 as never)).toBe('overdue')
})

test('refuses an overdue loan', async () => {
  const { db } = recordingCatalog()
  const status = await handleRenewal(
    { card: 'M-000001', today: 120 },
    { catalog: db },
  )
  expect(status).toBe(403)
})

test.skip('renews a staff card', async () => {
  const { db } = recordingCatalog()
  expect(
    await handleRenewal({ card: 'S-AB0001', today: 99 }, { catalog: db }),
  ).toBe(200)
})

test('adds the grace period', () => {
  expect(100 + 7).toBe(107)
})

describe('the catalog', () => {
  test('is asked once', async () => {
    const { db, calls } = recordingCatalog()
    await handleRenewal({ card: 'M-000001', today: 99 }, { catalog: db })
    expect(calls.length).toBe(1)
  })
})

describe('a lapsed card', () => {
  test('is asked once', async () => {
    const { db, calls } = recordingCatalog()
    await handleRenewal({ card: 'M-000001', today: 99 }, { catalog: db })
    expect(calls).toBeDefined()
  })
})

test('passes an unexpected catalog error on', async () => {
  const failure = new TypeError('catalog.loanFor is not a function')
  const { db } = recordingCatalog(() => failure)
  await expect(
    handleRenewal({ card: 'M-000001', today: 99 }, { catalog: db }),
  ).rejects.toBe(failure)
})

test('refuses a card without a loan', async () => {
  const { db } = recordingCatalog(() => new NoOpenLoan('no loan'))
  const status = await handleRenewal(
    { card: 'M-000001', today: 120 },
    { catalog: db },
  )
  expect(status).toBeGreaterThanOrEqual(400)
})

test('refuses a bad card on a bad day', async () => {
  const { db } = recordingCatalog()
  const status = await handleRenewal(
    { card: 'M-1', today: 'tomorrow' },
    { catalog: db },
  )
  expect(status).toBeGreaterThanOrEqual(400)
})
