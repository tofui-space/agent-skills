# Presenting a gate-map report: primary-source research

| | |
|---|---|
| Date | 2026-10-23. Every web source was fetched on this date. |
| Mermaid | Source at tag `mermaid@11.15.0` of `mermaid-js/mermaid` (raw files from GitHub): `packages/mermaid/src/schemas/config.schema.yaml`, `src/setupGraphViewbox.js`, `src/rendering-util/setupViewPortForSVG.ts`, `src/docs/syntax/flowchart.md`, `src/docs/syntax/sequenceDiagram.md`, `src/docs/config/configuration.md`. Context7 `/mermaid-js/mermaid` was queried first and agreed with the source. `mermaid.js.org` did not resolve from this machine, so the docs were read from the repository's `src/docs` folder instead. |
| JetBrains IDE | IntelliJ IDEA **2026.2.3**, build `262.10968.63` (`Contents/Resources/product-info.json`). Bundled plugin `com.intellij.mermaid` version `262.10968.63` (`plugins/mermaid/lib/mermaid.jar`, `META-INF/plugin.xml`). Its preview script `com/intellij/mermaid/markdown/jcef/mermaid.js` contains Mermaid **11.15.0**. The bundled Markdown stylesheet is `plugins/markdown/lib/intellij.markdown.jar!/org/intellij/plugins/markdown/extensions/common/baseStyles/default.css`. The Markdown preview source is `JetBrains/intellij-community` at tag `idea/262.10968.63`. The help page is "Markdown", IntelliJ IDEA 2026.2 Help. |
| GitHub | The Mermaid renderer is `viewscreen.githubusercontent.com/markdown/mermaid`, script `mermaidMarkdown-5b99bd9a2037271fa4cf.js`. It passes version **12.2.0** to the renderer. The page stylesheet is `primer-38ae573fa780d76a.css` on `github.githubassets.com`. The `github/markup` README is at commit `4f40faf` (2026-10-19). Docs come from docs.github.com. All of these were served on 2026-10-23 and can change without notice. |
| GitLab | `gitlab-org/gitlab` `master` at `e3654f11532ac8f11841dd4da5a4d25796a0bb0f` (2026-10-23): `package.json`, `doc/user/markdown.md`, `app/assets/javascripts/behaviors/markdown/render_sandboxed_mermaid.js`, `app/assets/javascripts/lib/mermaid_sandbox.js`. |
| Research | Cowan 2001 (BBS 24:87–114); Larkin & Simon 1987 (Cognitive Science 11:65–100); Vessey 1991 (Decision Sciences 22:219–240); Ghoniem, Fekete & Castagliola 2004 (InfoVis, pp. 17–24) and 2005 (Information Visualization 4(2):114–135); Okoe, Jianu & Kobourov 2019 (IEEE TVCG 25(10):2940–2952); Yoghourdjian et al. 2018 (Visual Informatics 2(4):264–282, arXiv 1809.00270); Legge & Bigelow 2011 (Journal of Vision 11(5):8). The abstracts for Cowan, Larkin & Simon, Vessey and both Ghoniem papers were read through Europe PMC and OpenAlex. The full texts of Okoe et al. and Yoghourdjian et al. were read. The full text of Ghoniem et al. could not be downloaded, because the archive's bot protection blocked it. |
| Accessibility | W3C WCAG 2.2 Recommendation (12 December 2024) and its Understanding documents for 1.4.8 and 1.4.10. W3C "Making Content Usable for People with Cognitive and Learning Disabilities" (COGA), Working Group Note, 29 April 2021. W3C CSS Values and Units Level 4, §6.2. |

In this file, **Source:** marks what a primary source says or what its code does, and **Inference:** marks reasoning that goes beyond it. A measurement taken in a lab is reported with its conditions, and any design rule drawn from it is marked as Inference.

## Summary

| # | Claim | Verdict | Primary citation |
|---|---|---|---|
| 1 | The reader can hold only a handful of items in mind, so the gaps must be listed, not reconstructed from a list of checks | **Supported, with limits.** The measured limit is about 4 chunks in short-term memory tasks, not in reading a report. | Cowan 2001, abstract; COGA §4.7.5, §4.6.3 |
| 2 | The answer (the gaps) belongs at first glance; the detail can be one step away | **Supported** by W3C guidance. This is guidance, not a measurement. | COGA §4.3.4, §4.4.8; WCAG 2.2 SC 2.4.6 |
| 3 | A matrix (need × stage) beats a flowchart for "which protection exists at which stage" | **Supported by analogy.** Matrices won on most lookup tasks above 20 vertices, and node-link diagrams won on path tasks. A need × stage table is not an adjacency matrix. | Ghoniem et al. 2004/2005, abstracts; Okoe et al. 2019, conclusion |
| 4 | Order and timing findings suit a diagram | **Supported by analogy.** Path and connectivity tasks favoured node-link diagrams in both studies, and diagrams help where information is indexed by location. | Ghoniem et al. abstract; Okoe et al., conclusion; Larkin & Simon 1987 |
| 5 | The JetBrains preview shrinks a Mermaid flowchart to the pane width | **Confirmed from code.** Flowchart `useMaxWidth` defaults to `true`, and the plugin overrides only the theme. | `config.schema.yaml:366-372`; `setupGraphViewbox.js:23-33`; plugin `mermaid.js` |
| 6 | GitHub shrinks Mermaid diagrams the same way, but offers zoom and pan | **Confirmed from served code.** It runs Mermaid 12.2.0 in an iframe, with Zoom in/out, Pan and Reset buttons. | viewscreen `mermaidMarkdown-*.js`, `mermaid-*.css` |
| 7 | GitLab shrinks Mermaid diagrams to the width | **Confirmed from code.** It sets `flowchart.useMaxWidth: true` explicitly and puts the diagram in an iframe with `width: '100%'`. It also refuses diagrams over 2,000 characters until the reader clicks. | `mermaid_sandbox.js:76-97`; `render_sandboxed_mermaid.js:29-35,117,205-212` |
| 8 | `<details>`/`<summary>` works on all three | **Confirmed** for GitHub and GitLab by their docs. **Confirmed from code only** for JetBrains, where no tag filter exists. It was not tested visually. | GitHub docs; `doc/user/markdown.md:2456,2512`; `IncrementalDOMBuilder.kt:56-61` |
| 9 | A wide table makes the page scroll sideways | **False** for GitHub and JetBrains: the table scrolls inside itself. **Not established** for GitLab. | `primer-*.css` `.markdown-body table`; `default.css:377-385` |
| 10 | A Markdown report can control its line length and diagram scale | **Mostly false.** GitHub strips inline styles. The only per-diagram lever is Mermaid frontmatter `config`, which can set `useMaxWidth: false` (overflow instead of shrinking). | `github/markup` README l.7; `configuration.md:12-14` |
| 11 | A self-contained HTML report renders where the Markdown report renders | **False** for the repository file views of GitHub and GitLab. HTML needs Pages, a job artifact or a local browser. | GitHub docs "Working with non-code files"; GitLab Pages docs |

---

## 1. What the reader needs

### 1.1 The reader's tasks

**Inference.** The reader of a gate map has four tasks, in this order:

1. Find the gaps: which needs are not guaranteed before they are relied on.
2. Judge severity: what happens to a request, a deploy or a merge when the gap is hit.
3. Decide fixes: where a gate would have to go.
4. Verify the claims: open the `file:line` behind each step.

Tasks 1 and 2 are done by everyone who opens the report. Tasks 3 and 4 are done by the person who takes a fix. The failed report served task 4 (a complete list of checks) and made task 1 depend on reading all of it.

### 1.2 Working-memory capacity

**Source.** Cowan 2001, abstract (Behavioral and Brain Sciences 24(1):87–114, doi:10.1017/S0140525X01003922): "A single, central capacity limit averaging about four chunks is implicated". The paper says Miller's "seven" was "more as a rough estimate and a rhetorical device than as a real capacity limit". The limit is observed under specific conditions: "when information overload limits chunks to individual stimulus items", when "steps are taken specifically to block the recording of stimulus items into larger chunks", in "performance discontinuities", and in "indirect effects".

**What it measured.** Cowan's paper is a review of short-term memory experiments (span, recall and attention tasks), not of reading documents or using tables.

**Inference.** To find a gap in a 21-row, 7-column checks table, the reader must keep in mind, for each need, which rows protect it and at which stage. That goes well beyond four separate items, unless the report does the grouping itself. Cowan's figure does not give a document rule such as "show four gaps". It supports a weaker rule: the report should do the combining (need, stage, outcome) itself, so the reader compares at most a few items at a time.

### 1.3 Guidance on the first glance and the step beyond

**Source.** COGA, Working Group Note, 29 April 2021 (https://www.w3.org/TR/coga-usable/):
- §4.3.4 "Make it easy to find the most important actions and information on the page". User need: "I need to reach important information and the controls I need without scrolling or carrying out other actions." What to do: "Make key content visually stand out. Key content should be visible to users without needing to scroll the page".
- §4.4.8 "Provide Summary of Long Documents and Media". What to do: "Provide a brief summary for a long document and media."
- §4.6.3 "Avoid Too Much Content". What to do: "Keep the interface simple. Provide users with five or less main choices on each screen and remove unnecessary content."
- §4.7.5 "Do Not Rely on Users Calculations or Memorizing Information". It says "each step in a process must contain the information needed to allow a user to proceed" and "Many users have an impaired working memory. They cannot remember many details at the same time."
- §4.3.5 "Break Media into Chunks": "Using a clear, logical structure, with headings allows users to orient and navigate through the content easily".

**What it is.** COGA is design guidance from a W3C task force, based on user needs. It is not an experiment, and the "five or less" figure in §4.6.3 has no cited measurement in the text that was read.

**Source.** WCAG 2.2 (W3C Recommendation, 12 December 2024, https://www.w3.org/TR/WCAG22/):
- SC 2.4.6 Headings and Labels (AA): "Headings and labels describe topic or purpose."
- SC 2.4.10 Section Headings (AAA): "Section headings are used to organize the content."
- SC 1.4.1 Use of Color (A): "Color is not used as the only visual means of conveying information…"
- SC 1.1.1 Non-text Content (A): "All non-text content that is presented to the user has a text alternative that serves the equivalent purpose…"

**Inference.** For this report:
- At first glance: one verdict sentence and the gap list, with one line per gap naming the need, the class and the effect.
- One step away (a heading or a link): one block per finding with its sequence and evidence.
- Two steps away (collapsed): the per-check inventory.

Each finding block must restate its need and effect, so the reader does not have to carry them over from the summary (COGA §4.7.5). A class shown by colour must also be written as a word (SC 1.4.1). A diagram must have a text equivalent (SC 1.1.1), and the finding's step list already is one.

### 1.4 Tables versus graphics, by task type

**Source.** Vessey 1991, abstract (Decision Sciences 22(2):219–240): "graphical representations emphasize spatial information, while tables emphasize symbolic information"; performance is enhanced "when graphs support spatial tasks and when tables support symbolic tasks".

**What it is.** A theory checked against previously published studies ("validated by its success in explaining the results of published studies"). It is not a new experiment.

**Source.** Larkin & Simon 1987, abstract (Cognitive Science 11(1):65–100): in diagrammatic representations "information is organized by location, and often much of the information needed to make an inference is present and explicit at a single location", and the most important differences are "in the efficiency of search for information and in the explicitness of information".

**What it is.** A computational analysis of worked problems in mathematics and physics, not a user study.

**Inference.**
- "Is need N guaranteed at stage S, and how?" is a symbolic lookup, so it suits a table.
- "Does the request arrive before the migration finishes?" is about order between processes, so it suits a picture of time.

Larkin and Simon's point about locality argues for putting the need, the stage and the outcome in one cell. That is exactly what the need × stage table does and what the 21-row checks table did not do.

---

## 2. Choosing the visualization

### 2.1 Matrix versus node-link: Ghoniem, Fekete and Castagliola

**Source.** InfoVis 2004, pp. 17–24, doi:10.1109/INFVIS.2004.1, abstract (OpenAlex record): "when graphs are bigger than twenty vertices, the matrix-based visualization performs better than node-link diagrams on most tasks. Only path finding is consistently in favor of node-link diagrams throughout the evaluation." The journal version (Information Visualization 4(2):114–135, doi:10.1057/palgrave.ivs.9500092) has the same finding: "the matrix-based visualization outperforms node-link diagrams on most tasks".

**Conditions.** Seven generic tasks were tested, on synthetic graphs of 20, 50 and 100 nodes at densities 0.2, 0.4 and 0.6, with interactive visualizations in which nodes could be selected and highlighted. These conditions come from the related-work section of Okoe et al. 2019, which describes the study. The original full text could not be opened, so they are second-hand.

### 2.2 Matrix versus node-link: Okoe, Jianu and Kobourov

**Source.** IEEE TVCG 25(10):2940–2952, 2019, author copy at NSF PAR `10179526`. Conclusion section: "N L is better than AM for questions about network topology, connectivity, and memorability tasks, while AM outperforms N L for group tasks. These findings apply to visualizing datasets similar to the ones we evaluated, provided a similar interaction set."

**Conditions.** 864 crowdsourced participants answered 14 task types on two real networks (258 nodes / 1,090 edges, and 332 nodes / 2,126 edges), with interactive versions of both encodings, including zoom and pan (study design and conclusion sections).

**Limits.** The authors limit the results to similar data and the same interactions. The networks were far larger than a gate map.

### 2.3 How large the tested graphs were

**Source.** Yoghourdjian et al. 2018 (Visual Informatics 2(4):264–282; arXiv 1809.00270) surveyed 152 empirical studies on graph visualization. Of these, 121 of 152 used graphs with 100 nodes or less (section on graph size), and 119 used graphs with density below 10%. The survey says that, following Bae and Watson and Ghoniem et al., "it is reasonable to use node-link diagrams for path-finding purposes when the graph is less than 200 nodes."

**What it is.** A survey that counts the conditions of other studies. It does not measure readability itself.

### 2.4 What none of these studies covered

**Inference.**
- None of the studies tested a static picture shrunk to a few pixels. Okoe et al. gave participants zoom and pan, and Ghoniem et al. used interactive views. The failure of the previous report was a rendering failure (the text was illegible) and came before any of the measured effects.
- A need × stage table is not an adjacency matrix. It is a two-attribute lookup with 4–8 rows and 3 columns. The matrix result transfers only in this sense: cell lookup tasks favoured the grid.
- The finding that path tasks favour node-link diagrams transfers to timing findings. Those are about the order of events across a few actors, which is what a sequence diagram shows.

### 2.5 The three forms compared

| Form | Fits | Fails |
|---|---|---|
| Flowchart / graph | order and paths across a few actors (§2.1, §2.2) | lookup of "is X protected at stage Y"; legibility once shrunk (§3, §4) |
| Matrix / table | cell lookup and group comparison (§2.1, §2.2, §1.4) | wide tables on phones (§4.3) |
| List | reflows at any width (§4); one item per gap (§1.3) | comparing across stages: the reader rebuilds the grid (§1.2) |

**Inference.** The table above combines the sources cited in its rows. No single study compared all three forms for this task.

---

## 3. Rendering facts for where the report is read

### 3.1 Mermaid sizing

**Source.**
- `config.schema.yaml:366-372` (BaseDiagramConfig): "When this flag is set to `true`, the height and width is set to 100% and is then scaled with the available space. If set to `false`, the absolute space required is used." Default `true`.
- `setupGraphViewbox.js:23-33`: when `useMaxWidth` is true, the SVG gets `width="100%"` and `style="max-width: <natural width>px"`; otherwise it gets fixed `height` and `width`. `setupViewPortForSVG.ts:5-26` applies this to flowcharts and sets the `viewBox`.

**Inference.** With `useMaxWidth: true`, a diagram never grows above its natural size, but it shrinks without limit to fit a narrower container. All text inside the SVG shrinks by the same factor. This is the mechanism behind the few-pixel text in the failed report.

**Source.** Flowchart defaults in `config.schema.yaml`:
- `diagramPadding` 8 (l.2175).
- `nodeSpacing` 50 (l.2190): "Pertains to horizontal spacing for TB … and the vertical spacing for LR".
- `rankSpacing` 50 (l.2199): "Pertains to horizontal spacing for TB … and the vertical spacing for LR".
- `wrappingWidth` 200 (l.2239): "Width of nodes where text is wrapped."
- Global `fontSize` 16 (l.345-347).

**Inference.** The schema's wording for `rankSpacing` looks swapped: ranks run left to right in an LR graph, so the gap between ranks is horizontal there. Whichever way it is worded, an LR flowchart's width grows with the number of ranks, and a TB flowchart's width grows with the number of nodes in the widest rank.

**Source.** Sequence diagram defaults in `config.schema.yaml`: `diagramMarginX` 50 (l.2020), `actorMargin` 50 (l.2030), actor `width` 150 (l.2035), `wrap` false (l.2120), `mirrorActors` true (l.2056). The syntax doc table (`sequenceDiagram.md:838+`) lists `mirrorActors` as `false`, which contradicts the schema. The schema is the code's source of defaults.

**Source.** Direction: `flowchart.md:79-104` gives `TB`/`TD`, `BT`, `RL`, `LR`. `flowchart.md:946-990`: subgraphs can set `direction`, but "If any of a subgraph's nodes are linked to the outside, subgraph direction will be ignored."

**Source.** Overrides per diagram: `configuration.md:12-14`: "The entire mermaid configuration (except the secure configs) can be overridden by the diagram author in the frontmatter of the diagram." The default `secure` list (`config.schema.yaml:236-248`) does not include `useMaxWidth`. A site's `initialize` call can extend it; GitHub's call lists only `secure`, `securityLevel`, `startOnLoad` and `maxTextSize` (§3.3).

**Inference.** A report can write `config: { flowchart: { useMaxWidth: false } }` in a diagram's frontmatter to keep its natural size. The diagram then overflows its container instead of shrinking. This was not tested on any renderer.

### 3.2 JetBrains IDE Markdown preview (IntelliJ IDEA 2026.2.3)

**Source.**
- Help page "Markdown" (IntelliJ IDEA 2026.2): "The Markdown editor can render diagrams defined with Mermaid and PlantUML." and "This functionality relies on the Mermaid plugin, which is bundled and enabled in IntelliJ IDEA by default."
- Bundled plugin `com.intellij.mermaid` 262.10968.63. Its preview script contains Mermaid's `info` diagram version string `11.15.0`.
- The plugin's initialization code (minified, from Kotlin `MermaidInitializationManager`) builds `He={}; He.theme=$e; …initialize(He)`. It sets the theme only and passes no `useMaxWidth`.
- The plugin's `mermaid.css` sets `.mermaid > svg { display: block; margin-left: auto; margin-right: auto; }`.

**Inference.** In the IDE preview, a flowchart uses the default `useMaxWidth: true` and is scaled down to the preview pane's width. This matches the failure that was observed. No zoom control for Mermaid inside the Markdown preview was found in the plugin's preview script. The help page names only a preview font-size setting and custom CSS, and neither scales SVG text proportionally.

**Source.** Preview stylesheet `default.css`:
- l.38-46: `body { font-size: 14px; line-height: 1.6; word-wrap: break-word; margin: 0 2em; }`. There is no `max-width`.
- l.377-385: `table { display: block; width: 100%; overflow: auto; … }`.

**Source.** HTML handling:
- `MarkdownUtil.kt` (`generateMarkdownHtml`) renders with the GFM flavour of `org.intellij.markdown`.
- `IncrementalDOMBuilder.kt:56-61` (`ensureCorrectTag`) renames only `body` to `div` and passes every other tag through.
- `PreviewStaticServer.kt:83-89` sets a Content Security Policy: `default-src 'none'; script-src <listed scripts>; style-src https: … 'unsafe-inline'; … child-src 'none'`.

**Inference.**
- `<details>`/`<summary>` reach the Chromium preview unchanged and should work natively. This was not checked visually.
- Inline scripts in a report cannot run, because only the listed script URLs are allowed.
- Line length is unbounded: on a wide pane, the text runs the full pane width.
- A wide table scrolls sideways inside itself, not the page.

### 3.3 GitHub

**Source.** Docs, "Creating diagrams" (docs.github.com/…/creating-diagrams): Mermaid renders "in GitHub Issues, GitHub Discussions, pull requests, wikis, and Markdown files". To learn the version, the reader writes a Mermaid block containing only `info`. The docs state no version number.

**Source.** Served code on 2026-10-23:
- Markdown containing Mermaid produces `<section … data-host="https://viewscreen.githubusercontent.com" data-type="mermaid" aria-label="mermaid rendered output container">`. The diagram renders in an iframe from that host.
- The viewscreen script calls the renderer with version `"12.2.0"`.
- It initializes with `secure:["secure","securityLevel","startOnLoad","maxTextSize"]`, `securityLevel:"antiscript"`, `flowchart:{diagramPadding:48}`, `gantt:{useWidth:1200}` and `sequence:{diagramMarginY:40}`. The bundled defaults keep `flowchart.useMaxWidth: true`.
- The viewer adds buttons labelled "Zoom in" and "Zoom out" (±0.1 scale per click), "Reset view", "Pan up/down/left/right" (100 px per click), plus an "expand" control. The CSS includes `.mermaid-viewer-control-panel{… position:absolute; bottom:1em; right:1em}`.

**Inference.** On GitHub, a large flowchart is also shrunk to the content width, but the reader can zoom and pan inside the frame. So the failure is milder on GitHub than in the IDE, but the first view is still shrunk.

**Source.** Page layout from served CSS (`primer-38ae573fa780d76a.css`) and page markup:
- `.markdown-body{… font-size:16px; line-height:1.5}`.
- `.markdown-body table{font-variant:tabular-nums; width:max-content; max-width:100%; display:block; overflow:auto}`.
- `.markdown-body table th, .markdown-body table td{… padding:6px 13px}`.
- The repository file view for a `.md` file uses `class="markdown-body entry-content container-lg"`, and `.container-lg{max-width:1012px; …}`.

**Source.** `github/markup` README l.7: "The HTML is sanitized, aggressively removing things that could harm you and your kin—such as `script` tags, inline-styles, and `class` or `id` attributes."

**Source.** Docs, "Organizing information with collapsed sections": "Any Markdown within the `<details>` block will be collapsed until the reader clicks" the toggle, and `<details open>` displays it open by default.

### 3.4 GitLab

**Source.** `doc/user/markdown.md`:
- l.1666: "GitLab supports Mermaid version 11."
- `package.json` (master `e3654f1`) pins `"mermaid-v11": "npm:mermaid@11.16.1"` and `"mermaid-v12": "npm:mermaid@12.0.0"`. `render_sandboxed_mermaid.js:95-97` picks v12 only when `gon.features?.useMermaidV12` is set.

**Inference.** Which version a given GitLab instance uses depends on a feature flag outside the repository, and on the instance's GitLab version for self-managed installs.

**Source.** Mermaid rendering code:
- `mermaid_sandbox.js:76-97` initializes with `flowchart: { useMaxWidth: true, htmlLabels: true }` and `securityLevel: 'strict'`.
- `render_sandboxed_mermaid.js:111-118` renders into a sandboxed iframe with `width: '100%'` and sets its height from the rendered size.
- `render_sandboxed_mermaid.js:29-35` sets `MAX_CHAR_LIMIT = 2000` and `MAX_MERMAID_BLOCK_LIMIT = 50`. Lines 205-212: above these limits, or with more than 30 `&` chained links, the diagram is not drawn until the reader clicks "Display" under the warning "Displaying this diagram might cause performance issues on this page." Some pages listed in `unrestrictedPages` are exempt.

**Inference.** A 30-node flowchart with long quoted labels and class definitions can exceed 2,000 characters, and then GitLab hides it behind a warning by default. This was not measured on the failed report.

**Source.** HTML and tables in `doc/user/markdown.md`:
- l.2454-2456: besides the default `SanitizationFilter` allowlist, "GitLab allows `span`, `abbr`, `details`, and `summary` elements".
- l.2512-2530: describes the collapsible section and says that "Markdown inside these tags is also supported" with blank lines around it.
- l.919-950: "Column widths are calculated dynamically based on the content of the cells", and a long cell "eventually wraps the text when the cell is too large for the display size".
- l.114-117 (Accessible tables): "tables should not have any empty cells."

**Not established:** GitLab's CSS for table overflow, its maximum content width, and any zoom or pan control for Mermaid.

---

## 4. Fitting the report to screens

### 4.1 What WCAG requires

**Source.**
- WCAG 2.2 SC 1.4.10 Reflow (AA): content must be presented "without requiring scrolling in two dimensions" for "Vertical scrolling content at a width equivalent to 320 CSS pixels". This is "Except for parts of the content which require two-dimensional layout for usage or meaning." Understanding 1.4.10 lists "data tables (not individual cells)" and "images required for understanding (such as maps and diagrams)" as such parts. It notes that "320 CSS pixels is equivalent to a starting viewport width of 1280 CSS pixels wide at 400% zoom."
- SC 1.4.8 Visual Presentation (AAA): "Width is no more than 80 characters or glyphs (40 if CJK)." Understanding 1.4.8: long lines make readers "have trouble keeping their place and following the flow of text". The page names no study for the 80-character figure. Its resources list psychophysics papers (Legge et al. 1985; Beckmann & Legge 1996) without saying which one supports it.

**Inference.** A data table or a diagram may scroll sideways and still conform. The prose, the gap list and the finding blocks must reflow at 320 px.

### 4.2 Legibility of shrunk diagrams

**Source.** Legge & Bigelow 2011 (Journal of Vision 11(5):8, PMC3428264): "a consensus value for the critical print size for normally sighted readers is 0.2° x-height". Below it, "reading speed begins to decline sharply". The fluent range is "from approximately 0.2° to 2°". The measurements were reading speed with text read aloud, scrolling text or RSVP.

**Source.** CSS Values 4 §6.2: "The reference pixel is the visual angle of one pixel on a device with a device pixel density of 96dpi and a distance from the reader of an arm's length", nominally 28 inches (about 0.0213°).

**Inference (arithmetic).**
- At the nominal 71 cm, 0.2° ÷ 0.0213° per px ≈ 9.4 CSS px of x-height.
- At 40 cm, one reference pixel subtends 0.0213° × 71.1 / 40 ≈ 0.0379°, so the critical size is 0.2 / 0.0379 ≈ 5.3 px of x-height.
- With an assumed x-height of 0.5 em, these give a font size of about 10.6 px (40 cm) to 18.8 px (71 cm).
- Mermaid's labels are 16 px at scale 1, so the rendered size is 16 × s. Even with the closer distance, s < 10.6 / 16 ≈ 0.66 puts labels below the critical print size.
- The text in the failed report was "a few pixels high". For 3 px text, s ≈ 0.19, roughly a third of the critical size.

These are estimates. Physical CSS px differ by device, and x-height differs by font.

### 4.3 Width budgets

**Inference (arithmetic; content widths assume 16 px side gutters on phones and are not measured).**

| Viewport | Where | Content width available |
|---|---|---|
| 2560 × 1440 | GitHub file view | ≤ 1012 px (`.container-lg`), minus padding |
| 1920 × 1080 | GitHub file view | ≤ 1012 px, the same cap |
| 2560 or 1920 | JetBrains preview | pane width − 56 px (2 em × 14 px margins); the pane is often half the editor or less |
| 411 / 393 / 384 | phone | ≈ 379 / 361 / 352 px |

**Inference (diagram nodes per row; assumes a 20-character label, an average advance of 0.55 em per character, about 30 px of node padding, Mermaid defaults; to be measured with `mmdc`).**
- A node is about 20 × 0.55 × 16 + 30 ≈ 206 px wide.
- An LR flowchart with k ranks, or a TB flowchart with k nodes in its widest rank, is about 206k + 50(k−1) + 16 px wide.
- For s ≥ 0.66, the natural width must be at most the content width ÷ 0.66:
  - phone (352–379 px): natural width ≤ 533–574 px, so k ≤ 2;
  - JetBrains pane of about 744 px: ≤ 1127 px, so k ≤ 4;
  - GitHub (1012 px): ≤ 1533 px, so k ≤ 6.
- A sequence diagram with n participants is about 150n + 50(n−1) + 100 = 200n + 50 px wide (`width` 150, `actorMargin` 50, `diagramMarginX` 50):
  - 4 participants: about 850 px. That fits 1012 px at s = 1, but on a 352 px phone s ≈ 0.41, so 16 px messages render at about 6.6 px.
  - 3 participants: about 650 px, s ≈ 0.54 on a phone.
- No diagram of useful size keeps s ≥ 0.66 on a phone. On phones the diagram can only supplement text; on GitHub the reader can zoom.

**Inference (table columns; GitHub cell padding 13 px each side plus a 1 px border; 16 px text at 0.55 em per character).**
- The narrowest a column can get is its longest unbreakable word × 8.8 px + 27 px.
- The class words are `gated`, `missing`, `soft`, `late`, `early`, `hollow`, `bypassable` and `unresolved`. The longest has 10 characters, so a column needs about 115 px.
- A need × stage table with one label column and three stage columns needs about 4 × 115 = 460 px. That fits every desktop pane but not a 352–379 px phone, where it scrolls inside itself (GitHub and JetBrains CSS, §3.2–3.3), which Reflow allows.
- With two stage columns or shorter words it would fit a phone. Splitting the stages changes the content, so this report keeps three columns and puts a reflowing gap list before the table.
- The old 7-column checks table, with `file:line` paths of about 20 characters, needs more than 1012 px and scrolls even on desktop GitHub.

**Inference (line length).** GitHub caps lines at about 1012 / 8.8 ≈ 115 characters, and JetBrains does not cap them at all. Both exceed the 80 characters of SC 1.4.8. Markdown cannot set a width, because GitHub strips inline styles (§3.3). The only lever inside the report is short paragraphs and one claim per list item.

### 4.4 Techniques

**Inference.**
1. Put the answer in prose and lists, which reflow at any width.
2. Keep each table to at most 4 columns of short words. Put long tokens (paths, commands) in finding blocks or list items, not in table columns.
3. Draw diagrams with at most 2 columns of nodes on phones, about 4 in an IDE pane and 6 on GitHub. Never rely on a diagram for a claim that the text does not also state.
4. Prefer `sequenceDiagram` with at most 4 participants for timing findings.
5. Prefer `flowchart TB` over `LR` when stages are many and branches few, because width then grows with branching rather than with length.
6. Check the rendered width with `mmdc` before publishing: the SVG's `max-width` style is the natural width (§3.1).

---

## 5. Markdown or HTML

**Source.**
- GitHub docs, "Working with non-code files": the renderable types are images, STL, CSV/TSV, PDF, prose documents "supported by github/markup", GeoJSON/TopoJSON, Jupyter and Mermaid files. HTML is not listed, and the page says "We don't directly support rendered views of commits to HTML documents."
- GitLab Pages docs: "GitLab Pages publishes static websites directly from a repository in GitLab."
- The JetBrains Markdown preview blocks scripts not on its list (CSP, §3.2).

**Inference.** A self-contained HTML report would win when the reader needs any of the following:
- a layout the renderer cannot override: a capped line length, a matrix that becomes a list on phones, diagrams pre-rendered at a fixed legible size with pan and zoom;
- interaction: filtering findings by class or stage, linking a finding to its checks;
- one look on every platform, instead of three renderers with different Mermaid versions (11.15.0, 11.16.1 or 12.0.0, 12.2.0) and different sizing.

It would cost the following:
- **Where it renders.** It is not rendered in the GitHub or GitLab file view or in a pull request diff. The reader needs a Pages site, a downloaded CI artifact, or a local browser. Review in a merge request then sees only the HTML source.
- **Upkeep.** The skill would have to produce and keep up a template with CSS and possibly JavaScript, and the agent writing the report would have to fill it correctly. Markdown needs neither.
- **Verification.** A reviewer reads a Markdown diff line by line. An HTML diff mixes content with markup, so claims are harder to check against `file:line`. That works against task 4 (§1.1).
- **Diffs over time.** A rerun of the skill gives a readable Markdown diff, and an HTML diff is much noisier.

**Inference (verdict).** For a report that lives next to the code and is reviewed in merge requests, Markdown with the structure in the recommendations below fixes both observed failures. The diagram failure is fixed by size limits and by keeping diagrams out of the critical path. The table failure is fixed by the need × stage table and the gap list. HTML is worth its cost only when the report is published to readers outside the repository, or when it grows to more checks than a collapsed section can hold usefully. In that case it should be generated in addition to the Markdown report, not instead of it.

---

## Not established

- The natural width of the failed report's 30-node diagram. `mmdc` is not installed here, and nothing was rendered.
- That `<details>` works in the JetBrains preview. The code path was read, but it was not tested visually.
- GitLab's table overflow CSS, its maximum content width, and whether it offers Mermaid zoom.
- Whether the JetBrains Markdown preview offers any zoom for Mermaid diagrams. None was found in the plugin's preview script or on the help page.
- The full text of Ghoniem et al. 2004/2005. Their study conditions are taken from the related-work section of Okoe et al.
- A measured study that compares lists, tables and diagrams for coverage questions like "which protection exists at which stage". None was found. Every transfer in §2 is an analogy.
- The x-height and average character width of the fonts each renderer actually uses. §4 assumes 0.5 em and 0.55 em.

---

## Recommendations for the gate-map report

1. **Open with the answer.** Write one paragraph giving the scope, the commit and the date. Follow it with the gaps as a bulleted list of at most about 5 items, each in one line: need, class (as a word), effect. If there are more gaps, list them in order of effect and say how many follow. (1.2, 1.3)
2. **Put a need × stage table next.** Use one row per need and one column per stage (at most 3 stage columns plus the need column). Each cell holds one class word from the fixed set (`gated`, `missing`, `soft`, `late`, `early`, `hollow`, `bypassable`, `unresolved`), plus the finding ID when it is not `gated`. Never put paths or commands in this table. Write `—` (not empty) where a stage does not apply. (1.4, 2.1, 2.2, 2.5, 3.4, 4.3)
3. **Give one block per finding.** Repeat the need and the effect in the block's first line, then the numbered sequence with `file:line`, then the refutation that was tried. The block must make sense without the summary above it. (1.3, 1.1)
4. **Group the checks by what their failure stops** (merge, build, image, deploy, container start, traffic, request), as short lists under each heading. Do not use one 7-column row per check. (1.2, 1.4)
5. **Collapse the full per-check inventory.** Put it in `<details><summary>All checks (N)</summary>`, with a blank line after `<summary>` and before `</details>`. If it stays a table, keep at most 4 columns and move `file:line` into the check's name cell or a list. (3.2, 3.3, 3.4, 4.3)
6. **Use diagrams only for timing findings.** Use `sequenceDiagram` with at most 4 participants and at most about 10 messages, placed under the finding it illustrates. Every step in the diagram must also appear in the finding's text list. (2.4, 4.2, 4.3, 1.3)
7. **Drop the whole-lifecycle flowchart from the default report.** If an overview is kept, limit it to one node per stage (about 3–5 nodes), drawn `TB`, with no subgraphs, and put it inside `<details>`. Replace the template's "under 30 nodes" rule with "at most 2 nodes per row on phones, about 4 in an IDE pane". (3.1, 3.2, 4.2, 4.3)
8. **Carry the class in words, never in colour alone,** in tables, lists and diagram labels. Give each diagram an `accTitle` and `accDescr`. (1.3)
9. **Check the diagrams before publishing.** Render each one with `mmdc` and read the SVG's `max-width`. If it exceeds about 1,500 px (GitHub at 1012 px with s ≥ 0.66) or about 1,100 px (an IDE pane), split or drop the diagram. Also keep each Mermaid block under 2,000 characters, or GitLab hides it behind a warning. (3.1, 3.4, 4.2, 4.3)
10. **Do not rely on `useMaxWidth: false`** to fix legibility. It trades shrinking for overflow, and its effect on the three renderers was not tested. (3.1, Not established)
11. **Keep the report in Markdown.** Generate an HTML version only when it is published outside the repository, and generate it in addition to the Markdown, not instead of it. (5)
