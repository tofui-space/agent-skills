#!/usr/bin/env node
// Optional Claude Code PostToolUse hook: rebuilds the task page after an Edit or Write to the tasks file.
// Usage in the hook command: node <skill-dir>/assets/hooks/rebuild-on-edit.mjs <config.json> [--standalone]
// Edits to other files: exits 0 silently. Rebuilt: tells the agent in one line. Build failed: exit 2, so the
// generator's error reaches the agent.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const [configArg, ...passThrough] = process.argv.slice(2)
if (!configArg) {
  console.error('rebuild-on-edit: missing config path argument')
  process.exit(1)
}

let edited
try {
  edited = JSON.parse(readFileSync(0, 'utf8'))?.tool_input?.file_path
} catch {
  process.exit(0)
}
if (!edited) process.exit(0)

const configPath = resolve(configArg)
const config = JSON.parse(readFileSync(configPath, 'utf8'))
const source = resolve(dirname(configPath), config.source)
const same = (a, b) => (process.platform === 'win32' || process.platform === 'darwin' ? a.toLowerCase() === b.toLowerCase() : a === b)
if (!same(resolve(edited), source)) process.exit(0)

const generator = resolve(dirname(fileURLToPath(import.meta.url)), '../../scripts/tasks-page.mjs')
const run = spawnSync(process.execPath, [generator, configPath, ...passThrough], { encoding: 'utf8' })
if (run.status !== 0) {
  process.stderr.write(`Task page not rebuilt. ${run.stderr || run.error?.message || ''}`)
  process.exit(2)
}
const [page, summary] = run.stdout.trim().split('\n')
console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: `Task page rebuilt by the hook: ${page} (${summary}). Publish it by path at the end of the turn; do not run the generator again.`,
    },
  }),
)
