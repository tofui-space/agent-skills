import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `tofui-skills-${prefix}-`))
}

export function writeFile(file: string, contents: string): string {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, contents)
  return file
}

export function skillFile(name: string, description: string): string {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`
}

/**
 * A catalog covering every layout the discovery rules care about: flat skills,
 * category-nested skills, a flat skill shadowing a nested one, directories
 * without a SKILL.md, rules at several depths, and two rules sharing a
 * basename so ambiguous selectors can be exercised.
 */
export function makeCatalog(): string {
  const root = makeTempDir('catalog')

  writeFile(
    path.join(root, 'skills/flat-skill/SKILL.md'),
    skillFile('flat-skill', 'a flat skill'),
  )
  writeFile(path.join(root, 'skills/flat-skill/references/extra.md'), 'extra\n')
  writeFile(
    path.join(root, 'skills/general/nested-skill/SKILL.md'),
    skillFile('nested-skill', 'a nested skill'),
  )
  writeFile(
    path.join(root, 'skills/general/another/SKILL.md'),
    skillFile('another', 'another nested skill'),
  )
  writeFile(
    path.join(root, 'skills/shadowed/SKILL.md'),
    skillFile('shadowed', 'shadows anything nested below it'),
  )
  writeFile(
    path.join(root, 'skills/shadowed/inner/SKILL.md'),
    skillFile('inner', 'must never be discovered'),
  )
  writeFile(path.join(root, 'skills/notaskill/README.md'), 'no SKILL.md here\n')
  writeFile(
    path.join(root, 'skills/.hidden/SKILL.md'),
    skillFile('hidden', 'inside a dot directory'),
  )

  writeFile(path.join(root, 'rules/top.md'), '# top level rule\n')
  writeFile(
    path.join(root, 'rules/development/comments.md'),
    '---\npaths:\n  - "**/*.ts"\n  - "**/*.py"\n---\n\n# comments\n',
  )
  writeFile(path.join(root, 'rules/development/nested/deep.md'), '# deep\n')
  writeFile(path.join(root, 'rules/notes.txt'), 'not a rule\n')
  writeFile(path.join(root, 'rules/dup-a/dup.md'), '# dup a\n')
  writeFile(path.join(root, 'rules/dup-b/dup.md'), '# dup b\n')

  return root
}

let symlinkCapable: boolean | undefined

/** Windows only permits symlinks with Developer Mode or elevation. */
export function canSymlink(): boolean {
  if (symlinkCapable !== undefined) return symlinkCapable
  const dir = makeTempDir('symlink-probe')
  try {
    fs.symlinkSync(dir, path.join(dir, 'probe'), 'dir')
    symlinkCapable = true
  } catch {
    symlinkCapable = false
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  return symlinkCapable
}

export function removeAll(...dirs: readonly string[]): void {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true })
}
