# The privacy seal — full reference

SKILL.md carries the rule and the three gates. This file carries the detail: exact
definitions, the substitution vocabulary, worked examples of implicit leaks, and the
checklists to run at each gate. Read it whenever a gate decision is not obvious.

## Contents

1. Why the seal exists
2. What counts as the author's information
3. The source rule
4. Neutral substitution vocabulary
5. Worked examples of implicit leaks
6. Gate checklists
7. Editing skills that already leak
8. The denylist file
9. The one-line seal report

---

## 1. Why the seal exists

A skill is a reusable instruction file. It gets copied into other repositories, committed,
published to catalogs, pasted into other people's agents. Anything written into it travels
with it, forever, outside the author's control.

The failure mode this seal prevents is not a typo. It is a reflex: when a model wants an
example to feel "realistic", it reaches for the most salient concrete material it has, and
the most salient material is always the author — their employer, their current project,
their domain, their file names, their colleagues. The result looks like a harmless
illustrative example. It is actually a disclosure of what the author works on, made without
the author's knowledge, in a file that has nothing to do with that work.

That has happened. A skill on an unrelated topic ended up naming, and describing, an internal
project the author had once worked on, because the model borrowed it as an
example. The author found it after the fact. The seal exists so that it cannot happen again:
the check runs before the text is written, not after it is discovered.

Realism is not the goal. Distance is. An example should be judged by how far it sits from
the author's life, not by how real it feels.

## 2. What counts as the author's information

Treat every item below as sealed. "Author" means the person you are working with, plus
anyone and anything connected to them.

**Identity and personal life**

- Names, handles, e-mail addresses, usernames (including the OS account name that appears
  in every absolute path on their machine), initials used as identifiers.
- Location: country, city, time zone, language, nationality, accent, currency.
- Health, neurotype, disability, accommodations, working hours, energy, routines.
- Family, relationships, pets, hobbies, possessions, devices, hardware, OS.
- Anything stated in rules files, memory files, CLAUDE.md, system prompts, or earlier
  sessions about who the author is or how they want to be treated.

**Professional life**

- Employer, past employers, clients, agencies, contracts, job title, seniority, team,
  colleagues, managers, reports, recruiters.
- Industry and domain of their work, even stated generically ("works in adtech").
- Internal systems, products, platforms, services, code names, tickets, incident names.
- Tooling choices that are specific to their workplace rather than to the skill's subject.

**Projects**

- Repository names, organization names, package names, bundle identifiers, domains, URLs.
- Architecture, stack, module names, file paths, directory layout, naming conventions,
  environment variable names, config values, test names, commit history.
- Other skills, rules, or agents the author owns — unless the skill being written is
  explicitly meant to link to one of them and the author asked for that link.
- Anything visible in the current working directory, open files, git remotes, or the
  catalog this skill is being added to.

**Implicit carriers** — the forms a leak usually takes

- Examples and "e.g." clauses.
- Hypotheticals ("imagine you are migrating a payments service").
- Analogies and metaphors drawn from a domain the author works in.
- Test prompts, eval queries, sample inputs, sample outputs, fixtures.
- Placeholder names that echo real ones (`globexpay`, `gbx`, `platform-v2`).
- File names, column names, field names, enum values, API routes in samples.
- The *choice of domain* for an example, even when every noun in it is invented.
- Descriptions written "pushy" with trigger phrases copied from the author's vocabulary.
- Commit messages, PR descriptions, or changelog lines written on the author's behalf.

## 3. The source rule

Every concrete noun in a skill artifact has exactly one of three permitted origins:

1. **Declared scope.** The author wrote it, in this conversation, as content for this skill.
   Use it verbatim or paraphrased. Do not extend it: "my team uses pnpm" does not license
   naming the team, the repo, or the product.
2. **The skill's own subject.** The thing the skill teaches (Excel formulas, commit
   messages, WCAG criteria). Vocabulary intrinsic to the subject is not the author's
   information.
3. **Neutral invention.** Names and domains chosen from the substitution vocabulary below,
   or invented to be equally distant from the author.

There is no fourth origin. Conversation history, memory, rules files, CLAUDE.md, the
repository on disk, and earlier sessions are sources of **requirements** (what the skill
must do) — never of **content** (what goes on the page). When a requirement arrives
wrapped in the author's specifics, strip the specifics before the requirement is written
down.

"Turn this conversation into a skill" is the highest-risk request, because the
conversation is made of the author's specifics. Extract the pattern (steps, decisions,
corrections, formats), then re-domain it completely before drafting. If the pattern cannot
be expressed without the author's specifics, the skill is project-local: say so, and ask the
author what, if anything, may be named — then include only that.

## 4. Neutral substitution vocabulary

Use these, or invent equivalents that are just as generic. Rotate between them so a skill
does not accidentally build a consistent fictional world that reads as a real one.

| Kind          | Use                                                                   |
|---------------|-----------------------------------------------------------------------|
| Person        | Alex, Sam, Jordan, Riley, "a teammate", "the reviewer"                 |
| Organisation  | Acme, Globex, Initech, "Example Corp", "the vendor"                    |
| Domain/e-mail | example.com, example.org, example.net, `*.test`, `*.invalid`          |
| Repo/package  | `example-app`, `widget-service`, `acme/tools`                         |
| Paths         | `~/project/…`, `/path/to/…`, `<repo>/src/…`, `$HOME/…`                |
| Data domains  | library catalog, weather log, bus timetable, recipe box, plant care,   |
|               | hardware-store inventory, bird sightings, board-game scores            |
| Tickets/IDs   | `TICKET-123`, `#42`, `abc123`                                         |

Before using a "neutral" domain, apply the echo check (gate 2): a neutral domain stops
being neutral the moment it matches what the author actually does.

## 5. Worked examples of implicit leaks

Each "before" would pass a naive proofread. Each is a leak. The author in these examples is
invented: they work on a payroll product at a company called Globex, and their rules file
says they prefer British spelling.

**Domain echo.** Skill: "write commit messages".
Before: `Input: Added overtime rounding to payslips  Output: feat(payslip): round overtime`
After: `Input: Added overdue-book reminder e-mails  Output: feat(reminders): e-mail overdue notices`

**Path echo.** Before: `Read C:\Users\<their-account>\work\globex\payroll\src\index.ts`
After: `Read <repo>/src/index.ts`

**Vocabulary echo.** A skill about documentation style must not say "use British spelling"
as though that were the skill's own rule, when it is this author's stated preference. Either
the author asked for it to be in the skill, or the skill stays spelling-neutral.

**Placeholder echo.** Before: `const GPX_API = ...` where GPX abbreviates the real product.
After: `const CATALOG_API = ...`

**Trigger-phrase echo.** Before (description): "Use when the user says 'payrun' or
'month-end close' ..." copied from how this author talks at work. Acceptable only if the
author asked for those trigger phrases; otherwise pick phrases from the subject, not from
the person.

**Eval-query echo.** Before: "ok so my manager at Globex wants the payroll variance report
by friday". After: "ok so my manager wants the overdue-books report by friday, it's in
~/downloads/overdue_final_v2.xlsx".

**Hypothetical echo.** Before: "Suppose you are migrating a payroll engine to a new tax
table format." After: "Suppose you are adding a search box to a recipe site."

**Incident echo.** The author tells you, while asking for a skill, about a past leak and
what it exposed. That story is now the most salient material you have. It is also sealed:
do not reuse its domain, names, or details as examples anywhere — including in a skill
about preventing leaks.

## 6. Gate checklists

**Gate 1 — declared scope (before drafting)**

- [ ] Written down, in one or two lines: what the author explicitly supplied for this skill.
- [ ] Decided: is this skill generic (default) or project-local (author said so)?
- [ ] If project-local: listed exactly which names the author permitted. Nothing else.

**Gate 2 — noun audit + echo check (before every write)**

- [ ] Every person, organisation, product, project, domain, path, URL, file, column, field,
      acronym, and ticket in the text has a permitted origin (declared / subject / neutral).
- [ ] Every example's *domain* is unrelated to the author's work and life.
- [ ] No placeholder resembles a real name, even by abbreviation or rhythm.
- [ ] No rationale, constraint, or preference that belongs to the author is presented as the
      skill's own.
- [ ] Test prompts, eval queries, fixtures, and sample data passed the same audit.
- [ ] Absolute paths: only placeholders. No account names.

**Gate 3 — scan + report (before presenting, packaging, or committing)**

- [ ] `python -m scripts.privacy_scan <skill-dir>` run from the tofui-skill-creator
      directory, exit code 0.
- [ ] `evals/` and any workspace outputs scanned too if they will be committed.
- [ ] Seal report line delivered to the author (section 9).

## 7. Editing skills that already leak

When asked to edit an existing skill, run the gate-3 scan on it *before* touching it and
read it with the gate-2 checklist in mind. Pre-existing leaks are reported to the author
with file, line, and the exact replacement you propose. Do not silently delete them — the
author decides whether a project-local mention was intentional. Do not leave them either:
the report is not optional, and removal is one confirmation away.

Never reintroduce a leak you just removed by "preserving the original example". Re-domain
the example.

## 8. The denylist file

`scripts/privacy_scan.py` reads an optional denylist: one term per line, `#` comments,
case-insensitive whole-word matching. Default location `~/.claude/private-terms.txt`,
overridable with `--terms FILE` or `PRIVATE_TERMS_FILE`.

The file lives **outside every repository**, because it is itself a list of the author's
private terms. Never copy it, quote it, commit it, or echo its contents into a skill, a
transcript summary, or a commit message. When the scan reports a hit, report the file and
line, and the kind of hit; repeat the matched term only if the author needs it to find the
line.

Good candidates for the list: employer and client names, product and code names, repo and
org names, colleagues, city, any abbreviation the author uses for their projects.

## 9. The one-line seal report

After every turn that wrote or changed a skill artifact, end with exactly one line:

```
Seal: scan clean · model-supplied specifics: Acme, Alex, library-catalog domain
```

or

```
Seal: scan found 2 errors (SKILL.md:41, evals/evals.json:7) — fixed · model-supplied specifics: none
```

"Model-supplied specifics" lists every concrete noun you chose yourself (origin 3 in the
source rule). It is the author's veto list: if anything on it looks too close to home, they
say so and you replace it. Keep the line short; it is read every time.
