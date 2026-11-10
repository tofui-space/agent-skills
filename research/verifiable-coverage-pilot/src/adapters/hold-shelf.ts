import type { CopyNumber, HoldDay } from '../types.ts'

export type HoldShelf = {
  holdOn(copy: CopyNumber): Promise<HoldDay>
}

export class NoHold extends Error {}

export type HoldLookup =
  | { readonly kind: 'held'; readonly until: HoldDay }
  | { readonly kind: 'free' }

export async function findHold(
  shelf: HoldShelf,
  copy: CopyNumber,
): Promise<HoldLookup> {
  try {
    const until = await shelf.holdOn(copy)
    return { kind: 'held', until }
  } catch (error) {
    if (error instanceof NoHold) return { kind: 'free' }
    throw error
  }
}
