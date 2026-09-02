---
name: skill-final-review
description: "Final pre-ship review of a drafted skill across six fronts: conflict and logical risk against other installed skills, escape hatches and missing exceptions, noise that restates default behavior, leaked personal or case-specific detail, stale claims about models, tools or sibling skills, and token cost measured against the installed corpus. Offer it unprompted, once, as soon as a draft has been shown to the user and the conversation turns to packaging, installing, testing, or approval. Also invoke on 'final review', 'review this skill', 'proof the skill', 'is this skill ready', 'skill-final-review', or any request to check a skill before shipping. Do NOT use while a skill is still being scoped or drafted — that is skill-creator's job — and not for validating code changes or builds."
---

# Final Skill Review

The last pass before a drafted skill is packaged, installed, or called done. Six fronts, one report, edits only after the user picks which findings to act on.

## The failure this stops

The reviewer is almost always the author. Having written the draft, you know what each line was meant to do — so a hedge reads as prudence, a restatement reads as emphasis, and an example lifted from the conversation that produced the skill reads as helpful grounding. All three survive a reread, because intent supplies meaning the page does not carry. The reader who actually runs the skill is a fresh session with none of that context. They get only the page.

Two consequences shape the whole procedure:

- **Read the file from disk.** Reviewing the draft as remembered replays the intent instead of reading the text. Open it.
- **Report before editing.** Fixing on sight turns a finding the user might have overruled into a silent change.

## When to run it

On request: any ask to review, proof, or sign off a skill before it ships.

Unprompted: offer once, in one line, when a draft has been shown to the user at least once and the next move is packaging, installing, testing, or "looks good". Earlier than that the draft is still moving and a review only relitigates decisions in flight. If the offer is declined, drop it.

## Setup

Read the draft file. Read the `name` and `description` of every other installed skill — that pair is where conflict and overlap live. Then measure:

```bash
wc -w <path>/SKILL.md ~/.claude/skills/*/SKILL.md | sort -n
# on claude.ai the installed corpus is /mnt/skills/user/*/SKILL.md
```

Count the description separately; it is priced differently (front 6).

## The six fronts

### 1. Conflict and logical risk — blocking

Catches: two rules that cannot both be satisfied; a rule that contradicts another installed skill; a rule that contradicts a standing user preference; a term used as though defined that never is; a rule whose firing condition cannot occur while the skill is active.

Test: for each rule, name the situation it fires in and the action it forces. Two rules firing on one situation with different actions is a conflict. Resolve it with a precedence line in the file, not by trusting the reader to choose well.

Every behavior-constraining skill also needs one sentence on what wins against an explicit user instruction and against other skills. Absence of that line is a finding.

Not a finding: rules that overlap and agree; a rule that is merely strict.

### 2. Escape hatches and missing exceptions — blocking

Two directions, opposite failures.

**Hatch.** An exception whose condition cannot be evaluated before acting: "where appropriate", "use judgment", "if it makes sense", "generally", "try to", "consider". A rule with an undecidable exception is a suggestion, and it gets skipped precisely when following it would have cost something — which is when it mattered. Test: can the reader tell, before acting, whether the exception applies? Decidable exceptions stay ("skip for creative writing", "skip when the user asked to be taught"). Undecidable ones get deleted or given a named condition.

**Missing exception.** A rule with no stated boundary fires where it does damage. Every behavior-changing rule needs an anti-domain.

Not a finding: a hedge whose criteria the file supplies elsewhere. Judgment with stated inputs is a method; judgment standing alone is a hatch.

### 3. Noise — non-blocking

Three kinds: restates default model behavior; restates another line in the same file; unreachable in practice.

Test: delete the line and name the output that changes. If nothing changes, it was noise. If `anti-vacuity` is installed, its clause test is the instrument here — apply it, do not restate it.

Not a finding: a rule that states a default *because the default fails under pressure*, with the reason attached. The stated "why" is what stops a future session from reasoning the rule away, and it earns its words.

### 4. Leakage and overfit — blocking for anything personal or secret

Catches: person names, contact details, employer or client names, repo, branch and ticket identifiers, absolute paths containing a username, internal URLs, incident dates, anything under NDA. Credentials are the worst case — an API key, token or connection string left in an example ships with the package the moment the skill is installed anywhere. Internal process leaks without naming anything: an approval chain, a release ritual, or a team's escalation path written as though it were universal. The common vector for all of it is a fact pulled from memory or from the drafting conversation and pasted in as an example.

Test for the rest: does this detail define the skill's domain, or does it only record where the rule was discovered? Domain detail stays — a synthesizer skill names the synthesizer, a jurisdiction skill names the jurisdiction. Discovery detail goes; replace it with the smallest synthetic example that exercises the same rule. Keep the shape, drop the identity.

Not a finding: version numbers, standards citations, tool names, technical specificity.

### 5. Staleness — non-blocking, blocking when the claim is already false

Catches instructions written against a model, tool, or environment that has since moved: model names and routing assumptions, API strings, environment variables, capability claims ("the model cannot do X"), paths to bundled files, references to a sibling skill or script by name, version pins, and workarounds for bugs that were fixed.

Two halves, with different evidence standards.

**Claims about the world** — a named model, a tool, a file path, another installed skill — are checkable right now. A reference to something that no longer exists under that name is a finding, and it blocks when a future session would act on it rather than notice it.

**Behavioral guardrails** — rules that exist because a model does something unhelpful — are not checkable from the inside. You cannot confirm a behavior is gone by not observing it in yourself, and the rule may be the reason it is absent. "Current models don't do that anymore" is the same unreliable self-report the guardrail was written to catch. Raise these as a question: name the rule, name the behavior it targets, state that the evidence is unavailable, and leave removal to the user. The cheap test is running the skill without the rule, not introspection.

Scope compounds this. A skill may run on a model other than the one reviewing it, so a guardrail that is dead weight for one can be load-bearing for a smaller or older one.

The fix is rarely deletion. A version-pinned claim earns a check that confirms the assumption and stops if it fails, so the skill breaks loudly instead of mis-routing in silence.

Not a finding: a rule that names a model, tool or version and verifies it before acting on it.

### 6. Token cost — non-blocking

Two budgets at different prices. The description loads into every conversation whether or not the skill triggers; the body loads only when it does. So the description takes the harshest cut: trigger phrases, contexts, anti-triggers, nothing else. Explanation belongs in the body.

For the body, compare rather than guess. Name the three installed skills nearest in size and ask whether this skill's scope is comparable to theirs. A single-rule skill sitting above the corpus median is over-written. A multi-domain reference skill sitting at the top is fine. Past the corpus maximum, either cut or split the depth into `references/` with a pointer from SKILL.md.

Overlap is the other cost: if an installed skill already carries a rule, reference it by name instead of copying it. Duplicated rules are paid for twice and drift apart the first time one copy is edited.

## Report format

```
FINAL REVIEW — <skill-name>
Verdict: ship | fix first — <n> blocking, <m> non-blocking
Size: body <N>w · description <M>w · corpus median <X>w, max <Y>w

BLOCKING
<front> — "<verbatim span>" — <what goes wrong in a future session> — <proposed fix>

NON-BLOCKING
<front> — "<verbatim span>" — <what it costs> — <proposed fix>

CLEAN: <fronts with no findings>
```

Blocking means the skill will behave wrongly for a future reader, or that it leaks private data. Non-blocking means cost, redundancy, or tidiness. Naming the clean fronts matters: it makes the review auditable, and a front that is genuinely clean should be visible as checked rather than skipped.

Worked lines:

```
BLOCKING
escape hatch — "apply this where it seems appropriate" — never binds; skipped exactly when it costs something — name the condition: "apply to every PR touching auth"
leakage — "e.g. J. Doe's PR #412 in acme-billing-api" — names a person and an internal repo — "e.g. a self-merged PR carrying an AI-written review"
```

## After the report

The user picks what to apply. Apply those, re-measure both word counts, and state the new numbers.

One pass. A second full review of the edited draft returns wording churn rather than findings. Re-run a single front only when an applied fix added a new rule or rewrote more than a paragraph, and re-run only that front.

If the description changed and skill-creator's description optimizer is available, this is the point to run it.

## Precedence

Findings are advisory. The user decides which to apply, including blocking ones, and a declined finding is dropped rather than raised again in the same session.

Against other skills: this file governs the content of the review, not the shape of the rest of the response. The findings block is a mandated output format and stays as specified; the surrounding prose follows whatever formatting skills are active.
