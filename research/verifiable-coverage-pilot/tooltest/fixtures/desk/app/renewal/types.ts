export type LibraryCard = string & { readonly brand: 'LibraryCard' }
export type DueDay = number & { readonly brand: 'DueDay' }
export type CurrentDay = number & { readonly brand: 'CurrentDay' }
export type LoanState = 'onTime' | 'dueToday' | 'inGrace' | 'overdue'
