# Sources

Full citations for the source tags used in this skill. Each entry was checked against the publication, its publisher's or author's page, or official documentation on 2026-11-06, except where an entry says otherwise. A scope label in braces marks guidance that comes from one ecosystem (`cheat-sheet.md`).

Empirical studies among these sources (count for more than consensus guidance, which counts for more than one author's opinion): [Stylos-Clarke], [Ellis], [Robillard], [Robillard-DeLine], and the vendor study [Deque-57]; [Potvin-Levenberg] is an experience report.

Provenance distance of this file: the checks were made by research agents, mostly through a fetch tool that summarizes pages. For a later session, every entry is therefore "cited, not reopened": quotes are near-verbatim, and a flag, attribute, default, or version must be reopened at its source before it decides anything expensive to reverse (`research.md`, Provenance and decay).

## Contents

- Framework and API design
- Software design
- Alternate directions
- API usability
- Evolution, compatibility, and release
- Security and constraints
- Architecture, conventions, and evaluation
- Stacks and metaframeworks
- Application domains
- UI and accessibility
- Documentation
- Language cultures
- Practice
- Process and decisions

## Framework and API design

- **[FDG]** Krzysztof Cwalina, Jeremy Barton, Brad Abrams. *Framework Design Guidelines*, 3rd edition. Addison-Wesley, 2020. `{.NET}`. Chapter 2 names the principles of scenario-driven design, low barrier to entry, self-documenting object models, and layered architecture; §6.1 "DO NOT provide abstractions unless they are tested by developing several concrete implementations and APIs consuming the abstractions"; §7.5 the Tester-Doer and Try patterns. The online excerpt at learn.microsoft.com/dotnet/standard/design-guidelines is from the 2nd edition (2008).
- **[Bloch]** Joshua Bloch. "How to Design a Good API and Why it Matters". Talk slides, 2006–2007. `{Java}`. Read from a third-party copy of the slides.
- **[Tulach]** Jaroslav Tulach. *Practical API Design: Confessions of a Java Framework Architect*. Apress, 2008. `{Java}`. Chapter 8 "Separate APIs for Clients and Providers"; the broad definition of an API (chapter 3) and "Never hold a lock when calling a foreign code!" from the book's companion wiki, wiki.apidesign.org.
- **[Johnson-Foote]** Ralph E. Johnson, Brian Foote. "Designing Reusable Classes". *Journal of Object-Oriented Programming* 1(2):22–35, 1988. White-box and black-box frameworks.
- **[Roberts-Johnson]** Don Roberts, Ralph Johnson. "Patterns for Evolving Frameworks". In *Pattern Languages of Program Design 3*, Addison-Wesley, 1998. Patterns Three Examples, White-box Framework, Component Library, Hot Spots, Pluggable Objects, Fine-grained Objects, Black-box Framework, Visual Builder, Language Tools. Read through secondary sources.
- **[Fowler-IoC]** Martin Fowler. "InversionOfControl". martinfowler.com, 2005.
- **[Fowler-Published]** Martin Fowler. "Public versus Published Interfaces". *IEEE Software*, March/April 2002.
- **[RustAPI]** Rust API Guidelines. rust-lang.github.io/api-guidelines. `{Rust}`. Items C-CUSTOM-TYPE, C-SEALED, C-STRUCT-PRIVATE, C-BUILDER, C-VALIDATE.
- **[JLBP-1]** Google Best Practices for Java Libraries, JLBP-1 "Minimize dependencies". jlbp.dev. `{Java}`.
- **[PitOfSuccess]** Brad Abrams. "The Pit of Success". Blog post, 2 October 2003, quoting Rico Mariani. learn.microsoft.com/archive/blogs/brada.

## Software design

- **[APOSD]** John Ousterhout. *A Philosophy of Software Design*, 2nd edition. Yaknyam Press, 2021. Chapters "Modules Should Be Deep", "Information Hiding (and Leakage)", "General-Purpose Modules are Deeper", "Different Layer, Different Abstraction", "Pull Complexity Downwards", "Define Errors Out Of Existence" (including §10.9 "Taking it too far"), "Design it Twice", "Choosing Names", "Write The Comments First", "Consistency", "Software Trends". Some wording read through secondary sources.
- **[Parnas72]** David L. Parnas. "On the Criteria To Be Used in Decomposing Systems into Modules". *Communications of the ACM* 15(12):1053–1058, 1972.
- **[Parnas79]** David L. Parnas. "Designing Software for Ease of Extension and Contraction". *IEEE Transactions on Software Engineering* SE-5(2):128–138, 1979.
- **[Lampson]** Butler W. Lampson. "Hints for Computer System Design". SOSP 1983; *Operating Systems Review* 15(5):33–48.
- **[Ousterhout-Martin]** John Ousterhout, Robert C. Martin. "A Philosophy of Software Design vs Clean Code". github.com/johnousterhout/aposd-vs-clean-code, 2024–2025.
- **[Metz]** Sandi Metz. "The Wrong Abstraction". sandimetz.com, 20 January 2016.
- **[Brooks]** Frederick P. Brooks. *The Mythical Man-Month*, chapter 5 "The Second-System Effect".
- **[Minsky]** Yaron Minsky. "Effective ML Revisited". Jane Street blog, 2011. "Make illegal states unrepresentable".
- **[King]** Alexis King. "Parse, don't validate". lexi-lambda.github.io, 5 November 2019.

## Alternate directions

- **[Kiczales]** Gregor Kiczales. "Towards a New Model of Abstraction in the Engineering of Software". IMSA'92 Workshop on Reflection and Meta-level Architectures, 1992; and Gregor Kiczales et al. "Open Implementation Design Guidelines". ICSE 1997, pp. 481–490.
- **[Gabriel]** Richard P. Gabriel. "The Rise of Worse is Better", from "Lisp: Good News, Bad News, How to Win Big". dreamsongs.com.
- **[E2E]** J. H. Saltzer, D. P. Reed, D. D. Clark. "End-to-End Arguments in System Design". *ACM Transactions on Computer Systems* 2(4):277–288, 1984.
- **[Hickey-SME]** Rich Hickey. "Simple Made Easy". Strange Loop, 2011.
- **[Hickey-Spec]** Rich Hickey. "Spec-ulation". Clojure/conj, 2016. Growth by accretion, relaxation, and fixation; "If you are going to break somebody, use a new name."
- **[Petricek]** Tomas Petricek. "Library patterns: Why frameworks are evil". tomasp.net, 3 March 2015.
- **[Least-Power]** Tim Berners-Lee, Noah Mendelsohn. "The Rule of Least Power". W3C TAG Finding, 23 February 2006.
- **[Acton]** Mike Acton. "Data-Oriented Design and C++". CppCon keynote, 2014.
- **[Bernhardt]** Gary Bernhardt. "Boundaries". SCNA, 2012.
- **[Miller-Ocap]** Mark S. Miller. *Robust Composition: Towards a Unified Approach to Access Control and Concurrency Control*. PhD thesis, Johns Hopkins University, 2006.
- **[Rails-Doctrine]** David Heinemeier Hansson. "The Rails Doctrine". rubyonrails.org/doctrine, 2016. The current page lists nine pillars.
- **[RFC9413]** M. Thomson, D. Schinazi. RFC 9413 "Maintaining Robust Protocols". June 2023.

## API usability

- **[Myers-Stylos]** Brad A. Myers, Jeffrey Stylos. "Improving API Usability". *Communications of the ACM* 59(6):62–69, 2016.
- **[Stylos-Clarke]** Jeffrey Stylos, Steven Clarke. "Usability Implications of Requiring Parameters in Objects' Constructors". ICSE 2007, pp. 529–539.
- **[Ellis]** Brian Ellis, Jeffrey Stylos, Brad Myers. "The Factory Pattern in API Design: A Usability Evaluation". ICSE 2007, pp. 302–312.
- **[Robillard]** Martin P. Robillard. "What Makes APIs Hard to Learn? Answers from Developers". *IEEE Software* 26(6):27–34, 2009.
- **[Clarke-CD]** Steven Clarke. "Measuring API Usability". *Dr. Dobb's Journal*, May 2004; building on T. R. G. Green, M. Petre, "Usability Analysis of Visual Programming Environments: A 'Cognitive Dimensions' Framework", *Journal of Visual Languages and Computing* 7(2):131–174, 1996.

## Evolution, compatibility, and release

- **[Hyrum]** Hyrum's Law. hyrumslaw.com; stated in Titus Winters et al., *Software Engineering at Google*, chapter 1.
- **[SemVer]** Semantic Versioning 2.0.0. semver.org, including its FAQ on deprecation.
- **[desRivieres]** Jim des Rivières. "Evolving Java-based APIs", part 1, revision 1.2. wiki.eclipse.org, 2007. `{Java}`.
- **[DotNet-Rules]** ".NET API changes that affect compatibility". learn.microsoft.com/dotnet/core/compatibility/library-change-rules. `{.NET}`.
- **[Go1]** "Go 1 Release Notes", section on map iteration. go.dev/doc/go1. `{Go}`.
- **[Go-Modules]** "Go Modules Reference". go.dev/ref/mod. `{Go}`.
- **[PEP387]** PEP 387 "Backwards Compatibility Policy". peps.python.org/pep-0387. `{Python}`.
- **[KeepChangelog]** Keep a Changelog 1.1.0. keepachangelog.com.
- **[Node-Exports]** Node.js documentation, "Packages", the `"exports"` field. nodejs.org/api/packages.html. `{TS/JS}`.
- **[Crater]** "Crater". Rust compiler development guide, rustc-dev-guide.rust-lang.org/tests/crater.html. `{Rust}`.
- **[Cargo-Resolver]** The Cargo Book, "Dependency Resolution", recommendations on version requirements. `{Rust}`.
- **[Cargo-FAQ]** The Cargo Book, FAQ on committing `Cargo.lock`; Rust blog, "Change in Guidance on Committing Lockfiles", 29 August 2023. `{Rust}`.
- **[npm-peer]** npm documentation, `package.json`, `peerDependencies`. `{TS/JS}`.
- **[npm-provenance]** npm documentation, "Generating provenance statements". `{TS/JS}`.
- **[PyPI-TP]** PyPI documentation, "Trusted Publishers". `{Python}`.
- **[SLSA]** SLSA specification, version 1.2, build track. slsa.dev.
- **[Sigstore]** Sigstore documentation, overview. docs.sigstore.dev.
- **[Scorecard]** OpenSSF Scorecard. github.com/ossf/scorecard.
- **[GitHub-SecPolicy]** GitHub documentation, "Adding a security policy to your repository".
- **[GitHub-Advisories]** GitHub documentation, "About repository security advisories".
- Compatibility checkers in `release.md`: japicmp (github.com/siom79/japicmp), Revapi, the Kotlin Gradle plugin's ABI validation (kotlinlang.org/docs/gradle-binary-compatibility-validation.html), cargo-semver-checks, .NET package validation and ApiCompat (learn.microsoft.com/dotnet/fundamentals/apicompat), API Extractor (api-extractor.com), gorelease and apidiff (pkg.go.dev/golang.org/x/exp), griffe (mkdocstrings.github.io/griffe).

## Security and constraints

- **[Saltzer-Schroeder]** Jerome H. Saltzer, Michael D. Schroeder. "The Protection of Information in Computer Systems". *Proceedings of the IEEE* 63(9), 1975. Eight design principles, among them fail-safe defaults, complete mediation, and psychological acceptability. The venue was not rechecked.
- **[BSRS]** Heather Adkins et al. *Building Secure and Reliable Systems*. O'Reilly, 2020. Chapter 12 "Writing Code", sections "Frameworks to Enforce Security and Reliability" and "Security and Reliability by Default".
- **[Kern]** Christoph Kern. "Securing the Tangled Web". *Communications of the ACM* 57(9):38–47, 2014.
- **[Wang-Bangert-Kern]** Pei Wang, Julian Bangert, Christoph Kern. "If It's Not Secure, It Should Not Compile: Preventing DOM-Based XSS in Large-Scale Web Development with API Hardening". ICSE 2021.
- **[TrustedTypes]** W3C, "Trusted Types". w3.org/TR/trusted-types. `{web}`.
- **[CISA-SbD]** CISA and partner agencies. "Shifting the Balance of Cybersecurity Risk: Principles and Approaches for Secure by Design Software". April 2023, revised October 2023.
- **[OWASP-API]** OWASP API Security Top 10, 2023: API1 Broken Object Level Authorization, API3 Broken Object Property Level Authorization, and API5 Broken Function Level Authorization, as separate risks. owasp.org/API-Security. Confirmed through secondary sources on 2026-11-06; the official page was not opened.
- **[OWASP-PC]** OWASP Top 10 Proactive Controls, 2024. C5 "Secure By Default Configurations". top10proactive.owasp.org.
- OWASP ASVS 5.0 (published 30 May 2025) and the OWASP Cheat Sheet Series, for current guidance per topic.

## Architecture, conventions, and evaluation

- **[Evans]** Eric Evans. *Domain-Driven Design*. Addison-Wesley, 2003. **[Evans-Ref]** Eric Evans. *Domain-Driven Design Reference*, 2015, section "Distillation for Strategic Design", pattern Core Domain.
- **[Vernon]** Vaughn Vernon. *Implementing Domain-Driven Design*. Addison-Wesley, 2013.
- **[Khononov-DDD]** Vlad Khononov. *Learning Domain-Driven Design*. O'Reilly, 2021. Core, supporting, and generic subdomains.
- **[Khononov-Coupling]** Vlad Khononov. *Balancing Coupling in Software Design*. Addison-Wesley, 2024. Integration strength, distance, volatility.
- **[Bogard]** Jimmy Bogard. "Vertical Slice Architecture". jimmybogard.com, 19 April 2018.
- **[Cockburn-Hex]** Alistair Cockburn. "Hexagonal (Ports & Adapters) Architecture". alistair.cockburn.us, 2005.
- **[Palermo]** Jeffrey Palermo. "The Onion Architecture: part 1". 29 July 2008.
- **[Martin-Clean]** Robert C. Martin. "The Clean Architecture". blog.cleancoder.com, 13 August 2012.
- **[Fowler-Layering]** Martin Fowler. "PresentationDomainDataLayering". martinfowler.com, 26 August 2015.
- **[Brown-Modular]** Simon Brown. "Modular Monoliths". GOTO Berlin, 2018. Read through a search excerpt only.
- **[FSD]** Feature-Sliced Design, version 2.1. feature-sliced.design, with the Steiger linter (github.com/feature-sliced/steiger).
- **[Tornhill]** Adam Tornhill. *Your Code as a Crime Scene*, 2nd edition, Pragmatic Bookshelf, 2024; *Software Design X-Rays*, 2018; the code-maat tool (github.com/adamtornhill/code-maat).
- **[Ford-Parsons-Kua]** Neal Ford, Rebecca Parsons, Patrick Kua. *Building Evolutionary Architectures*. O'Reilly, 2017; 2nd edition with Pramod Sadalage. Fitness functions.
- **[Conway]** Melvin E. Conway. "How Do Committees Invent?". *Datamation*, April 1968.
- **[Team-Topologies]** Matthew Skelton, Manuel Pais. *Team Topologies*. IT Revolution, 2019; 2nd edition 2025.
- **[SAAM]** Rick Kazman, Len Bass, Gregory Abowd, Mike Webb. "SAAM: A Method for Analyzing the Properties of Software Architectures". ICSE 1994; direct and indirect scenarios and scenario interaction as described in Kazman, Abowd, Bass, Clements, "Scenario-Based Analysis of Software Architecture", *IEEE Software*, 1996.
- **[ATAM]** Rick Kazman, Mark Klein, Paul Clements. "ATAM: Method for Architecture Evaluation". CMU/SEI-2000-TR-004, 2000. Utility tree and quality attribute scenarios.
- **[Bass-SAP]** Len Bass, Paul Clements, Rick Kazman. *Software Architecture in Practice*, 2nd edition, 2003. Six-part quality attribute scenarios.
- **[Cockburn-UC]** Alistair Cockburn. *Writing Effective Use Cases*. Addison-Wesley, 2000.
- **[Sindre-Opdahl]** Guttorm Sindre, Andreas L. Opdahl. "Eliciting security requirements with misuse cases". *Requirements Engineering* 10(1):34–44, 2005.
- **[Adzic]** Gojko Adzic. *Specification by Example*. Manning, 2011.
- **[Foote-Opdyke]** Brian Foote, William F. Opdyke. "Lifecycle and Refactoring Patterns that Support Evolution and Reuse". In *Pattern Languages of Program Design 1*, Addison-Wesley, 1995. Prototype, expansionary, and consolidation phases.
- **[Opdyke]** William F. Opdyke. *Refactoring Object-Oriented Frameworks*. PhD thesis, University of Illinois at Urbana-Champaign, 1992. Read through a secondary record.
- **[Fowler-Refactoring]** Martin Fowler. *Refactoring*, 2nd edition. Addison-Wesley, 2018. "Three strikes, then you refactor", credited to Don Roberts; read through a secondary source.

## Stacks and metaframeworks

- **[McKinley]** Dan McKinley. "Choose Boring Technology". mcfunley.com, 30 March 2015.
- **[Fowler-MonolithFirst]** Martin Fowler. "MonolithFirst". martinfowler.com, 3 June 2015.
- **[DHH-Majestic]** David Heinemeier Hansson. "The Majestic Monolith". Signal v. Noise, 29 February 2016.
- **[Ford-Polyglot]** Neal Ford. "Polyglot Programming". memeagora.blogspot.com, 5 December 2006.
- **[Potvin-Levenberg]** Rachel Potvin, Josh Levenberg. "Why Google Stores Billions of Lines of Code in a Single Repository". *Communications of the ACM* 59(7):78–87, 2016.
- **[Newman-BFF]** Sam Newman. "Backends For Frontends". samnewman.io, 18 November 2015.
- **[Rendering-Web]** Addy Osmani, Jason Miller. "Rendering on the Web". web.dev, 2019, updated 2026. `{web}`.
- **[Islands]** Jason Miller. "Islands Architecture". jasonformat.com, 11 August 2020. `{web}`.
- **[RSC]** React RFC 188 "Server Components" (github.com/reactjs/rfcs), and the React reference pages for `'use client'` and `'use server'` (react.dev/reference/rsc). `{React-based}`.
- **[tRPC]** tRPC documentation. trpc.io/docs. `{TS/JS}`.
- **[Protobuf]** Protocol Buffers documentation, overview. protobuf.dev.
- **[WinterTC]** Ecma International. ECMA-429 "Minimum Common Web API", 1st edition, December 2025 (TC55, formerly WinterCG).
- **[Vite8]** "Announcing Vite 8". vite.dev/blog, 12 March 2026. `{TS/JS}`.
- **[Roslyn-NuGet]** Microsoft. "Analyzer NuGet formats". learn.microsoft.com/nuget/guides/analyzers-conventions; and Alex Turner, "Use Roslyn to Write a Live Code Analyzer for Your API", *MSDN Magazine*, 2014. `{.NET}`.
- Metaframework snapshot in `stacks.md`: the official documentation of Next.js, Nuxt, SvelteKit, SolidStart, React Router, TanStack Start, and Astro, read on 2026-11-06.

## Application domains

- **[Wilkinson]** Leland Wilkinson. *The Grammar of Graphics*. Springer, 1999; 2nd edition 2005. Edition years read through search results.
- **[Wickham]** Hadley Wickham. "A Layered Grammar of Graphics". *Journal of Computational and Graphical Statistics* 19(1):3–28, 2010.
- **[Vega-Lite]** Arvind Satyanarayan, Dominik Moritz, Kanit Wongsuphasawat, Jeffrey Heer. "Vega-Lite: A Grammar of Interactive Graphics". *IEEE Transactions on Visualization and Computer Graphics* (Proc. InfoVis 2016), 2017.
- **[Nystrom]** Robert Nystrom. *Game Programming Patterns*. 2014. gameprogrammingpatterns.com.
- **[Temporal]** Temporal documentation, "Workflow Definition": "A Workflow Definition must be deterministic to support replay." docs.temporal.io.
- **[OpenMCT]** NASA Open MCT (Open Mission Control Technologies). github.com/nasa/openmct.
- **[Grafana]** Grafana plugin types: panel, data source, app. grafana.com/developers/plugin-tools.
- **[ArrayAPI]** Python array API standard, Consortium for Python Data API Standards. data-apis.org/array-api.
- **[ROS2]** ROS 2 documentation, "Interfaces: topics, services, actions" and "About client libraries" (rclcpp, rclpy).
- **[FPrime]** F´ (F Prime) flight software framework, originally developed at JPL: components, ports, topologies. github.com/nasa/fprime.
- **[cFS]** NASA Core Flight System. github.com/nasa/cFS.
- **[DO-178C]** RTCA DO-178C, software considerations in airborne systems and equipment certification, 2011. rtca.org.
- **[SysML]** OMG SysML v2, final adoption approved in 2025 (OMG press release, 21 July 2025).
- **[Geant4]** Geant4 User's Guide for Application Developers: user initialization classes and user action classes.
- **[Buitinck]** Lars Buitinck et al. "API design for machine learning software: experiences from the scikit-learn project". ECML PKDD 2013 workshop "Languages for Data Mining and Machine Learning"; arXiv:1309.0238.
- **[MCP]** Model Context Protocol, announced 25 November 2024; specification at modelcontextprotocol.io/specification, versioned by date.
- **[HomeAssistant]** Home Assistant contributor documentation, "Create an integration". contributors.home-assistant.io.
- **[Bencina]** Ross Bencina. "Real-time audio programming 101: time waits for nothing". rossbencina.com, 2011.
- **[AudioPlugins]** CLAP, announced by Bitwig and u-he on 15 June 2022; Steinberg VST 3 developer portal; Apple Audio Unit v3 documentation; JUCE (github.com/juce-framework/JUCE).
- Also named in `domains.md`: Node-RED (nodered.org), WordPress plugin hooks, Drupal hooks, Odoo modules, Nextflow, Snakemake, Matter (Connectivity Standards Alliance), MQTT 5.0 (OASIS Standard, 2019), Zephyr, ESPHome, MISRA C.

## UI and accessibility

- **[WCAG22]** W3C, Web Content Accessibility Guidelines 2.2. Published 5 October 2023, updated 12 December 2024. w3.org/TR/WCAG22.
- **[APG]** W3C WAI-ARIA Authoring Practices Guide: patterns with keyboard interaction. w3.org/WAI/ARIA/apg.
- **[Using-ARIA]** W3C, "Using ARIA", the first rule of ARIA use. w3.org/TR/using-aria.
- **[WAI-Tools]** W3C WAI, "Selecting Web Accessibility Evaluation Tools". w3.org/WAI/test-evaluate/tools/selecting.
- **[Deque-57]** Deque. "Automated Testing Study Identifies 57 Percent of Digital Accessibility Issues". 10 March 2021. A vendor study on the vendor's own audit data, measured by issue volume, not by success criteria.
- **[Testing-Library]** Testing Library, "Guiding Principles" and "About Queries" (role queries first). testing-library.com.
- **[DTCG]** Design Tokens Community Group, "Design Tokens Format Module 2025.10", Final Community Group Report, 28 October 2025. designtokens.org.
- **[MDN-ElementInternals]** MDN, `ElementInternals`. developer.mozilla.org.
- Also named in `ui-frameworks.md`: React Aria (react-aria.adobe.com), Radix Primitives, eslint-plugin-jsx-a11y, the Angular CDK accessibility package, the Storybook accessibility addon (built on axe-core), Astro ("Zero JS, by default"), React Native accessibility properties and the ARIA aliases added in 0.71.

## Documentation

- **[Diataxis]** Daniele Procida. Diátaxis. diataxis.fr: the four kinds and the compass (action or cognition, acquisition or application); Canonical's adoption announced at ubuntu.com/blog, 15 December 2021.
- **[Django-Docs]** Django documentation index ("How the documentation is organized") and "Design philosophies". docs.djangoproject.com.
- **[Robillard-DeLine]** Martin P. Robillard, Robert DeLine. "A field study of API learning obstacles". *Empirical Software Engineering* 16:703–732, 2011.
- **[Rust-RFC1574]** Rust RFC 1574, "More API Documentation Conventions". `{Rust}`.
- **[MDN-PageTypes]** MDN writing guidelines, "API method subpage template". `{web}`.
- **[Go-DocComments]** "Go Doc Comments", go.dev/doc/comment; examples in the `testing` package documentation and the Go blog post "Testable Examples in Go" (2015). `{Go}`.
- **[PEP257]** PEP 257, "Docstring Conventions". `{Python}`.
- **[TSDoc]** TSDoc, tsdoc.org (a proposal for standard TypeScript doc comments); TypeDoc, typedoc.org. `{TS/JS}`.
- **[Google-Style]** Google developer documentation style guide, including "Code samples" and "API reference code comments". developers.google.com/style.
- **[Microsoft-Style]** Microsoft Writing Style Guide, developer content section. learn.microsoft.com/style-guide.
- **[Elm-Errors]** Evan Czaplicki. "Compiler Errors for Humans". elm-lang.org, 30 June 2015.
- **[Baker]** Mark Baker. *Every Page is Page One: Topic-based Writing for Technical Communication and the Web*. XML Press, 2013.
- **[llms-txt]** Jeremy Howard. "The /llms.txt file". llmstxt.org, 3 September 2024.
- **[WriteTheDocs]** Write the Docs, "Docs as Code". writethedocs.org/guide/docs-as-code.
- **[Bhatti]** Jared Bhatti, Sarah Corleissen, Jen Lambourne, David Nuñez, Heidi Waterhouse. *Docs for Developers: An Engineer's Field Guide to Technical Writing*. Apress, 2021.
- **[React-Docs]** "Introducing react.dev". react.dev/blog, 16 March 2023; the React 19 upgrade guide, react.dev/blog, 25 April 2024. `{React}`.
- **[Stripe-Docs]** Stripe API reference, "Authentication" (test keys in every example); "How Stripe builds interactive docs with Markdoc", stripe.dev/blog, 2022.
- **[Angular-Update]** Angular Update Guide, angular.dev/update-guide; `ng update`, angular.dev/cli/update; error pages, angular.dev/errors. `{Angular}`.
- **[Next-Codemods]** Next.js documentation, "Codemods". nextjs.org/docs. `{React-based}`.

## Language cultures

Most quotes in `language-cultures.md` were read through a summarizing fetch and are near-verbatim; recheck the page before quoting one word for word.

- **[Go-CRC]** Go Code Review Comments: Variable Names, Package Names, Handle Errors. go.dev/wiki/CodeReviewComments. `{Go}`.
- **[Go-PkgNames]** Effective Go, "Package names", and Sameer Ajmani, "Package names", Go blog, 2015. `{Go}`.
- **[Go-Proverbs]** Rob Pike. Go Proverbs, Gopherfest 2015; transcription at go-proverbs.github.io. `{Go}`.
- **[Go-FuncOpts]** Rob Pike, "Self-referential functions and the design of options", 24 January 2014; Dave Cheney, "Functional options for friendly APIs", 17 October 2014. `{Go}`.
- **[PEP20]** Tim Peters. PEP 20, "The Zen of Python". `{Python}`.
- **[PEP8]** PEP 8, "Style Guide for Python Code", naming conventions. `{Python}`.
- **[JLS-6.1]** The Java Language Specification, SE 21, §6.1, "Package Names and Module Names". `{Java}`.
- **[FDG-Naming]** Framework Design Guidelines, "Names of Namespaces" and "General Naming Conventions" (online excerpt of the 2nd edition). `{.NET}`.
- **[DotNet-Options]** .NET documentation, "Options pattern guidance for .NET library authors". `{.NET}`.
- **[Rust-Book-Reexport]** *The Rust Programming Language*, chapter 14.2, "Exporting a Convenient Public API". `{Rust}`.
- **[Rust-Style]** The Rust Style Guide. doc.rust-lang.org/style-guide. `{Rust}`.
- **[Google-TS-Style]** Google TypeScript Style Guide. google.github.io/styleguide/tsguide.html. `{TS/JS}`.
- **[TS-Team]** TypeScript wiki, "Coding guidelines", which states it is not a prescriptive guideline for the community. `{TS/JS}`.
- **[TS-Namespaces]** TypeScript handbook, "Namespaces and Modules". `{TS/JS}`.
- **[Kotlin-ExplicitAPI]** Kotlin 1.4 release notes, "Explicit API mode for library authors". `{Kotlin}`.
- **[Kotlin-Conventions]** Kotlin coding conventions, exceptions, and library authors' guidelines on simplicity. kotlinlang.org/docs. `{Kotlin}`.
- **[Swift-API]** Swift API Design Guidelines. swift.org/documentation/api-design-guidelines. `{Swift}`.
- **[Java-Exceptions]** The Java Tutorials, "Unchecked Exceptions — The Controversy". `{Java}`.
- **[Ruby-About]** "About Ruby", ruby-lang.org; Bill Venners, "The Philosophy of Ruby", interview with Yukihiro Matsumoto, Artima, 2003. `{Ruby}`.
- **[Ruby-Methods]** Ruby documentation, "Methods" syntax (`?` and `!` method names). `{Ruby}`.
- **[CppCore]** Bjarne Stroustrup, Herb Sutter (eds.). C++ Core Guidelines, including NL.7 and SL.2. isocpp.github.io/CppCoreGuidelines. `{C++}`.
- **[Armstrong]** Joe Armstrong. *Making reliable distributed systems in the presence of software errors*. PhD thesis, 2003, §4.4 "Let it crash". `{Erlang}` `{Elixir}`.
- **[Elixir-Guides]** Elixir documentation: naming conventions, design anti-patterns, library guidelines. hexdocs.pm/elixir. `{Elixir}`.
- **[Prettier]** Prettier, "Rationale" and "Option Philosophy". prettier.io/docs. `{TS/JS}`.

## Practice

Entries added from practice (`evolution.md`) are defined here, one per tag: grade, evidence kind, and a generic description. They name no project; the link to the work they came from is kept outside the skill. The entries below were added on 2026-11-06 at the skill author's request, from the author's earlier framework work. Their provenance distance is "derived": they come from the author's design records, reviews, and research notes, several written with agents, so their factual premises are rechecked before they decide anything expensive to reverse.

- **[Practice-2026-11-1]** Repeated (two metaframework efforts, one built with recorded outcomes, one a specification), reasoned with recorded outcomes. Declarative backend metaframeworks: generated surfaces, output schemas, no surface without a declaration, contract diffs, inferred types, add-only development sync, reserved storage names, effective-configuration inspection, one consequence per setting, sharing options in tiers, requirements stated at observable boundaries, rewrites starting from the predecessor's pitfalls, warning-level rules that gate nothing.
- **[Practice-2026-11-2]** Repeated (several projects and review rounds, with recorded fixes). Access enforcement beyond dispatch: function-level and object-level checks, the in-process data API as an entry point, stricter rules for derived records, one limiter instead of two, strictest default for undeclared routes, roles held on resources, the invariant watch-set, checking per version what host layers enforce, durable state over live channels.
- **[Practice-2026-11-3]** Repeated (several framework designs). Extension mechanisms: named calls until outside extenders exist, one-provider slots and collected fields, what counts as an earning implementation, references as factory values validated in one pass, extensions never naming each other, safety-relevant order derived from declarations, explicit transaction handles and swappable-implementation lifecycles.
- **[Practice-2026-11-4]** Promoted (one recorded measurement). The findability test for source layouts, with folders opened per concept as the tie-break.
- **[Practice-2026-11-5]** Repeated (several projects). Working with agent-written design material: re-checks found about 7 to 10 percent of cited claims wrong or outdated (two recorded counts); condensing silently closed open decisions; decisions taken from answers the owner never gave had to be reverted; process scaled to the size of the change; parking mechanisms that no scenario needs; replacing subsystems in reviewable steps.
- **[Practice-2026-11-6]** Promoted (one project with recorded outcomes, plus supporting notes). Headless cores that outlive their hosts, single-crossing language bindings with smoke checks, spikes on unstable host APIs, measuring real-time behavior on target hardware, mechanical real-time safety checks, repository shape for one application plus a native core.
- **[Practice-2026-11-7]** Promoted (two designs, no recorded outcomes yet). AI application frameworks: deterministic floor, one model adapter as the test-double point, model-free default test suites, model output as proposals a person accepts.
- **[Practice-2026-11-8]** Repeated (several projects, with recorded fixes). Documentation that covers only what ships, precedence between specification, documentation, and code, requirement identifiers in test names, link integrity checked by the build.
- **[Practice-2026-11-9]** Promoted (two interface designs and one accessibility fix). Control semantics, color-independent state, custom gesture controls with readable semantics, configuration limited to the data contract, honest precision in visualizations.

## Process and decisions

- **[Nygard]** Michael Nygard. "Documenting Architecture Decisions". Cognitect blog, 15 November 2011.
- **[Bezos]** Jeff Bezos. Amazon 2015 letter to shareholders (filed April 2016). Type 1 and Type 2 decisions; one-way and two-way doors.
- **[Beck-Tweet]** Kent Beck. Post of 25 September 2012: "make the change easy (warning: this may be hard), then make the easy change". Read through a secondary source.
