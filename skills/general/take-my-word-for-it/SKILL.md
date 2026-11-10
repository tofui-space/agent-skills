---
name: take-my-word-for-it
description: "Debugging mode that treats the reported symptom as fact, bans reproduction as a search method, and reads every file on the causal path in full until the defect is named with file, line, and mechanism. Invoke immediately when the user says 'take my word for it', 'trust me', 'I'm telling you it's broken', 'stop questioning me', 'I already told you', or 'it IS happening'. Also invoke when the previous response asked the user to re-verify, re-run, re-paste or reconfirm something already stated, or failed to reproduce the issue — unless the user supplied a reproduction command or asked for one. Applies to bugs, misconfigurations, build failures, wrong output, silent and intermittent failures. Do not use for feature work, code review, or architecture questions."
---

# Take My Word For It

## The failure

A user reports a symptom and the session sinks into one of two holes:

- **Interrogation.** Asking for the error again, asking whether the file was saved, proposing the behaviour is expected, offering a speculative one-liner and asking whether it helped.
- **Reproduction theatre.** Spending the budget on a repro, failing to trigger the symptom, and closing with "works for me". Zero lines read end to end, zero lines changed.

Both happen because reading whole files is expensive and shows nothing until it shows the answer, while questions and commands are cheap and look like progress. A failed repro is not evidence: the environment differs from the user's in ways that cannot be enumerated. A grep hit is not a read: it shows the line that looks correct without the call site or config that breaks it.

On trigger, the symptom becomes an axiom and the only question left is which line produces it.

## Activation

Once triggered, the mode stays on for the rest of the debugging thread. Do not re-decide each turn, and do not exit because a plausible explanation appeared.

## Rules

### 1. The symptom is true

The user observed it. Do not verify it, ask for it again, restate it as a question, or propose that it is expected behaviour. Banned: "did you save / rebuild / clear the cache?", "this code looks correct" as a terminal statement, and any question the user already answered in this thread.

### 2. Do not try to reproduce it

Execution means running the system under test or its suite. Read-only inspection of the working tree, history, artifacts and installed versions is reading, and is allowed. Do not install dependencies, write a harness, spin up the app, or run the suite in order to find the bug. Execution is permitted only after the defect is located, to confirm the fix.

A failed reproduction is discarded, not reported. Banned as conclusions: "works for me", "can't reproduce", "try again", and "may be environment-specific" offered before the files have been read.

### 3. Read whole files, then the whole set

List every source or config file on the causal path from input to symptom: entry point, handler, what it calls, what configures it, what builds it. The defect is usually not in the file that looks guilty.

Read each in full. Not a grep hit, not a symbol lookup, not the first 40 lines. If the set exceeds five files, rank by causal proximity, read the top five in full, and name the rest in the output.

Do not stop at the first suspicious line. A defect found in file two is a hypothesis until file four is read, which may hold the override that makes it harmless or a second defect the first fix would mask.

### 4. Explain the mechanism, not the smell

A finding explains the exact reported symptom. "This looks fragile" is not a finding. "Line 41 passes `opts` before line 12 assigns it, so the timeout is `undefined` and the request hangs instead of erroring at 5s" is. If the mechanism does not account for the reported behaviour, keep reading.

### 5. One diagnosis, one fix

Deliver a diagnosis and the change that fixes it. Not a ranked list of possibilities, and not "try this and tell me if it helps", which makes the user the execution engine for a random walk.

If every file was read and the code is correct, name the external cause with the evidence seen in the code: a stale artifact, an env var read at a named line that is unset, a lockfile version that lacks the API being called. This is a conclusion reached after reading, never a deflection offered instead of it.

### 6. The turn ends with a diff or a next-file list

Two legal endings. A concrete change, or `Read in full: <files>. No defect found. Next: <files, and why>.` Status reports, summaries of what was examined, and requests for the user to run something are not endings. If neither is present, the turn is not finished: read the next file.

## Output format

```
Read in full: <file1>, <file2>, <file3>
[Not read: <file6>, <file7> — ranked below the cut]

**<file>:<line> — <one-line statement of the defect>**

Mechanism: how this produces exactly the reported symptom.

Fix:
<the change, as a diff or exact replacement>
```

No preamble and no restatement of the report.

## Intermittent symptoms

Intermittency is a pointer, not an obstacle. Running the operation twenty times and seeing twenty successes proves nothing. Read the handler, the retry wrapper, the client and the storage adapter in full, looking for what varies between attempts: unawaited promises, shared mutable state, a pool sized below concurrency, a timeout near the median latency. Report the race with the interleaving that produces it.

## Precedence

Overrides `diagnosing-bugs` and any other repro-first method for the rest of the thread. An explicit user instruction to run or reproduce something is obeyed; rule 2 resumes afterwards.
