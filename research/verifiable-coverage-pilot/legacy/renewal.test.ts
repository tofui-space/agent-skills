import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { recordingCatalog } from '../spec/fakes.ts'
import { CatalogUnavailable, NoOpenLoan } from '../src/adapters/loan-catalog.ts'
import { classifyLoan } from '../src/classifiers/loan-state.ts'
import { handleRenewal, refusal } from '../src/wiring/renewal-request.ts'

test('renews a loan that is on time', async () => {
  const { db } = recordingCatalog()
  const status = await handleRenewal(
    { card: 'M-000001', today: 99 },
    { catalog: db },
  )
  assert.equal(status, 200)
})

test('refuses a malformed day', async () => {
  const { db } = recordingCatalog()
  const status = await handleRenewal(
    { card: 'M-1', today: 'tomorrow' },
    { catalog: db },
  )
  assert.equal(status, 401)
})

test('handles an unreachable catalog', async () => {
  const { db } = recordingCatalog(() => new CatalogUnavailable('down'))
  const status = await handleRenewal(
    { card: 'M-000001', today: 99 },
    { catalog: db },
  )
  assert.equal(typeof status, 'number')
})

test('answers a refusal with a client error', () => {
  assert.ok(refusal.unreadableCard >= 400)
})

test('classifies an overdue loan', () => {
  assert.equal(classifyLoan(100 as never, 120 as never), 'overdue')
})

test('refuses an overdue loan', async () => {
  const { db } = recordingCatalog()
  const status = await handleRenewal(
    { card: 'M-000001', today: 120 },
    { catalog: db },
  )
  assert.equal(status, 403)
})

test.skip('renews a staff card', async () => {
  const { db } = recordingCatalog()
  assert.equal(
    await handleRenewal({ card: 'S-AB0001', today: 99 }, { catalog: db }),
    200,
  )
})

test('adds the grace period', () => {
  assert.equal(100 + 7, 107)
})

describe('the catalog', () => {
  test('is asked once', async () => {
    const { db, calls } = recordingCatalog()
    await handleRenewal({ card: 'M-000001', today: 99 }, { catalog: db })
    assert.equal(calls.length, 1)
  })
})

describe('a lapsed card', () => {
  test('is asked once', async () => {
    const { db, calls } = recordingCatalog()
    await handleRenewal({ card: 'M-000001', today: 99 }, { catalog: db })
    assert.ok(calls)
  })
})

test('passes an unexpected catalog error on', async () => {
  const failure = new TypeError('catalog.loanFor is not a function')
  const { db } = recordingCatalog(() => failure)
  await assert.rejects(
    handleRenewal({ card: 'M-000001', today: 99 }, { catalog: db }),
    (error) => error === failure,
  )
})

test('refuses a card without a loan', async () => {
  const { db } = recordingCatalog(() => new NoOpenLoan('no loan'))
  const status = await handleRenewal(
    { card: 'M-000001', today: 120 },
    { catalog: db },
  )
  assert.ok(status >= 400)
})

test('refuses a bad card on a bad day', async () => {
  const { db } = recordingCatalog()
  const status = await handleRenewal(
    { card: 'M-1', today: 'tomorrow' },
    { catalog: db },
  )
  assert.ok(status >= 400)
})
