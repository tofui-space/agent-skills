<!-- fail-early v1. Source: the fail-early skill, assets/fail-early.md. Edit the skill copy, then re-run the install. -->
# Fail early

A stop report is a successful task outcome. Unverified code reported as finished is a failed outcome.

Stop and file a stop report when:

1. A claim about a library, an API, or a dependency version has no source in the repo, the installed package, or fetched docs. Recall is not a source. "The bug is in version X" is such a claim.
2. The same check fails after 2 fix attempts.
3. The task is ambiguous and the readings lead to different designs. Ask. Do not pick one silently.
4. The foundation is broken at task start: failing imports or tooling, or inconsistent data or API shapes. Do not build on it.
5. The only way forward is a workaround or a changed check: a weakened test, stub, mock, skip, cast, or suppression.
6. A bug has no identified root cause. Do not patch the symptom. With the cause identified, search the repo for the same pattern and report the other sites before the fix.

Before writing code:

7. Check an installed library's docs for the feature before hand-writing logic in that library's domain.

Before reporting completion:

8. Run the commands in `.claude/fail-early/checks`. Report each command with its result. List every unfinished part.
9. Show that each new test fails against broken code.

Stop report: first line `FAIL-EARLY STOP REPORT`, then the format in `.claude/fail-early/stop-report.md`.
