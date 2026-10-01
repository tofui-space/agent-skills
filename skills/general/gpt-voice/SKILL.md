---
name: gpt-voice
description: "Split each chat reply into two jobs: Claude decides the content (facts, verdict, caveats, code), and an OpenAI model writes the prose through a non-interactive `codex exec` call in the background. Claude then shows that prose as its own reply inside Claude Code, so the user never leaves the IDE or opens Codex. Use this skill when the user turns it on ('gpt-voice on', 'use gpt voice', 'let GPT write it', '/gpt-voice'), when a single message asks for it ('via gpt', 'in GPT's words'), and on every later reply while it is on, until the user says 'gpt-voice off'. Do NOT use it for code-only replies, tool output, file edits, or replies of one or two sentences."
---

# GPT voice

**Split of work.**

- Claude does the work and decides **what** the reply says.
- An OpenAI model, called through `codex exec`, decides **how** the reply says it.
- Claude shows the OpenAI text as the reply, unchanged except for placeholder substitution.

**Why.** The reply keeps Claude's analysis but uses the OpenAI model's writing style.

## When to route a reply

Route a reply when both conditions hold:

1. The user turned the mode on, or asked for it in the current message.
2. The reply contains prose of three sentences or more.

Sensitive content does not block routing. Step 3 removes it from the spec before anything leaves the machine.

Otherwise, reply normally.

## Workflow — 6 steps

### 1. Do the work first

Read files, run tools, and reach the answer exactly as without this skill. The spec in step 2 describes finished content, not open questions.

### 2. Write the content spec

Write the spec to a temporary file outside the repository, for example with `mktemp`. A spec inside the repository risks landing in version control. Delete the spec and the reply file after step 6.

Use this template. Write every line as a full sentence in plain words: the OpenAI model has no access to this session. Replace coined labels, arrows, session references ("as above"), and skill names with their meaning.

```markdown
# User message
<The user's message, verbatim, then scrubbed in step 3.>

# Verdict
<The direct answer in one sentence. "Yes", "No", or the choice, first.>

# Points
- <One fact or reason per bullet, in reading order.>

# Caveats
- <Caveat> — attaches to: <the point it modifies>

# Literals
{{LIT_1}}: <one-line description, e.g. "bash command that installs the skill">

# Must not add
- <Anything the reply must not claim, suggest, or promise.>
```

Omit an empty section, except Verdict.

**Literals.** Code, commands, tables, paths with special meaning, and exact numbers stay in Claude's hands. Put a placeholder in the spec and keep the real content yourself. The OpenAI model positions each placeholder; it never sees or rewrites the literal.

### 3. Scrub the spec

The spec goes to OpenAI. Remove internal and personal information from it before step 4. Two methods:

- **Placeholder.** An exact value the reply must show → `{{PRIV_1}}`, `{{PRIV_2}}`, and so on. Keep the real value yourself and restore it in step 6. The OpenAI model never sees it.
- **Generalization.** A detail the reply only mentions in passing → a generic description. "The Acme billing repo" becomes "the billing repository". Generalize only where the reply stays correct.

What to scrub, 4 categories:

| Category | Examples (invented) | Method |
|---|---|---|
| Secrets | API keys, tokens, passwords, private keys, connection strings | Placeholder only. Never generalize a secret into a description of its value. |
| Personal data | Names of people, emails, phone numbers, home-folder paths, account IDs | Placeholder, or a role: "a colleague", "the reviewer" |
| Internal details | Employer and customer names, project codenames, internal hostnames, URLs, IP addresses, ticket IDs, repository names, internal file paths | Placeholder, or generalization |
| Identifying context | A combination of details that identifies a person or organization, even with no name | Generalization |

**Keep** public technical facts: library names, public standards, error messages from public tools, general concepts. Scrubbing those makes the reply wrong without protecting anything.

**Deterministic backstop.** The script checks the spec before sending: common secret formats, emails, URLs, IP addresses, home-folder paths, IBANs, and every term in the user's denylist file. On a match, the script sends nothing and lists the matches. Replace each match with a placeholder or a generalization, then run the script again. Never weaken the check to get a spec through.

**Denylist file.** `~/.config/gpt-voice/denylist.txt` holds one term per line: employer names, codenames, colleague names. The file lives outside the skill, so the skill folder holds no real details. If the file does not exist, tell the user once per session that only the built-in patterns run.

### 4. Run the script

```bash
scripts/gpt_voice.sh <spec.md>
```

The script prints the path of the OpenAI reply. See "What the script does" below.

### 5. Check fidelity

Check the OpenAI reply against the spec:

1. The verdict appears, and it matches the spec.
2. Every point and caveat appears. Each caveat sits next to its point.
3. No fact, example, or recommendation appears that is absent from the spec.
4. Every `LIT` and `PRIV` placeholder appears exactly once, spelled exactly.

**On failure:** run the script once more with `--fix "<what is missing or added>"`. If the second reply still fails, show it and add one line naming the gap. Never repair the prose yourself: rewriting it brings Claude's style back.

### 6. Show the reply

- Replace each `LIT` placeholder with its literal and each `PRIV` placeholder with its real value.
- Output the result as the whole reply.
- Add no preamble, no "GPT wrote", and no summary before or after.

**If `codex` fails** (not installed, not logged in, timeout): write the reply yourself and add one line: "GPT voice unavailable: <error>".

## What the script does

- Creates a temporary folder and runs Codex there. Repository instruction files such as `AGENTS.md` therefore do not affect the prose.
- Checks the spec against the built-in patterns and the denylist. On a match, exits with code 3 and sends nothing.
- Sends the writer instructions, `references/style.md`, and the spec through standard input.
- Runs `codex exec` with a read-only sandbox and captures only the final message.
- Deletes its temporary folder after the run. The reply file stays in the system temp folder until you delete it.

**Flag check.** The script uses `codex exec` flags confirmed in September 2026: `-s read-only`, `-C`, `--skip-git-repo-check`, `--output-last-message`, and `-` for standard input. If the script fails on a flag, run `codex exec --help` and update the script.

## Style control

`references/style.md` holds the style instructions for the OpenAI model. The user edits that file. Do not add Claude's own style rules to the spec.

## Example (invented)

User message: "Should the worker retry failed uploads or drop them?"

Spec:

```markdown
# User message
Should the worker retry failed uploads or drop them?

# Verdict
Retry failed uploads, with a limit of 5 attempts.

# Points
- Most upload failures in the logs are timeouts, and a second attempt usually succeeds.
- Dropping uploads loses user files without notice.
- Each retry waits longer than the one before: exponential backoff.

# Caveats
- A file that fails 5 times goes to a dead-letter queue for manual review. — attaches to: the limit of 5 attempts

# Literals
{{LIT_1}}: TypeScript retry configuration object

# Must not add
- Any claim about upload volume or costs.
```

The OpenAI model writes the prose around `{{LIT_1}}`. Claude inserts the configuration object and shows the result.
