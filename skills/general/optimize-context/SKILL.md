---
name: optimize-context
description: "On-demand audit and repair of the context that piles up in long engineering work: the current conversation, earlier session transcripts, decision records, research and review notes, scratchpads, task lists, docs, and agent instruction files (skills, rules, CLAUDE.md, AGENTS.md, memory), across every checkout, worktree and shared store a project uses. Checks each entry against code, runs, sources and its origin, and repairs only what the user approves. Use when the user asks to audit, verify, clean up, consolidate or optimize context, notes, memory or instruction files, mentions context rot or lost provenance, asks what is actually known or decided, or wants a verified brief to restart from. Only on request. Not for a plain handoff summary of the conversation without checking it, code review, writing new docs, or shortening a single prompt."
metadata:
  version: "2026-11-06.2"
  written-with: "claude-opus-5-5"
  verified-against: "Claude Code 2.1.319, codex-cli 0.166.0; vendor docs and papers read 2026-11-06"
---

# Optimize context

Long engineering work leaves context behind: what was said in the conversation, what earlier sessions concluded, and what was written into notes, decision records and instruction files. Every later session reads some of it and acts on it. Over many hours and sessions it rots in predictable ways: a guess is written down as a fact, a user's passing remark becomes a requirement, a decision is reversed in chat but the old one stays in a file, two files drift apart, a summary drops the condition that made a statement true, and a path or command stops existing. Nobody notices, because each piece reads as plausible on its own.

This skill audits that context one entry at a time: where it lives, where it came from, and whether the evidence still supports it. Then it proposes exact repairs, and applies only the ones the user approves.

The audit does not run in this session. It reads far more than a normal task (each test run of this skill used 136k to 151k tokens), and that reading would land in the very context being cleaned, where length alone lowers accuracy and earlier errors make later ones more likely (`references/evidence.md`). A fresh context reads the record from disk instead. This session keeps only the auditor's short return, the user's answers, and the approved edits.

## Contents

- Step 1: Brief the auditor
- Step 2: Start it in a fresh context
- Step 3: Show the result and say what is needed
- Step 4: Apply what was approved
- Step 5: Repair this conversation
- Precedence
- Reference files

## Step 1: Brief the auditor

Collect these, without reading the files under audit yourself:

- What the user asked to audit, in their words, and any instruction they gave for it.
- Every checkout: `git worktree list --porcelain` lists the worktrees and their branches. Without git, the working directory is the only checkout.
- The transcript of the session under audit. Usually that is this session: run `python3 <skill>/scripts/transcripts.py sessions <checkout>`, take the newest entry for the directory this session started in, and confirm it with `show <file> --user --grep '<a phrase from the user's latest message>'`. When the user asks to audit an earlier session, pass that session's transcript instead. When none can be found, say so in the prompt; the conversation can then not be audited, only the files.
- Locations the user named, and the report directory if the user named one.

Do not summarize the conversation for the auditor. A summary written here is an unchecked claim about the record, and it would anchor the auditor on this session's reading; the transcript path replaces it.

## Step 2: Start it in a fresh context

Start one subagent with a fresh context. Not a fork or copy of this conversation: that would carry the same errors and the same load. Give it this prompt, filled in:

```
Read <skill>/references/audit.md and follow it. The skill directory is <skill>.
Audit requested by the user: "<their words>"
Checkouts: <path (branch)>, …
Transcript of the session under audit: <path, or "none found">
Other locations the user named: <paths, or none>
Report directory: <path, or "default">
Write a handoff brief: <yes, when the session under audit is this one or the user asked for one; otherwise no>
You cannot ask the user anything. Put every question in the report and in your return.
```

If no subagent can be started, give the user two choices: start a new session in the same directory and invoke this skill there, where it audits this session through its transcript; or run the audit here by following `references/audit.md`, which adds all of the audit's reading to this conversation.

## Step 3: Show the result and say what is needed

Relay the auditor's return as it came: the report path, the count per verdict, the High findings and the questions. Then say exactly what the user needs to do:

- Reply with the finding IDs to apply: by ID, by range, by group ("all noise removals"), or "none".
- Answer each numbered question.
- Nothing changes until they reply. Each finding in the report holds the exact old and new text, for any finding they want to check before approving.

If you ask through a question tool, put the report path and the material each question refers to inside the question itself: such tools can hide the text written before them.

If the audit covered instruction files on Claude Code v2.1.283 or later, mention once that the built-in `/doctor prompt-audit` can check them as well. It is a command the user runs. If they do, treat each of its findings as a claim, verify it, and add it to the report under this skill's verdicts before proposing it.

## Step 4: Apply what was approved

For each approved ID, read that finding's change from the report (search the report for the ID rather than reading all of it), re-read the target file, and apply the change exactly as written. Mark each finding in the report as applied, declined (with the user's reason, if given) or deferred. Record the user's answers to the questions in the report as user-confirmed, dated, from this audit. An answer that calls for a new change gets that change proposed first, not applied. Leave the edits uncommitted for the user to review, unless they ask otherwise.

If the user disputes a finding, re-open its evidence (the command, `path:line` or URL in the report) and look for what they point to. Change the verdict when the evidence changes, not because the finding was challenged: models are measured to drop correct answers under "are you sure?", and an audit that folds under pushback records the error a second time. If the user keeps the entry anyway, that is their call; mark the finding declined with their reason.

## Step 5: Repair this conversation

This conversation cannot be edited. Once the approvals are applied, state each approved correction that concerns something said in this conversation, one line each: what was said, when, and what the evidence shows. Later turns then read the correction instead of the earlier claim. If a handoff brief was written, give its path: a new session started from it leaves the accumulated context behind.

## Precedence

An explicit instruction from the user in this session wins over the steps here. "Apply all of them" is approval for every proposal listed; it is not approval for proposals made later. Instructions that shape chat replies govern what this session writes in chat; the report and the brief follow their template.

## Reference files

- `references/audit.md`: the auditor's procedure. The auditor reads it. This session reads it only when no fresh context could be started and the user chose to run the audit here.
- `references/report-template.md`: the report and brief templates. The auditor writes from it; this session needs only the layout of a finding to find its change in Step 4.
- `references/locations.md`: where agents keep instruction files, memory and transcripts, and how to use `scripts/transcripts.py`. Read its transcript section for Step 1.
- `references/evidence.md`: the research behind the steps, with sources. Read it when the user asks why a step exists.
- `references/maintenance.md`: how the files are versioned and what ages. Read it only when updating this skill.
