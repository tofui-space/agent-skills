---
name: reel-back
description: "Return the conversation to where it stood before a sidetrack the user wants to abandon: a dead end, a detour that takes too long, or a topic they lost interest in, even when every turn in it worked. Invoke on 'reel us back in', 'reel it back', '/reel-back', and equivalents such as 'get us back on track', 'back to the main task', 'we got sidetracked', 'drop this and go back', 'forget this, where were we', 'enough, back to <topic>'. Announces the return point and stops, or asks how far back when several fit. Only on the user's request, never on the agent's own sense of drift. Not for undoing file changes, restoring a checkpoint, or a complaint that does not ask to go back."
---

# Reel Back

The user has decided the current direction is not worth continuing and wants the conversation back where it was before it branched. Find that place, say in four short sentences where the work stands there, and stop.

The sidetrack may have gone well; every turn in it may have worked. Reeling back is a change of direction the user makes, not a verdict on the sidetrack and not a correction of you. It gets no apology, no defense of the sidetrack, and no account of how the conversation got there.

## Terms

- **Task**: something the conversation set out to do or decide. The first one is the root. A task can contain sub-tasks.
- **Sidetrack**: a stretch of conversation that left a task without being that task's next step. Sidetracks nest: one can branch from another.
- **Branch point**: the turn where a sidetrack left its task.
- **Return point**: the task as it stood just before the branch point: what had last been done or settled on it, and what was about to happen next.

## Find the return point

1. **The user named a target** ("reel us back to the print layout"): the return point is that task. If the name fits more than one task, ask (see "Several return points").
2. **No target named**: walk back from the current turn and list each task the current stretch branched from, nearest first, up to the root. Each one is a candidate return point.
3. **Drop finished tasks.** A task completed before the sidetrack began has no next step to return to. A topic the user started after finishing the previous task is a new task, not a sidetrack of the old one.
4. **Count the candidates.** One: announce. Two or more: ask. None: see "No sidetrack found".

Signs of a branch point:

- a phrase that opens a side topic: "by the way", "quick question", "while we're at it", "out of curiosity", "before we continue";
- a question or piece of work whose answer would not change the task's next step;
- a step that kept going after it had given the task what it needed;
- comparing ways to do something after one way had been chosen.

When the drift was gradual and has no single turn, the branch point is the last turn where the task itself made progress. If two turns are equally likely and would give different accounts of what had been done, treat them as two candidates.

Take what had been done and what was next from the conversation: the last result on the task, and the next step that you or the user stated before the branch point. If no next step was stated, propose the most direct one and say that it is a proposal. If earlier turns were summarized and the summary does not show where the task stood, say what the summary shows and ask; do not fill the gap with what usually comes next.

## One return point: announce and stop

Reply with four sentences, one per line:

```
Back to our <task>: <the task>.
<What we had done on it.>
<What we were about to do.>
We're dropping <the sidetrack, in a few words>.
```

- **First line.** Use the word that names what you are returning to: task, topic, problem, fix, question. Name it in the words used when it was set, so the user recognizes it without scrolling up.
- **Second and third lines.** Plain sentences, subject first, then the verb: "We grouped the ingredients by aisle." "We were about to lay out the print page." Do not repeat the first line's label-and-noun pattern, and do not pack several facts into one clause. A sentence that starts with its actor and its action shows at once which way the work was going.
- **Last line.** Name the sidetrack in a few words and nothing more.

Example. The conversation was adding a printable shopping list to a recipe app when a question about PDF output turned into a comparison of PDF libraries:

```
Back to our task: the printable shopping list for the recipe app.
We grouped the ingredients by aisle and tested the grouping.
We were about to lay out the print page.
We're dropping the PDF library comparison.
```

### Leftovers

Do not list what the sidetrack left behind: files, dependencies, running processes, checklist items. The user asked to leave the sidetrack, and an inventory of it pulls their attention back there just when they are deciding where to go.

Do not change any of it either. Do not revert, delete, stop a process, or edit the checklist unless the user asks. When the work resumes, the next step starts from the state the sidetrack left: read a file again before editing it, instead of assuming it is as it was at the branch point.

### Stop

End the reply after the last line. Do not start the next step, run tools for it, or ask whether to continue: the third line already says what comes, and the user's next message decides when. If the message that asked to reel back also said what to do next, give the four lines, then do what it asked.

## Several return points: ask

Ask one question: how far back. Each option is one candidate, nearest first, labeled with the task's name and described by the same two sentences: what we had done, and what we were about to do. The user can then choose without scrolling up. Always allow an answer in the user's own words.

- With a question tool (in Claude Code, `AskUserQuestion`), use it; it adds a free-text choice itself. It takes at most four options; with more candidates, offer the three nearest and the root.
- Without one, ask in plain text and end the reply there.

Example. The conversation went from the printable shopping list, to where aisle numbers should come from, to scraping a store's website for them, when the user said "reel us back in":

```
How far back?
1. Where aisle numbers come from. We listed two sources: a hand-kept list and the store's published data. We were about to choose one.
2. The printable shopping list. We grouped the ingredients by aisle and tested the grouping. We were about to lay out the print page.
Or tell me where, in your own words.
```

After the answer, give the four lines for the chosen point and stop. If the answer still fits more than one point, ask again with only those.

## No sidetrack found

If no branch point can be found, do not invent one. Say in one line which task the conversation is on and its next step, then ask how far back, offering the earlier topics of the conversation and "stay on <the current task>" as options. If there are no earlier topics, say that the conversation has stayed on this task, and stop.

## Afterwards

The dropped sidetrack stays dropped. Do not return to it or reuse its conclusions unless the user raises it again. What it left in place stays as it is until the user asks about it.

## When this does not apply

- The user asks to undo file changes or restore an earlier version of a file or a checkpoint. That changes files; this skill only moves the conversation.
- The user complains about the current approach without asking to leave it ("this is slow"). Answer the complaint.
- The conversation drifted in your own judgment, but the user has not asked to go back. Reeling back is the user's call.

## Precedence

An explicit instruction from the user wins over this skill for what it covers: asked to list or undo what the sidetrack left, do it. Against skills that shape replies, the four lines and the "how far back" question keep the shape set here.
