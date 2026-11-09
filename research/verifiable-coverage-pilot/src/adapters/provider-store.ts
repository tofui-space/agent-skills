import type { ProviderId, TagText, Version } from '../types.ts'

export type Change =
  | { readonly field: 'approved'; readonly value: boolean }
  | { readonly field: 'tag'; readonly value: TagText }

export type ProviderDb = {
  update(
    providerId: ProviderId,
    change: Change,
    expectedVersion: Version,
  ): Promise<void>
}

export class VersionConflict extends Error {}

export class StoreUnavailable extends Error {}

export type WriteResult = 'written' | 'conflict' | 'unavailable'

export async function writeProvider(
  db: ProviderDb,
  providerId: ProviderId,
  change: Change,
  expectedVersion: Version,
): Promise<WriteResult> {
  try {
    await db.update(providerId, change, expectedVersion)
    return 'written'
  } catch (error) {
    if (error instanceof VersionConflict) return 'conflict'
    if (error instanceof StoreUnavailable) return 'unavailable'
    throw error
  }
}
