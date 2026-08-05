import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import {
  discoverRules,
  discoverSkills,
  loadCatalog,
  parseFrontmatter,
  selectEntries,
} from '../src/catalog.ts'
import type { Catalog } from '../src/types.ts'
import { makeCatalog, removeAll } from './helpers.ts'

describe('parseFrontmatter', () => {
  test('returns nothing when there is no frontmatter', () => {
    assert.deepEqual(parseFrontmatter('# just a heading\n'), {})
  })

  test('reads scalars and strips surrounding quotes', () => {
    const meta = parseFrontmatter(
      '---\nname: thing\ndescription: "a: colon"\n---\nbody',
    )
    assert.equal(meta.name, 'thing')
    assert.equal(meta.description, 'a: colon')
  })

  test('joins folded blocks into a single string', () => {
    const meta = parseFrontmatter(
      '---\ndescription: >-\n  first line\n  second line\nname: folded\n---\n',
    )
    assert.equal(meta.description, 'first line second line')
    assert.equal(meta.name, 'folded')
  })

  test('reads dash lists', () => {
    const meta = parseFrontmatter(
      '---\npaths:\n  - "**/*.ts"\n  - src/**\n---\n',
    )
    assert.deepEqual(meta.paths, ['**/*.ts', 'src/**'])
  })

  test('handles CRLF line endings', () => {
    const meta = parseFrontmatter('---\r\nname: windows\r\n---\r\nbody')
    assert.equal(meta.name, 'windows')
  })
})

describe('discovery', () => {
  let root: string
  let catalog: Catalog

  before(() => {
    root = makeCatalog()
    catalog = loadCatalog(root)
  })
  after(() => {
    removeAll(root)
  })

  test('finds flat and category-nested skills', () => {
    const ids = catalog.skills.map((entry) => entry.id)
    assert.deepEqual(ids, ['another', 'flat-skill', 'nested-skill', 'shadowed'])
  })

  test('a flat skill shadows anything nested beneath it', () => {
    assert.equal(
      catalog.skills.find((entry) => entry.id === 'inner'),
      undefined,
    )
  })

  test('records the category without putting it in the id', () => {
    const nested = catalog.skills.find((entry) => entry.id === 'nested-skill')
    assert.equal(nested?.category, 'general')
    const flat = catalog.skills.find((entry) => entry.id === 'flat-skill')
    assert.equal(flat?.category, null)
  })

  test('ignores directories without a SKILL.md and dot directories', () => {
    const ids = catalog.skills.map((entry) => entry.id)
    assert.equal(ids.includes('notaskill'), false)
    assert.equal(ids.includes('hidden'), false)
  })

  test('reads the description out of frontmatter', () => {
    const flat = catalog.skills.find((entry) => entry.id === 'flat-skill')
    assert.equal(flat?.description, 'a flat skill')
  })

  test('finds rules at every depth and ignores non-markdown', () => {
    const ids = catalog.rules.map((entry) => entry.id).sort()
    assert.deepEqual(ids, [
      'development/comments',
      'development/nested/deep',
      'dup-a/dup',
      'dup-b/dup',
      'top',
    ])
  })

  test('keeps the rule path below rules/ for reinstallation', () => {
    const deep = catalog.rules.find(
      (entry) => entry.id === 'development/nested/deep',
    )
    assert.equal(
      deep?.relPath.split(/[\\/]/).join('/'),
      'development/nested/deep.md',
    )
    assert.equal(deep?.category, 'development/nested')
  })

  test('parses the paths frontmatter that scopes a rule', () => {
    const comments = catalog.rules.find(
      (entry) => entry.id === 'development/comments',
    )
    assert.deepEqual(comments?.paths, ['**/*.ts', '**/*.py'])
  })

  test('leaves paths empty for an unscoped rule', () => {
    const top = catalog.rules.find((entry) => entry.id === 'top')
    assert.deepEqual(top?.paths, [])
  })

  test('returns nothing for a directory with no catalog', () => {
    assert.deepEqual(discoverSkills('/nonexistent-catalog-path'), [])
    assert.deepEqual(discoverRules('/nonexistent-catalog-path'), [])
  })
})

describe('selectEntries', () => {
  let root: string
  let catalog: Catalog

  before(() => {
    root = makeCatalog()
    catalog = loadCatalog(root)
  })
  after(() => {
    removeAll(root)
  })

  test('matches a skill by id', () => {
    const { chosen, missing } = selectEntries(catalog, ['flat-skill'])
    assert.deepEqual(missing, [])
    assert.equal(chosen[0]?.type, 'skill')
    assert.equal(chosen[0]?.id, 'flat-skill')
  })

  test('matches a rule by its full path', () => {
    const { chosen, missing } = selectEntries(catalog, ['development/comments'])
    assert.deepEqual(missing, [])
    assert.equal(chosen[0]?.type, 'rule')
  })

  test('matches a rule by bare filename when unambiguous', () => {
    const { chosen } = selectEntries(catalog, ['comments'])
    assert.equal(chosen[0]?.id, 'development/comments')
  })

  test('refuses an ambiguous bare filename', () => {
    const { chosen, missing } = selectEntries(catalog, ['dup'])
    assert.deepEqual(chosen, [])
    assert.deepEqual(missing, ['dup'])
  })

  test('tolerates a .md suffix and a trailing slash', () => {
    const withSuffix = selectEntries(catalog, ['development/comments.md'])
    assert.equal(withSuffix.chosen[0]?.id, 'development/comments')
    const withSlash = selectEntries(catalog, ['flat-skill/'])
    assert.equal(withSlash.chosen[0]?.id, 'flat-skill')
  })

  test('reports unknown selectors instead of throwing', () => {
    const { chosen, missing } = selectEntries(catalog, ['flat-skill', 'nope'])
    assert.equal(chosen.length, 1)
    assert.deepEqual(missing, ['nope'])
  })
})
