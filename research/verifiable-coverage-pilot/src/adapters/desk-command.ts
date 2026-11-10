import {
  isMisfitValue,
  isStrayWord,
  isUndeclaredOption,
} from '../classifiers/parse-failure.ts'

export type DeskWords = {
  readonly card?: string | undefined
  readonly renew?: boolean | undefined
}

export type WordParser = {
  parse(words: readonly string[]): DeskWords
}

export type DeskCommand =
  | { readonly kind: 'command'; readonly words: DeskWords }
  | { readonly kind: 'undeclaredOption' }
  | { readonly kind: 'strayWord' }
  | { readonly kind: 'misfitValue' }

export function readDeskCommand(
  parser: WordParser,
  words: readonly string[],
): DeskCommand {
  try {
    const read = parser.parse(words)
    return { kind: 'command', words: read }
  } catch (error) {
    if (isUndeclaredOption(error)) return { kind: 'undeclaredOption' }
    if (isStrayWord(error)) return { kind: 'strayWord' }
    if (isMisfitValue(error)) return { kind: 'misfitValue' }
    throw error
  }
}
