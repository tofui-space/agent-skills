---
name: skill-final-review
description: "Final pre-ship review of a drafted skill across six fronts: conflict and logical risk against other installed skills, escape hatches and missing exceptions, noise that restates default behavior, leaked personal or case-specific detail, stale claims about models, tools or sibling skills, and token cost measured against the installed corpus. Offer it unprompted, once, as soon as a draft has been shown to the user and the conversation turns to packaging, installing, testing, or approval. Also invoke on 'final review', 'review this skill', 'proof the skill', 'is this skill ready', 'skill-final-review', or any request to check a skill before shipping. Do NOT use while a skill is still being scoped or drafted — that is skill-creator's job — and not for validating code changes or builds."
---

# Final Skill Review

The last pass before a drafted skill is packaged, installed, or called done. A fresh agent reviews the skill across six fronts, a second fresh agent tries to disprove each finding, and the user decides per finding: fix it, give it another pass, or drop it. After fixes, a check confirms that the fixes introduced no new conflicts.

## The failure this stops

The reviewer is almost always the author. Having written the draft, you know what each line was meant to do — so a hedge reads as prudence, a restatement reads as emphasis, and an example lifted from the conversation that produced the skill reads as helpful grounding. All three survive a reread, because intent supplies meaning the page does not carry. The reader who actually runs the skill is a fresh session with none of that context. They get only the page.

Three consequences shape the whole procedure:

- **Review from a fresh context.** The session that drafted the skill is the worst reviewer of it, so the review runs in an agent that has only the files.
- **Read the file from disk.** Reviewing the draft as remembered replays the intent instead of reading the text. Open it.
- **Report before editing.** Fixing on sight turns a finding the user might have overruled into a silent change.

The report has a second reader problem. The user who decides on the findings has often not read the skill closely: they may have written the request and delegated the drafting. A finding that only points at a line ("front 2 — 'where appropriate' — never binds") cannot be judged without reading the skill, which is the work the user delegated. So every finding carries the text it judges and explains the problem in full sentences.

And the review itself is unreliable. Most findings predict how a model will read a rule, and reading the rule cannot confirm the prediction. A reading-based review produces false positives, and a checklist that demands findings produces more of them. The report states this, rates each finding's confidence by the evidence behind it, and says where each finding came from, so the user can see which findings to trust and which to check.

**A finding needs a scenario.** Report a finding only when you can write the concrete situation in which a future session does the wrong thing, or the concrete cost it adds. A checklist requirement below ("check each rule for an anti-domain") tells you where to look; it is not a finding on its own. If you cannot write the scenario, drop it.

## When to run it

On request: any ask to review, proof, or sign off a skill before it ships.

Unprompted: offer once, in one line, when a draft has been shown to the user at least once and the next move is packaging, installing, testing, or "looks good". Earlier than that the draft is still moving and a review only relitigates decisions in flight. If the offer is declined, drop it.

## Options

Read both options from the user's request. When the user does not state one, use the default, and name both settings in the report header so the user can change them.

- **Verification** — default **on**. A second agent tries to disprove every finding before the user sees the report. The user turns it off with phrases such as "no verification" or "quick review". It costs extra time and tokens on every review.
- **Reader** — default **has not read the skill**. The report quotes enough text to judge each finding without opening the file, and it recommends a decision for each finding. The user switches to **knows the skill** with phrases such as "I know this skill" or "I wrote it myself"; quotes may then be shorter, and the report makes no recommendations.

## Procedure

When the environment offers subagents (agents that start from a fresh context), run the steps below as separate agents. When it does not, run them in this session, and say in the report header that the review and verification ran in this session rather than in fresh agents. When this session drafted or edited the skill, add that author bias was therefore not removed.

### Step 1 — Review

Start a fresh agent. Give it the path of this file and the path of the skill under review, and tell it to rely only on files, not on any conversation. It does the following:

1. Reads every file of the skill under review.
2. Reads the `name` and `description` of every other installed skill, because that pair is where conflict and overlap live.
3. Measures sizes:

   ```bash
   wc -w <path>/SKILL.md ~/.claude/skills/*/SKILL.md | sort -n
   # on claude.ai the installed corpus is /mnt/skills/user/*/SKILL.md
   ```

   It counts the description separately, because the description is priced differently (front 6).
4. Checks the six fronts below and writes each finding in the format under "Report format", without the Verification and Recommendation lines, and with the second half of Origin left blank.

### Step 2 — Verify (skip when verification is off)

Start a second fresh agent. Give it the findings, the path of the skill, and the skill's history: its rationale or reference files, and, when the skill is in a git repository, the output of `git log --follow -p -- <skill-dir>`. Its job is to disprove each finding, not to confirm it. For each finding it checks:

- **The quote.** Is it verbatim, and is it quoted in enough context? Does another line of the skill already resolve the problem?
- **The scenario.** Does it follow from a plain reading of the text, or only from an unlikely one?
- **The labels.** Are the kind, severity, and confidence justified by the evidence?
- **Common false positives:**
  - A checklist requirement reported with no real scenario.
  - A scenario that needs an unlikely reading when a plain reading exists.
  - A problem already resolved elsewhere in the skill.
  - A preference presented as a defect.
  - Severity inflated: a cost reported as blocking.
  - Confidence inflated: a prediction reported as high.
  - A deliberate rule misread as a mistake, when the page itself states the reason.

**History rule.** The history shows why a rule was written, which helps catch findings that misread a deliberate rule. It also brings back the author's intent, which is exactly what lets a flawed page look fine. So history refutes a finding only when the page itself carries the intent. When the intent is stated only in a commit message or a rationale file the skill never points to, the finding stands, and the fix is to put that intent into the skill.

For each finding, the agent returns a verdict with its reason: **confirmed**, **changed** (with the corrected labels), or **refuted**. A refutation quotes the line that resolves the problem; without it, the finding stands.

### Step 3 — Report

Write the report in this session, from the verified findings, in the format below. Before writing, fill in the second half of each Origin that is blank: "written in the drafting session" when this session wrote or edited the flagged text, otherwise "pre-existing text". Do the same for findings returned by another pass or the post-fix check. Refuted findings are not hidden: list them in one line each with the reason they were refuted, so the user can see how many false positives the first pass produced.

## The six fronts

### 1. Conflict and logical risk — blocking

Catches: two rules that cannot both be satisfied; a rule that contradicts another installed skill; a rule that contradicts a standing user preference; a term used as though defined that never is; a rule whose firing condition cannot occur while the skill is active.

Test: for each rule, name the situation it fires in and the action it forces. Two rules firing on one situation with different actions is a conflict. Resolve it with a precedence line in the file, not by trusting the reader to choose well.

Check whether a behavior-constraining skill says what wins against an explicit user instruction and against other skills. A missing line is a finding when you can name the instruction or installed skill it would collide with and what a session would then do.

Not a finding: rules that overlap and agree; a rule that is merely strict.

### 2. Escape hatches and missing exceptions — blocking

Two directions, opposite failures.

**Hatch.** An exception whose condition cannot be evaluated before acting: "where appropriate", "use judgment", "if it makes sense", "generally", "try to", "consider". A rule with an undecidable exception is a suggestion, and it gets skipped precisely when following it would have cost something — which is when it mattered. Test: can the reader tell, before acting, whether the exception applies? Decidable exceptions stay ("skip for creative writing", "skip when the user asked to be taught"). Undecidable ones get deleted or given a named condition.

**Missing exception.** A rule with no stated boundary fires where it does damage. Check each behavior-changing rule for an anti-domain; the absence is a finding when you can name a situation where the rule fires and the result is wrong.

Not a finding: a hedge whose criteria the file supplies elsewhere. Judgment with stated inputs is a method; judgment standing alone is a hatch.

### 3. Noise — non-blocking

Three kinds: restates default model behavior; restates another line in the same file; unreachable in practice.

Test: delete the line and name the output that changes. If nothing changes, it was noise.

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

Write the report for the reader set by the Reader option. Every sentence is a full sentence; no line is a chain of fragments joined by dashes.

**Header**, in this order:

1. The skill name and a verdict. **Fix first** if any blocking finding has high or tested confidence. **Check first** if the blocking findings are all medium or low confidence. **Ship** if nothing is blocking.
2. The counts: how many findings, how many are blocking if real, how many are tested, high, medium, or low confidence, and how many were refuted by verification.
3. The settings: verification ran, or was skipped and why; the reader setting; and whether the steps ran in separate agents or in this session.
4. This sentence, verbatim: "These findings come from reading the skill, not from running it, except where marked tested. Reading-based reviews produce false positives; the low-confidence findings are the most likely ones."
5. Size, in words: the body, the description, and the corpus median and maximum.

**Each finding** gets an ID: **B** for blocking if real, **N** for non-blocking, numbered in report order (B1, B2, N1). IDs stay fixed for the rest of the session; findings found later continue the numbering. IDs are assigned when the user first sees the report, from the verified labels. After that, an ID never changes, even when a later pass changes the finding's severity; the report then says 'now non-blocking' or 'now blocking' next to the ID. Order the findings by severity, then confidence:

```
### B1. <the problem, in one plain sentence>

What the skill says now (<file>:<line>):
> <verbatim excerpt: enough lines that the reader understands the rule without opening the file;
>  for a conflict, quote both sides; for something missing, quote the rule that lacks it>

What goes wrong: <the scenario, in full sentences: the situation, what a future session does, and why>

Proposed fix: <the replacement or added text, quoted>

- Kind: contradiction in the text | predicted misreading | missing boundary | leak | stale claim | cost
- Severity if real: blocking | non-blocking, because <one sentence>
- Confidence: tested | high | medium | low, because <what the evidence is>
- Origin: <the check that found it> · <pre-existing text | written in the drafting session>
- Verification: confirmed | changed from <old label>, because <reason> | not run
- Recommendation: fix | another pass | drop, because <reason>   (only when the reader has not read the skill)
```

**Confidence** follows from the evidence, not from how sure the finding feels:

- **Tested:** a session was run and showed the failure.
- **High:** the problem is visible in the quoted text alone: two quoted lines contradict, a leaked name is in the quote, or a referenced file was checked and does not exist.
- **Medium:** the scenario follows from the wording, but no session was run to see it happen.
- **Low:** the scenario depends on an assumption about the reader or the model that the reviewer cannot check.

**Origin** names the front and test that found the finding. It also says whether the session that runs this review wrote or edited the flagged text. Only that session knows this, so a review, verification, another-pass or post-fix agent keeps the value it was given and otherwise leaves it blank for that session to fill. When that session wrote the text, say so: that is the case where author bias is strongest, in both directions.

**Recommendation** follows from the labels, so the user can predict it: **fix** for tested or high confidence; **another pass** for a blocking finding with medium or low confidence; **drop** for a non-blocking finding with low confidence. For a non-blocking finding with medium confidence, recommend **fix** when the fix is one line and **another pass** otherwise. A finding that has already had another pass is not recommended for another pass again: recommend **fix** when it is tested, and otherwise recommend **fix** or **drop**, and name the evidence that would change the recommendation. The recommendation is the reviewer's, not a decision.

**After the findings:**

1. One line per refuted finding, with its ID and the reason it was refuted.
2. One line listing the fronts checked with no findings, so the reader can see they were checked and not skipped.
3. The decision request, verbatim:

   ```
   Reply with the IDs to act on:
   Fix: <IDs>
   Another pass: <IDs>
   Findings you do not list are dropped.
   ```

**Before sending, check every finding:**

- The quote is verbatim and long enough to understand without opening the file. When the reader setting is knows the skill, the quote only needs to be long enough to locate the rule.
- The scenario names the situation, what a session does, and why, in full sentences with their "because" or "so".
- The fix is quoted text, not a description of a fix.
- Each label has its value and its "because".

If a finding fails, restore what is missing. A finding shortened below this checklist, by any rule other than the reader setting, reads as complete while it is not, so the user cannot tell that a reason was dropped.

Worked example (for an invented meeting-notes skill, reader has not read the skill):

```
### B1. Two rules disagree about the closing summary

What the skill says now (SKILL.md:14 and SKILL.md:31):
> Line 14: "Always end the notes with a summary of the decisions."
> Line 31: "Never repeat content that already appears in the notes."

What goes wrong: A summary of the decisions repeats decisions already in the notes, so every set of notes breaks one of the two rules. A session that follows line 31 drops the summary, which is the part a reader who missed the meeting needs most.

Proposed fix: add to line 31: "The closing summary of decisions is exempt."

- Kind: contradiction in the text
- Severity if real: blocking, because one rule is broken in every set of notes
- Confidence: high, because both lines are quoted above and the conflict is visible without running anything
- Origin: conflict check (front 1) · pre-existing text
- Verification: confirmed, because no other line of the skill exempts the summary
- Recommendation: fix, because the contradiction is visible in the text

### B2. The length limit may push out decisions

What the skill says now (SKILL.md:9):
> "Keep the notes under one page."

What goes wrong: For a two-hour meeting with many decisions, a session may cut decisions to fit one page, because the rule gives no priority between length and completeness.

Proposed fix: "Keep the notes under one page; if the decisions do not fit, keep every decision and cut the discussion."

- Kind: missing boundary
- Severity if real: blocking, because a dropped decision makes the notes wrong
- Confidence: medium, because the scenario follows from the wording, but no session was run on a long meeting
- Origin: missing-exception check (front 2) · written in the drafting session
- Verification: confirmed, because no other line sets a priority between length and decisions
- Recommendation: another pass, because a test run on a long meeting would show whether decisions are actually dropped

Refuted: N1 (flagged "Use the attendees' names" as a leak; the skill's line 3 states that names come from the meeting invite, so no real name is in the skill).
Checked with no findings: noise, leakage (its only finding was refuted), staleness, token cost.

Reply with the IDs to act on:
Fix: <IDs>
Another pass: <IDs>
Findings you do not list are dropped.
```

## After the report

The user replies with a **Fix** list and an **Another pass** list. Findings in neither list are dropped and not raised again in this session.

When the user questions a finding, answer from the quoted text and the scenario; do not ask them to read the skill.

### Fix

Apply the listed fixes, re-measure both word counts, and state the new numbers. Then run the post-fix check below. Fixes are not done until it passes.

### Another pass

Start a fresh agent with the listed findings, the skill's files, and the skill's history, and tell it to go deeper than the first review could. For each finding it:

1. Rereads the whole skill, not only the quoted lines, to check whether another rule resolves the problem.
2. Checks the history, under the history rule in Step 2.
3. Compares the finding with the common false positives listed in Step 2.
4. **Runs a test when the finding predicts a misreading.** It writes, before running anything, a prompt built to trigger the scenario and the observable result that counts as failure. It then runs two fresh sessions that get only the skill file, treat it as loaded, load no other skill except the installed skills the finding's scenario names, which are loaded too, and answer that prompt. It judges each reply against the failure criterion it wrote beforehand. If the failure appears, the confidence becomes **tested**. If it appears in neither run, the confidence becomes **low**, with "not reproduced in two runs"; that is weak evidence against the finding, not proof, because model output varies and the test session may run on a different model than the one the skill will run on.

Without subagents, step 4 cannot run, because a test session must start without this conversation. Say so in the pass report; the confidence of a predicted misreading then cannot become tested.

Report each finding again in the full format, with the verdict **confirmed**, **changed**, or **refuted**, then end with the same decision request.

### Post-fix check

After any fix, start a fresh agent with the diff of the applied fixes and the whole skill. Without subagents, run the check in this session and say in its first line that the session that applied the fixes also checked them, so author bias was not removed. It runs front 1 (conflict) and front 2 (escape hatches and missing exceptions) on every changed line against every other line of the skill, and it checks that each fix actually removes the scenario of the finding it fixed. A fix often adds a rule that collides with an older line elsewhere in the file, and the review that proposed the fix did not look for that.

Report new findings in the full format, with IDs continuing the session's numbering, then end with the decision request. When there are none, say so in one line that also names how many changed lines were checked. Repeat after each round of fixes until the check finds nothing or the user stops.

No second full review of the edited skill: it returns wording churn rather than findings. Another pass and the post-fix check cover what changed.

If the description changed and skill-creator's description optimizer is available, this is the point to run it.

## Precedence

Findings are advisory. The user decides on each one, including blocking ones: fix, another pass, or drop. A dropped finding is not raised again in the same session, unless the post-fix check finds that a later fix reintroduced the same problem.

Against other skills, output styles, and standing instructions to be brief: the report is exempt from every length cap, compression rule, and clause-deletion test that does not come from the user in this conversation. This covers other installed skills, the active output style, and system-prompt instructions about brevity. Those rules exist to shorten routine replies; a finding is the one place where the reader cannot recover a dropped reason, because they have not read the skill. Other writing rules may still make a finding clearer, for example by naming a source or moving the key word earlier, but only when every part in the checklist under "Report format" survives intact. The prose around the report follows whatever writing rules are active.

An explicit request from the user in this conversation ("shorter review", a reading-time budget) does apply. Meet it by dropping whole findings, lowest severity and confidence first, and name the dropped ones in one line. Never meet it by shortening the findings that remain. "Quick review" only turns off verification (see Options); it is not a request to drop findings.
