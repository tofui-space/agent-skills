export const requirement =
  'A failure for an undeclared option is an object whose code is the text ERR_PARSE_ARGS_UNKNOWN_OPTION. Anything else is not.'

export function expected(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  if (!('code' in error)) return false
  return error.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION'
}
