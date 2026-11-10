export type Membership = 'admin' | 'member' | 'none'
export type Role = 'reviewer' | 'owner' | 'visitor'
export type Operation = 'grantApproval' | 'revokeApproval' | 'editOrdinaryTag'
export type AccountState = 'active' | 'suspended'
export type Tenant = 'sameTenant' | 'otherTenant'
export type Ownership = 'ownsProvider' | 'doesNotOwn'
export type Plan = 'deny' | 'setApproved' | 'clearApproved' | 'editTag'

export type FailedLoginCount = number & { readonly brand: 'FailedLoginCount' }
export type Version = number & { readonly brand: 'Version' }
export type ProviderId = string & { readonly brand: 'ProviderId' }
export type TagText = string & { readonly brand: 'TagText' }
export type AuthorizationHeader = string & {
  readonly brand: 'AuthorizationHeader'
}
export type CredentialKind = 'jwt' | 'session'

export type LibraryCard = string & { readonly brand: 'LibraryCard' }
export type DueDay = number & { readonly brand: 'DueDay' }
export type CurrentDay = number & { readonly brand: 'CurrentDay' }
export type LoanState = 'onTime' | 'dueToday' | 'inGrace' | 'overdue'
export type HoldDay = number & { readonly brand: 'HoldDay' }
export type HoldState = 'noHold' | 'held' | 'released'
export type CopyNumber = number & { readonly brand: 'CopyNumber' }
export type ShelfKind = 'reference' | 'lending' | 'unreadable'
