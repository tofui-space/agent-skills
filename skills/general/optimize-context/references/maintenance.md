# Maintaining this skill

Version 2026-11-06.2

How each file is versioned, which parts age as models and agent harnesses change, and how to re-check them. Read this only when updating the skill, not while running an audit.

The skill is split in two on purpose. `SKILL.md` runs in the session that invokes it and only briefs the auditor, relays its return, and applies approved changes. `references/audit.md` is the auditor's procedure, run in a fresh context so that the audit's reading does not fill the session being audited. A rule about how to audit belongs in `audit.md`; a rule about approval, applying or talking to the user belongs in `SKILL.md`.

## Versions

Every file carries the date of its last change:

| File | Where the date is |
|---|---|
| `SKILL.md` | `metadata.version` in the frontmatter, with `metadata.written-with` (the model that wrote the version) and `metadata.verified-against` (the harness versions and the date sources were read) |
| `references/*.md` | A `Version YYYY-MM-DD` line under the title |
| `scripts/transcripts.py` | `VERSION`; `transcripts.py --version` prints it |
| `evals/build_fixture.py`, `evals/evals.json` | `VERSION` and `"version"` |

Change a file's date when its content changes or when its facts are re-checked and still hold. A second change on the same day is `YYYY-MM-DD.2`. When a reference file changes, also change `metadata.version` in `SKILL.md`, so the skill's version is the date of its newest file.

Reports and briefs record the skill version, the model and the harness that produced them (see `references/report-template.md`). Audits made under different versions or model generations can then be told apart and compared.

## What ages, and how to re-check it

| Part | Depends on | Re-check |
|---|---|---|
| `references/evidence.md` and the steps it supports | How models behave: positional bias, self-conditioning on errors, multi-turn degradation, sycophancy, summary loss. The studies tested models up to early 2026. | Look for newer results on the same failure modes. A step that rests on a finding newer models no longer show is a candidate for removal, but remove it only after the evals pass without it; a model cannot confirm from the inside that it no longer has a behaviour. |
| `references/locations.md` | Where each harness keeps instruction files, memory and transcripts; loader size limits; retention. | Re-read the vendor pages linked there and compare with the installed version. Facts marked observed are checked on a current installation. |
| `scripts/transcripts.py` | The record format of Claude Code and Codex transcripts, which is undocumented. | Run `show` on a recent transcript of each agent, with `--user`. A format warning, an `events:` line with no USER events, or questions without answers means the format moved. |
| Step 4's mention of `/doctor prompt-audit` | A Claude Code command available from v2.1.283. | Check the Claude Code memory documentation for the command. |
| `evals/` | The fixture and assertions. | Rerun after any change above. Results compare only between runs with the same eval version. |

When a new model generation becomes the default, run the evals with it before changing anything, and record the model and the results in the change that follows.
