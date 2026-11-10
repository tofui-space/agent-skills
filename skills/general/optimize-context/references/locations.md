# Where context lives

Version 2026-11-06 · checked against Claude Code 2.1.319 and codex-cli 0.166.0

Where each agent keeps instruction files, memory and transcripts, and when each is read. Facts marked **documented** come from the vendor page linked beside them, read 2026-11-06. Facts marked **observed** were seen on one installation and are not documented; confirm them on the machine before relying on them. Both change between versions: when the installed version behaves differently, the installation wins and the finding is that this file is out of date.

## Contents

- Claude Code
- Codex
- Any other agent
- Reading transcripts with `scripts/transcripts.py`
- What a transcript can and cannot tell you

## Claude Code

`~/.claude` below means `$CLAUDE_CONFIG_DIR` when that variable is set (documented, https://code.claude.com/docs/en/claude-directory).

**Instruction files** (documented, https://code.claude.com/docs/en/memory):

| File | Read when |
|---|---|
| Managed policy `CLAUDE.md` (macOS `/Library/Application Support/ClaudeCode/CLAUDE.md`, Linux `/etc/claude-code/CLAUDE.md`) | Every session; cannot be excluded |
| `~/.claude/CLAUDE.md`, `~/.claude/rules/**/*.md` | Every session, every project |
| `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md` in the working directory and every directory above it | At launch, concatenated from the root down; `CLAUDE.local.md` after `CLAUDE.md` at each level |
| The same files in subdirectories below the working directory | On demand, once a file in that subdirectory is read or edited |
| `.claude/rules/**/*.md` | At launch; a rule with `paths:` frontmatter only when matching files are worked on |
| Files imported with `@path` from any of the above | With the file that imports them; up to four hops |
| `AGENTS.md` | Only when no `CLAUDE.md` or `CLAUDE.local.md` exists in the working directory or above it, or when a `CLAUDE.md` imports it |
| Skills (`~/.claude/skills/`, `.claude/skills/`) | Name and description every session; body when invoked |

Contradicting instructions: the same page says that if two instructions contradict each other, Claude may pick one arbitrarily, and that files over about 200 lines reduce adherence.

`CLAUDE.local.md` is usually gitignored, so it exists only in the worktree where it was created (documented, same page). Compare it per worktree.

**Auto memory** (documented, https://code.claude.com/docs/en/memory#auto-memory): `~/.claude/projects/<project>/memory/`, where `<project>` is derived from the git repository, so all worktrees and subdirectories of one repository share one memory directory. `autoMemoryDirectory` in settings can move it. The first 200 lines or 25KB of `MEMORY.md` load into every session; topic files are read on demand. Memory files are kept until edited or deleted.

**Transcripts** (documented, https://code.claude.com/docs/en/claude-directory):

- `~/.claude/projects/<project>/<session>.jsonl`: messages, tool calls and results, the system prompt, and the instruction files loaded.
- `~/.claude/projects/<project>/<session>/subagents/`: subagent transcripts in the same format.
- `~/.claude/projects/<project>/<session>/tool-results/`: large tool outputs stored separately.
- Deleted after `cleanupPeriodDays`, default 30 days. An older session's record may be gone; its entries then have provenance **Unknown**.
- Transcripts are plaintext and hold anything a tool read or printed, credentials included.

Observed, not documented: transcripts are filed under a folder named after the working directory the session started in, while auto memory sits under the repository's folder. Sessions started in different worktrees or subdirectories of one repository are therefore in different folders. `scripts/transcripts.py sessions` finds them by the working directory recorded inside each file, so the folder naming does not matter.

## Codex

`~/.codex` below means `$CODEX_HOME` when set.

**Instruction files** (documented, https://learn.chatgpt.com/docs/agent-configuration/agents-md):

| File | Read when |
|---|---|
| `~/.codex/AGENTS.override.md`, else `~/.codex/AGENTS.md` | Every session; the first non-empty one only |
| In each directory from the project root (usually the git root) down to the working directory: `AGENTS.override.md`, else `AGENTS.md`, else a name from `project_doc_fallback_filenames` | Every session started at or below that directory; at most one file per directory, concatenated root first |
| The same files in subdirectories below the working directory | Never |

Loading stops once the combined size reaches `project_doc_max_bytes` (default 32 KiB). A file past that limit is silently not loaded, so an audit checks the total size as well as the content. An `AGENTS.override.md` hides the `AGENTS.md` beside it, so an entry in the hidden file is never read.

**Transcripts** (observed on codex-cli 0.166.0, not documented): `~/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-<timestamp>-<id>.jsonl`, filed by date, not by project. The first record holds the working directory and git state of the session. Other stores in `~/.codex` (SQLite databases) are not covered here.

## Any other agent

Find its instruction-file and transcript locations in its own documentation, and record the URL in the report's scope section. If it keeps no transcripts, every entry that originated in a session has provenance **Unknown** unless a file or commit records it.

## Reading transcripts with `scripts/transcripts.py`

Python 3, standard library only. Run it with the path to the script inside this skill.

```
python3 <skill>/scripts/transcripts.py sessions <checkout> [<checkout> …]
```

Lists every Claude Code and Codex transcript whose recorded working directory is inside one of the given paths, oldest first: start time, agent (with `/subagent` for subagent transcripts), session ID, branch, working directory, file. Pass every worktree from `git worktree list`. Add `--store <dir>` to scan another transcript directory.

```
python3 <skill>/scripts/transcripts.py show <file> --grep '<regex>' --context 3
```

Prints the transcript as a timeline, one event per line: `USER`, `USER (mid-turn)` for a message typed while the agent was working, `USER (answer)` for an answer given through a question tool, `ASSISTANT`, `ASSISTANT (question)`, `COMPACTION` and `COMPACTION SUMMARY`. Options: `--width 0` prints events in full (default 600 characters); `--user` keeps only what the user typed or answered; `--tools` adds tool calls; `--injected` adds text the harness inserted (instruction files, hook output, notifications), which the user did not type.

A question tool is recognised by a name containing "question" or "user_input" (observed: `AskUserQuestion` in Claude Code, `request_user_input` and `request_user_input_async` in Codex). Answers are extracted for Claude Code only. In Codex the call returns before the user answers, and where the answer lands was not established, so read the records after each `ASSISTANT (question)` event. The stderr line `events: …` counts each kind; a warning appears when questions were asked and no answer was recognised.

Events are printed in the order they were delivered to the model. A mid-turn message carries the time it was typed, which can be earlier than the event before it.

The script warns on stderr when a file yields no recognisable records. Treat that as "format not understood", never as "nothing was said", and read the raw JSONL around a `grep -n` hit instead.

## What a transcript can and cannot tell you

- It shows what was said and what tools returned. It is the record for provenance: who first said something, what they said just before and after, and whether a "verified" claim has a matching command in the record.
- A compaction summary is the assistant's own summary of earlier turns. It is a claim about the record, not the record; when the earlier turns survive in the file, check the summary against them.
- Text marked as injected was put there by the harness, a hook or another agent. It is never a user statement.
- A user's reply applies to the message it answered. Read that message in full before grading the reply as confirmation of any item in it.
