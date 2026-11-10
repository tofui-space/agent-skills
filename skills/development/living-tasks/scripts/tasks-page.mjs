#!/usr/bin/env node
// Builds a phone-first HTML task page from a Markdown tasks file.
// Usage: node tasks-page.mjs [status [--label <name>]] <config.json> [--standalone]
// "status" builds nothing: it prints the page link and the counts per status, in two lines.
// With --label, the counts cover only the items carrying that label.
// The page is generated output: never edit it by hand, rerun this script instead.
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const usage = 'usage: node tasks-page.mjs [status [--label <name>]] <config.json> [--standalone]'
const args = process.argv.slice(2)
const statusOnly = args.includes('status')
const labelAt = args.indexOf('--label')
const onlyLabel = labelAt >= 0 ? args[labelAt + 1] : null
if (labelAt >= 0 && (!onlyLabel || onlyLabel.startsWith('--'))) fail(`--label needs a label name, such as --label bug; ${usage}`)
if (labelAt >= 0 && !statusOnly) fail(`--label works only with status; ${usage}`)
const configPath = args.find((a, i) => !a.startsWith('--') && a !== 'status' && (labelAt < 0 || i !== labelAt + 1))
if (!configPath) fail(usage)
const standalone = args.includes('--standalone') || undefined
const base = dirname(resolve(configPath))
const config = JSON.parse(readFileSync(configPath, 'utf8'))
if (!config.source) fail('config needs "source": the path to the tasks file')
const source = resolve(base, config.source)
const out = resolve(base, config.out ?? 'tasks.html')
const lines = readFileSync(source, 'utf8').split(/\r?\n/)

function fail(message) {
  console.error(`tasks-page: ${message}`)
  process.exit(1)
}

// ---------- defaults ----------

const PALETTE = {
  light: {
    ground: '#fafaf9', ink: '#1c1c1a', text2: '#44443f', text3: '#5f5f58', rule: 'rgb(28 28 26 / 0.16)',
    accent: '#2b5d5a', done: '#2e6b45', doing: '#2f5d8f', wait: '#a12d2d', open: '#5f5f58', note: '#6b4f8a',
    press: '#2a2a27', onPress: '#fafaf9',
  },
  dark: {
    ground: '#181817', ink: '#ededea', text2: '#cfcfca', text3: '#a3a39c', rule: 'rgb(237 237 234 / 0.16)',
    accent: '#8ccfc9', done: '#8fd0a6', doing: '#9fc2ec', wait: '#f0a3a3', open: '#b0b0a8', note: '#c9b2e6',
    press: '#ededea', onPress: '#181817',
  },
}
const SYSTEM_SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

// [ ] open · [~] in progress · [x] done · [!] waiting on the reader
const STATUS = {
  ' ': { key: 'open', word: 'Open' },
  '~': { key: 'doing', word: 'In progress' },
  x: { key: 'done', word: 'Done' },
  X: { key: 'done', word: 'Done' },
  '!': { key: 'wait', word: 'Waiting on you' },
}
const NOTE = { key: 'note', word: 'Note' }

// Legend text for the standard detail fields. Other fields declared in the file render without a legend entry.
const FIELDS = {
  shipped: 'is built',
  decided: 'is your call',
  spec: 'is requirements and facts',
  evidence: 'is how it was checked',
  direction: 'is the planned approach, waiting for your OK',
  open: 'is a question for you',
}

const palette = {
  light: { ...PALETTE.light, ...config.palette?.light },
  dark: { ...PALETTE.dark, ...config.palette?.dark },
}
const fonts = {
  body: config.fonts?.body ?? { family: null },
  display: config.fonts?.display ?? config.fonts?.body ?? { family: null },
}
const person = config.person
const rename = { ...(person ? { [`Waiting on ${person}`]: 'Waiting on you' } : {}), ...config.rename }

// ---------- parse ----------

const FORMAT = 3
let title = config.title
let format = null
let bareIds = null
let fields = null
let labels = null
let prefix = null
let next = null
let link = null
const idLines = new Map()
const sections = []
let item = null
let detail = null
const checkFormat = () => {
  const n = format ?? (prefix ? 2 : 1)
  if (n > FORMAT) fail(`${config.source} is format ${n}, newer than this generator (format ${FORMAT}); update the living-tasks skill before editing the file`)
  if (n < FORMAT) fail(`${config.source} is format ${n}; this generator reads format ${FORMAT}. Migrate the file as the skill's "Format version" section describes, then rebuild`)
  if (bareIds) fail(`${bareIds}: the IDs line needs its counter: "IDs: ${prefix} · next ${prefix}-<one above the highest number>"`)
}
const stray = (text, where) => {
  if (!labels) return
  const plain = text.replace(/`[^`]*`/g, '')
  const l = labels.find((name) => new RegExp(`(^|[^\\w#])#${name}(?![\\w-])`).test(plain))
  if (l) fail(`${where}: "#${l}" is not right after the ID, so it is not read as a label; move it there, or backtick it if it is not meant as a label`)
}
lines.forEach((line, n) => {
  const where = `${config.source}:${n + 1}`
  const h1 = line.match(/^# (.+)/)
  if (h1) return void (title ??= h1[1].trim())
  const decl = !sections.length && line.match(/^Details:\s*(.+)$/)
  if (decl) {
    fields = new Map(decl[1].split('·').map((l) => l.trim()).filter(Boolean).map((l) => [l.toLowerCase(), l]))
    return
  }
  if (!sections.length && /^Format:/.test(line)) {
    const f = line.match(/^Format:\s*([1-9]\d*)\s*$/)
    if (!f) fail(`${where}: write the format line as "Format: ${FORMAT}"`)
    format = Number(f[1])
    return
  }
  if (!sections.length && /^Labels:/.test(line)) {
    labels = line.replace(/^Labels:/, '').split('·').map((l) => l.trim()).filter(Boolean)
    const bad = labels.find((l) => !/^[a-z][a-z0-9-]*$/.test(l))
    if (bad) fail(`${where}: "${bad}" is not a label name; use lower-case letters, digits and hyphens, starting with a letter`)
    return
  }
  if (!sections.length && /^IDs:/.test(line)) {
    const ids = line.match(/^IDs:\s*([A-Z][A-Z0-9]{1,7})\s*·\s*next\s+\1-([1-9]\d*)\s*$/)
    const bare = !ids && line.match(/^IDs:\s*([A-Z][A-Z0-9]{1,7})\s*$/)
    if (bare) {
      prefix = bare[1]
      bareIds = where
      return
    }
    if (!ids) fail(`${where}: write the ID line as "IDs: ABC · next ABC-1", with a prefix of 2 to 8 capital letters or digits`)
    prefix = ids[1]
    next = Number(ids[2])
    return
  }
  const pageLine = !sections.length && line.match(/^Page:\s*(https?:\/\/\S+)\s*$/)
  if (pageLine) return void (link = pageLine[1])
  const h2 = line.match(/^## (.+)/)
  if (h2) {
    if (!sections.length) checkFormat()
    const raw = h2[1].trim()
    sections.push({ title: rename[raw] ?? raw, items: [], text: [] })
    item = detail = null
    return
  }
  const section = sections.at(-1)
  if (!section) return
  const m = line.match(/^- (?:\[(.)\] )?(.*)$/)
  if (m) {
    const status = m[1] === undefined ? NOTE : STATUS[m[1]]
    if (!status) fail(`${where}: unknown status [${m[1]}]; use [ ], [~], [x] or [!]`)
    if (!prefix) fail(`${where}: declare the ID prefix first, with an "IDs: ABC · next ABC-1" line under the title`)
    // The ID is the item's link on the page, so it never changes and is never reused.
    const raise = `give it ${prefix}-${next} and change the IDs line to next ${prefix}-${next + 1}`
    const id = m[2].match(new RegExp(`^(${prefix}-([1-9]\\d*))(?: (.*))?$`))
    if (!id) fail(`${where}: the item does not start with an ID such as ${prefix}-1; ${raise}`)
    if (idLines.has(id[1])) fail(`${where}: ${id[1]} is already the ID on line ${idLines.get(id[1])}; ${raise}`)
    if (Number(id[2]) >= next)
      fail(`${where}: ${id[1]} is not lower than the IDs line's next ${prefix}-${next}; change it to next ${prefix}-${Number(id[2]) + 1}`)
    idLines.set(id[1], n + 1)
    const tags = (id[3] ?? '').match(/^(?:#[^\s#]+ +)*(?:#[^\s#]+$)?/)[0]
    const itemLabels = tags.split(/\s+/).filter(Boolean).map((t) => t.slice(1))
    for (const l of itemLabels) {
      if (!labels) fail(`${where}: declare labels first, with a "Labels: ${l} · …" line under the title`)
      if (!labels.includes(l)) fail(`${where}: "#${l}" is not a declared label (${labels.join(', ')}); add it to the Labels line or fix the spelling`)
    }
    const text = (id[3] ?? '').slice(tags.length)
    stray(text, where)
    item = { id: id[1], status, labels: [...new Set(itemLabels)], text, details: [] }
    detail = null
    section.items.push(item)
    return
  }
  const d = line.match(/^ {2}- ([A-Za-z][\w ]*?)::\s+(.*)$/)
  if (d) {
    if (!item) fail(`${where}: a detail field needs an item above it`)
    if (!fields) fail(`${where}: declare detail fields first, with a "Details: Decided · Shipped · …" line under the title`)
    const field = fields.get(d[1].trim().toLowerCase())
    if (!field) fail(`${where}: "${d[1]}" is not a declared detail field (${[...fields.values()].join(', ')})`)
    detail = { field, text: d[2] }
    item.details.push(detail)
    return
  }
  if (/^ {2}- /.test(line)) fail(`${where}: a sub-bullet under an item must be a detail field: "  - field:: text"`)
  if (/^ {4}\S/.test(line) && detail) return void (detail.text += ` ${line.trim()}`)
  if (/^ {2}\S/.test(line) && item && !detail) {
    stray(line, where)
    return void (item.text += ` ${line.trim()}`)
  }
  if (/^ {2}\S/.test(line) && detail) fail(`${where}: indent detail continuations 4 spaces`)
  if (line.trim()) {
    item = detail = null
    section.text.push(line.trim())
  }
})
if (!sections.length) checkFormat()
title ??= 'Tasks'
const all = sections.flatMap((s) => s.items)
const count = (key, items = all) => items.filter((i) => i.status.key === key).length

if (statusOnly) {
  if (onlyLabel && !labels?.includes(onlyLabel)) fail(`"${onlyLabel}" is not a declared label (${labels?.join(', ') || 'the file has no Labels line'})`)
  const scope = onlyLabel ? all.filter((i) => i.labels.includes(onlyLabel)) : all
  console.log(`${link ?? `${out} (not published)`}
${onlyLabel ? `#${onlyLabel}: ` : ''}${count('wait', scope)} waiting on you · ${count('doing', scope)} in progress · ${count('open', scope)} open · ${count('done', scope)} done`)
  process.exit(0)
}

// ---------- inline formatting ----------

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// Commit hashes: 7 to 40 hex characters with at least one digit and one letter a-f.
// An all-digit hash is indistinguishable from a number; the tasks file backticks it.
const HASH = /\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b/g
// File paths: optional folders, then a name with a known extension.
const PATH =
  /(?<![\w/.@-])(?:[\w@.-]+\/)*[\w.-]+\.(?:md|mdx|txt|json|jsonc|ya?ml|toml|ini|env|lock|html?|css|scss|js|mjs|cjs|jsx|ts|mts|cts|tsx|vue|svelte|py|rb|go|rs|java|kt|cs|csproj|sln|fs|swift|c|h|cc|cpp|hpp|zig|php|sh|ps1|sql|graphql|proto|xml|svg|dockerfile)\b/gi
const autoCode = (s) =>
  s
    .split(/(<[^>]+>)/)
    .map((part) => (part.startsWith('<') ? part : part.replace(PATH, '<code>$&</code>').replace(HASH, '<code>$&</code>')))
    .join('')
const inline = (s) =>
  escape(s)
    .split(/(`[^`]+`)/)
    .map((part) =>
      part.length > 1 && part.startsWith('`') && part.endsWith('`')
        ? `<code>${part.slice(1, -1)}</code>`
        : autoCode(part.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')),
    )
    .join('')
    // Hashes inside a path or another code span stay one code span.
    .replace(/<code>([^<]*)<code>([^<]*)<\/code>([^<]*)<\/code>/g, '<code>$1$2$3</code>')

// ---------- contrast check ----------

const parse = (c) => {
  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((x) => x + x).join('') : hex[1]
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  }
  const rgb = c.match(/^rgb\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i)
  return rgb ? rgb.slice(1, 4).map(Number) : null
}
const lum = (rgb) =>
  rgb
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
const mix = (fg, bg, share) => fg.map((v, i) => Math.round(v * share + bg[i] * (1 - share)))
const problems = []
for (const theme of ['light', 'dark']) {
  const p = palette[theme]
  const ground = parse(p.ground)
  const check = (name, fg, bg = ground, bgName = 'ground') => {
    const f = parse(p[fg] ?? fg)
    if (!f || !bg) return void problems.push(`${theme}: cannot read ${name}; use #rrggbb or rgb()`)
    const r = ratio(f, bg)
    if (r < 4.5) problems.push(`${theme}: ${name} on ${bgName} is ${r.toFixed(2)}:1, needs 4.5:1`)
  }
  for (const t of ['ink', 'text2', 'text3', 'accent', 'done', 'doing', 'wait', 'open', 'note']) check(t, t)
  for (const [t, share] of [['done', 0.1], ['doing', 0.1], ['wait', 0.12]]) {
    const f = parse(p[t])
    if (f && ground) check(`${t} chip text`, t, mix(f, ground, share), 'its chip fill')
  }
  check('onPress', 'onPress', parse(p.press), 'press')
}
if (problems.length) fail(`contrast below WCAG AA, page not written:\n  ${problems.join('\n  ')}`)

// ---------- render ----------

const todo = count('open') + count('doing') + count('wait')
const hasDetails = all.some((i) => i.details.length)
const fieldsUsed = [...new Set(all.flatMap((i) => i.details.map((d) => d.field.toLowerCase())))]
const labelsUsed = (labels ?? []).filter((l) => all.some((i) => i.labels.includes(l)))
const unlabeled = all.some((i) => !i.labels.length)
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section'
const timeZone = config.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
const updated = statSync(source).mtime.toLocaleString(config.locale ?? 'en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone,
})
const storageKey = `tasks-filter:${slug(title)}`
const labelKey = `tasks-label:${slug(title)}`
const themeKey = `tasks-theme:${slug(title)}`
const ids = new Set()
const uniqueId = (s) => {
  let id = `s-${slug(s)}`
  for (let n = 2; ids.has(id); n++) id = `s-${slug(s)}-${n}`
  ids.add(id)
  return id
}

const detailsHtml = (i) => {
  if (!i.details.length) return ''
  const kinds = [...new Set(i.details.map((d) => d.field))].map(escape).join(' · ')
  const rows = i.details
    .map((d) => `<div><dt class="field ${slug(d.field)}">${escape(d.field)}</dt><dd>${inline(d.text)}</dd></div>`)
    .join('\n            ')
  return `
        <details>
          <summary>Details <span class="kinds">${kinds}</span></summary>
          <dl>
            ${rows}
          </dl>
        </details>`
}

const sectionHtml = sections
  .filter((s) => s.items.length)
  .map((s) => {
    const id = uniqueId(s.title)
    return `<section aria-labelledby="${id}" data-section>
  <h2 id="${id}">${escape(s.title)} <span class="n" data-count></span></h2>
  ${s.text.map((t) => `<p class="lede">${inline(t)}</p>`).join('\n  ')}
  <ul>
${s.items
  .map(
    (i) => `    <li id="${i.id}" data-status="${i.status.key}" data-labels="${i.labels.join(' ')}">
      <span class="chip ${i.status.key}">${i.status.word}</span>
      <div class="body">
        <p><a class="id" href="#${i.id}">${i.id}</a>${i.labels.map((l) => ` <span class="tag">#${l}</span>`).join('')} ${inline(i.text)}</p>${detailsHtml(i)}
      </div>
    </li>`,
  )
  .join('\n')}
  </ul>
</section>`
  })
  .join('\n')
// Option values "*" and "-" cannot collide with a label name, which starts with a letter.
const pickHtml = labelsUsed.length
  ? `\n    <div class="pick"><label for="label">Label</label><select id="label"><option value="*">All labels</option>${labelsUsed.map((l) => `<option value="${l}">#${l}</option>`).join('')}${unlabeled ? '<option value="-">No label</option>' : ''}</select></div>`
  : ''

const legend = fieldsUsed
  .filter((f) => FIELDS[f])
  .map((f) => `<b class="k-${f}">${f[0].toUpperCase()}${f.slice(1)}</b> ${FIELDS[f]}`)
const legendHtml = legend.length ? `\n  <p class="legend">Under <em>Details</em>: ${legend.join(', ')}.</p>` : ''

const tokens = (p) =>
  Object.entries(p)
    .map(([k, v]) => `--${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${v};`)
    .join(' ')
const stack = (f, fallback) => (f.family ? `${f.family}, ${fallback}` : fallback)
const googleFamilies = [fonts.body.google, fonts.display.google].filter(Boolean)
const fontLinks = googleFamilies.length
  ? `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${[...new Set(googleFamilies)].map((g) => `family=${g}`).join('&')}&display=swap">`
  : ''
const bodyFont = stack(fonts.body, SYSTEM_SANS)
const displayFont = stack(fonts.display, bodyFont)
const waiting = count('wait')

const page = `<title>${escape(title)}</title>
${fontLinks}
<style>
:root { color-scheme: light; ${tokens(palette.light)} }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { color-scheme: dark; ${tokens(palette.dark)} } }
:root[data-theme="dark"] { color-scheme: dark; ${tokens(palette.dark)} }
body { margin: 0; background: var(--ground); color: var(--ink); font: 16px/1.55 ${bodyFont}; padding-inline: 16px; }
[hidden] { display: none !important; }
main { max-width: 46rem; margin: 0 auto; padding-block: 20px 56px; }
h1, h2 { font-family: ${displayFont}; font-weight: 600; text-wrap: balance; margin: 0; }
h1 { font-size: 34px; line-height: 1.1; }
h2 { font-size: 26px; line-height: 1.2; }
.eyebrow { font-size: 13px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent); margin: 0 0 4px; }
.summary { margin: 8px 0 0; color: var(--text2); }
.summary strong { color: var(--wait); font-weight: 600; }
.summary span { white-space: nowrap; }
header { display: grid; grid-template-columns: 1fr auto; column-gap: 12px; align-items: start; }
header > :not(.theme) { grid-column: 1; }
header > .summary, header > .pick { grid-column: 1 / -1; }
.pick { margin-top: 12px; display: grid; gap: 4px; justify-items: start; min-width: 0; }
.pick label { font-size: 14px; font-weight: 600; color: var(--text2); }
.pick select { min-height: 44px; min-width: min(100%, 12rem); max-width: 100%; padding-inline: 12px; border: 1px solid var(--text3); border-radius: 8px; background: color-mix(in srgb, var(--ink) 4%, var(--ground)); color: var(--ink); font: 16px/1.2 ${bodyFont}; text-overflow: ellipsis; cursor: pointer; }
.theme { grid-column: 2; grid-row: 1 / span ${config.eyebrow ? 2 : 1}; width: 44px; height: 44px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 999px; background: transparent; color: var(--text2); cursor: pointer; }
.theme:hover { background: color-mix(in srgb, var(--ink) 8%, transparent); color: var(--ink); }
.theme svg { width: 22px; height: 22px; }
.theme[data-dark="true"] .moon, .theme[data-dark="false"] .sun { display: none; }
.bar { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 1; background: var(--ground); border-bottom: 1px solid var(--rule); padding-block: 12px; margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap; }
.bar button { min-height: 44px; min-width: 44px; padding-inline: 14px; border: 1px solid var(--rule); border-radius: 8px; background: transparent; color: var(--ink); font: 600 15px/1 ${bodyFont}; cursor: pointer; }
.bar button[aria-pressed="true"] { background: var(--press); color: var(--on-press); border-color: var(--press); }
.bar .n, h2 .n { font-weight: 400; font-variant-numeric: tabular-nums; }${pickHtml ? `\n.bar .n { display: inline-block; min-width: ${String(all.length).length}ch; text-align: end; }` : ''}
h2 .n { font: 400 15px/1 ${bodyFont}; color: var(--text3); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.legend { margin: 12px 0 0; font-size: 14px; color: var(--text3); }
.legend b { font-weight: 600; color: var(--text2); }
section { margin-top: 28px; }
.lede { color: var(--text3); margin: 6px 0 0; }
.empty { margin: 28px 0 0; color: var(--text3); }
ul { list-style: none; margin: 8px 0 0; padding: 0; }
li { display: grid; gap: 6px; padding-block: 14px; border-top: 1px solid var(--rule); }
li:first-child { border-top: 0; }
li p { margin: 0; overflow-wrap: break-word; }
li[data-status="done"] .body > p { color: var(--text2); }
li:target { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 4px; }
.id { color: var(--text3); font-variant-numeric: tabular-nums; white-space: nowrap; text-decoration: none; }
.id:hover { text-decoration: underline; }
.tag { color: var(--text3); font-size: 14px; overflow-wrap: anywhere; }
.body { display: grid; gap: 8px; min-width: 0; }
strong { font-weight: 600; }
.chip { justify-self: start; font-size: 13px; font-weight: 600; letter-spacing: 0.02em; line-height: 1; padding: 5px 9px; border-radius: 999px; border: 1px solid currentColor; white-space: nowrap; }
.chip.done { color: var(--done); background: color-mix(in srgb, var(--done) 10%, transparent); }
.chip.doing { color: var(--doing); background: color-mix(in srgb, var(--doing) 10%, transparent); }
.chip.wait { color: var(--wait); background: color-mix(in srgb, var(--wait) 12%, transparent); }
.chip.open { color: var(--open); }
.chip.note { color: var(--note); }
details { border-left: 2px solid var(--rule); padding-left: 12px; }
summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-weight: 600; font-size: 15px; color: var(--accent); list-style: none; }
summary::-webkit-details-marker { display: none; }
summary::before { content: '▸'; display: inline-block; width: 1em; transition: transform 0.15s; }
details[open] > summary::before { transform: rotate(90deg); }
summary .kinds { font-weight: 400; font-size: 13px; color: var(--text3); }
dl { margin: 0 0 6px; display: grid; gap: 10px; }
dl div { display: grid; gap: 2px; }
dt.field { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text3); }
dt.decided, .legend .k-decided { color: var(--accent); }
dt.shipped, .legend .k-shipped { color: var(--done); }
dt.direction, .legend .k-direction { color: var(--doing); }
dt.open, .legend .k-open { color: var(--wait); }
dd { margin: 0; overflow-wrap: break-word; }
code { font: 0.86em/1 ui-monospace, 'SF Mono', Menlo, Consolas, monospace; background: color-mix(in srgb, var(--ink) 8%, transparent); padding: 0.15em 0.35em; border-radius: 4px; overflow-wrap: anywhere; }
footer { margin-top: 40px; color: var(--text3); font-size: 14px; }
@media (min-width: 600px) { li { grid-template-columns: 8.5rem 1fr; gap: 14px; align-items: baseline; } }
@media (prefers-reduced-motion: reduce) { summary::before { transition: none; } }
</style>
<main>
  <header>
    <button type="button" class="theme" id="theme" data-dark="false" aria-label="Switch to dark theme" title="Switch to dark theme"><svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg><svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button>${config.eyebrow ? `\n    <p class="eyebrow">${escape(config.eyebrow)}</p>` : ''}
    <h1>${escape(title)}</h1>
    <p class="summary">${[waiting ? `<strong>${waiting} waiting on you</strong>` : '0 waiting on you', `${count('doing')} in progress`, `${count('open')} open`, `${count('done')} done`].map((t) => `<span>${t}</span>`).join(' · ')}</p>${pickHtml}
  </header>
  <nav class="bar" aria-label="Show">
    <button type="button" data-filter="todo" aria-pressed="false">To do <span class="n" data-n="todo">${todo}</span></button>
    <button type="button" data-filter="wait" aria-pressed="false">Waiting on you <span class="n" data-n="wait">${waiting}</span></button>
    <button type="button" data-filter="done" aria-pressed="false">Done <span class="n" data-n="done">${count('done')}</span></button>
    <button type="button" data-filter="all" aria-pressed="true">All</button>${hasDetails ? '\n    <button type="button" id="all-details" aria-pressed="false">All details</button>' : ''}
  </nav>${legendHtml}
${sectionHtml}
  <p class="empty" hidden>Nothing matches this filter.</p>
  <footer>From <code>${escape(config.sourceLabel ?? config.source)}</code>, updated ${escape(updated)}.</footer>
</main>
<script>
(() => {
  const key = ${JSON.stringify(storageKey)}
  const show = {
    all: () => true,
    todo: (s) => s === 'open' || s === 'doing' || s === 'wait',
    wait: (s) => s === 'wait',
    done: (s) => s === 'done',
  }
  const labelKey = ${JSON.stringify(labelKey)}
  const picker = document.getElementById('label')
  const state = { filter: 'all', label: '*' }
  const labelled = (li) => {
    const own = li.dataset.labels ? li.dataset.labels.split(' ') : []
    return state.label === '*' || (state.label === '-' ? !own.length : own.includes(state.label))
  }
  // Notes (no status box) show only under All.
  const apply = () => {
    for (const b of document.querySelectorAll('[data-filter]')) b.setAttribute('aria-pressed', String(b.dataset.filter === state.filter))
    let any = 0
    for (const section of document.querySelectorAll('[data-section]')) {
      let shown = 0
      for (const li of section.querySelectorAll('li')) {
        li.hidden = !labelled(li) || !show[state.filter](li.dataset.status)
        if (!li.hidden) shown++
      }
      section.hidden = shown === 0
      section.querySelector('[data-count]').textContent = shown ? String(shown) : ''
      any += shown
    }
    document.querySelector('.empty').hidden = any > 0
    const items = [...document.querySelectorAll('li')].filter(labelled)
    for (const n of document.querySelectorAll('[data-n]')) n.textContent = String(items.filter((li) => show[n.dataset.n](li.dataset.status)).length)
    if (picker) picker.value = state.label
    try { localStorage.setItem(key, state.filter); localStorage.setItem(labelKey, state.label) } catch {}
  }
  for (const b of document.querySelectorAll('[data-filter]')) b.addEventListener('click', () => { state.filter = b.dataset.filter; apply() })
  picker?.addEventListener('change', () => { state.label = picker.value; apply() })
  const toggle = document.getElementById('all-details')
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-pressed') !== 'true'
    toggle.setAttribute('aria-pressed', String(open))
    for (const d of document.querySelectorAll('details')) d.open = open
  })
  // Theme: follows the system until the viewer picks one; the pick is remembered per viewer.
  const root = document.documentElement
  const theme = document.getElementById('theme')
  const dark = () => root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
  // The label names what a press does, so it changes with the theme.
  const showTheme = () => {
    const label = dark() ? 'Switch to light theme' : 'Switch to dark theme'
    theme.dataset.dark = String(dark())
    theme.setAttribute('aria-label', label)
    theme.title = label
  }
  try { const t = localStorage.getItem(${JSON.stringify(themeKey)}); if (t === 'dark' || t === 'light') root.dataset.theme = t } catch {}
  showTheme()
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', showTheme)
  theme.addEventListener('click', () => {
    root.dataset.theme = dark() ? 'light' : 'dark'
    showTheme()
    try { localStorage.setItem(${JSON.stringify(themeKey)}, root.dataset.theme) } catch {}
  })
  try {
    const f = localStorage.getItem(key)
    if (show[f]) state.filter = f
    const l = localStorage.getItem(labelKey)
    if (picker && [...picker.options].some((o) => o.value === l)) state.label = l
  } catch {}
  apply()
  // A link to an item (#ABC-4) lands below the sticky bar, and shows the item even when the filter or label hides it.
  const bar = document.querySelector('.bar')
  const pad = () => { root.style.scrollPaddingTop = \`calc(env(safe-area-inset-top, 0px) + \${bar.offsetHeight + 8}px)\` }
  pad()
  new ResizeObserver(pad).observe(bar)
  const reveal = () => {
    const target = location.hash && document.getElementById(location.hash.slice(1))
    if (!target || !target.matches('li') || !target.hidden) return
    state.filter = 'all'
    state.label = '*'
    apply()
    target.scrollIntoView()
  }
  reveal()
  addEventListener('hashchange', reveal)
})()
</script>
`

const html = standalone
  ? `<!doctype html>
<html lang="${escape(config.lang ?? 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${page.replace(/<main>[\s\S]*$/, '')}</head>
<body>
${page.match(/<main>[\s\S]*$/)[0]}</body>
</html>
`
  : page
writeFileSync(out, html)
console.log(`${out}\n${sections.map((s) => `${s.title}: ${s.items.length}`).join(' · ')} · ${count('wait')} waiting`)
