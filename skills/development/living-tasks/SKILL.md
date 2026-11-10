---
name: living-tasks
description: Keep a project's task list in a local TASKS.md and publish it as a phone-first HTML page with status and label filters and expandable details. Use when work spans sessions or requests and the person needs to see what is open, done, or waiting on them; on "task list", "TASKS.md", "track this", "add it to the list", "what's left", "what's waiting on me", "publish the tasks", "rebuild the task page", "link to the task page", "label these tasks", "filter the tasks by label"; and when a request arrives mid-session. Not for building a to-do feature in an app, and not for the session's own progress checklist.
---

# Living tasks

A tasks file in the repo records every request, decision, and result. A page generated from it shows the person what needs them. The file is the record; the page is a view of it.

An agent's memory is lost on a new session or after compaction. A file on disk is not. So every fact that a later session needs goes into the file, at the moment it becomes true.

**Precedence.** An explicit instruction from the person wins over these conventions. Skills that write validation verdicts into a task file write them as detail fields in this format.

## Contents

- The tasks file
  - Where it lives
  - Header
  - Format version
  - Item IDs
  - Sections
  - Labels
  - Items
  - Detail fields
  - Done items carry evidence
  - Waiting items name the exact action
  - When to write
- The page
  - Rebuild and republish
  - Link and counts
  - First setup in a project
  - Palette, fonts, and the rebuild hook
  - Page behavior and config keys
- Files

## The tasks file

### Where it lives

- Path: `TASKS.md` at the repo root, or `docs/TASKS.md` if a `docs/` folder exists. Use an existing tasks file if one is present.
- Local only. Add its path to `.git/info/exclude`, which is local to the checkout and never committed. Do not use `.gitignore` for this: `.gitignore` is a committed file.
- If git already tracks the file (`git ls-files --error-unmatch <path>` succeeds), exclusion has no effect. Tell the person; untracking it is theirs to do.
- Never commit the tasks file, the page config, or the generated page.

### Header

Under the title:

```markdown
# Crumb tasks

Living task list for Crumb, the bakery pre-order app. Local only, never committed.
Format: 3
Status: `[ ]` open · `[~]` in progress · `[x]` done · `[!]` waiting on Alex.
Details: Decided · Shipped · Spec · Evidence · Direction · Open
Labels: storefront · orders · bug
IDs: CRB · next CRB-12
Page: https://example.com/pages/crumb-tasks
```

- `Format:` is the version of the file's format. See "Format version".
- `Details:` declares the allowed detail fields. The generator stops on any other field and names the file and line.
- `Labels:` declares the allowed item labels. Optional; see "Labels".
- `IDs:` declares the item ID prefix and the next free number. See "Item IDs".
- `Page:` holds the published link. A later session reads it and republishes to the same link. Fill it in after the first publish.

### Format version

This skill writes format 3. A new tasks file gets the `Format: 3` line.

Before the first edit to a tasks file in a session, read its header. A file with no `Format:` line is format 1 if it has no `IDs:` line, and format 2 if it has one. Migrate an older file before any other edit to it:

1. **Format 1 to 2, item IDs.** Ask the person for the prefix as "Item IDs" describes, and wait for the answer. Then number the existing items 1, 2, 3, … in file order, notes included, and add the `IDs:` line with `next` one above the last.
2. **Format 2 to 3, labels.** If the `IDs:` line has no `next`, such as `IDs: CA`, add it: `IDs: CA · next CA-<n>`, with `<n>` one above the highest item number in the file. An item whose text starts with `#` right after its ID would now be read as a label: backtick that word. Then add `Format: 3` under the description line.
3. Rebuild and republish the page.

Change nothing else in the file while migrating, and tell the person in one line which format it was migrated from. The generator stops on a file older than format 3 and names its format, so an unmigrated file never builds a page.

A file with a format higher than 3 was written by a newer version of this skill. Do not edit it; tell the person to update the skill.

### Item IDs

Every item has an ID such as `CRB-4`: the prefix, a hyphen, and a number. It stays the same when the item's title, status, section, or labels change. In conversation, name an item by its ID. On the page it is also the item's anchor (`#CRB-4`), which works when the page is opened directly; a publishing tool that shows the page inside its own frame may drop it.

**Choosing the prefix.** When creating the tasks file, or before adding an item to a file with no `IDs:` line, ask the person for the prefix and offer a default:

- An acronym of the project name, such as `CRB` for Crumb. If the file covers one area of a larger project, an acronym of that area, such as `PAY` for payments.
- 2 to 5 capital letters.
- Not used anywhere in the repo (`git grep -nwE 'CRB-[0-9]+'` prints nothing), and not a widely used prefix such as ADR, RFC, CVE, PR, or API. Tools, documents, and agents number many things with a prefix, and an ID that matches one of them is ambiguous.

Wait for the answer before writing the item or starting the work. If the answer names no prefix, use the default.

Write the chosen prefix into the `IDs:` line. The generator accepts 2 to 8 capital letters or digits, starting with a letter. When adding IDs to an existing file, number its items 1, 2, 3, … in file order and set `next` one above the last.

**Numbering:**

- A new item takes the number in `next`. Raise `next` by one in the same edit.
- Never renumber an item and never reuse a number. `next` only goes up, so a removed item's number is never given out again and an old link never points to a different item.
- Notes in the red-flags section get IDs too.

The generator stops on an item without an ID, a duplicate ID, or an ID not lower than `next`, and names the line and the next free ID.

### Sections

In this order. Drop a section only while it is empty.

| Section | Holds |
|---|---|
| `## Now` | Work in progress, and finished items not yet cleared by the person. |
| `## Queue (approved)` | Work the person approved but nobody has started. |
| `## Waiting on <name>` | Actions only the person can take. `<name>` is the person's first name. |
| A red-flags section, such as `## Red flags` | Code to untangle before the next review. Notes, no status boxes. An optional lede line under the heading says what the list is for. |
| `## Later` | Ideas and parked work, not approved. |

### Labels

Labels are optional. They let the person view part of the list on the page: an area, a feature, a kind of task, a client, a release, or any mix of these. Without labels, the page shows the whole list as one backlog. A label never changes where an item sits in the file; the item stays in its section.

```markdown
Labels: storefront · orders · bug

- [~] CRB-4 #storefront **Allergen info** on every product card.
- [ ] CRB-9 #orders #bug **Receipt times** show the pickup time in UTC.
- [ ] CRB-2 **Gift cards.**
```

- The `Labels:` line under the title declares the allowed labels: lower-case letters, digits, and hyphens, starting with a letter. The generator stops on an undeclared label and names the line.
- An item's labels are `#name` words right after its ID, before the title. An item can have any number of labels, or none. Notes take labels the same way. A declared label written anywhere else in the item's text stops the generator; backtick it there if it is not meant as a label.
- Label an item when the person names the label for it, or when the item's subject is the label's subject, such as `#bug` on a reported defect. Otherwise leave it unlabeled. Never hold an item back for a label: the page's "No label" choice lists unlabeled items, so the person can label them later.
- The person decides which labels exist. Add, rename, or remove a label only when the person asks. A rename changes the `Labels:` line and every item carrying the label, in the same edit.

### Items

One item is one line starting `- `, continued on lines indented 2 spaces.

```markdown
- [~] CRB-4 #storefront **Allergen info** on every product card. Data comes from `menu/allergens.json`; three products lack entries.
  - spec:: the 14 EU allergens, shown as words, never as icons alone.
  - direction:: a "Contains" line under the price; a product with no entry says "Allergens not listed yet".
```

Status box, then ID, then labels if any, then text:

- `[ ]` open
- `[~]` in progress
- `[x]` done
- `[!]` waiting on the person
- no box: a note (red flags only)

Rules for every item:

- **Bold title after the ID and any labels.** The title names the outcome in the person's words: "**Pickup slots fill up correctly.**", not "Slot logic".
- **Quote the person, with a date.** Where the person asked for or decided something, quote their exact words and the date: `Alex 2026-03-02: "close it at twelve."` Their wording is the requirement; a paraphrase drifts.
- **One item per request.** A request that grows becomes more detail fields, not a second item.

### Detail fields

A detail field sits under an item as `  - field:: text`: indented 2 spaces, the field name in lower case, then a double colon. The double colon marks a field, so a prose line is never misread as one. A field longer than one line continues on lines indented 4 spaces. Any other sub-bullet under an item stops the generator. The page puts detail fields behind a "Details" toggle, so the item line stays short.

| Field | Holds |
|---|---|
| `decided` | A decision by the person, quoted and dated. |
| `shipped` | What is built and how it behaves. |
| `spec` | Requirements and facts found: limits, measurements, how reference products do it. |
| `evidence` | How the result was checked. |
| `direction` | The planned approach, waiting for the person's OK. |
| `open` | A question for the person. |

To add a field, add its name to the `Details:` line first. Added fields render without a legend entry.

### Done items carry evidence

An item is `[x]` only with its evidence on the item line or in an `evidence` field:

- **Commits:** the short hashes. Backtick a hash that has no letter, such as `` `2604311` ``; without a letter the generator cannot tell it from a number.
- **Tests:** passed over total, such as `Tests 88/88`. A partial pass is not done.
- **UI work:** the screen sizes it was checked at, on which devices or browsers, and how, such as a script name. UI work is not done until it has been checked on real screen sizes, including a 360 px wide phone.

Without evidence, the item stays `[~]` and says what is missing.

### Waiting items name the exact action

A `[!]` item says what to do, specifically enough to do it without asking:

- Good: `Push main: 4e1c09a pickup slots, 9b72f3e allergen loader. Everything through 51ac7d2 is pushed.`
- Not enough: `Push the recent work.`

When the person finishes the action, mark the item `[x]` with what happened.

### When to write

Items are for requests that change the project (code, config, design, content, docs) or need a decision. A question answered in the reply is not an item.

- **A new request:** add the item before starting work on it, in the same turn the request arrives. Quote the request. The one exception is an open prefix question; see "Item IDs".
- **A decision:** add a `decided` field the moment it is made.
- **A status change:** update the box when the status changes, not at the end of the session.
- **A blocker that needs the person:** add a `[!]` item right away.

Items stay in their section when done. Remove or move old done items only when the person asks.

## The page

The page is generated from the tasks file by `scripts/tasks-page.mjs`. Never edit the page by hand: the next build overwrites the edit, and the page and the file disagree until then.

### Rebuild and republish

After any turn that changed the tasks file:

1. Run `node <skill-dir>/scripts/tasks-page.mjs <config.json>`. Skip this step when the optional rebuild hook reported "Task page rebuilt" after the last edit.
2. Publish the output to the link in the file's `Page:` line, replacing the previous version. Use the environment's own publishing tool; with a hosted-page tool, pass the existing link so the link stays the same.
3. If no link exists yet, publish once, then write the new link into the `Page:` line.
4. With no publishing tool, write the page, give the person its path, and leave the `Page:` line unchanged.

Rebuild once per turn, after the last edit, not after every edit.

Publish the page by path. Never Read, Write or Edit the generated page: the script's summary line is the check. A rebuild and publish by path costs a few hundred tokens; reading the page costs thousands, and it grows with the tasks file.

Add `--standalone` for a full HTML document with `<!doctype>`, `<head>`, and `<body>`. Without it the script writes a fragment (title, styles, content, script), for publishing tools that wrap pages in their own document.

### Link and counts

When the person asks for the task page, its link, or how many tasks are open, done, or waiting, run:

```sh
node <skill-dir>/scripts/tasks-page.mjs status <config.json>
```

It prints two lines and writes nothing:

```
https://example.com/pages/crumb-tasks
2 waiting on you · 1 in progress · 5 open · 1 done
```

Reply with those two lines. When the question names a label, such as "how many bugs are open?", add `--label bug` after `status`: the second line then counts only the items carrying that label, and starts with `#bug:`. Read the tasks file only when the person asks about specific tasks. The first line is the `Page:` link, or the local page path followed by "(not published)" when the file has no link yet. The command checks the tasks file as a build does, and stops on the same errors.

### First setup in a project

1. Copy `assets/tasks-page.config.example.json` to a place outside version control, or add its path to `.git/info/exclude`.
2. Set `source`, `title`, `person`, and `timeZone`.
3. Take the project's palette and fonts into `palette` and `fonts`, as `references/setup.md` describes.
4. Build, check the page at 360 px wide in light and dark, publish, and fill in the `Page:` line.

### Palette, fonts, and the rebuild hook

Read `references/setup.md` at first setup, when the generator reports a contrast failure, and when the person asks for the rebuild hook. It says how to take the palette and fonts from the project, and how to install the optional Claude Code hook.

Set up the hook only when the person asks for it. Other agents, such as Codex or Gemini CLI, run the rebuild step by hand; that step is the default everywhere.

### Page behavior and config keys

Read `references/page.md` before changing the script, the config, or the palette. It lists what the page must do, as a checklist for verifying a change, and every config key with its default.

## Files

- `scripts/tasks-page.mjs` — the generator, and its `status` subcommand. Node 18 or later, no dependencies.
- `references/page.md` — page behavior checklist and config reference.
- `references/setup.md` — taking the palette and fonts from the project, and installing the optional rebuild hook.
- `assets/TASKS.example.md` — a complete tasks file with every section, status, detail field, and labels.
- `assets/tasks-page.config.example.json` — a config that builds the example.
- `assets/hooks/rebuild-on-edit.mjs`, `assets/hooks/settings.example.json` — the optional Claude Code rebuild hook.
