import {
  CatalogUnavailable,
  NoOpenLoan,
} from '../app/renewal/loan-catalog.adapter.ts'
import type {
  RenewalDeps,
  RenewalRequest,
} from '../app/renewal/renewal.handler.ts'
import { recordingCatalog } from './fakes.ts'

export const requirement =
  'A renewal is refused at the first check that fails, without asking the catalog again: the card, the day, then the loan lookup. Otherwise the state of the loan decides the answer.'

type Handler = (req: RenewalRequest, deps: RenewalDeps) => Promise<number>

const run =
  (req: RenewalRequest, failure?: () => Error) => async (handle: Handler) => {
    const { db, calls } = recordingCatalog(failure)
    const status = await handle(req, { catalog: db })
    return { status, calls }
  }

export const observe = run({ card: 'M-000001', today: 103 })

export const expected = { status: 402, calls: [['M-000001']] }

export const order = [
  'isLibraryCard(req.card)',
  'isCurrentDay(req.today)',
  'lookup.kind',
]

export const exits = {
  'isLibraryCard(req.card)': {
    false: {
      observe: run({ card: 'M-1', today: 103 }),
      expected: { status: 401, calls: [] },
    },
  },
  'isCurrentDay(req.today)': {
    false: {
      observe: run({ card: 'M-000001', today: '103' }),
      expected: { status: 400, calls: [] },
    },
  },
  'lookup.kind': {
    none: {
      observe: run(
        { card: 'M-000001', today: 103 },
        () => new NoOpenLoan('no loan on this card'),
      ),
      expected: { status: 404, calls: [['M-000001']] },
    },
    unavailable: {
      observe: run(
        { card: 'M-000001', today: 103 },
        () => new CatalogUnavailable('connection reset'),
      ),
      expected: { status: 503, calls: [['M-000001']] },
    },
  },
}
