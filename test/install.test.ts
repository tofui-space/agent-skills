import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, beforeEach, describe, test } from 'node:test'
import { loadCatalog } from '../src/catalog.ts'
import {
  destinationFor,
  inspect,
  install,
  readManifest,
  targetRoot,
  uninstall,
  writeManifest,
} from '../src/install.ts'
import type { Catalog, CatalogEntry, Manifest } from '../src/types.ts'
import { makeCatalog, makeTempDir, removeAll, writeFile } from './helpers.ts'

function entry(catalog: Catalog, id: string): CatalogEntry {
  const found = [...catalog.skills, ...catalog.rules].find((c) => c.id === id)
  assert.ok(found, `fixture is missing ${id}`)
  return found
}

describe('targetRoot', () => {
  const original = process.env.CLAUDE_CONFIG_DIR

  after(() => {
    if (original === undefined) delete process.env.CLAUDE_CONFIG_DIR
    else process.env.CLAUDE_CONFIG_DIR = original
  })

  test('defaults to .claude in the working directory', () => {
    assert.equal(targetRoot(), path.resolve(process.cwd(), '.claude'))
  })

  test('--dir targets .claude inside the given directory', () => {
    assert.equal(
      targetRoot({ dir: '/somewhere' }),
      path.join('/somewhere', '.claude'),
    )
  })

  test('--global follows CLAUDE_CONFIG_DIR when set', () => {
    process.env.CLAUDE_CONFIG_DIR = '/custom/config'
    assert.equal(targetRoot({ global: true }), path.resolve('/custom/config'))
  })

  test('--global falls back to ~/.claude when unset', () => {
    delete process.env.CLAUDE_CONFIG_DIR
    assert.equal(
      targetRoot({ global: true }),
      path.join(os.homedir(), '.claude'),
    )
  })

  test('--dir wins over --global', () => {
    process.env.CLAUDE_CONFIG_DIR = '/custom/config'
    assert.equal(
      targetRoot({ dir: '/explicit', global: true }),
      path.join('/explicit', '.claude'),
    )
  })
})

describe('destinationFor', () => {
  let catalog: Catalog
  let root: string

  before(() => {
    root = makeCatalog()
    catalog = loadCatalog(root)
  })
  after(() => {
    removeAll(root)
  })

  test('drops the catalog category from a skill', () => {
    const dest = destinationFor(entry(catalog, 'nested-skill'), '/target')
    assert.equal(dest, path.join('/target', 'skills', 'nested-skill'))
  })

  test('keeps the category path for a rule', () => {
    const dest = destinationFor(
      entry(catalog, 'development/comments'),
      '/target',
    )
    assert.equal(
      dest,
      path.join('/target', 'rules', 'development', 'comments.md'),
    )
  })
})

describe('manifest', () => {
  let root: string

  beforeEach(() => {
    root = makeTempDir('manifest')
  })
  after(() => {
    removeAll(root)
  })

  test('reads an empty manifest when none exists', () => {
    assert.deepEqual(readManifest(root), { version: 1, entries: {} })
  })

  test('round-trips what was written', () => {
    const manifest: Manifest = {
      version: 1,
      entries: {
        'skill:x': {
          type: 'skill',
          id: 'x',
          source: 'skills/g/x',
          mode: 'copy',
          installedAt: '2026-01-01T00:00:00.000Z',
        },
      },
    }
    writeManifest(root, manifest)
    assert.deepEqual(readManifest(root), manifest)
  })

  test('treats an unparseable manifest as empty rather than throwing', () => {
    writeFile(path.join(root, '.tofui-skills.json'), '{ not json')
    assert.deepEqual(readManifest(root), { version: 1, entries: {} })
  })
})

describe('install and uninstall', () => {
  let catalogRoot: string
  let catalog: Catalog
  let target: string
  let manifest: Manifest

  before(() => {
    catalogRoot = makeCatalog()
    catalog = loadCatalog(catalogRoot)
  })
  after(() => {
    removeAll(catalogRoot)
  })
  beforeEach(() => {
    target = makeTempDir('target')
    manifest = readManifest(target)
  })

  test('copies a skill directory including its references', () => {
    const dest = install(entry(catalog, 'flat-skill'), target, manifest, {
      mode: 'copy',
    })
    assert.ok(fs.existsSync(path.join(dest, 'SKILL.md')))
    assert.ok(fs.existsSync(path.join(dest, 'references', 'extra.md')))
    assert.equal(fs.lstatSync(dest).isSymbolicLink(), false)
    removeAll(target)
  })

  test('installs a nested skill flattened to its name', () => {
    const dest = install(entry(catalog, 'nested-skill'), target, manifest, {
      mode: 'copy',
    })
    assert.equal(dest, path.join(target, 'skills', 'nested-skill'))
    removeAll(target)
  })

  test('installs a rule under its category path', () => {
    const dest = install(
      entry(catalog, 'development/comments'),
      target,
      manifest,
      { mode: 'copy' },
    )
    assert.equal(dest, path.join(target, 'rules', 'development', 'comments.md'))
    assert.match(fs.readFileSync(dest, 'utf8'), /# comments/)
    removeAll(target)
  })

  test('link mode creates a symlink back to the catalog', () => {
    const dest = install(entry(catalog, 'flat-skill'), target, manifest, {
      mode: 'link',
    })
    assert.equal(fs.lstatSync(dest).isSymbolicLink(), true)
    assert.ok(fs.existsSync(path.join(dest, 'SKILL.md')))
    removeAll(target)
  })

  test('records provenance in the manifest', () => {
    install(entry(catalog, 'flat-skill'), target, manifest, {
      mode: 'copy',
      origin: 'https://example.test/repo.git',
      commit: 'abc1234',
    })
    const record = manifest.entries['skill:flat-skill']
    assert.equal(record?.mode, 'copy')
    assert.equal(record?.origin, 'https://example.test/repo.git')
    assert.equal(record?.commit, 'abc1234')
    assert.equal(record?.source, path.join('skills', 'flat-skill'))
    removeAll(target)
  })

  test('omits provenance keys when the source is not a clone', () => {
    install(entry(catalog, 'flat-skill'), target, manifest, { mode: 'copy' })
    const record = manifest.entries['skill:flat-skill']
    assert.equal('origin' in (record ?? {}), false)
    assert.equal('commit' in (record ?? {}), false)
    removeAll(target)
  })

  test('reports an untracked file at the destination', () => {
    const skill = entry(catalog, 'flat-skill')
    writeFile(
      path.join(destinationFor(skill, target), 'SKILL.md'),
      'hand written\n',
    )
    const placement = inspect(skill, target, manifest)
    assert.equal(placement.exists, true)
    assert.equal(placement.tracked, false)
    removeAll(target)
  })

  test('reports a destination it installed as tracked', () => {
    const skill = entry(catalog, 'flat-skill')
    install(skill, target, manifest, { mode: 'copy' })
    const placement = inspect(skill, target, manifest)
    assert.equal(placement.exists, true)
    assert.equal(placement.tracked, true)
    removeAll(target)
  })

  test('reinstalling replaces the previous contents', () => {
    const skill = entry(catalog, 'flat-skill')
    const dest = install(skill, target, manifest, { mode: 'copy' })
    writeFile(path.join(dest, 'stale.md'), 'left over\n')
    install(skill, target, manifest, { mode: 'copy' })
    assert.equal(fs.existsSync(path.join(dest, 'stale.md')), false)
    assert.ok(fs.existsSync(path.join(dest, 'SKILL.md')))
    removeAll(target)
  })

  test('uninstall removes the entry and its manifest record', () => {
    const skill = entry(catalog, 'flat-skill')
    const dest = install(skill, target, manifest, { mode: 'copy' })
    uninstall(skill, target, manifest)
    assert.equal(fs.existsSync(dest), false)
    assert.equal(manifest.entries['skill:flat-skill'], undefined)
    removeAll(target)
  })

  test('uninstall prunes category directories left empty', () => {
    const deep = entry(catalog, 'development/nested/deep')
    const comments = entry(catalog, 'development/comments')
    install(deep, target, manifest, { mode: 'copy' })
    install(comments, target, manifest, { mode: 'copy' })

    uninstall(deep, target, manifest)
    assert.equal(
      fs.existsSync(path.join(target, 'rules', 'development', 'nested')),
      false,
    )
    assert.equal(fs.existsSync(path.join(target, 'rules', 'development')), true)

    uninstall(comments, target, manifest)
    assert.equal(
      fs.existsSync(path.join(target, 'rules', 'development')),
      false,
    )
    assert.equal(fs.existsSync(path.join(target, 'rules')), true)
    removeAll(target)
  })
})
