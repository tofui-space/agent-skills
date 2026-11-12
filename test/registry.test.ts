import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { after, describe, test } from 'node:test'
import { AGENTS } from '../src/agents.ts'
import { writeManifest } from '../src/install.ts'
import {
  dedupeTargets,
  projectLogFiles,
  readProjectLog,
  readRegistry,
  recordTarget,
  scanForTargets,
  targetsInProjectLogs,
  writeRegistry,
} from '../src/registry.ts'
import type { Manifest } from '../src/types.ts'
import { makeTempDir, removeAll, writeFile } from './helpers.ts'

const temps: string[] = []
after(() => removeAll(...temps))

function temp(prefix: string): string {
  const dir = makeTempDir(prefix)
  temps.push(dir)
  return dir
}

function oneEntry(): Manifest {
  return {
    version: 1,
    entries: {
      'rule:development/comments': {
        type: 'rule',
        id: 'development/comments',
        source: 'rules/development/comments.md',
        mode: 'copy',
        installedAt: '2026-01-01T00:00:00.000Z',
      },
    },
  }
}

describe('recordTarget', () => {
  test('lists a directory while its manifest tracks entries', () => {
    const file = path.join(temp('registry'), 'installs.json')
    const root = path.join(temp('project'), '.claude')
    writeManifest(root, oneEntry())

    recordTarget(file, { agent: AGENTS.claude, root })

    const targets = readRegistry(file)
    assert.equal(targets.length, 1)
    assert.equal(targets[0]?.agent.id, 'claude')
    assert.equal(targets[0]?.root, path.resolve(root))
  })

  test('drops a directory once its manifest is empty', () => {
    const file = path.join(temp('registry'), 'installs.json')
    const root = path.join(temp('project'), '.claude')
    writeManifest(root, oneEntry())
    recordTarget(file, { agent: AGENTS.claude, root })

    writeManifest(root, { version: 1, entries: {} })
    recordTarget(file, { agent: AGENTS.claude, root })

    assert.deepEqual(readRegistry(file), [])
  })

  test('records a directory once however often it is saved', () => {
    const file = path.join(temp('registry'), 'installs.json')
    const root = path.join(temp('project'), '.claude')
    writeManifest(root, oneEntry())

    recordTarget(file, { agent: AGENTS.claude, root })
    recordTarget(file, { agent: AGENTS.claude, root })

    assert.equal(readRegistry(file).length, 1)
  })

  test('keeps the same directory separately for each agent', () => {
    const file = path.join(temp('registry'), 'installs.json')
    const project = temp('project')
    const claude = path.join(project, '.claude')
    const codex = path.join(project, '.codex')
    writeManifest(claude, oneEntry())
    writeManifest(codex, oneEntry())

    recordTarget(file, { agent: AGENTS.claude, root: claude })
    recordTarget(file, { agent: AGENTS.codex, root: codex })

    assert.deepEqual(
      readRegistry(file).map((target) => target.agent.id),
      ['claude', 'codex'],
    )
  })
})

describe('readRegistry', () => {
  test('reads a missing or malformed file as empty', () => {
    const dir = temp('registry')
    assert.deepEqual(readRegistry(path.join(dir, 'missing.json')), [])
    const bad = writeFile(path.join(dir, 'bad.json'), '{ not json')
    assert.deepEqual(readRegistry(bad), [])
  })

  test('skips entries with an unknown agent or no root', () => {
    const file = writeFile(
      path.join(temp('registry'), 'installs.json'),
      JSON.stringify({
        version: 1,
        targets: [
          { agent: 'claude', root: '/a/.claude' },
          { agent: 'nobody', root: '/b/.claude' },
          { agent: 'codex' },
        ],
      }),
    )
    const targets = readRegistry(file)
    assert.equal(targets.length, 1)
    assert.equal(targets[0]?.root, path.resolve('/a/.claude'))
  })

  test('round-trips through writeRegistry without duplicates', () => {
    const file = path.join(temp('registry'), 'installs.json')
    const target = { agent: AGENTS.claude, root: path.resolve('/a/.claude') }
    writeRegistry(file, [target, target])
    assert.deepEqual(readRegistry(file), [target])
  })
})

describe('dedupeTargets', () => {
  test('treats paths that resolve to the same directory as one', () => {
    const root = path.resolve('/a/.claude')
    const targets = dedupeTargets([
      { agent: AGENTS.claude, root },
      { agent: AGENTS.claude, root: path.join(root, '..', '.claude') },
    ])
    assert.equal(targets.length, 1)
  })
})

describe('readProjectLog', () => {
  test('reads the keys of the projects object in a JSON log', () => {
    const file = writeFile(
      path.join(temp('log'), '.claude.json'),
      JSON.stringify({ projects: { '/a/one': {}, '/b/two': {} }, other: 1 }),
    )
    assert.deepEqual(readProjectLog(file, 'json-projects'), [
      '/a/one',
      '/b/two',
    ])
  })

  test('reads literal and basic quoted project headers in a TOML log', () => {
    const file = writeFile(
      path.join(temp('log'), 'config.toml'),
      [
        'model = "x"',
        "[projects.'c:\\work\\one']",
        'trust_level = "trusted"',
        '[projects."c:\\\\work\\\\two"]',
        '[profiles.default]',
        "  [projects.'/home/three']  ",
      ].join('\r\n'),
    )
    assert.deepEqual(readProjectLog(file, 'toml-projects'), [
      'c:\\work\\one',
      'c:\\work\\two',
      '/home/three',
    ])
  })

  test('reads a missing, malformed or projectless log as empty', () => {
    const dir = temp('log')
    assert.deepEqual(
      readProjectLog(path.join(dir, 'missing.json'), 'json-projects'),
      [],
    )
    const bad = writeFile(path.join(dir, 'bad.json'), '{ not json')
    assert.deepEqual(readProjectLog(bad, 'json-projects'), [])
    const none = writeFile(path.join(dir, 'none.json'), '{"projects": []}')
    assert.deepEqual(readProjectLog(none, 'json-projects'), [])
  })
})

describe('targetsInProjectLogs', () => {
  test('finds installs of every agent in each logged project', () => {
    const projects = temp('projects')
    const one = path.join(projects, 'one')
    const two = path.join(projects, 'two')
    writeManifest(path.join(one, '.claude'), oneEntry())
    writeManifest(path.join(one, '.codex'), oneEntry())
    fs.mkdirSync(path.join(two, '.claude'), { recursive: true })
    const log = writeFile(
      path.join(temp('log'), '.claude.json'),
      JSON.stringify({
        projects: { [one]: {}, [two]: {}, [path.join(projects, 'gone')]: {} },
      }),
    )

    const found = targetsInProjectLogs([
      { file: log, format: 'json-projects' },
      { file: log, format: 'json-projects' },
    ]).map((target) => [target.agent.id, target.root])

    assert.deepEqual(found, [
      ['claude', path.join(one, '.claude')],
      ['codex', path.join(one, '.codex')],
    ])
  })
})

describe('projectLogFiles', () => {
  test('resolves each log against home or the agent config directory', () => {
    const files = projectLogFiles('/home/u', (agent) =>
      path.join('/cfg', agent.id),
    ).map((log) => log.file)
    assert.deepEqual(files, [
      path.join('/home/u', '.claude.json'),
      path.join('/cfg/claude', '.claude.json'),
      path.join('/cfg/codex', 'config.toml'),
    ])
  })
})

describe('scanForTargets', () => {
  test('finds manifests in nested projects for both agents', () => {
    const top = temp('scan')
    writeManifest(path.join(top, 'one', '.claude'), oneEntry())
    writeManifest(path.join(top, 'group', 'two', '.codex'), oneEntry())

    const found = scanForTargets([top])
      .map((target) => [target.agent.id, path.relative(top, target.root)])
      .sort()

    assert.deepEqual(found, [
      ['claude', path.join('one', '.claude')],
      ['codex', path.join('group', 'two', '.codex')],
    ])
  })

  test('ignores config directories whose manifest is empty or absent', () => {
    const top = temp('scan')
    writeManifest(path.join(top, 'empty', '.claude'), {
      version: 1,
      entries: {},
    })
    fs.mkdirSync(path.join(top, 'bare', '.claude'), { recursive: true })

    assert.deepEqual(scanForTargets([top]), [])
  })

  test('does not descend into dependency folders or hidden directories', () => {
    const top = temp('scan')
    writeManifest(path.join(top, 'node_modules', 'pkg', '.claude'), oneEntry())
    writeManifest(path.join(top, '.hidden', 'pkg', '.claude'), oneEntry())

    assert.deepEqual(scanForTargets([top]), [])
  })

  test('stops at the depth limit', () => {
    const top = temp('scan')
    writeManifest(path.join(top, 'a', 'b', 'c', '.claude'), oneEntry())

    assert.equal(scanForTargets([top], 2).length, 0)
    assert.equal(scanForTargets([top], 3).length, 1)
  })
})
