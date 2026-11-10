# Documentation and developer guidance

A framework's documentation is part of its surface. What it promises becomes contract; what its first example shows becomes the code most consumers write, so a documentation default is as much policy as a code default. Documentation also carries the design's reasons, which consumers need in order to use the framework as intended. In a field study of more than 440 professional developers, the obstacles to learning an API were documentation of intent, code examples, matching APIs with scenarios, the API's penetrability, and format and presentation [Robillard-DeLine]; each section below answers one of them.

## Contents

- Kinds of documentation
- From design artifacts to documentation
- Reference page anatomy
- Examples are code
- Error messages as guidance
- Migration guides and codemods
- The documentation site
- Specification, documentation, and code
- Documentation for tools and agents
- Docs as code
- Style guides
- Lessons from exemplary documentation
- Documentation review checklist

## Kinds of documentation

Keep four kinds apart, one kind per page. Diátaxis separates them along two questions: does the reader need action or cognition, and are they acquiring a skill or applying it [Diataxis].

| Kind | Action or cognition | Acquisition or application | Answers | Written as |
|---|---|---|---|---|
| Tutorial | Action | Acquisition | "Teach me" | A guided path with a working result at the end |
| How-to guide | Action | Application | "How do I…?" | Steps for one goal, assuming basic knowledge |
| Reference | Cognition | Application | "What exactly is…?" | Complete, consistent descriptions of the surface |
| Explanation | Cognition | Acquisition | "Why…?" | Discussion of concepts, design decisions, and alternatives |

Mixing kinds is the common failure: a tutorial that stops to list every option, or a reference page that tries to teach. Django's documentation is organized in the same four kinds (tutorials, topic guides, reference guides, how-to guides) [Django-Docs]; Canonical adopted Diátaxis for its documentation [Diataxis].

## From design artifacts to documentation

| Design artifact | Becomes |
|---|---|
| Top scenarios (`scenarios.md`) | The tutorial's path, and one how-to guide per scenario |
| Surface table and contracts (`assets/templates/api-spec.md`) | Reference pages |
| Decisions with reasons (design record) | Explanation pages: why the framework works this way, and what it deliberately does not do (Django keeps a "Design philosophies" page [Django-Docs]) |
| Misuse scenarios and error messages | Error reference pages, one per error code |
| Compatibility classifications (`compatibility.md`) | Migration guides and changelog entries |
| Constraints and their opt-outs (`constraints-by-default.md`) | A security page listing every default protection and every named opt-out |
| Benefit profile | The framework's stated philosophy, so consumers know what to expect |
| Accessibility responsibility table (`ui-frameworks.md`) | A per-component accessibility section |

## Reference page anatomy

Every reference page for a public element has the same sections, in the same order, so readers look in the same place every time and an empty section shows what is missing:

1. **Summary**: one sentence saying what the element is or does.
2. **Signature**, in the platform's notation.
3. **Parameters**: type, meaning, units, ownership, default value, and accepted range. State defaults and limits as values ("between 1 and 100, default 10"), not as "configurable".
4. **Return value**, including what is returned for empty or absent results.
5. **Errors**: each error, the condition that raises it, and its error code.
6. **Behavior notes**: thread-safety and async behavior, performance class, side effects, defaults that change behavior.
7. **Examples**: at least one runnable example for the common use; more for non-obvious uses.
8. **Version information**: when it was added, deprecated (with the replacement), or changed.
9. **Related elements**, and the how-to guides that use it.

Follow the platform's convention where one exists:

- `{Rust}` API documentation conventions name sections for Examples, Panics, Errors, Safety, Aborts, and Undefined Behavior [Rust-RFC1574].
- `{web}` MDN's template for an API method: an introduction; Syntax, with Parameters, Return value, and Exceptions; an optional Description; Examples; Specifications; Browser compatibility; See also [MDN-PageTypes].
- `{Go}` every exported name has a doc comment, written in complete sentences that begin with the name [Go-DocComments].
- `{Python}` docstrings state the effect as a command ("Return the…"), with a summary line, a blank line, and the elaboration [PEP257].
- `{TS/JS}` TSDoc is a proposed standard for doc comments; TypeDoc reads both TSDoc and JSDoc tags [TSDoc].
- Generic: document every method, with a description of each parameter, the return value, and any exceptions [Google-Style].

## Examples are code

- **Test every example** in CI. rustdoc executes documentation examples as tests `{Rust}`; Go shows `Example` functions from test files in the package documentation, and `go test` checks them against their `// Output:` comments `{Go}`; Django's documentation checks must pass before documentation changes merge; elsewhere, extract the samples and compile and run them in the build. "Always compile and test your code" [Microsoft-Style]. An example that no longer works teaches the wrong thing with the framework's authority.
- **The first example is the default most consumers copy.** It uses the secure, recommended path, never a shortcut that disables a constraint.
- **Let readers run and edit examples in place** where the platform makes it cheap: react.dev ships hundreds of editable sandboxes [React-Docs]; Stripe puts a working test key into every example, so any example runs as shown [Stripe-Docs].
- **One scenario per example**, complete enough to run, showing its expected output, with nothing the scenario does not need. Mark omitted code with a comment, not an ellipsis [Google-Style].
- **Document only what ships.** Pages for planned features stay out of the published documentation until the feature ships, and documentation never shows code or options that do not exist; before calling documentation done, check every example and option against the code [Practice-2026-11-8].
- **Prove setup guides by replay**: run the guide step by step in a clean directory and compare the result with the expected project; each step names the documentation version it relies on.

## Error messages as guidance

The error message is the one text a developer is sure to read, at the moment they need it most:

- State what went wrong, where, and what to do about it. "Every message has a useful hint" [Elm-Errors].
- Give each error a stable code and link the code to its own entry, on a page of its own or in one error catalog with a stable anchor per code, with causes, a debugging section, and fixes. Each rustc error has a code that `rustc --explain` expands, and an error index lists them all `{Rust}`; Angular keeps a catalog of error pages `{Angular}`; React's production errors carry a link to the error's documentation `{React}`.
- Keep codes stable across versions; message text may change, codes may not (`compatibility.md`).

## Migration guides and codemods

For every major version, ship a tool and a guide together. The tool applies the mechanical changes everywhere; the guide covers what the tool cannot decide.

- A migration guide that lists each breaking change with before-and-after consumer code, ordered by how many consumers it affects.
- A codemod or migration command for mechanical changes, with a dry-run mode, that marks the places it could not migrate. Established examples: Angular's update guide with `ng update` migrations `{Angular}` [Angular-Update]; React's upgrade guide with its codemod recipe, which states what it does not cover `{React}`; Next.js codemods, which offer `--dry` and leave marker comments where manual work remains `{React-based}` [Next-Codemods].

## The documentation site

- **Versioned**: readers choose the version they run, for example through a version selector and per-version addresses; the default is the latest stable release; pages for older versions say so.
- **Learning separated from lookup**: a path for learners ("Learn") apart from the reference, as on react.dev [React-Docs], because a learner needs an order and a working developer needs one page with the facts.
- **Searchable**, including the reference; search by type signature where the platform allows it, as rustdoc's search does `{Rust}`, because developers often know the types they have and want, but not the name.
- **Every page is page one**: readers arrive from search, not from the table of contents, so each page states its context and links to what it assumes [Baker].
- **Defaults and limits on the pages where consumers meet them**, not only in a configuration reference; for each option, a list of the conditions under which the application refuses to start.
- **Links that hold**: the first mention of a name on a page links to its reference entry, headings have stable identifiers, and the documentation build fails on a broken anchor [Practice-2026-11-8].

## Specification, documentation, and code

When the specification, the documentation, and the code disagree, record per item which one wins, rather than assuming one always does; carry requirement identifiers into test names, so that drift between them shows in the test suite [Practice-2026-11-8]. Agent instruction files and plans hold no mutable status: decisions, work status, and the specification live in separate files with a stated precedence, and code comments cite decision records, never plans or phases.

## Documentation for tools and agents

Documentation is increasingly read by coding assistants. Publish the reference in a form tools can read whole: Markdown copies of pages beside the HTML, and an `llms.txt` index file, a Markdown file listing the pages that matter, proposed in 2024 [llms-txt]. Keep examples complete and current; an assistant copies them as faithfully as a person does.

## Docs as code

Keep documentation in the repository, write it with the same tools as the code (version control, review, plain-text markup, automated tests), build it in CI, and fail the build on broken links and failing examples [WriteTheDocs]. Merging a surface change can be blocked until its documentation is included; a surface change without its documentation change is incomplete in the same way as one without its test.

## Style guides

Use an established style guide rather than inventing one: the Google developer documentation style guide [Google-Style] or the Microsoft Writing Style Guide, whose developer section treats reference documentation and code examples as the foundation of developer documentation [Microsoft-Style]. For writing developer documentation as an engineer, see [Bhatti].

## Lessons from exemplary documentation

Learn from frameworks whose documentation is current and praised for it, chosen with the rules in `research.md`, and record each lesson with the project and its link. Lessons observed on 2026-11-06:

| Lesson | Seen in |
|---|---|
| Separate the learning path from the reference | react.dev, Django |
| Let readers edit and run examples in place | react.dev, rustdoc playground links, Stripe |
| One layout for every reference page | MDN, react.dev (reference, usage, troubleshooting), Rust |
| Documentation per release, with a version selector | Django |
| Search by types as well as names | rustdoc |
| A stable code and a page per error | rustc, Angular, React, Elm |
| A migration tool plus a guide per major | Angular, React, Next.js |
| Defaults, ranges, and limits stated as numbers | Stripe, Cloudflare Workers |
| A separate place for the reasons | Django design philosophies, react.dev deep dives, rustc error explanations |
| Documentation tested in CI | rustdoc, Go examples, Django, Stripe |

## Documentation review checklist

For a Document task, check and report each item with the consumer question it leaves unanswered when it fails:

1. Every top scenario has a tutorial path or a how-to guide.
2. Every public element has a complete reference page in the anatomy above.
3. Every default and limit is documented, as a value, where consumers meet it.
4. Every error code has a page.
5. Every deprecation names its replacement; every major has a migration guide and, for mechanical changes, a migration tool.
6. Every constraint and every named opt-out is on the security page.
7. Every example runs in CI.
8. The documentation is versioned, and the default version is the latest stable release.
9. Explanation pages give the reasons for the main design decisions, including what the framework deliberately does not do.
10. For UI libraries: each component states its accessibility responsibilities.
