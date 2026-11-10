# Research

Consistent web research before deciding: what the platform says, how mature frameworks solved the same problem, why their maintainers chose as they did, and what current security guidance requires. Research is evidence about consequences, not authority: a pattern found here still goes through the forces, scenarios, and gates like any other option.

## Contents

- When to research
- Source order
- Choosing which frameworks to learn from
- Official guideline index
- Query patterns
- Reading rules
- The user's own past work
- Provenance and decay
- Budget and stopping
- The research log
- Without web access

## When to research

Research at method step 3 for:

- every Design task;
- every Change task that adds or alters published surface;
- every Constraints task, because security guidance changes;
- every Stack task, because layers change between majors, often within a year;
- every Fit task, for the convention's own sources and its known failure modes;
- each Review or Retro finding whose fix the problem map does not settle;
- every fact about a specific tool, flag, attribute, or version that goes into the output.

Skip only when the user says so. Record the skip in the output.

## Source order

Prefer earlier kinds; use later kinds to find earlier ones. For a constraint question (security, data protection, accessibility), the applicable standard and current security guidance (kind 5) outrank the precedent of other frameworks (kind 2): frameworks are evidence of what is common, the standard of what is required.

Before researching outside, check the framework's own sibling features and earlier designs for the same mechanism, and say plainly when no precedent exists anywhere.

1. **The platform's official design guidelines and specifications** (index below), and the language reference.
2. **The documentation and source code of mature frameworks** that solved the same problem, at a stated version. Two or three, chosen for being past 1.0, maintained, and widely used.
3. **Their maintainers' design records**: RFCs, design documents, decision records, issue threads, changelogs, migration guides. Reversals and deprecations with stated reasons are the most valuable entries.
4. **The literature**: the books and papers in `sources.md`, and peer-reviewed studies.
5. **Current security guidance** for constraint work: the OWASP Cheat Sheet Series, the OWASP ASVS, the platform's own security documentation.
6. **Talks and posts by maintainers**, as context for 2 and 3.
7. **Everything else** (other blogs, Q&A sites, forum answers, generated summaries): only as pointers to sources of kinds 1 to 5, never as evidence.

## Choosing which frameworks to learn from

For source kind 2, pick frameworks that are good at the specific thing being researched, not merely popular:

- **Current**: a major release within roughly the last two years, and maintained.
- **Praised for this aspect**: other maintainers or the literature cite it as an example for the topic at hand (its documentation, its extension model, its compatibility record), not only for its size.
- **Comparable**: same platform, or a platform with the language features the pattern depends on (`cheat-sheet.md`).
- **Not popular by inheritance alone**: a framework whose adoption rests mainly on its history or the size of its community, while its design has fallen behind current practice, is evidence of what consumers tolerate, not of what to copy. Record why it was skipped.

## Official guideline index

| Platform | Guideline |
|---|---|
| .NET | Framework Design Guidelines, learn.microsoft.com/dotnet/standard/design-guidelines (excerpted from the 2008 second edition; the book's third edition is newer) |
| Android | Android API guidelines, source.android.com/docs/setup/contribute/api-guidelines |
| Rust | Rust API Guidelines, rust-lang.github.io/api-guidelines |
| Swift | API Design Guidelines, swift.org/documentation/api-design-guidelines |
| Kotlin | Library authors' guidelines, kotlinlang.org/docs/api-guidelines-introduction.html |
| TypeScript | Declaration files "Do's and Don'ts", typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html |
| Go | "Keeping Your Modules Compatible", go.dev/blog/module-compatibility; Go Code Review Comments, go.dev/wiki/CodeReviewComments |
| Python | PEP 8 (style), PEP 387 (backwards compatibility policy), peps.python.org |
| Java | Google Best Practices for Java Libraries, jlbp.dev; "Evolving Java-based APIs", wiki.eclipse.org/Evolving_Java-based_APIs |
| HTTP APIs (for multi-language boundaries) | Google API Improvement Proposals, google.aip.dev; Microsoft REST API Guidelines, github.com/microsoft/api-guidelines (the root document is deprecated; current guidance is under `azure/` and `graph/`); Kubernetes API Conventions, github.com/kubernetes/community, `contributors/devel/sig-architecture/api-conventions.md` |
| Security | OWASP Cheat Sheet Series, cheatsheetseries.owasp.org; OWASP ASVS, asvs.owasp.org |

These addresses were checked when this skill was written; confirm that each still resolves before citing it.

## Query patterns

| Question | Query |
|---|---|
| The platform's idiom | `<platform> API guidelines <topic>` |
| How others shaped the surface | `<framework> <feature> API reference` |
| Why they shaped it so | `<framework> RFC <feature>`, `<framework> design doc <feature>` |
| What they regret | `why <framework> deprecated <feature>`, `<framework> <feature> breaking change`, `<framework> <feature> migration guide` |
| Known failure modes | `<pattern> pitfalls <platform>`, `<framework> issue <symptom>` |
| Constraint guidance | `OWASP cheat sheet <topic>`, `<framework> security <topic>` |
| Current tool facts | `<tool> documentation <flag or attribute>` |

Use a documentation lookup tool, if one is available, for library and framework reference documentation; it returns current, version-specific pages.

## Reading rules

- **Version and date every fact.** A fact about a framework is a fact about one version of it.
- **Read the source for the decisive detail.** Documentation describes intent; the code shows behavior. When they differ, report both.
- **Disagreement is a finding.** When mature frameworks solved the same problem differently, record both choices with the condition each was made under; that is the tradeoff the decision must weigh.
- **Popularity is not evidence of good design.** A widely copied pattern may be widely regretted; look for the regrets.
- **Translate patterns across platforms; do not transliterate them.** A pattern from another platform is evidence about consequences, rewritten in this platform's idiom before it becomes an option.
- **Separate what a source shows from what you infer.** An inference from a source is labeled "reasoned".

## The user's own past work

Beside external sources, search the user's earlier framework work for past decisions, the criteria behind them, and the patterns actually used: the current project's design records and history, the user's other framework projects, the agent's persistent memory, and session logs where the environment keeps them and the user permits. Follow `judgment-memory.md` for where to look, how to label provenance (source, project, date, stated or inferred), and how to present inherited choices: as defaults to keep or change per aspect, because a new framework may deliberately differ from the last.

## Provenance and decay

Knowledge degrades as it is copied. Each restatement can drop a condition, a version, or a caveat, and a model's summary reads as confidently as the source it summarizes. Treat every source with the distance it has from its origin (`SKILL.md`, Axes, dials, and labels), and handle the common forms of decay explicitly:

| Form | Example | Handling |
|---|---|---|
| Copy of a copy | A research note cites another note, which cites a blog post about the documentation | Follow the chain to the primary source and read it; until then the claim is "derived" |
| Summarized quote | A quote obtained through a fetch tool that summarizes pages, or through an agent's report | Near-verbatim at best: reopen the page before quoting it exactly or relying on an exact flag, attribute, or default |
| Untested code | Snippets in a research note, a pattern card, an answer, or this skill's own earlier output | Untested until it type-checks and runs in a scratch project in this session (`prototyping.md`); never put it into documentation, a template, or a pattern card as working code before that |
| Stale fact | A tool flag from two majors ago | Check the version and date; a fact older than the tool's current major is stale |
| False consensus | Five documents agree, all citing the same origin, or citing each other | Count independent primary origins, not documents |
| Self-reinforcement | A past design record, memory lesson, or this skill's own output re-read as evidence | Use it at the evidence kind it recorded; reading a claim again never raises its evidence kind |
| Model-written authority | A well-formatted findings document produced by an agent in an earlier session | Derived, whatever its format: it is a list of pointers to check, not a source |

Expect a share of agent-researched claims to fail when reopened: in one designer's recorded past work, independent re-checks found roughly 7 to 10 percent of cited claims wrong or out of date [Practice-2026-11-5]. For research that will decide something expensive to reverse, have an independent pass, one that did not write the claims, reopen every cited source.

In a precedent survey, report for each precedent whether the design matches or departs from it, which findings recur across projects and which appear in one only, and which candidates were refuted.

When writing anything that later sessions may read as evidence (research findings, design records, pattern cards, memory lessons, practice entries in this skill), record for each claim: its evidence kind, its provenance distance, whether its code was run (and the command), and the date. That record is what lets the next reader take it with the right grain of salt instead of a fresh, unearned certainty.

## Budget and stopping

Stop researching a question when two independent sources of kinds 1 to 3 agree, or when about eight sources have been read without settling it. Record an unsettled question as open, with what was read; it may become a prototype (`prototyping.md`) or a decision for the user.

## The research log

Keep a log in the design record, or in the output for a single task:

| Question | Source (link) | Version / date | Finding | Used in |
|---|---|---|---|---|

"Used in" names the problem-map entry, option, scenario, or decision the finding fed. A question searched without result gets a row too, saying so.

## Without web access

Say so in the output. Label every conclusion that rests on training data "from training, not checked against current sources". Never present a remembered tool flag, attribute name, default value, or version as current.
