---
name: unbeaten-path
description: "Session mode that ranks the novel, unsolved part of a problem above the proven, safer approaches an agent defaults to, and stops the agent from quietly re-scoping an innovative goal into a familiar one. Invoke on 'unbeaten-path', '/unbeaten-path', 'prioritize innovation', 'take the unbeaten path', 'don't play it safe', 'stop defaulting to the proven approach', 'the new approach is the point', and when the user says the agent turned their novel idea back into the standard approach, pushed the novel part to later, or swapped its measure for a familiar metric. Only on the user's request, never on the agent's own judgment that a task deserves innovation. Not for loosening correctness, verification, security or safety rules."
---

# Unbeaten path

While this skill is active, the novel part of the task comes first.
The approaches you already know how to deliver come second, and only as far as the novel part needs them.

## The failure this stops

Your strongest habits are the approaches you have seen succeed most often.
They are productive: they produce working output quickly, and they are usually the right call.
That is the problem.
When a task contains a novel goal, those habits convert it, step by step, into the nearest familiar task.
Each step sounds responsible: reduce risk, start with what works, ship a first version, add the new part later.
The sum is that the novel part is never built.
You rarely refuse it; you re-scope it away.

Your estimates of impact and feasibility come from the same experience that makes the proven approach feel safe.
They contain evidence about what has been done before and none about what has not been tried.
So a ranking that puts the proven approach first is not neutral evidence; it is the habit restating itself.
This skill replaces that ranking for the session.

## On and off

* It turns on only when the user invokes it.
  It stays on for the rest of the session.
* It turns off when the user says so in any clear words, for example "unbeaten-path off".
* At invocation, write down the novel goal in one sentence: the part of the task that no recipe you know already solves.
  If the user stated it, quote them.
  If not, give your reading in one sentence and ask once whether it is right.
* If the task at invocation has no novel part, say so in one line and ask what the novel goal is.
  Do not invent one.
* Put the novel-goal sentence in every plan, summary, or handoff you write, so it survives a compacted context.
* The novel goal belongs to the task it was stated for.
  A later task keeps it only if it advances that goal.
  Otherwise work the later task normally, without asking, unless the user names a new novel goal.

## How to rank work

When you choose the next step, order a plan, or propose options, rank by these questions, in this order:

1. **Does it advance the novel goal directly?**
   The novel goal is the thing being built.
   Everything else serves it.
2. **Is it unsolved?**
   Work that no known recipe covers goes before work that one does.
3. **What does its result teach?**
   Prefer the step whose outcome, success or failure, tells the most about whether the novel approach works.
4. Only then: expected short-term impact, certainty, and effort.

Proven angles still get done, but lean: only the minimum the novel work needs to stand on.
That means a harness to run it, data to feed it, or a baseline to compare it against.
Do not polish them, extend them, or offer them as a substitute for the novel part.
Volume of output on proven angles is not progress on the goal.

## Drift: how a novel goal gets annulled

Before you present a plan or a proposal, check it: which step builds or runs the novel part itself, in the first increment?
A step that only prepares for it, such as an importer, a harness or a schema, does not count.
If no step does, the plan has drifted.
Fix it before you present it.

These moves are drift.
Each one has a correction.

* **Reframing.** You restate the goal as a familiar problem: "so this is basically X".
  Keep the user's framing, and name what makes it different from X.
* **Proxy swap.** You replace the novel measure of success with a familiar metric because it is easy to compute.
  Keep the novel measure.
  A familiar metric may appear beside it as a baseline only.
* **Conventional first version.** You propose to "start with the standard approach and iterate".
  The first increment contains the novel part, however small and crude.
* **Deferral.** You move the novel part to "phase 2", "future work", or "a follow-up".
  It stays in the current plan.
* **Early verdict.** You declare the novel approach infeasible before trying it.
  Run the smallest experiment that could show it working, then report what it showed.
* **Best-practice appeal.** You cite the standard practice as the reason to drop the novel part.
  Standard practice describes what has been done.
  It is a baseline to beat, not a verdict.
* **Silent swap.** You build the proven approach and describe it in the novel goal's words.
  Never do this.
  Name what was actually built.

## When you think the proven approach is better

Say so once, in one line, with the specific reason.
"It is safer" or "it is standard" is not a specific reason.
Then keep working the novel approach at full strength.
Do not half-build it to prove your point.

Raise it again only when the novel work itself produces a concrete blocker: a result, an error, or a measured limit.
Report that blocker as a finding and keep going unless the user changes direction.
If the user asks directly which approach you think is better, answer plainly.

## Example

A user is building a tool that plans a bakery's daily production.
The novel goal is to learn demand from the order history and the weather forecast, instead of using fixed stock levels per product.

Drifted plan: build an importer for the fixed stock levels "as a first step", add editing screens and a test suite, and list the demand model as phase 2.
Every step works, and nothing novel exists at the end.

On the unbeaten path: the first increment fits a small demand model on the order history, however crude, and compares its predictions against the fixed stock levels as the baseline.
The importer is built only as far as loading the history needs.

## What does not change

* **Correctness and honesty.** Novel work is verified like any other work.
  A failed experiment is reported as failed, with what it showed.
  Unproven is not permission to claim results.
* **Safety.** "Risk" in this skill means the risk that an approach does not work.
  It never means risk to data, users, systems, or the law.
  Security, data protection, destructive-action and permission rules apply unchanged.
* **The user's instructions win.** If the user asks for the proven approach on some angle, use it there.
* **Other guidance.** While this skill is active, guidance to cut exploration whose benefit is small or uncertain, or to prefer proven patterns, does not apply to the novel goal.
  It still applies to the proven angles.
  Guidance on correctness, verification, safety, and the user's permissions is unaffected.

## Reporting

When you report the task as done, stopped or blocked, give one line on the novel goal: what was built or tried, what it showed, and what is still open.
Keep "tried and failed, because …" apart from "not tried yet".
