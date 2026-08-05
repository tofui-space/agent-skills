import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { after, afterEach, before, describe, test } from 'node:test'
import {
  DEFAULT_REPO,
  PACKAGE_NAME,
  cacheDir,
  cacheRepoDir,
  hasGit,
  repoUrl,
  resolveSource,
} from '../src/source.ts'
import { makeCatalog, makeTempDir, removeAll, writeFile } from './helpers.ts'

const savedEnv = {
  repo: process.env.TOFUI_SKILLS_REPO,
  source: process.env.TOFUI_SKILLS_SOURCE,
  home: process.env.TOFUI_SKILLS_HOME,
}

function clearEnv(): void {
  delete process.env.TOFUI_SKILLS_REPO
  delete process.env.TOFUI_SKILLS_SOURCE
  delete process.env.TOFUI_SKILLS_HOME
}

after(() => {
  for (const [key, value] of [
    ['TOFUI_SKILLS_REPO', savedEnv.repo],
    ['TOFUI_SKILLS_SOURCE', savedEnv.source],
    ['TOFUI_SKILLS_HOME', savedEnv.home],
  ] as const) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('repoUrl', () => {
  afterEach(clearEnv)

  test('prefers an explicit override', () => {
    process.env.TOFUI_SKILLS_REPO = 'https://env.test/repo.git'
    assert.equal(
      repoUrl('https://explicit.test/repo.git'),
      'https://explicit.test/repo.git',
    )
  })

  test('falls back to the environment', () => {
    process.env.TOFUI_SKILLS_REPO = 'https://env.test/repo.git'
    assert.equal(repoUrl(), 'https://env.test/repo.git')
  })

  test('falls back to the default remote', () => {
    clearEnv()
    assert.equal(repoUrl(), DEFAULT_REPO)
  })
})

describe('cacheDir', () => {
  afterEach(clearEnv)

  test('honours TOFUI_SKILLS_HOME', () => {
    process.env.TOFUI_SKILLS_HOME = '/tmp/tofui-skills-cache-test'
    assert.equal(cacheDir(), path.resolve('/tmp/tofui-skills-cache-test'))
    assert.equal(
      cacheRepoDir(),
      path.join(path.resolve('/tmp/tofui-skills-cache-test'), 'repo'),
    )
  })

  test('defaults under the home directory', () => {
    clearEnv()
    assert.match(cacheDir(), /[\\/]\.cache[\\/]tofui-skills$/)
  })
})

describe('resolveSource', () => {
  let catalogRoot: string
  const originalCwd = process.cwd()

  before(() => {
    catalogRoot = makeCatalog()
  })
  after(() => {
    process.chdir(originalCwd)
    removeAll(catalogRoot)
  })
  afterEach(() => {
    process.chdir(originalCwd)
    clearEnv()
  })

  test('uses an explicit directory', () => {
    const source = resolveSource(catalogRoot)
    assert.equal(source.kind, 'explicit')
    assert.equal(source.dir, path.resolve(catalogRoot))
  })

  test('reads TOFUI_SKILLS_SOURCE when no argument is given', () => {
    process.env.TOFUI_SKILLS_SOURCE = catalogRoot
    const source = resolveSource()
    assert.equal(source.kind, 'explicit')
    assert.equal(source.dir, path.resolve(catalogRoot))
  })

  test('rejects a directory holding no catalog', () => {
    const empty = makeTempDir('empty')
    assert.throws(
      () => resolveSource(empty),
      /No skills\/ or rules\/ directory/,
    )
    removeAll(empty)
  })

  test('detects an enclosing checkout by package name', () => {
    const checkout = makeTempDir('checkout')
    writeFile(
      path.join(checkout, 'package.json'),
      JSON.stringify({ name: PACKAGE_NAME }),
    )
    writeFile(
      path.join(checkout, 'skills/demo/SKILL.md'),
      '---\nname: demo\n---\n',
    )
    const nested = path.join(checkout, 'nested/deeper')
    fs.mkdirSync(nested, { recursive: true })

    process.chdir(nested)
    const source = resolveSource()
    assert.equal(source.kind, 'checkout')
    assert.equal(source.dir, fs.realpathSync(checkout))

    process.chdir(originalCwd)
    removeAll(checkout)
  })

  test('ignores an unrelated project that merely has a skills directory', () => {
    const decoy = makeTempDir('decoy')
    writeFile(
      path.join(decoy, 'package.json'),
      JSON.stringify({ name: 'some-other-project' }),
    )
    writeFile(
      path.join(decoy, 'skills/demo/SKILL.md'),
      '---\nname: demo\n---\n',
    )

    process.chdir(decoy)
    const source = resolveSource()
    assert.notEqual(source.kind, 'checkout')

    process.chdir(originalCwd)
    removeAll(decoy)
  })
})

describe('hasGit', () => {
  test('detects the git binary on PATH', () => {
    assert.equal(typeof hasGit(), 'boolean')
  })
})
