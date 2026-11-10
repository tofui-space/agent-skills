# Comment and documentation conventions: primary-source check of `rules/development/comments.md`

| | |
|---|---|
| Question | Do the claims in `rules/development/comments.md` (working-tree copy of 2026-11-06, 167 lines) hold against the tools' and languages' own documentation and source code, in an arbitrary repository the rule is installed into? |
| Date read | Every source was opened on 2026-11-06 unless it is marked **not accessed**. Every tool default below is as of the docs page or source revision named next to it. |
| Method | Vendor docs were fetched with curl or WebFetch and searched for the passages that set each behaviour. Source code was read from each project's default branch on GitHub at the commit given in the Sources table. Nothing was run: no formatter, linter, compiler or doc generator was executed, so this file contains no observed behaviour. Line numbers such as "line 35" refer to `rules/development/comments.md`. |

**Read** means the source was opened and the statement or setting was seen in it. **Read (source)** means the statement comes from the tool's source code rather than its docs. **Not accessed** means the source could not be opened, and the reason is given. **Inference:** marks reasoning that goes beyond what a source says. Verdicts use four words: **holds**, **wrong** (with what the source says instead), **holds only when** (with the condition), and **missing** (a primary-source convention the section leaves out that an agent writing comments in that language would need).

## Contents

1. [Summary](#summary)
2. [Prose layout and formatter line length (lines 28–35)](#1-prose-layout-and-formatter-line-length-lines-2835)
3. [Python (lines 76–82)](#2-python-lines-7682)
4. [TypeScript (lines 84–88)](#3-typescript-lines-8488)
5. [Rust (lines 90–97)](#4-rust-lines-9097)
6. [Go (lines 99–108)](#5-go-lines-99108)
7. [C# (lines 110–118)](#6-c-lines-110118)
8. [C++ and C (lines 19, 120–129)](#7-c-and-c-lines-19-120129)
9. [Kotlin (lines 131–139)](#8-kotlin-lines-131139)
10. [Java (lines 141–148)](#9-java-lines-141148)
11. [Android (lines 150–161)](#10-android-lines-150161)
12. [Content and context (lines 37–74)](#11-content-and-context-lines-3774)
13. [The `paths:` glob (line 3)](#12-the-paths-glob-line-3)
14. [Could not confirm](#could-not-confirm)
15. [Sources](#sources)

## Summary

1. Line 35, "Formatter line-length settings apply to code, not prose", is wrong as a general statement. clang-format reflows comments to `ColumnLimit` in every predefined style (only WebKit, with no column limit, escapes), google-java-format refills Javadoc and splits long `//` comments at 100 columns by default, and ktfmt refills KDoc and splits long `//` comments at 100. detekt `MaxLineLength` (on by default, 120) and Checkstyle `LineLength` count comment lines. Black, the Ruff formatter, Prettier, Biome, gofmt, rustfmt (stable) and `dotnet format` leave comment text alone.
2. Lines 28–29 (one sentence per line, no column limit) contradict most language owners' style guides, which set a limit that covers comments: PEP 8 (72 for docstrings and comments), Google Python (80), Google C++ (80), LLVM (80 for source files), Google Java (100), and the Rust Style Guide (80 for comment-only lines). sembr.org itself recommends an 80-character maximum. Go is the exception: go.dev endorses semantic linefeeds and gofmt does not rewrap paragraph text.
3. Line 30 (split a long sentence at a clause boundary) breaks Python docstring summaries: PEP 257 and Google Python require the summary on one physical line, and Ruff `D205` fires on any non-blank second line (read in Ruff's source).
4. Line 80 holds only when the repository selects the rules: none of `D200`, `D205`, `D209`, `D400` is in Ruff's default rule set (only `D419` is), all four are "pedantic", and `convention = "google"` disables `D400`.
5. Go line 103 (its second half) and line 108 are wrong: Go Code Review Comments and the Google Go style guide ask for doc comments on non-trivial unexported declarations, and both Go Code Review Comments and go.dev/doc/comment show `/* */` package comments. Line 107 attributes code-block rendering to gofmt; the doc-comment syntax defines it, `go doc` and pkgsite render it, and gofmt only normalises its indentation.
6. Kotlin, line 135, conflicts with the Kotlin coding conventions, which say "Generally, avoid using `@param` and `@return` tags". The AndroidX Compose component guidelines ask for `@param` on every parameter, so the right answer depends on the codebase.
7. Java, line 143, misses Markdown doc comments (`///`), delivered in JDK 23 by JEP 467 and accepted by Google Java Style. `{@snippet}` (JEP 413) shipped in JDK 18.
8. The file's own sections conflict: "add a comment only when it records information the code does not express" (line 39) against "Document every exported identifier" (line 103) and "Use Javadoc for public and protected API documentation" (line 143); `///` for all public C++ API (line 122) against "only where the repository generates API documentation" (line 124); reasons in lint baselines (line 156) against "Do not comment generated sources" (line 161). The Contents list names a "C" section (line 19) that does not exist and omits the C# section (line 110).
9. The `paths:` glob (line 3) is valid: Claude Code's docs show brace expansion in `paths:`. It omits `.js`, `.jsx`, `.mjs`, `.cjs`, and GCC's other C++ suffixes (`.C`, `.H`, `.cp`, `.CPP`, `.c++`, `.h++`, `.hp`, `.HPP`, `.tcc`), and its `**/*.xml` pattern loads the rule for every XML file, including tool-generated `lint-baseline.xml`.

## 1. Prose layout and formatter line length (lines 28–35)

### What each tool does with comments

| Tool | Does a line-length setting apply to comments or doc comments? | Does it rewrap or reflow comment text? | Default | Status |
|---|---|---|---|---|
| Ruff `E501` (line-too-long) | Yes. It checks every line over the limit; its exceptions are lines that are a single word, lines ending in a URL that starts before the limit, lines ending in a pragma (`# noqa`, `# type: ignore`) that starts before the limit, SPDX and copyright lines, and, when `lint.pycodestyle.ignore-overlong-task-comments = true` (default `false`), comments starting with a task tag (`TODO`, `FIXME`, `XXX`). The rule page's exceptions for pragma and task comments show comments are checked. | No, it is a lint rule. | Limit from `line-length`, default 88; `lint.pycodestyle.max-line-length` defaults to `line-length`. `E501` is category "formatting" and is not in the default rule set. | **Read**: rule page, settings, default rules, rules index |
| Ruff `W505` (doc-line-too-long) | Yes, only to "a line consisting of either a standalone comment or a standalone string, like a docstring", with the same exceptions as `E501`. | No. | `lint.pycodestyle.max-doc-length` defaults to `null`, which "disables reporting violations"; the rule page says that with no value "this rule will be ignored, even if it's added to your `--select` list". | **Read**: rule page, settings |
| Ruff formatter | The docs describe `line-length` as where "the formatter prefers to wrap lines" and do not describe wrapping comments. | The docs describe no comment or docstring prose rewrapping; `docstring-code-format` (off by default) formats only code examples inside docstrings. The formatter "adheres to Black's (stable) code style". **Inference:** it does not rewrap comment text. | `line-length` 88 | **Read**: formatter page, settings |
| Black | Not to comment text. | No: "*Black* does not format comment contents, but it enforces two spaces between code and a comment on the same line". Docstrings get indentation corrected and trailing whitespace removed; no reflow is described. | 88 characters | **Read** |
| clang-format `ReflowComments` | Yes. `Always`: "Apply indentation rules and reflow long comments into new lines, trying to obey the ColumnLimit." `IndentOnly` and `Never` leave comment contents untouched. `CommentPragmas` exempts matching comments. | Yes, under `Always`. | `RCS_Always` is set once in `getLLVMStyle` (`Format.cpp:2044`), and no other predefined style overrides it, so LLVM, Google, Chromium, Mozilla, WebKit, Microsoft and GNU all reflow. | **Read (source)**: `clang/lib/Format/Format.cpp`; option docs |
| clang-format `ColumnLimit` by `BasedOnStyle` | — | — | LLVM 80 (`Format.cpp:1972`; JSON 0 at :2122). Google inherits 80 for C and C++, and sets 100 for Java (:2229), Objective-C (:2268) and C# (:2280). Chromium inherits Google, with 80 for Objective-C (:2342). Mozilla inherits 80. WebKit 0 (:2385). Microsoft 120 (:2415). GNU 79 (:2405). "A column limit of 0 means that there is no column limit." **Inference:** under WebKit, `ReflowComments` has no limit to reflow to. | **Read (source)**, **Read**: option docs |
| rustfmt `wrap_comments`, `comment_width` | `comment_width`: "Maximum length of comments. No effect unless `wrap_comments = true`." `error_on_line_overflow` excludes comments and string literals. | Only with `wrap_comments = true`. | `wrap_comments` default `false`, "Stable: No"; `comment_width` default 80; `max_width` 100. **Inference:** stable rustfmt never wraps comments, because unstable options need a nightly toolchain (not checked). | **Read**: `Configurations.md` |
| Rust Style Guide | "Source lines which are entirely a comment should be limited to 80 characters in length (including comment sigils, but excluding indentation) or the maximum width of the line ... whichever is smaller". It also says the comment guidelines "are recommendations only, a mechanical formatter might skip formatting of comments". | — | 80 | **Read** |
| gofmt (doc comments since Go 1.19) | go.dev/doc/comment names no line length. | No: "Gofmt preserves line breaks in paragraph text: it does not rewrap the text. This allows the use of semantic linefeeds". Since Go 1.19 it "reformats doc comments to make their rendered meaning clearer": it removes leading and trailing blank lines, collapses duplicate blank lines, rewrites lists and code blocks, and moves directives. | none | **Read**: go.dev/doc/comment, Go 1.19 release notes |
| google-java-format | Yes, to Javadoc and to `//` comments. | Yes. Javadoc is reformatted unless `--skip-javadoc-formatting` is passed. In the lexer a newline in Javadoc prose becomes a `Whitespace` token (`JavadocLexer.java:226-228`) that the writer emits as a space or a line break (`JavadocWriter.java:106-112`), so paragraphs are refilled. Both `/**` and Markdown `///` Javadoc go through the formatter (`JavaCommentsHelper.java:51-58`). `//` comments longer than the limit are split at whitespace (`JavaCommentsHelper.java:150`). | `--max-line-length` default 100 | **Read**: README; **Read (source)** |
| ktfmt | Yes, to KDoc and to `//` comments. | Yes. KDoc goes through `KDocFormatter` with `maxLineWidth` and `maxCommentWidth` both set to the formatter's maximum line length and greedy line breaking (`KDocCommentsHelper.kt:50-58`), and paragraphs are reflowed (`Paragraph.reflow`). `//` comments longer than the limit are split at whitespace (`KDocCommentsHelper.kt:124-150`). `FormattingOptions.kt` has no option to turn KDoc formatting off. | `DEFAULT_MAX_WIDTH = 100`; EditorConfig `max_line_length` overrides it when `--enable-editorconfig` is passed | **Read**: README; **Read (source)** |
| ktlint `max-line-length` | Partly. The rule skips leaves that are part of `KDOC` (`MaxLineLengthRule.kt:65`) and lines containing only a comment (`:69`, `:107-109`); a trailing comment after code counts, and the docs show `val foo... = "..." // some comment` as disallowed. | No, it is a lint rule. | `max_line_length`: `ktlint_official` 140, `intellij_idea` off, `android_studio` 100 | **Read**: standard rules page; **Read (source)** |
| detekt `MaxLineLength` | Yes: `excludeCommentStatements` defaults to `false`. | No. | Active by default; `maxLineLength` 120 (docs for 1.23.8 and 2.0.0-alpha.6) | **Read** |
| Checkstyle `LineLength` | Yes. `ignorePattern` defaults to `^(package\|import) .*` only, and "Trailing comments are taken into consideration while calculating the line length". | No. | `max` 80 | **Read** |
| Prettier | `printWidth` is "the line length that the printer will wrap on" for code; comment content is not wrapped. | No: "Comments can contain everything from prose to commented out code and ASCII diagrams ... Prettier can't know how to format or wrap them. So they are left as-is. The only exception to this are JSDoc-style comments ... which Prettier can fix the indentation of." `proseWrap` applies to Markdown files and defaults to `"preserve"`. | `printWidth` 80 | **Read**: rationale, options |
| Biome | `formatter.lineWidth` is the "preferred maximum line width used when deciding where to wrap code". | No. The JS formatter prints comment text as written, except that a multi-line block comment whose lines all start with `*` has its lines re-indented by one space (`biome_js_formatter/src/comments.rs:33-70`, `biome_formatter/src/comments.rs:1282-1296`). | `lineWidth` 80 | **Read**: configuration reference; **Read (source)** |
| `dotnet format` | The C# formatting options page lists no line-length option: its 37 `csharp_*` options cover indentation, new lines, spacing and preserving single-line blocks. **Inference:** `dotnet format` neither measures nor wraps comments. | No (inference above). | none | **Read**: `dotnet format` page, C# formatting options |

### Language owners' style guides on comment length

- PEP 8: "Limit all lines to a maximum of 79 characters. For flowing long blocks of text with fewer structural restrictions (docstrings or comments), the line length should be limited to 72 characters." (**Read**: https://peps.python.org/pep-0008/)
- Google Python Style: "Maximum line length is 80 characters", with exceptions for "URLs, pathnames, or long flags in comments". (**Read**)
- Google C++ Style: "Each line of text in your code should be at most 80 characters long", with an exception for "a comment line which is not feasible to split without harming readability". (**Read**)
- LLVM Coding Standards: "Write your code to fit within 80 columns ... However, documentation files are not source code files, and instead of fitting into 80 columns, they must be formatted to one sentence per line." Comments in source files therefore stay inside 80 columns. (**Read**)
- Google Java Style: "Java code has a column limit of 100 characters", with the exception of lines "where obeying the column limit is not possible (for example, a long URL in Javadoc ...)". It also says: "use the `/* ... */` style if you want automatic code formatters to re-wrap the lines when necessary (paragraph-style). Most formatters don't re-wrap lines in `// ...` style comment blocks." (**Read**)
- Google Go Style: "There is no fixed line length for comments in Go. Long comment lines should be wrapped ... 80 or 100 columns are common choices. However, this is not a hard cut-off". It also says to "Avoid comments that fit large amounts of text onto a single line". (**Read**)
- go.dev/doc/comment shows a package comment "written using semantic linefeeds, in which each new sentence or long phrase is on a line by itself", then says "Whatever is best for your code base is fine. Either way, go doc and pkgsite rewrap doc comment text when printing it." (**Read**)
- sembr.org: rule 2, "A semantic line break MUST NOT alter the final rendered output of the document"; rule 4, a break "MUST occur after a sentence"; rule 5, "SHOULD occur after an independent clause"; rule 6, "MAY occur after a dependent clause in order to clarify grammatical structure or satisfy line length constraints"; rule 12, "A maximum line length of 80 characters is RECOMMENDED"; rule 13, "A line MAY exceed the maximum line length if necessary, such as to accommodate hyperlinks, code elements, or other markup." Its FAQ recommends using semantic line breaks "for any new or revised text" rather than migrating a whole document at once. (**Read**: https://sembr.org/)

### Verdicts

- Line 28, "Put each complete sentence on its own source line": **holds only when** the comment's renderer joins consecutive lines (sembr rule 2) and no formatter in the repository refills that comment. Go explicitly supports it (go.dev/doc/comment). It does not survive google-java-format on Javadoc, ktfmt on KDoc, or clang-format under any predefined style except WebKit when a sentence runs past `ColumnLimit` (table above). **Inference:** Python's `help()` and pydoc print docstrings as written, so the breaks show there; Sphinx reST joins them (reST is on sembr.org's list of compatible languages).
- Line 29, "Do not wrap prose at a character or column limit": **wrong** for repositories following PEP 8, Google Python, Google C++, LLVM, Google Java or the Rust Style Guide, which all set a limit that covers comment lines (list above). It also contradicts sembr.org rule 12, the convention line 28 adopts. It **holds** for Go, where neither go.dev nor Google Go sets a fixed limit ("There is no fixed line length for comments in Go"), though Google Go still asks that long comment lines be wrapped.
- Line 30, "Split a long sentence only at a meaningful clause or list-item boundary": **holds only when** the sentence is not a Python docstring summary. PEP 257 says the summary line must fit "on one line", Google Python says "one physical line not exceeding 80 characters", and Ruff `D205` fires on it (section 2). It matches sembr.org rules 5–8 elsewhere.
- Line 31, "Separate paragraphs with a blank documentation line": **holds only when** the doc format is Markdown-like or reST. It holds for Go ("A paragraph is a span of unindented non-blank lines"), Rust (CommonMark), KDoc (Markdown), Markdown Javadoc ("separated as usual for Markdown, by a line that is blank apart from the leading `///`"), and Python reST. Traditional Javadoc also needs `<p>` before each paragraph except the first (Google Java 7.1.2). C# XML documentation uses `<para>` ("The `<para>` tag creates a double spaced paragraph"). In Doxygen `///` blocks, "a blank line ends a documentation block", so the separator has to be an empty `///` line, not a truly blank line.
- Line 32, "Do not join separate sentences to fill a line": **holds**; it is sembr.org rule 4.
- Line 33, "Do not reflow unrelated prose": **holds only when** the repository's formatter does not reflow comments. google-java-format, ktfmt and clang-format with `ReflowComments: Always` rewrite comments on every run, whatever the agent intends (table above).
- Line 35, "Formatter line-length settings apply to code, not prose": **wrong** as a general statement. It holds for Black, the Ruff formatter, Prettier, Biome, gofmt, stable rustfmt and `dotnet format`. It is false for clang-format (all predefined styles), google-java-format, ktfmt, detekt `MaxLineLength` (on by default and counting comments), Checkstyle `LineLength`, Ruff `E501` when selected, Ruff `W505` when `max-doc-length` is set, and ktlint for trailing comments (KDoc and comment-only lines are exempt).

## 2. Python (lines 76–82)

### What the rules check

- `D200` (unnecessary-multiline-docstring): "Checks for single-line docstrings that are broken across multiple lines." In the source, it fires when the docstring body has exactly one non-empty line but more than one line, that is, when the quotes sit on their own lines (`one_liner.rs:62-75`). Category pedantic. (**Read**, **Read (source)**)
- `D205` (missing-blank-line-after-summary): "Checks for docstring summary lines that are not separated from the docstring description by one blank line." In the source, it counts the blank lines after the first line of the trimmed body and fires when the docstring has more than one line and that count is not exactly 1 (`blank_after_summary.rs:82-92`). Category pedantic. (**Read**, **Read (source)**)
- `D209` (new-line-after-last-paragraph): "Checks for multi-line docstrings whose closing quotes are not on their own line." Category pedantic. (**Read**)
- `D400` (missing-trailing-period): the docs say "Checks for docstrings in which the first line does not end in a period", and "By default, this rule is enabled when using the numpy and pep257 conventions, and disabled when using the google convention." The source checks a different line: `logical_line` returns the index of the last non-empty line before the first blank line (`helpers.rs:15-31`), and the rule checks that line (`ends_with_period.rs:99-115`). Category pedantic. (**Read**, **Read (source)**)
- Default selection: the Default Rules page lists `D419` (empty-docstring) as the only `pydocstyle` rule enabled by default, and the rules index marks `D419` "✅ Enabled by default". `D200`, `D205`, `D209` and `D400` are not in it. (**Read**)
- `lint.pydocstyle.convention` (default `null`): "Enabling a convention will disable all rules that are not included in the specified convention." `pep257` excludes D203, D212, D213, D214, D215, D404–D411, D413, D415, D416, D417, D420. `numpy` excludes D107, D203, D212, D213, D402, D413, D415, D416, D417. `google` excludes D203, D204, D213, D215, D400, D401, D404, D406–D409, D413. So all three keep `D200`, `D205` and `D209`, and only `google` drops `D400`. (**Read**: settings)
- A docstring whose first paragraph is two sentences on two lines, such as `"""First sentence.\nSecond sentence.\n\nMore."""`, violates `D205`: the second line is not blank (as the docs word it, and in the source). It passes `D400`: the first line ends in a period, and so does the last line of the first paragraph, which is the one the source checks. A single sentence split at a comma, as line 30 allows, also violates `D205`; it passes `D400` in the source (the paragraph's last line ends in a period) but would fail `D400` as the docs word it ("first line"). (**Read (source)**; **Inference:** the outcome for these example strings is traced from the code, not run.)
- PEP 257: "Multi-line docstrings consist of a summary line just like a one-line docstring, followed by a blank line, followed by a more elaborate description. The summary line may be used by automatic indexing tools; it is important that it fits on one line and is separated from the rest of the docstring by a blank line." A one-line docstring "is a phrase ending in a period. It prescribes the function or method's effect as a command ('Do this', 'Return that'), not as a description". (**Read**)

### Verdicts

- Line 78, "Use docstrings for API documentation": **holds** (PEP 257; Google Python 3.8.1).
- Line 79, "Use `#` comments for implementation rationale": **holds**. Google Python 3.8.3: "subtle but important details of a function's implementation that are not relevant to the caller are better expressed as comments alongside the code than within the function's docstring."
- Line 80, "Ruff enforces docstring structure through `D200`, `D205`, `D209`, and `D400`": **holds only when** the repository selects those rules. None of them is enabled by default, and `convention = "google"` removes `D400`. In an arbitrary repository Ruff enforces none of the four.
- Line 81, "Ruff does not enforce semantic prose line breaks": **holds**. A search of the rules index for "sentence" and "semantic line" found nothing. But `E501` (when selected) and `W505` (when `max-doc-length` is set) do flag a long one-sentence line, so a repository using either one blocks the layout lines 28–29 ask for.
- Line 82, "A one-line docstring remains on one line as required by `D200`": **holds only when** `D200` is selected. `D200` requires the quotes to share the line when the text is one line; it does not stop a one-sentence docstring from being split over two lines. That case trips `D205` instead.
- **Missing:** the summary-line rules of PEP 257 and Google Python (one physical line, then a blank line), which line 30 contradicts. Also missing: PEP 257's imperative mood ("Return that", checked by `D401`, which the `google` convention disables); PEP 8's 72-character limit for docstrings and comments; Google Python's special sections ("Certain aspects of a function should be documented in special sections", 3.8.3); and which objects need docstrings (PEP 257: "all functions and classes exported by a module should also have docstrings. Public methods (including the `__init__` constructor) should also have docstrings"; Google Python 3.8.3: "A docstring is mandatory for every function that has one or more of the following properties: being part of the public API, nontrivial size, non-obvious logic").

## 3. TypeScript (lines 84–88)

### What the sources say

- TSDoc tags read on tsdoc.org: `@param` (Core): "The `@param` tag is followed by a parameter name, followed by a hyphen, followed by a description." `@returns` (Core): "Used to document the return value for a function." `@remarks` (Core): "The `@remarks` block tag ends the summary section, and begins the remarks section for a doc comment"; index pages show only the summary. `@deprecated` (Core): "followed by a sentence describing the recommended alternative. It recursively applies to members of the container." `@throws` (Extended): "A separate `@throws` block should be used to document each exception type. This tag is for informational purposes only". `@example` (Extended): text on the tag's line is the example's title. Core tags "are considered essential", Extended tags "are optional. Documentation tools may or may not support them." (**Read**)
- JSDoc `{type}` annotations: the TSDoc parser reports message `tsdoc-param-tag-with-invalid-type`, "The `@param` block should not include a JSDoc-style `{type}`" (`TSDocMessageId.ts:146-149`, `NodeParser.ts:471-477`), and `tsdoc-param-tag-with-invalid-optional-name` for `[name]`. TSDoc therefore does not allow `{type}` on `@param`. (**Read (source)**)
- TypeScript handbook, JSDoc Reference: "Only documentation tags are supported in TypeScript files. The rest of the tags are only supported in JavaScript files." The documentation tags it lists as working "in both TypeScript and JavaScript" are `@deprecated`, `@see` and `@link`. In JavaScript files, `@param {string} p1 - ...` and `@returns {string}` supply type information to the checker. (**Read**)

### Verdicts

- Line 86, "Use `/** ... */` for exported API documentation": **holds** (TSDoc examples; TypeScript handbook).
- Line 87, "Use `//` for implementation rationale": **holds**; no source read contradicts it.
- Line 88, "Do not use documentation blocks for ordinary implementation comments": **holds**. **Inference:** editors and tools such as TypeDoc and API Extractor extract `/** */` blocks, so an implementation note written that way shows up as API documentation.
- **Missing:** TSDoc's `@param name - description` form, with the hyphen and without JSDoc `{type}` or `[name]`. Also missing: the summary section followed by `@remarks`, the Core-versus-Extended status of `@throws` and `@example`, and that `@deprecated` names the alternative. The section also says nothing about JavaScript files, where JSDoc `{type}` annotations are how types are declared. The glob (line 3) does not load the rule for `.js` files anyway (section 12).
- Formatter interaction: Prettier and Biome leave comment text as written (section 1), so sentence-per-line layout survives in TypeScript.

## 4. Rust (lines 90–97)

### What the sources say

- rustdoc book: `//!` lines "indicate module-level or crate-level documentation". `rustdoc` "uses the CommonMark Markdown specification" plus extensions. "Everything before the first empty line will be reused to describe the component in searches and module overviews ... It is good practice to keep the summary to one line". "the public API of all code should have documentation". Types need not be restated, because "the type system does a good job of defining what types a function passes and returns". (**Read**)
- Doctests: "`rustdoc` supports executing your documentation examples as tests." Doctests "will still link against only the public items of your crate; if you need to test private items, you need to write a unit test." The `ignore` attribute: "It is customary to add the reason why it should be ignored in a `(…)` comment." (**Read**) Cargo: "Documentation tests are also run by default ... It extracts code samples from documentation comments of the library target", and they can be turned off with `doctest = false`. (**Read**: `cargo test` page)
- Rust Style Guide: "Prefer line comments (`//`) to block comments", "Prefer line comments (`///`) to block comments (`/** ... */`)", and "only use inner doc comments (`//!` and `/*! ... */`) to write module-level or crate-level documentation." (**Read**)
- Rust API Guidelines C-FAILURE: "Error conditions should be documented in an 'Errors' section", "Panic conditions should be documented in a 'Panics' section", and "Unsafe functions should be documented with a 'Safety' section that explains all invariants that the caller is responsible for upholding". C-EXAMPLE: "Every public module, trait, struct, enum, function, method, macro, and type definition should have an example", "applied within reason". C-HIDDEN: "Rustdoc does not show unhelpful implementation details". (**Read**)
- Clippy groups and defaults: `missing_safety_doc` is in `style`, which is warn by default. `missing_errors_doc` ("`pub fn` returns `Result` without `# Errors` in doc comment") and `missing_panics_doc` are in `pedantic`, which is allow by default. `doc_lazy_continuation` ("require every line of a paragraph to be indented and marked") is in `style`, warn by default. `too_long_first_doc_paragraph` is in `nursery`, allow by default. (**Read (source)**: `clippy_lints/src/doc/mod.rs:185-186, 450-451, 494-495, 534-535, 674-675`; **Read**: Clippy README group table)

### Verdicts

- Line 92, "Use `///` for item documentation": **holds** (Rust Style Guide).
- Line 93, "Use `//!` for crate-level or module-level documentation": **holds** (rustdoc book; Rust Style Guide).
- Line 94, "Use `//` for implementation rationale": **holds**.
- Line 95, "Documentation comments use Markdown": **holds**. Precisely, rustdoc uses CommonMark plus extensions.
- Line 96, "Keep examples valid as Rust documentation tests where practical": **holds only when** the item is in a library target and its example uses public items. Cargo runs doctests only for the library target, and doctests link only against public items. Elsewhere, mark the block `ignore` with a reason in parentheses, or `no_run`.
- Line 97, "Do not use documentation comments for private implementation narration": **holds**. It matches C-HIDDEN; no source read states it directly.
- **Missing:** the `# Errors`, `# Panics`, `# Safety` and `# Examples` sections (API Guidelines). Clippy warns by default on a public `unsafe fn` without `# Safety`. Also missing: the summary is everything before the first empty line, so with one sentence per line (line 28) a two-sentence first paragraph becomes a two-sentence summary. And `doc_lazy_continuation`, warn by default, requires continuation lines of a Markdown list item to be indented, which matters when line 30 splits a sentence inside a list item.

## 5. Go (lines 99–108)

### What the sources say

- go.dev/doc/comment: "'Doc comments' are comments that appear immediately before top-level package, const, func, type, and var declarations with no intervening newlines. Every exported (capitalized) name should have a doc comment." For a package comment, "the first sentence begins with 'Package '". For a command, "The first sentence conventionally begins with the name of the program itself". Type doc comments "start with complete sentences naming the declared symbol", and the examples begin "A Reader serves content from a ZIP archive." Multi-file packages: "the package comment should only be in one source file. If multiple files have package comments, they are concatenated". (**Read**)
- Concurrency, go.dev/doc/comment: "By default, programmers should expect that a type is safe for use only by a single goroutine at a time. If a type provides stronger guarantees, the doc comment should state them." "By default, programmers can assume that a top-level function is safe to call from multiple goroutines; this fact need not be stated explicitly." (**Read**)
- Errors: go.dev/doc/comment shows the convention in examples ("The only possible returned error is [ErrBadPattern], when pattern is malformed"; "Errors returned by file systems can be tested against these errors using errors.Is") but states no rule. The Go blog "Working with Errors in Go 1.13" (Damien Neil and Jonathan Amsterdam, 17 October 2019): "wrapping an error makes that error part of your API", and "If a function is defined as returning an error wrapping some sentinel or type, do not return the underlying error directly." (**Read**)
- Code blocks: "A code block is a span of indented or blank lines not starting with a bullet list marker or numbered list marker. It is rendered as preformatted text". "Gofmt indents all lines in a code block by a single tab ... Gofmt also inserts a blank line before and after each code block". "A list is a span of indented or blank lines ... in which the first indented line begins with a bullet list marker or numbered list marker." Go 1.19: "the new package go/doc/comment provides parsing and reformatting of doc comments as well as support for rendering them to HTML, Markdown, and text"; `go doc` and pkgsite render. (**Read**)
- Block comments: go.dev/doc/comment shows gofmt's own package comment written as `/* Gofmt formats Go programs. ... */`. Go Code Review Comments, Package Comments, shows `/* Package template implements data-driven templates ... */ package template`. Effective Go: "Line comments are the norm; block comments appear mostly as package comments". (**Read**)
- Go Code Review Comments, Doc Comments: "All top-level, exported names should have doc comments, as should non-trivial unexported type or function declarations." Comment Sentences: "Comments should begin with the name of the thing being described and end in a period". Goroutine Lifetimes: "Try to keep concurrent code simple enough that goroutine lifetimes are obvious. If that just isn't feasible, document when and why the goroutines exit." (**Read**)
- Google Go Style: "All top-level exported names must have doc comments, as should unexported type or function declarations with unobvious behavior or meaning. These comments should be full sentences that begin with the name of the object being described. An article ('a', 'an', 'the') can precede the name to make it read more naturally." (**Read**)
- `doc.go`: the Go blog "Godoc: documenting Go code" (Andrew Gerrand, 31 March 2011): for "packages that need large amounts of introductory documentation: the package comment is placed in its own file, doc.go, which contains only those comments and a package clause." (**Read**)

### Verdicts

- Line 101, "Use `//` for both documentation and implementation rationale; Go has no separate documentation syntax": **holds** for the second half. Effective Go and go.dev show block comments in use for package comments, so `//` is the norm, not the only form.
- Line 102, "Begin a doc comment with the name of the identifier it documents, directly above the declaration, with no blank line between": **holds only when** the declaration is a const, func, type or var, and with the allowance that "an article ... can precede the name" (Google Go; go.dev's own "A Reader ..." examples). Package comments begin "Package <name>", and command comments begin with the program name. The placement half holds.
- Line 103, "Document every exported identifier; reserve comments on unexported identifiers for rationale": the first half **holds** (go.dev and Code Review Comments say "should", Google Go "must"). The second half is **wrong**: Code Review Comments asks for doc comments on "non-trivial unexported type or function declarations", and Google Go on "unexported type or function declarations with unobvious behavior or meaning", written "as if it were exported (namely, starting the comment with the unexported name)".
- Line 104, "Put package documentation above a single `package` clause, or in `doc.go` when it is long": **holds** (go.dev; Go blog 2011).
- Line 105, errors: **holds** as a convention the Go docs show in examples and the errors blog motivates; no Go page states it as a rule. Concurrency: **holds only when** the type gives a stronger guarantee than the default, or a function is not safe for concurrent use. go.dev says the default for top-level functions "need not be stated explicitly".
- Line 106, goroutine ownership and cancellation: **holds only when** the lifetimes are not obvious from the code. Code Review Comments says to make them obvious first, and to document "when and why the goroutines exit" if that is not feasible. No Go source read asks to document "which context governs it".
- Line 107, "`gofmt` renders indented lines as code blocks, so do not indent prose": **wrong** about the tool. The doc-comment syntax (package `go/doc/comment`) defines indented spans as code blocks, `go doc` and pkgsite render them, and gofmt only normalises them: one tab of indentation and blank lines around. The advice not to indent prose holds. **Missing:** list items are indented spans that start with a list marker, and gofmt rewrites list markers.
- Line 108, "Do not use `/* ... */` for documentation comments": **wrong**. go.dev/doc/comment and Code Review Comments both show `/* */` package comments, and Effective Go says block comments "appear mostly as package comments".
- **Missing:** doc links (`[Name]`, `[pkg.Name]`), headings (`# Heading`), and the "reports whether" wording for boolean functions. All are on go.dev/doc/comment.

## 6. C# (lines 110–118)

### What the sources say

- XML documentation comments: "You set either the `GenerateDocumentationFile` or `DocumentationFile` option ... When you enable this option, the compiler generates the CS1591 warning for any publicly visible member declared in your project without XML documentation comments." `///` text with no XML tags is copied to the output, but "Most tools that consume XML comments (including Visual Studio IntelliSense) don't read these comments." (**Read**)
- CS1591, "Compiler Warning (level 4)": "Missing XML comment for publicly visible type or member 'Type_or_Member'. The DocumentationFile compiler option was specified, but one or more constructs did not have comments." (**Read**)
- `GenerateDocumentationFile` "controls whether the compiler generates an XML documentation file for your library"; the entry states no default. (**Read**)
- Recommended tags: "For the sake of consistency, document all publicly visible types and their public members." "At a bare minimum, types and their members should have a `<summary>` tag." "Write documentation text using complete sentences that end with full stops." "The `<param>` tag describes parameters. If you use this tag, the compiler verifies that the parameter exists and that all parameters are described in the documentation." `cref`: "The compiler verifies that this code element exists." The recommended tags include `<summary>`, `<remarks>`, `<returns>`, `<param>`, `<paramref>`, `<exception>`, `<value>`, `<para>`, `<list>`, `<c>`, `<code>`, `<example>`, `<inheritdoc>`, `<include>`, `<see>`, `<seealso>`, `<typeparam>` and `<typeparamref>`. The page also describes `<safety>`, for "a preview feature in C# 15 and .NET 11"; "The C# compiler doesn't recognize or process the `<safety>` tag." `<inheritdoc>`: "Visual Studio automatically inherits XML documentation for undocumented members that override or implement documented members ... However, this automatic inheritance only applies within the Visual Studio IDE and doesn't affect the XML documentation file generated by the compiler." (**Read**)
- Nullability: the Nullable reference types page says "Projects created from recent .NET templates set `<Nullable>enable</Nullable>` in the project file" and tells readers of older projects to check for the line and add it if missing. The dotnet/runtime API guideline `nullability.md` says "Nullability annotations are about codifying a contract, and documentation is a description of that contract", and bases annotations on what the documentation says about `null`. No Microsoft page read tells authors to leave nullability out of documentation. (**Read**)

### Verdicts

- Line 112, "Use `///` XML documentation comments for public APIs that require generated or IDE-visible documentation": **holds only when** the condition is read narrowly. Microsoft recommends documenting "all publicly visible types and their public members", and once `GenerateDocumentationFile` is on, CS1591 warns on every publicly visible member without a comment, whether or not anyone "requires" it.
- Line 113, "Use `//` for implementation rationale": **holds**.
- Line 114, the five tags: **holds**; all five are recommended tags. **Missing:** `<summary>` is the stated minimum; `<inheritdoc>` (with the note that IDE-only inheritance does not reach the XML file), `<typeparam>`, `<value>`, `<paramref>`, `<see cref>` and `<para>` are also recommended; documentation text should be complete sentences ending with full stops.
- Line 115, "Document observable API behavior, not implementation details": **not established** from a Microsoft source; no source read contradicts it.
- Line 116, "Keep parameter names and documented exceptions consistent with the declaration": **holds**. The compiler checks `<param>` names and `cref` targets and warns on a mismatch.
- Line 117, cancellation, disposal and thread affinity: **not established**; no Microsoft source read covers it.
- Line 118, "Do not restate nullability that the nullable reference type annotations already state": **holds only when** the nullable context is enabled for the file. Without `<Nullable>enable</Nullable>` the annotations state nothing. No Microsoft source states the rule; the dotnet/runtime guideline treats annotation and documentation as one contract that must agree.

## 7. C++ and C (lines 19, 120–129)

### What the sources say

- Google C++ Style, Comment Style: "Use either the `//` or `/* */` syntax, as long as you are consistent." Function Comments: "Declaration comments describe use of the function (when it is non-obvious); comments at the definition of a function describe operation." Function Declarations: "Almost every function declaration should have comments immediately preceding it ... These comments may be omitted only if the function is simple and obvious". Things to mention include "whether the object remembers reference or pointer arguments beyond the duration of the method call", "For each pointer argument, whether the pointer may be null", and "If there are any performance implications". Class Comments: "Document the synchronization assumptions the class makes, if any." Class Data Members: invariants "(special values, relationships between members, lifetime requirements) not clearly expressed by the type and name ... must be commented." Overrides: "the override needs no additional documentation". Don'ts: "Do not state the obvious." TODO: "TODOs should include the string TODO in all caps, followed by the bug ID, name, e-mail address, or other identifier of the person or issue with the best context about the problem", for example `// TODO(bug 12345): remove the "Last visitors" feature.`, plus "a very specific date ... or a very specific event" for future-dated TODOs. (**Read**)
- LLVM Coding Standards: "prefer C++-style comments (`//` for normal comments, `///` for doxygen documentation comments)". C-style comments are for "When writing C code to be compatible with C89" and "When writing a header file that may be #included by a C source file". "Include descriptive paragraphs for all public interfaces ... Avoid restating the information that can be inferred from the API name or signature." "Put the documentation comments for public APIs into the header file. Documentation comments for private APIs can go to the implementation file." "Don't duplicate the function or class name at the beginning of the comment." The standard file header uses `//===----...----===//` banner lines. "If an algorithm is based on a paper or is described in another source, provide a reference." (**Read**)
- C++ Core Guidelines: NL.1 "Don't say in comments what can be clearly stated in code"; NL.2 "State intent in comments", with the note "If the comment and the code disagree, both are likely to be wrong"; NL.3 "Keep comments crisp". NL.27: `.h` headers "are more often shared with C", and other suffixes such as `.hh`, `.C` and `.cxx` are "in widespread use". (**Read**)
- Doxygen manual, comment blocks for C-like languages including C: Javadoc style `/** ... */`, Qt style `/*! ... */`, or "a block of at least two C++ comment lines, where each line starts with an additional slash or an exclamation mark" (`///` or `//!`); "Note that a blank line ends a documentation block in this case." (**Read**)
- Linux kernel-doc: "The opening comment mark `/**` is used for kernel-doc comments." The function format is `function_name() - Brief description of function.`, then `@arg1:` lines, then a longer description, then `Context:` ("whether the function can sleep, what locks it takes, releases, or expects to be held") and `Return:`. "Every function that is exported to loadable modules using EXPORT_SYMBOL or EXPORT_SYMBOL_GPL should have a kernel-doc comment." Kernel coding style: "NEVER try to explain HOW your code works in a comment", "Do not add boilerplate kernel-doc which simply reiterates what's obvious from the signature", and the preferred multi-line comment is `/* ... */` with "A column of asterisks on the left side". The preferred line length is 80 columns. (**Read**)
- GCC manual, C++ Style Comments: `//` comments "are included in the 1999 C standard. However, C++ style comments are not recognized if you specify an `-std` option specifying a version of ISO C before C99, or `-ansi`". `file.h` is a "C, C++, Objective-C or Objective-C++ header file". (**Read**)

### Verdicts

- Line 19, Contents entry "C": **wrong**. The file has no `## C` section; the only sections near it are `## C#` (line 110, which the Contents list omits) and `## C++` (line 120). The glob loads the rule for `.c` and `.h` files with no C guidance.
- Line 122, "Use `///` for public API documentation": **holds only when** the repository follows LLVM or Doxygen conventions. Google C++ documents with plain `//` or `/* */`. Doxygen accepts `/** */`, `/*! */` and `//!` as well. It is wrong for C compiled as C89/C90 (GCC) and, per LLVM, for headers that C sources include.
- Line 123, "Use `//` for implementation rationale": **holds**.
- Line 124, "Use documentation blocks only where the repository generates API documentation from them": **holds**, but it conflicts with line 122, which asks for `///` on public API with no such condition.
- Line 125, ownership, lifetime, thread-safety, preconditions: **holds** (Google C++ function, class and data-member comments). Invalidation and units: **not established**; no source read names them.
- Line 126, the exception contract and "`noexcept` by intent": **not established**. LLVM asks to document "what happens when something unexpected happens, for instance, does the method return null?"; no source read covers `noexcept` by intent.
- Line 127, why a template constraint, specialization or overload exists: **not established**; consistent with LLVM's "what the code is trying to do and why".
- Line 128, documentation on the declaration in the header and rationale on the definition: **holds** (Google C++; LLVM).
- Line 129, "Do not narrate control flow that is already clear from the code": **holds** (Google C++ Don'ts; NL.1; kernel coding style).
- **Missing for C:** the kernel-doc format for kernel-style C; that `///` is valid only from C99 on; and that `.h` is shared between C and C++, so a header may be read under either section.

## 8. Kotlin (lines 131–139)

### What the sources say

- Kotlin coding conventions, Documentation comments: "Generally, avoid using `@param` and `@return` tags. Instead, incorporate the description of parameters and return values directly into the documentation comment, and add links to parameters wherever they are mentioned. Use `@param` and `@return` only when a lengthy description is required which doesn't fit into the flow of the main text." (**Read**)
- KDoc: "KDoc combines Javadoc's syntax for block tags ... and Markdown for inline markup." "By convention, the first paragraph of the documentation text (the block of text until the first blank line) is the summary description". Block tags: `@param`, `@return`, `@constructor`, `@receiver`, `@property`, `@throws`/`@exception`, `@sample`, `@see`, `@author`, `@since`, `@suppress`. On `@throws`: "Since Kotlin does not have checked exceptions, there is also no expectation that all possible exceptions are documented, but you can still use this tag when it provides useful information". "KDoc does not support the `@deprecated` tag. Instead, please use the `@Deprecated` annotation." Links: "simply put its name in square brackets", and "KDoc does not have any syntax for resolving overloaded members in links." The page does not mention `@Throws`. (**Read**)
- `@Throws` is a Java-interop declaration: when a Java caller catches `IOException` from a Kotlin function that does not declare it, "You get an error message from the Java compiler ... To work around this problem, use the `@Throws` annotation in Kotlin". (**Read**: Calling Kotlin from Java)
- Platform types: "Types of Java declarations are treated in Kotlin as non-denotable and called platform types." (**Read**: Calling Java from Kotlin)
- Android coroutines best practices: "Suspend functions should be main-safe, meaning they're safe to call from the main thread. If a class is doing long-running blocking operations in a coroutine, it's in charge of moving the execution off the main thread using `withContext`." (**Read**) kotlinx.coroutines documents cancellation in KDoc with a fixed sentence, as in `delay`: "This suspending function is cancellable: if the [Job] of the current coroutine is cancelled while this suspending function is waiting, this function immediately resumes with [CancellationException]." (**Read (source)**: `Delay.kt:109-112`)

### Verdicts

- Line 133, "Use `/** ... */` KDoc for public and internal API documentation": **holds** for the syntax; no Kotlin source read sets the visibility scope.
- Line 134, "Use `//` for implementation rationale": **holds**.
- Line 135, "Use KDoc tags `@param`, `@return`, `@throws`, `@receiver`, and `@sample`, and reference symbols as `[Symbol]`": **wrong** for `@param` and `@return` under the Kotlin coding conventions, which say to avoid them and write `[parameter]` links in the prose. The AndroidX Compose component guidelines (section 10) require `@param` for each parameter of a component, so the choice depends on the codebase. `@throws` **holds**, with the KDoc caveat that Kotlin has no expectation of documenting every exception; `@Throws` is a different thing, needed only for Java callers. `[Symbol]`, `@receiver` and `@sample` **hold**. **Missing:** `@property`, `@constructor`, `@see`, `@suppress`, and the `@Deprecated` annotation in place of a `@deprecated` tag.
- Line 136, "which dispatcher a `suspend` function expects": **holds only when** the function is not main-safe. Android's best practice is that suspend functions be main-safe, which leaves no dispatcher requirement to document. "how it responds to cancellation" **holds**; kotlinx.coroutines follows it with the fixed "This suspending function is cancellable" sentence.
- Line 137, "Document nullability only where the type system cannot, such as platform types": **holds** (platform types are non-denotable).
- Line 138, "Do not document an override that adds nothing": **holds** by analogy (Google C++; Google Java 7.3.2); no Kotlin source read states it.
- Line 139, "Do not repeat a default value, visibility, or type that the declaration already states": **holds** by analogy (rustdoc on types; LLVM "Avoid restating the information that can be inferred from the API name or signature"); no Kotlin source read states it.
- Formatter interaction: ktfmt refills KDoc paragraphs (section 1), so line 28 does not survive ktfmt.

## 9. Java (lines 141–148)

### What the sources say

- Oracle, "How to Write Doc Comments for the Javadoc Tool": **not accessed**. https://www.oracle.com/technical-resources/articles/java/javadoc-tool.html and https://www.oracle.com/technetwork/java/javase/tech/index-137868.html returned HTTP 403 to WebFetch, and curl was redirected to `/downloads/`. Its claims are not used here.
- JDK 27 Documentation Comment Specification for the Standard Doclet: "Documentation comments containing Markdown are composed of a series of consecutive lines, each beginning with optional whitespace followed by `///`." "The first sentence of the main description should be a summary sentence that contains a concise but complete description of the declared entity." `@throws`: "An unchecked exception class may be omitted from the throws clause, and so won't be considered missing in a method documentation", and "To ensure that all checked exceptions are documented, when a throws tag does not exist for an exception in the throws clause, the standard doclet adds that exception to the generated output (with no description)". The spec defines `@param`, `@return`, `@throws`, `@deprecated`, `{@code}`, `{@link}`, `{@linkplain}`, `{@inheritDoc}` and `{@snippet}`. (**Read**)
- JEP 413, Code Snippets in Java API Documentation: "Introduce an `@snippet` tag for JavaDoc's Standard Doclet"; Status Closed / Delivered, Release 18. JEP 467, Markdown Documentation Comments: "Enable JavaDoc documentation comments to be written in Markdown rather than solely in a mixture of HTML and JavaDoc @-tags"; Status Closed / Delivered, Release 23. (**Read**)
- Google Java Style: 7.1.1 "Both Markdown Javadoc and Traditional Javadoc are acceptable." 7.1.3: block tags "appear in the order `@param`, `@return`, `@throws`, `@deprecated`, and these four types never appear with an empty description." 7.2: the summary "is a fragment—a noun phrase or verb phrase, not a complete sentence ... However, the fragment is capitalized and punctuated as if it were a complete sentence"; and "`/// @return the customer ID.` ... is incorrect, and should be changed to `/// Returns the customer ID.` or `/// {@return the customer ID}.`" 7.3: "At the minimum, Javadoc is present for every visible class, member, or record component", with exceptions for "simple, obvious" members and for overrides. 7.3.4: "Whenever an implementation comment would be used to define the overall purpose or behavior of a class or member, that comment is written as Javadoc instead (using `///` or `/**`)." (**Read**)

### Verdicts

- Line 143, "Use `/** ... */` Javadoc for public and protected API documentation": **holds only when** the codebase targets a JDK before 23 or chooses Traditional Javadoc. Since JDK 23 (JEP 467), `///` Markdown comments are Javadoc too, and Google Java Style accepts both. **Inference:** in a JDK 23+ codebase, a run of `///` lines before a declaration becomes Javadoc whether or not that was intended. The scope is also narrower than Google's: 7.3.4 puts any purpose-of-a-member comment in Javadoc, for non-public members too.
- Line 144, "Use `//` for implementation rationale": **holds**.
- Line 145, `@param`, `@return`, `@throws`, `{@link}`, `{@code}`: **holds**; all are in the JDK spec. **Missing:** `{@snippet}` (JDK 18, JEP 413) for examples; `{@return}`; the required block-tag order; and the summary rule. The JDK spec asks for "a summary sentence", while Google asks for a fragment, which is not the "complete sentence" line 28 assumes.
- Line 146, thread-safety, mutability and ownership of returned collections: **not established**; the Oracle guide was not accessed and no other source read covers it.
- Line 147, "Document unchecked exceptions a caller is expected to handle, alongside the declared checked ones": **holds**. The JDK spec says unchecked exceptions are not added automatically and checked ones are, so unchecked ones appear only if written.
- Line 148, "Do not restate what `@Override`, `@Nullable`, or a functional interface already states": **not established**; consistent with Google Java 7.3.2 on overrides.
- Formatter interaction: google-java-format refills Traditional and Markdown Javadoc to 100 columns by default (section 1), so line 28 does not survive it.

## 10. Android (lines 150–161)

### What the sources say

- Thread annotations: "The following thread annotations are supported: `@MainThread`, `@UiThread`, `@WorkerThread`, `@BinderThread`, `@AnyThread`." "The build tools treat the `@MainThread` and `@UiThread` annotations as interchangeable ... you should annotate methods associated with an app's view hierarchy with `@UiThread` and annotate only methods associated with an app's lifecycle with `@MainThread`." (**Read**: developer.android.com/studio/write/annotations)
- `@RequiresPermission`: "Use the `@RequiresPermission` annotation to validate the permissions of the caller of a method", with `anyOf` and `allOf`; for intents, "place the permission requirement on the string field that defines the intent action name". (**Read**)
- Lint: "add the `@SuppressLint` annotation to that code", or `tools:ignore` in XML. Baselines: "the `lint-baseline.xml` file is created to establish your baseline. From then on, the tools only read the file ... If you want to create a new baseline, manually delete the file and run lint again to re-create it." "Running lint records all the current issues in the `lint-baseline.xml` file." (**Read**: developer.android.com/studio/write/lint)
- AndroidX Compose component API guidelines, Documentation for the component (framework SHOULD, libraries and apps MAY): "Documentation for `@Composable` components should follow JetBrains's ktdoc guidelines", and every component should have "One-liner paragraph summarizing the component", detail paragraphs that may include "`@sample`", "`@see`" and design links, then a "Description for each parameter of the component, starting with `@param paramname`"; documentation for the trailing `content` lambda may be omitted. (**Read**) Compose API guidelines communicate persistence through naming: a factory that `remember`s a mutable object must be prefixed `remember`, because "An object that can change over time and persists across recompositions carries observable side effects that should be clearly communicated to a caller." (**Read**)

### Verdicts

- Line 154, API-level branches: **not established**; no source read covers it.
- Line 155, "Record the requirement behind a permission check or a `@RequiresPermission` annotation": **holds**; no source contradicts it. The annotation states which permission, not why.
- Line 156, "Give every `@SuppressLint` and lint baseline suppression a reason and a removal condition": for `@SuppressLint`, **holds**. For baselines, **holds only when** reasons are kept outside `lint-baseline.xml`. lint writes that file and re-creates it from scratch, and line 161 forbids commenting generated files. **Inference:** a comment added inside the baseline is lost the next time it is re-created. The glob's `**/*.xml` loads this rule for that file (section 12).
- Line 157, lifecycle ownership of coroutines and listeners: **not established**; no source read covers it.
- Line 158, "Document the required thread when no `@MainThread`, `@WorkerThread`, or `@AnyThread` annotation expresses it": **holds**. **Missing:** `@UiThread` and `@BinderThread`, and Android's split between `@UiThread` for view-hierarchy code and `@MainThread` for lifecycle code.
- Line 159, "For a composable, document state ownership, hoisting expectations, and side effects; do not narrate the emitted UI tree": **holds only when** read as an addition to the Compose guideline. The AndroidX guideline prescribes a different structure (one-line summary, details with `@sample` and `@see`, `@param` per parameter) and puts state hoisting in API design and naming, not in documentation.
- Line 160, why a resource value exists: **not established**; no source read covers it.
- Line 161, "Do not comment generated sources": **holds**; it conflicts with line 156 for lint baselines.

## 11. Content and context (lines 37–74)

### What the sources say

- Ousterhout, in his own discussion document with Robert Martin (johnousterhout/aposd-vs-clean-code, September 2024 to February 2025): "there are two major reasons why comments are needed. The first reason for comments is abstraction. Simply put, without comments there is no way to have abstraction or modularity." "It should be possible to use a method without reading its code. The way we achieve this is by writing a header comment that describes the method's *interface* (all the information someone needs in order to invoke the method)." "The second general reason for comments is for important information that is not obvious from the code." (**Read**) The book, *A Philosophy of Software Design*, was **not accessed** (not available online); its chapters on interface and implementation comments are not quoted here.
- Requirements to document public API, by language: Go "Every exported (capitalized) name should have a doc comment"; Rust "the public API of all code should have documentation"; C# "document all publicly visible types and their public members"; Google Java "Javadoc is present for every visible class, member, or record component" except "simple, obvious" members and overrides; Google C++ "Almost every function declaration should have comments ... omitted only if the function is simple and obvious"; LLVM "Include descriptive paragraphs for all public interfaces ... Avoid restating the information that can be inferred from the API name or signature"; kernel "Do not add boilerplate kernel-doc which simply reiterates what's obvious from the signature"; PEP 257 "all functions and classes exported by a module should also have docstrings"; Google Python "A docstring is mandatory for every function that has one or more of the following properties: being part of the public API ...". (**Read**, sections above)
- Against restating code: Google C++ "Do not state the obvious. In particular, don't literally describe what code does"; C++ Core Guidelines NL.1; Google Python "never describe the code"; PEP 8 "Inline comments are unnecessary and in fact distracting if they state the obvious". (**Read**)
- Decoration: Google Java "Comments are not enclosed in boxes drawn with asterisks or other characters"; Google Go "Apart from indentation, decoration should generally be avoided"; LLVM's standard file header is framed by `//===----...----===//` lines; Doxygen documents banner comment blocks. (**Read**)
- TODO formats: Google C++ `// TODO(bug 12345): ...`; Google Java `// TODO: example.com/12345678 - Remove this after ...`; Google Python `# TODO(example.com/12345): ...`, which calls the Java-style form "Old style, formerly recommended, but discouraged for use in new code". Google Java and Google Python say to avoid TODOs that name an individual or team; Google C++ allows a name ("it is almost always your name that is given"). All three ask for "a very specific date ... or a very specific event" in "At a future date do something" TODOs. (**Read**)

### Verdicts

- Line 39, "Add a comment only when it records information the code does not express clearly": **holds only when** "the code" means what a caller sees, the declaration. Read as the function body, it forbids the interface comments that Ousterhout calls the means of abstraction, and that Go (line 103), Java (line 143), C# (line 112) and Rust require. The file's own sections conflict here: line 103 and line 143 require documentation that, for a self-explanatory member, restates the code (line 48). Primary sources resolve it differently: Google Java (7.3.1) and Google C++ exempt "simple, obvious" members; LLVM and the kernel forbid restating the signature; Go asks for a comment on every exported name; Rust asks for documentation on all public API. The rule should name which resolution applies to each language section.
- Lines 41–44, the four kinds of information: **holds**. Google C++ definition comments ("explain why you chose to implement the function in the way you did"), NL.2 ("State intent in comments"), LLVM ("what the code is trying to do and why").
- Line 48, "restate the code": **holds** (sources above), subject to the tension with lines 103 and 143.
- Line 50, "speculate about intent or rationale": **holds**. It does not conflict with NL.2, which asks to state intent. **Inference:** an agent may read "intent" here as forbidding the intent comments NL.2 asks for; "speculate" carries the distinction.
- Line 53, "use decorative separators": **holds only when** the repository does not follow LLVM, whose standard file header is a banner. It matches Google Java and Google Go.
- Line 54, "contain a TODO without a concrete completion condition": **holds** for future-dated TODOs (Google's "very specific date or ... event"). **Missing:** the reference Google requires in every TODO (a bug or link, the main element of all three Google formats), and the fact that the format differs by language.
- Line 58 against line 65: comments "must be understandable from the repository and any references they cite" (line 58) and line 73 allows "a requirement, specification, documented external behavior", while line 65 forbids "information available only outside the repository". LLVM asks for a reference to an external paper; Google C++ shows a TODO linking a design document. Line 65 **holds only when** read as information that is outside the repository and not cited.
- Line 62, "prompts, conversations, users, agents, or models": **Inference:** ambiguous in code whose domain has end users or data and machine-learning models; no primary source applies. Naming the referent ("the user of this conversation", "the language model that generated the change") would remove the ambiguity.
- Lines 72–74, "Do not invent rationale": **holds**; no source contradicts it.

## 12. The `paths:` glob (line 3)

### What the source says

- Claude Code docs, Path-specific rules: "You can specify multiple patterns and use brace expansion to match multiple extensions in one pattern", with the example `"src/**/*.{ts,tsx}"`. "Each brace group multiplies the number of expanded patterns ... a rule's whole `paths` list shares one budget of 1,000 expanded patterns and 4 MiB ... Claude Code uses any pattern that would exceed the budget unexpanded, and its literal braces match no files." "A path-scoped rule loads when Claude uses the Read, Write, or Edit tool on a matching file", or views one with a Bash command that counts as a read. Patterns are relative to the rule's base directory: for project rules, the directory containing `.claude`; for user-level rules, the session's primary working directory. "`paths` is the only field Claude Code reads from a rule". If the frontmatter YAML does not parse, "Claude Code ignores the frontmatter and loads the rule as if it had no `paths`." (**Read**: https://code.claude.com/docs/en/memory.md)

### Verdicts

- Line 3, brace expansion: **holds**. The pattern has one brace group of 29 extensions. **Inference:** it expands to 29 patterns, far under the 1,000 budget.
- **Missing**, extensions for languages the file covers:
  - JavaScript: `.js`, `.jsx`, `.mjs`, `.cjs`. Node: files with `.mjs` "are always loaded as ES modules" and `.cjs` as CommonJS (**Read**: nodejs.org/api/packages.html). TypeScript's `allowJs` lets JavaScript files into a TypeScript project (**Read**: TSConfig `allowJs`). The TypeScript section (lines 84–88) never loads for them.
  - C and C++: GCC treats `.cp`, `.CPP`, `.c++` and `.C` as C++ source, and `.H`, `.hp`, `.HPP`, `.h++` and `.tcc` as C++ headers (**Read**: GCC Overall Options). The glob lists `.cc`, `.cpp`, `.cxx`, `.ixx`, `.cppm`, `.inl`, `.ipp`, `.h`, `.hh`, `.hpp`, `.hxx` but none of those. Whether `paths:` matching is case-sensitive, which decides `.C` and `.H`, is not stated (see Could not confirm).
  - Python, Rust, Go, C#, Kotlin and Java: no omitted extension was checked against a primary source.
- `**/*.xml` (line 3): **Inference:** it matches every XML file, not only Android resources: `pom.xml`, IDE metadata, test reports, and the generated `lint-baseline.xml`. The whole rule, including the Python and Go sections, loads for each of them, and line 160 is the only guidance that applies to XML.
- Line 19 and line 110: the Contents entry "C" has no section, and the C# section is missing from the Contents (section 7).

## Could not confirm

- **Oracle, "How to Write Doc Comments for the Javadoc Tool":** **not accessed**; https://www.oracle.com/technical-resources/articles/java/javadoc-tool.html and https://www.oracle.com/technetwork/java/javase/tech/index-137868.html returned HTTP 403 to WebFetch, and curl was redirected to https://www.oracle.com/downloads/. Lines 146 and 148 are therefore unchecked against Oracle's guide. A search-result summary of the page was seen but not used.
- ***A Philosophy of Software Design* (Ousterhout, 2nd ed.):** **not accessed**; the book is not online. Only Ousterhout's own GitHub discussion document was used.
- **Case sensitivity of `paths:` matching:** the Claude Code memory page does not say whether `*.C` and `*.c` are different patterns.
- **`GenerateDocumentationFile` default:** the MSBuild property entry states no default. That the compiler checks `<param>` names and `cref` targets only when documentation generation is on was not confirmed.
- **clang-format reflow detail:** whether `ReflowComments: Always` also joins the remainder of a broken line with the next comment line was not established from the docs or the source.
- **detekt `excludeCommentStatements`:** whether "comment statements" includes KDoc was not established.
- **gofmt line length:** that gofmt has no line-length option was inferred from go.dev/doc/comment; the `cmd/gofmt` flag list was not opened.
- **Checkstyle defaults:** Checkstyle's bundled `sun_checks.xml` and `google_checks.xml` were not read, so the line limit a typical Checkstyle setup applies was not established.
- **rustfmt on stable:** that unstable options such as `wrap_comments` need a nightly toolchain was not checked in this session.
- **pydoc and `help()` rendering of docstring line breaks:** not checked; the statement in section 1 is inference.
- **Claims with no primary source found:** line 115, line 117, line 125 (invalidation and units), line 126, line 127, line 146, line 148, line 154, line 157 and line 160.

## Sources

All accessed 2026-11-06. **R** = read, **R-src** = source code read at the commit shown, **NA** = not accessed.

### Python

| # | Source | URL | Status |
|---|---|---|---|
| 1 | Ruff rule E501 line-too-long | https://docs.astral.sh/ruff/rules/line-too-long/ | R |
| 2 | Ruff rule W505 doc-line-too-long | https://docs.astral.sh/ruff/rules/doc-line-too-long/ | R |
| 3 | Ruff settings (`line-length`, `max-line-length`, `max-doc-length`, `ignore-overlong-task-comments`, `pydocstyle.convention`) | https://docs.astral.sh/ruff/settings/ | R |
| 4 | Ruff Default Rules | https://docs.astral.sh/ruff/default-rules/ | R |
| 5 | Ruff rules index | https://docs.astral.sh/ruff/rules/ | R |
| 6 | Ruff linter (rule selection, categories) | https://docs.astral.sh/ruff/linter/ | R |
| 7 | Ruff formatter | https://docs.astral.sh/ruff/formatter/ | R |
| 8 | Ruff rule D200 | https://docs.astral.sh/ruff/rules/unnecessary-multiline-docstring/ | R |
| 9 | Ruff rule D205 | https://docs.astral.sh/ruff/rules/missing-blank-line-after-summary/ | R |
| 10 | Ruff rule D209 | https://docs.astral.sh/ruff/rules/new-line-after-last-paragraph/ | R |
| 11 | Ruff rule D400 | https://docs.astral.sh/ruff/rules/missing-trailing-period/ | R |
| 12 | Ruff source, `crates/ruff_linter/src/rules/pydocstyle/` (`rules/one_liner.rs`, `rules/blank_after_summary.rs`, `rules/ends_with_period.rs`, `helpers.rs`), main at `0b35b699e5cc2aae7d0062c4b88f68f13ef389ee`; latest release 0.17.4 (2026-11-05) | https://github.com/astral-sh/ruff/tree/main/crates/ruff_linter/src/rules/pydocstyle | R-src |
| 13 | Black, The Black code style | https://black.readthedocs.io/en/stable/the_black_code_style/current_style.html | R |
| 14 | PEP 257, Docstring Conventions | https://peps.python.org/pep-0257/ | R |
| 15 | PEP 8, Style Guide for Python Code | https://peps.python.org/pep-0008/ | R |
| 16 | Google Python Style Guide | https://google.github.io/styleguide/pyguide.html | R |

### C and C++

| # | Source | URL | Status |
|---|---|---|---|
| 17 | Clang-Format Style Options (`BasedOnStyle`, `ColumnLimit`, `CommentPragmas`, `ReflowComments`) | https://clang.llvm.org/docs/ClangFormatStyleOptions.html | R |
| 18 | clang-format source, `clang/lib/Format/Format.cpp`, last changed in `1139ef809b76519c013f660b89d120c7757edb15` (2026-11-04) | https://github.com/llvm/llvm-project/blob/main/clang/lib/Format/Format.cpp | R-src |
| 19 | Google C++ Style Guide (Comments, Line Length) | https://google.github.io/styleguide/cppguide.html | R |
| 20 | LLVM Coding Standards (Commenting, Source Code Width) | https://llvm.org/docs/CodingStandards.html | R |
| 21 | C++ Core Guidelines (NL.1–NL.3, NL.27) | https://github.com/isocpp/CppCoreGuidelines/blob/master/CppCoreGuidelines.md | R |
| 22 | Doxygen manual, Documenting the code | https://www.doxygen.nl/manual/docblocks.html | R |
| 23 | Linux kernel, Writing kernel-doc comments | https://docs.kernel.org/doc-guide/kernel-doc.html | R |
| 24 | Linux kernel coding style | https://docs.kernel.org/process/coding-style.html | R |
| 25 | GCC manual, C++ Style Comments | https://gcc.gnu.org/onlinedocs/gcc/C_002b_002b-Comments.html | R |
| 26 | GCC manual, Options Controlling the Kind of Output (file suffixes) | https://gcc.gnu.org/onlinedocs/gcc/Overall-Options.html | R |

### Rust

| # | Source | URL | Status |
|---|---|---|---|
| 27 | rustfmt Configurations (`wrap_comments`, `comment_width`, `max_width`, `error_on_line_overflow`, `format_code_in_doc_comments`, `normalize_comments`) | https://github.com/rust-lang/rustfmt/blob/main/Configurations.md | R |
| 28 | Rust Style Guide (Comments, Doc comments) | https://github.com/rust-lang/rust/blob/main/src/doc/style-guide/src/README.md | R |
| 29 | rustdoc book, How to write documentation | https://doc.rust-lang.org/rustdoc/how-to-write-documentation.html | R (Markdown source in rust-lang/rust) |
| 30 | rustdoc book, Documentation tests | https://doc.rust-lang.org/rustdoc/write-documentation/documentation-tests.html | R (Markdown source in rust-lang/rust) |
| 31 | Cargo, `cargo test` | https://doc.rust-lang.org/cargo/commands/cargo-test.html | R |
| 32 | Rust API Guidelines, Documentation | https://rust-lang.github.io/api-guidelines/documentation.html | R (Markdown source in rust-lang/api-guidelines) |
| 33 | Clippy source, `clippy_lints/src/doc/mod.rs`, master at `32a833324c16a86f61c8c47ec15674f1e862b749` | https://github.com/rust-lang/rust-clippy/blob/master/clippy_lints/src/doc/mod.rs | R-src |
| 34 | Clippy README (lint groups and default levels) | https://github.com/rust-lang/rust-clippy/blob/master/README.md | R |

### Go

| # | Source | URL | Status |
|---|---|---|---|
| 35 | Go Doc Comments | https://go.dev/doc/comment | R |
| 36 | Go 1.19 Release Notes (Doc Comments) | https://go.dev/doc/go1.19 | R |
| 37 | Go Code Review Comments | https://go.dev/wiki/CodeReviewComments | R |
| 38 | Effective Go, Commentary | https://go.dev/doc/effective_go | R |
| 39 | Go blog, Godoc: documenting Go code (Andrew Gerrand, 31 March 2011) | https://go.dev/blog/godoc | R |
| 40 | Go blog, Working with Errors in Go 1.13 (Damien Neil and Jonathan Amsterdam, 17 October 2019) | https://go.dev/blog/go1.13-errors | R |
| 41 | Google Go Style Guide, Style Decisions (Commentary) | https://google.github.io/styleguide/go/decisions | R |

### Java and Kotlin

| # | Source | URL | Status |
|---|---|---|---|
| 42 | Oracle, How to Write Doc Comments for the Javadoc Tool | https://www.oracle.com/technical-resources/articles/java/javadoc-tool.html | NA (HTTP 403) |
| 43 | Oracle, same article, older URL | https://www.oracle.com/technetwork/java/javase/tech/index-137868.html | NA (HTTP 403) |
| 44 | JDK 27 Documentation Comment Specification for the Standard Doclet | https://docs.oracle.com/en/java/javase/27/docs/specs/javadoc/doc-comment-spec.html | R |
| 45 | JEP 413, Code Snippets in Java API Documentation | https://openjdk.org/jeps/413 | R |
| 46 | JEP 467, Markdown Documentation Comments | https://openjdk.org/jeps/467 | R |
| 47 | Google Java Style Guide | https://google.github.io/styleguide/javaguide.html | R |
| 48 | google-java-format README | https://github.com/google/google-java-format/blob/master/README.md | R |
| 49 | google-java-format source (`UsageException.java`, `JavaCommentsHelper.java`, `javadoc/JavadocLexer.java`, `javadoc/JavadocWriter.java`, `javadoc/JavadocFormatter.java`), master at `98daeb0f804a82e9a28ebe7f4c0859fa4a866f99` | https://github.com/google/google-java-format/tree/master/core/src/main/java/com/google/googlejavaformat/java | R-src |
| 50 | Checkstyle LineLength (Checkstyle 14.4.0 docs) | https://checkstyle.org/checks/sizes/linelength.html | R |
| 51 | Kotlin coding conventions, Documentation comments | https://kotlinlang.org/docs/coding-conventions.html | R |
| 52 | Kotlin, Document Kotlin code: KDoc | https://kotlinlang.org/docs/kotlin-doc.html | R |
| 53 | Kotlin, Calling Kotlin from Java (`@Throws`) | https://kotlinlang.org/docs/java-to-kotlin-interop.html | R |
| 54 | Kotlin, Calling Java from Kotlin (platform types) | https://kotlinlang.org/docs/java-interop.html | R |
| 55 | kotlinx.coroutines source, `kotlinx-coroutines-core/common/src/Delay.kt` | https://github.com/Kotlin/kotlinx.coroutines/blob/master/kotlinx-coroutines-core/common/src/Delay.kt | R-src |
| 56 | ktfmt README | https://github.com/Kotlin/ktfmt/blob/main/README.md | R |
| 57 | ktfmt source (`format/FormattingOptions.kt`, `kdoc/KDocCommentsHelper.kt`, `kdoc/KDocFormattingOptions.kt`, `kdoc/Paragraph.kt`, `kdoc/KDocFormatter.kt`), main at `d580286ee53e20915e3eab255612c2b6274f7d8f` | https://github.com/Kotlin/ktfmt/tree/main/core/src/main/kotlin/org/jetbrains/kotlinx/ktfmt | R-src |
| 58 | ktlint standard rules, Max line length | https://ktlint.github.io/ktlint/latest/rules/standard/ | R (the old https://pinterest.github.io/ktlint/latest/rules/standard/ returned HTTP 404) |
| 59 | ktlint source, `MaxLineLengthRule.kt`, master at `9ec0867cb7eeb9cf370bb9d7563cbbe4fc547e9d` | https://github.com/ktlint/ktlint/blob/master/ktlint-ruleset-standard/src/main/kotlin/io/github/ktlint/core/ruleset/standard/rules/MaxLineLengthRule.kt | R-src |
| 60 | detekt Style rule set, MaxLineLength (2.0.0-alpha.6 and 1.23.8) | https://detekt.dev/docs/rules/style and https://detekt.dev/docs/1.23.8/rules/style | R |

### TypeScript and JavaScript

| # | Source | URL | Status |
|---|---|---|---|
| 61 | TSDoc, What is TSDoc, Approach, Standardization groups | https://tsdoc.org/ , https://tsdoc.org/pages/intro/approach , https://tsdoc.org/pages/spec/standardization_groups | R |
| 62 | TSDoc tag pages `@param`, `@returns`, `@remarks`, `@throws`, `@deprecated`, `@example` | https://tsdoc.org/pages/tags/param (and siblings under /pages/tags/) | R |
| 63 | TSDoc parser source, `tsdoc/src/parser/TSDocMessageId.ts` and `NodeParser.ts`, main at `76dcd8ea88e492b21657a22bf8afc4b600e6bfdf` | https://github.com/microsoft/tsdoc/tree/main/tsdoc/src/parser | R-src |
| 64 | TypeScript handbook, JSDoc Reference | https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html | R |
| 65 | TSConfig reference, `allowJs` | https://www.typescriptlang.org/tsconfig/allowJs.html | R |
| 66 | Node.js, Packages (`.mjs`, `.cjs`) | https://nodejs.org/api/packages.html | R |
| 67 | Prettier, Rationale (Comments) | https://prettier.io/docs/rationale | R |
| 68 | Prettier, Options (`printWidth`, `proseWrap`) | https://prettier.io/docs/options | R |
| 69 | Biome, Configuration reference (`formatter.lineWidth`) | https://biomejs.dev/reference/configuration/ | R |
| 70 | Biome source, `crates/biome_js_formatter/src/comments.rs` and `crates/biome_formatter/src/comments.rs`, main at `2987b54ef12d6949fefe97363fd8df8bedfa34f9` | https://github.com/biomejs/biome/tree/main/crates | R-src |

### C# and .NET

| # | Source | URL | Status |
|---|---|---|---|
| 71 | XML documentation comments (C#) | https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/xmldoc/ | R |
| 72 | Recommended XML tags for C# documentation comments | https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/xmldoc/recommended-tags | R |
| 73 | Compiler Warning (level 4) CS1591 | https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/compiler-messages/cs1591 | R |
| 74 | MSBuild reference for .NET SDK projects, `GenerateDocumentationFile` | https://learn.microsoft.com/en-us/dotnet/core/project-sdk/msbuild-props | R |
| 75 | Nullable reference types (C#) | https://learn.microsoft.com/en-us/dotnet/csharp/nullable-references | R |
| 76 | dotnet/runtime, API guidelines: Nullability | https://github.com/dotnet/runtime/blob/main/docs/coding-guidelines/api-guidelines/nullability.md | R |
| 77 | `dotnet format` | https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-format | R |
| 78 | C# formatting options | https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/style-rules/csharp-formatting-options | R |

### Android

| # | Source | URL | Status |
|---|---|---|---|
| 79 | Improve code inspection with annotations (thread and permission annotations) | https://developer.android.com/studio/write/annotations | R |
| 80 | Improve your code with lint checks (`@SuppressLint`, baselines) | https://developer.android.com/studio/write/lint | R |
| 81 | Best practices for coroutines in Android | https://developer.android.com/kotlin/coroutines/coroutines-best-practices | R |
| 82 | AndroidX, Compose component API guidelines, last changed in `142d6944c83ecf9113c40dfec3ad3cf335b4e067` (2026-08-12) | https://github.com/androidx/androidx/blob/androidx-main/compose/docs/compose-component-api-guidelines.md | R |
| 83 | AndroidX, Compose API guidelines | https://github.com/androidx/androidx/blob/androidx-main/compose/docs/compose-api-guidelines.md | R |

### General

| # | Source | URL | Status |
|---|---|---|---|
| 84 | Semantic Line Breaks | https://sembr.org/ | R |
| 85 | Ousterhout and Martin, A Philosophy of Software Design vs Clean Code | https://github.com/johnousterhout/aposd-vs-clean-code/blob/main/README.md | R |
| 86 | Ousterhout, A Philosophy of Software Design, 2nd ed. | (book) | NA (not online) |
| 87 | Claude Code, Store instructions and memories (Path-specific rules) | https://code.claude.com/docs/en/memory | R (Markdown variant at https://code.claude.com/docs/en/memory.md) |
