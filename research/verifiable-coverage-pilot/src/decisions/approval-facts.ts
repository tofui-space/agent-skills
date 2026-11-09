export type FactsRole = 'reviewer' | 'owner'
export type FactsAccount = 'active' | 'suspended'
export type Facts =
  | Readonly<{ kind: 'missing' }>
  | Readonly<{ kind: 'unavailable' }>
  | Readonly<{ kind: 'found'; role: FactsRole; account: FactsAccount }>
export type FactsDecision = 'approve' | 'deny' | 'notFound' | 'retry'

export function decide(facts: Facts): FactsDecision {
  switch (facts.kind) {
    case 'missing':
      return 'notFound'
    case 'unavailable':
      return 'retry'
    case 'found':
      if (facts.role !== 'reviewer') return 'deny'
      return facts.account === 'active' ? 'approve' : 'deny'
  }
}
