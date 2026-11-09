// Usage: node per-test-branch-map.mjs <package dir> <out dir> <source file>[,<source file>]
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const [pkg, out, named] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const sources = named.split(',')

const list = JSON.parse(execFileSync('pnpm', ['exec', 'vitest', 'list', '--json'], { cwd: pkg, encoding: 'utf8' })).map((t) => ({ ...t, name: t.name.replaceAll('\\"', '"') }))
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const results = []

for (const [index, test] of list.entries()) {
  const dir = join(out, `cov-${index}`)
  rmSync(dir, { recursive: true, force: true })
  const args = [
    'exec', 'vitest', 'run', relative(pkg, test.file), '--no-watch',
    '-t', `^${escape(test.name)}$`,
    '--coverage.enabled', '--coverage.provider=istanbul', '--coverage.reporter=json',
    `--coverage.reportsDirectory=${dir}`, '--coverage.all=false',
    ...sources.flatMap((s) => [`--coverage.include=${s}`]),
  ]
  let status = 'passed'
  try {
    execFileSync('pnpm', args, { cwd: pkg, stdio: 'pipe', encoding: 'utf8' })
  } catch (e) {
    status = 'failed'
    writeFileSync(join(out, `err-${index}.txt`), String(e.stdout ?? '') + String(e.stderr ?? ''))
  }
  const file = join(dir, 'coverage-final.json')
  const arms = []
  if (existsSync(file)) {
    const cov = JSON.parse(readFileSync(file, 'utf8'))
    for (const [path, data] of Object.entries(cov)) {
      const rel = relative(pkg, path)
      for (const [id, counts] of Object.entries(data.b)) {
        const branch = data.branchMap[id]
        counts.forEach((n, arm) => {
          if (n > 0) arms.push(`${rel}:${branch.loc.start.line}:${branch.type}#${id}.${arm}`)
        })
      }
    }
  }
  results.push({ test: test.name, file: relative(pkg, test.file), status, arms })
  process.stdout.write(`${index + 1}/${list.length} ${status} ${arms.length} arms  ${test.name.slice(0, 80)}\n`)
}

// All arms, including the ones no test reaches, from the last run that produced a report.
const all = new Map()
for (let index = list.length - 1; index >= 0; index--) {
  const file = join(out, `cov-${index}`, 'coverage-final.json')
  if (!existsSync(file)) continue
  const cov = JSON.parse(readFileSync(file, 'utf8'))
  for (const [path, data] of Object.entries(cov)) {
    const rel = relative(pkg, path)
    for (const [id, counts] of Object.entries(data.b)) {
      const branch = data.branchMap[id]
      counts.forEach((_, arm) => all.set(`${rel}:${branch.loc.start.line}:${branch.type}#${id}.${arm}`, branch))
    }
  }
  break
}
writeFileSync(join(out, 'results.json'), JSON.stringify({ results, allArms: [...all.keys()] }, null, 2))
