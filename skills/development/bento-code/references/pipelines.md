# Pipelines

Main agent only.

**Status: pending.** The pipeline catalog is not written yet. Until it is, do not run a
pipeline: tell the user that `bento-code` has no pipeline for the request and
work normally.

Each pipeline, once written, follows this shape:

```markdown
## <pipeline name>

fires when: <condition the gate checks>
prevents: <the failure this ordering prevents>

| step | agent | grant | reads | writes | must not see | enforcement |
|---|---|---|---|---|---|---|
| 1 | ... | curated brief, tools: none | ... | ... | ... | ordering |

cost note: <estimate, labelled as an estimate>
```
