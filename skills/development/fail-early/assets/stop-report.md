# Stop report format

Copy the block. Keep the first line unchanged: the stop gate searches for it.

```
FAIL-EARLY STOP REPORT
Rule: <number and short name>
Task: <one sentence>
Blocker: <the observable fact: command and output, the missing source, or the ambiguous sentence>
Tried: <each attempt with its result, or "nothing">
Done: <each finished part, with the check that verified it>
Not done: <every unfinished part>
Tree state: <files changed, and for each: safe to keep, or revert>
Needed: <a decision, a source, or an environment fix>
```

Rules for the content:

- Blocker holds evidence, not a summary. Paste the failing output or name the searched locations.
- Tree state covers every changed file. A half-finished change marked "safe to keep" is a false report.
- Needed names one concrete input. "More context" is not an input.
