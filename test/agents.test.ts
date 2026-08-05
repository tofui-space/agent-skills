import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, beforeEach, describe, test } from 'node:test'
import { AGENTS, parseAgents } from '../src/agents.ts'
import { loadCatalog } from '../src/catalog.ts'
import {
  agentsFileFor,
  destinationFor,
  inspect,
  install,
  isFileDelivered,
  readManifest,
  renderRulesBlock,
  syncAgentsFile,
  targetRoot,
  trackedRules,
  uninstall,
} from '../src/install.ts'
import type {
  Catalog,
  CatalogEntry,
  Manifest,
  RuleEntry,
} from '../src/types.ts'
import { makeCatalog, makeTempDir, removeAll, writeFile } from './helpers.ts'

const codex = AGENTS.codex
const claude = AGENTS.claude

function entry(catalog: Catalog, id: string): CatalogEntry {
  const found = [...catalog.skills, ...catalog.rules].find((c) => c.id === id)
  assert.ok(found, `fixture is missing ${id}`)
  return found
}

function rule(catalog: Catalog, id: string): RuleEntry {
  const found = catalog.rules.find((c) => c.id === id)
  assert.ok(found, `fixture is missing rule ${id}`)
  return found
}

describe('parseAgents', () => {
  test('defaults to Claude Code so existing invocations are unchanged', () => {
    assert.deepEqual(
      parseAgents(undefined).map((a) => a.id),
      ['claude'],
    )
  })

  test('accepts a comma-separated list', () => {
    assert.deepEqual(
      parseAgents('claude,codex').map((a) => a.id),
      ['claude', 'codex'],
    )
  })

  test('accepts all', () => {
    assert.deepEqual(
      parseAgents('all')
        .map((a) => a.id)
        .sort(),
      ['claude', 'codex'],
    )
  })

  test('is case and whitespace tolerant, and de-duplicates', () => {
    assert.deepEqual(
      parseAgents(' Codex , codex ').map((a) => a.id),
      ['codex'],
    )
  })

  test('rejects an unknown agent by name', () => {
    assert.throws(() => parseAgents('cursor'), /Unknown agent: cursor/)
  })
})

describe('codex target resolution', () => {
  const original = process.env.CODEX_HOME

  after(() => {
    if (original === undefined) delete process.env.CODEX_HOME
    else process.env.CODEX_HOME = original
  })

  test('project scope uses .codex', () => {
    assert.equal(
      targetRoot(codex, { dir: '/proj' }),
      path.join('/proj', '.codex'),
    )
  })

  test('--global follows CODEX_HOME when set', () => {
    process.env.CODEX_HOME = '/custom/codex'
    assert.equal(
      targetRoot(codex, { global: true }),
      path.resolve('/custom/codex'),
    )
  })

  test('--global falls back to ~/.codex', () => {
    delete process.env.CODEX_HOME
    assert.equal(
      targetRoot(codex, { global: true }),
      path.join(os.homedir(), '.codex'),
    )
  })

  test('each agent reads its own home variable', () => {
    process.env.CODEX_HOME = '/custom/codex'
    assert.notEqual(
      targetRoot(codex, { global: true }),
      targetRoot(claude, { global: true }),
    )
  })
})

describe('codex delivery routing', () => {
  let catalogRoot: string
  let catalog: Catalog

  before(() => {
    catalogRoot = makeCatalog()
    catalog = loadCatalog(catalogRoot)
  })
  after(() => {
    removeAll(catalogRoot)
  })

  test('skills are files for both agents', () => {
    const skill = entry(catalog, 'flat-skill')
    assert.equal(isFileDelivered(skill, codex), true)
    assert.equal(isFileDelivered(skill, claude), true)
  })

  test('rules are files for Claude Code but not for Codex', () => {
    const ruleEntry = entry(catalog, 'development/comments')
    assert.equal(isFileDelivered(ruleEntry, claude), true)
    assert.equal(isFileDelivered(ruleEntry, codex), false)
  })

  test('a codex skill lands in .codex/skills/<name>', () => {
    const dest = destinationFor(
      entry(catalog, 'nested-skill'),
      codex,
      '/p/.codex',
    )
    assert.equal(dest, path.join('/p/.codex', 'skills', 'nested-skill'))
  })

  test('a codex rule resolves to AGENTS.md beside the config directory', () => {
    const dest = destinationFor(
      entry(catalog, 'development/comments'),
      codex,
      '/p/.codex',
    )
    assert.equal(dest, path.join('/p', 'AGENTS.md'))
  })

  test('agentsFileFor sits next to the config directory, not inside it', () => {
    assert.equal(agentsFileFor('/p/.codex'), path.join('/p', 'AGENTS.md'))
  })
})

describe('AGENTS.md block', () => {
  let catalogRoot: string
  let catalog: Catalog
  let file: string
  let dir: string

  before(() => {
    catalogRoot = makeCatalog()
    catalog = loadCatalog(catalogRoot)
  })
  after(() => {
    removeAll(catalogRoot)
  })
  beforeEach(() => {
    dir = makeTempDir('agentsmd')
    file = path.join(dir, 'AGENTS.md')
  })

  test('renders a rule body without its frontmatter', () => {
    const block = renderRulesBlock([rule(catalog, 'development/comments')])
    assert.match(block, /# comments/)
    assert.equal(block.includes('---\npaths:'), false)
  })

  test('states glob scope as prose, since Codex cannot enforce it', () => {
    const block = renderRulesBlock([rule(catalog, 'development/comments')])
    assert.match(
      block,
      /Applies to files matching `\*\*\/\*\.ts`, `\*\*\/\*\.py`/,
    )
  })

  test('omits the scope line for an unscoped rule', () => {
    const block = renderRulesBlock([rule(catalog, 'top')])
    assert.equal(block.includes('Applies to files matching'), false)
  })

  test('creates the file when absent', () => {
    syncAgentsFile(file, [rule(catalog, 'top')])
    assert.match(fs.readFileSync(file, 'utf8'), /tofui-skills:begin/)
    removeAll(dir)
  })

  test('preserves hand-written content around the block', () => {
    writeFile(file, '# My project\n\nHand written notes.\n')
    syncAgentsFile(file, [rule(catalog, 'top')])
    const text = fs.readFileSync(file, 'utf8')
    assert.match(text, /# My project/)
    assert.match(text, /Hand written notes\./)
    assert.match(text, /tofui-skills:begin/)
    removeAll(dir)
  })

  test('replaces the block instead of appending a second one', () => {
    writeFile(file, '# Mine\n')
    syncAgentsFile(file, [rule(catalog, 'top')])
    syncAgentsFile(file, [rule(catalog, 'development/comments')])
    const text = fs.readFileSync(file, 'utf8')
    assert.equal(text.match(/tofui-skills:begin/g)?.length, 1)
    assert.match(text, /# comments/)
    assert.equal(text.includes('top level rule'), false)
    assert.match(text, /# Mine/)
    removeAll(dir)
  })

  test('is idempotent for the same rule set', () => {
    syncAgentsFile(file, [rule(catalog, 'top')])
    const first = fs.readFileSync(file, 'utf8')
    syncAgentsFile(file, [rule(catalog, 'top')])
    assert.equal(fs.readFileSync(file, 'utf8'), first)
    removeAll(dir)
  })

  test('removes the block but keeps surrounding content', () => {
    writeFile(file, '# Mine\n')
    syncAgentsFile(file, [rule(catalog, 'top')])
    syncAgentsFile(file, [])
    const text = fs.readFileSync(file, 'utf8')
    assert.equal(text.includes('tofui-skills:begin'), false)
    assert.match(text, /# Mine/)
    removeAll(dir)
  })

  test('deletes a file it fully owns once the last rule goes', () => {
    syncAgentsFile(file, [rule(catalog, 'top')])
    syncAgentsFile(file, [])
    assert.equal(fs.existsSync(file), false)
    removeAll(dir)
  })
})

describe('codex install lifecycle', () => {
  let catalogRoot: string
  let catalog: Catalog
  let project: string
  let root: string
  let manifest: Manifest

  before(() => {
    catalogRoot = makeCatalog()
    catalog = loadCatalog(catalogRoot)
  })
  after(() => {
    removeAll(catalogRoot)
  })
  beforeEach(() => {
    project = makeTempDir('codexproj')
    root = targetRoot(codex, { dir: project })
    manifest = readManifest(root)
  })

  test('a rule writes no file directly and reports no destination', () => {
    const ruleEntry = entry(catalog, 'development/comments')
    const dest = install(ruleEntry, codex, root, manifest, { mode: 'copy' })
    assert.equal(dest, null)
    assert.equal(fs.existsSync(path.join(root, 'rules')), false)
    assert.ok(manifest.entries['rule:development/comments'])
    removeAll(project)
  })

  test('tracked rules drive the rendered block', () => {
    install(entry(catalog, 'development/comments'), codex, root, manifest, {
      mode: 'copy',
    })
    const tracked = trackedRules(manifest, catalog.rules)
    assert.deepEqual(
      tracked.map((r) => r.id),
      ['development/comments'],
    )

    const file = agentsFileFor(root)
    syncAgentsFile(file, tracked)
    assert.match(fs.readFileSync(file, 'utf8'), /# comments/)
    removeAll(project)
  })

  test('a codex skill is copied like any other', () => {
    const dest = install(entry(catalog, 'flat-skill'), codex, root, manifest, {
      mode: 'copy',
    })
    assert.equal(dest, path.join(root, 'skills', 'flat-skill'))
    assert.ok(dest)
    assert.ok(fs.existsSync(path.join(dest, 'SKILL.md')))
    removeAll(project)
  })

  test('rule presence is decided by the manifest, not the shared file', () => {
    const a = entry(catalog, 'development/comments')
    const b = entry(catalog, 'top')
    install(a, codex, root, manifest, { mode: 'copy' })
    syncAgentsFile(agentsFileFor(root), trackedRules(manifest, catalog.rules))

    // AGENTS.md now exists, but an uninstalled rule must not look present.
    assert.equal(inspect(b, codex, root, manifest).exists, false)
    assert.equal(inspect(a, codex, root, manifest).exists, true)
    removeAll(project)
  })

  test('uninstall drops the rule from the block', () => {
    const a = entry(catalog, 'development/comments')
    const b = entry(catalog, 'top')
    const file = agentsFileFor(root)

    install(a, codex, root, manifest, { mode: 'copy' })
    install(b, codex, root, manifest, { mode: 'copy' })
    syncAgentsFile(file, trackedRules(manifest, catalog.rules))
    assert.match(fs.readFileSync(file, 'utf8'), /# comments/)

    uninstall(a, codex, root, manifest)
    syncAgentsFile(file, trackedRules(manifest, catalog.rules))
    const text = fs.readFileSync(file, 'utf8')
    assert.equal(text.includes('# comments'), false)
    assert.match(text, /top level rule/)
    removeAll(project)
  })
})
