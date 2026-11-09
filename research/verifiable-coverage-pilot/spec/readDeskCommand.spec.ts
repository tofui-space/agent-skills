import type {
  DeskCommand,
  DeskWords,
  WordParser,
} from '../src/adapters/desk-command.ts'

export const requirement =
  'Words that parse are a command. An option the desk does not declare, a word that is no option, and a value that does not fit its option are each reported as such. Any other error propagates unchanged.'

export const port = { contract: 'node@24', member: 'parseArgs' }

export const args: readonly [readonly string[]] = [['--card', 'M-000001']]

const read: DeskWords = { card: 'M-000001' }

export function fake(failure: () => Error | undefined): {
  readonly db: WordParser
  readonly calls: Array<readonly [readonly string[]]>
} {
  const calls: Array<readonly [readonly string[]]> = []
  const db: WordParser = {
    parse: (words) => {
      calls.push([words])
      const error = failure()
      if (error) throw error
      return read
    },
  }
  return { db, calls }
}

const coded = (code: string) => Object.assign(new TypeError(code), { code })

export const provoke: Record<DeskCommand['kind'], () => Error | undefined> = {
  command: () => undefined,
  undeclaredOption: () => coded('ERR_PARSE_ARGS_UNKNOWN_OPTION'),
  strayWord: () => coded('ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL'),
  misfitValue: () => coded('ERR_PARSE_ARGS_INVALID_OPTION_VALUE'),
}

export const expected: Record<DeskCommand['kind'], DeskCommand> = {
  command: { kind: 'command', words: read },
  undeclaredOption: { kind: 'undeclaredOption' },
  strayWord: { kind: 'strayWord' },
  misfitValue: { kind: 'misfitValue' },
}

export const unnamed = () => coded('ERR_INVALID_ARG_TYPE')
