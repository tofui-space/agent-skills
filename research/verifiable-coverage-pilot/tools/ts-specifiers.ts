import { registerHooks } from 'node:module'

const local = (specifier: string) =>
  specifier.startsWith('.') ||
  specifier.startsWith('/') ||
  specifier.startsWith('file:')

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if (!local(specifier) || !/\.[cm]?js$/.test(specifier)) throw error
      return nextResolve(specifier.replace(/\.([cm]?)js$/, '.$1ts'), context)
    }
  },
})
