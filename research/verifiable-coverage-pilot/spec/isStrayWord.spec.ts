export const requirement =
  'A failure for a stray word is an object whose code is the text ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL. Anything else is not.'

export function expected(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  if (!('code' in error)) return false
  return error.code === 'ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL'
}
