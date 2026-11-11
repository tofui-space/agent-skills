import { readFileSync } from 'node:fs'

const profiles = JSON.parse(readFileSync(new URL('./capabilities.json', import.meta.url), 'utf8'))
const [language, ...extra] = process.argv.slice(2)
if (!['typescript', 'csharp'].includes(language) || extra.length > 0) {
  console.error('UNSUPPORTED: specify exactly one language: typescript or csharp')
  process.exitCode = 1
} else {
  console.log(JSON.stringify({ schema: profiles.schema, language, ...profiles[language] }, null, 2))
}
