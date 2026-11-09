export function isUndeclaredOption(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  return 'code' in error && error.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION'
}

export function isStrayWord(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  return (
    'code' in error && error.code === 'ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL'
  )
}

export function isMisfitValue(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  return 'code' in error && error.code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE'
}
