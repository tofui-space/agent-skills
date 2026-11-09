export type TextParser = {
  parse(text: string): unknown
}

export type ShelfListRead =
  | { readonly kind: 'read'; readonly value: unknown }
  | { readonly kind: 'malformed' }

export function readShelfList(parser: TextParser, text: string): ShelfListRead {
  try {
    const value = parser.parse(text)
    return { kind: 'read', value }
  } catch (error) {
    if (error instanceof SyntaxError) return { kind: 'malformed' }
    throw error
  }
}
