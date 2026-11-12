# Checking code that cannot be enumerated: primary-source research

Scope: techniques for checking C#/.NET code whose input domain no tool can enumerate.
Date of every fetch in this file: 2026-11-11.
Every source listed was opened on that date.
Nothing was run, built or installed.
Every statement about behaviour therefore rests on documentation that was read or on source code that was read, never on an execution.

## (a) Summary for a meeting

Five families of technique were researched: model checking of a specification, systematic schedule testing, deductive verification, property-based testing, and run-time invariants.
None of them checks the shipped C# program exhaustively.
A model checker (TLC, Apalache) checks a separate model, and only for the finite constants, state constraint or step bound that a person supplied; its own documentation says a pass on a small model can hide errors that appear on a larger one.
Coyote explores a chosen number of schedules of the real C# code and states that it is not a verification system.
Dafny proves that Dafny code meets its written specification for all inputs, but the proof covers only Dafny-originated code, and in the latest release (4.11.0) its documented numeric types are unbounded integers and exact reals, not IEEE 754 `double`.
FsCheck and CsCheck run a property on a sample (100 cases by default in both) and report a seed for reproducing a failure; a pass means no counterexample was found in that sample.
`Debug.Assert` is compiled out of Release builds, and Code Contracts are not supported on .NET 5 and later.
For floating point, the first-party sources state IEEE 754 conformance of the formats and state several cases where results can differ between platforms, architectures or .NET versions; no first-party source was found that promises identical `double` results across machines.
Deterministic simulation and record/replay are described by primary sources as methods that give repeatability of a run, not coverage of all runs.
The routing table in section (e) is inference from these sources; no source states it.

## (b) Claims by technique

How to read the tables.
The tag `cited` means the page or file at the URL was opened on 2026-11-11 and contains the quote.
The tag `unverified` means the claim is recalled, or is inferred from cited material and still needs a run; the reason is given in the tag cell.
A quote taken from source code is marked "(source code)" in the claim; a quote taken from documentation is a claim made by the documentation, not an observation of behaviour.
Quotes taken from PDF files were extracted with a text converter, so typographic characters can differ from the PDF.
URLs under `raw.githubusercontent.com` are the documentation sources of the tool's published site, read at the branch or tag shown in the URL.

### Versions and maintenance status

| ID | Claim | Source URL | Quote | Tag |
|---|---|---|---|---|
| V1 | The latest non-pre-release of the TLA+ tools (TLC, PlusCal translator, SANY) is 1.7.4, published 2024-08-05; a rolling 1.8.0 pre-release was last updated 2026-11-06. | https://github.com/tlaplus/tlaplus/releases/latest (redirects to `/releases/tag/v1.7.4`) and https://raw.githubusercontent.com/tlaplus/tlaplus/master/README.md | "Currently, every commit to the master branch is built & uploaded to the [1.8.0 Clarke pre-release](https://github.com/tlaplus/tlaplus/releases/tag/v1.8.0)." | cited |
| V2 | The last commit on the TLA+ tools `master` branch is dated 2026-11-06, and the Eclipse Toolbox is stated to be unmaintained. | https://github.com/tlaplus/tlaplus/commits/master.atom and https://raw.githubusercontent.com/tlaplus/tlaplus/master/README.md | "The Eclipse-based TLA⁺ Toolbox GUI is also available from this repository, but it is currently unmaintained." | cited |
| V3 | The TLA+ tools need Java 11 or later; no .NET integration is described in the README. | https://raw.githubusercontent.com/tlaplus/tlaplus/master/README.md | "The TLA⁺ tools require Java 11+ to run." | cited |
| V4 | The PlusCal manual that was read is P-Syntax version 1.8, dated 11 March 2024; the translator ships inside `tla2tools.jar`. | https://lamport.azurewebsites.net/tla/p-manual.pdf and https://raw.githubusercontent.com/tlaplus/tlaplus/master/README.md | "java pcal.trans -help     # The PlusCal-to-TLA⁺ translator" | cited |
| V5 | The latest Apalache release is v0.63.0, dated 2026-11-10; the last commit on `main` is dated 2026-11-10. | https://github.com/apalache-mc/apalache/releases/latest (redirects to `/releases/tag/v0.63.0`), https://github.com/apalache-mc/apalache/releases.atom, https://github.com/apalache-mc/apalache/commits/main.atom | Feed entry: "v0.63.0", updated "2026-11-10T07:01:23Z". | cited |
| V6 | Apalache describes itself as experimental. | https://raw.githubusercontent.com/apalache-mc/apalache/main/docs/src/apalache/index.md | "experimental, so be prepared to use the command-line and to help us discover bugs." (end of a longer sentence) | cited |
| V7 | The latest Coyote package on NuGet is 1.7.11, published 2024-03-18. | https://api.nuget.org/v3/registration5-gz-semver2/microsoft.coyote/index.json | Catalog entry: version "1.7.11", published "2024-03-18T19:30:52.36+00:00". | cited |
| V8 | The Coyote repository is not archived and its `main` branch received commits in November 2026, the latest dated 2026-11-11. | https://github.com/microsoft/coyote (page data) and https://github.com/microsoft/coyote/commits/main.atom | Page data: `"isArchived":false`. Feed entry: "Add .NET 11 support (#539)", updated "2026-11-11T19:01:17Z". | cited |
| V9 | Coyote's own documentation states continued investment and no formal support. | https://raw.githubusercontent.com/microsoft/coyote/main/docs/overview/faq.md and https://raw.githubusercontent.com/microsoft/coyote/main/README.md | "Microsoft continues to invest in Coyote and accepts community contributions as well." and "We are not able to provide any formal support." | cited |
| V10 | The changes after 1.7.11 are listed under an unreleased "vNext" heading in the Coyote change log. | https://raw.githubusercontent.com/microsoft/coyote/main/History.md | Heading "## vNext", first entry: "Added support for the `net11.0` target framework." | cited |
| V11 | The latest P release is 3.1.0 (GitHub release dated 2026-06-03; NuGet package `P` lists 3.1.0 as its newest version); the last commit on `master` is dated 2026-08-03. | https://github.com/p-org/P/releases/tag/p-3.1.0, https://api.nuget.org/v3-flatcontainer/p/index.json, https://github.com/p-org/P/commits/master.atom | Release page: `datetime="2026-06-03T18:35:46Z"`. | cited |
| V12 | The latest Dafny release is 4.11.0, dated 2025-08-25; a nightly build tag was updated 2026-11-06 and the last commit on `master` is dated 2026-11-03. | https://github.com/dafny-lang/dafny/releases/latest (redirects to `/releases/tag/v4.11.0`), https://github.com/dafny-lang/dafny/releases.atom, https://github.com/dafny-lang/dafny/commits/master.atom | Release page: `datetime="2025-08-25T19:53:51Z"`. | cited |
| V13 | The Dafny tool is a .NET 8.0 artifact and can be installed as a .NET tool. | https://raw.githubusercontent.com/dafny-lang/dafny/master/docs/Installation.md | "The `dafny tool` is a .NET 8.0 artifact, but it compiles to native executables on supported platforms." | cited |
| V14 | The latest FsCheck release is 3.6.0, dated 21 October 2026; the major version is 3. | https://raw.githubusercontent.com/fscheck/FsCheck/master/FsCheck%20Release%20Notes.md and https://api.nuget.org/v3/registration5-gz-semver2/fscheck/index.json | "## 3.6.0 - 21 October 2026" | cited |
| V15 | The latest CsCheck package on NuGet is 5.0.1, published 2026-11-03; the project file on the default branch targets `net10.0` and `net11.0`. | https://api.nuget.org/v3/registration5-gz-semver2/cscheck/index.json and https://raw.githubusercontent.com/AnthonyLloyd/CsCheck/master/CsCheck/CsCheck.csproj | "<Version>5.0.1</Version>" and "<TargetFrameworks>net10.0;net11.0</TargetFrameworks>" | cited |
| V16 | The last commit on the CsCheck default branch is dated 2026-11-10; the repository has no GitHub releases. | https://github.com/AnthonyLloyd/CsCheck/commits/master.atom and https://github.com/AnthonyLloyd/CsCheck/releases/latest (redirects to `/releases`) | Feed entry: "update to dotnet 11", updated "2026-11-10T17:02:10Z". | cited |
| V17 | The .NET runtime source was read at tag `v10.0.0` and the .NET SDK targets at tag `v10.0.100`; API pages were read with `view=net-10.0`. | https://raw.githubusercontent.com/dotnet/runtime/v10.0.0/src/libraries/System.Private.CoreLib/src/System/Double.cs | Both tags returned HTTP 200 for the files cited below. | cited |

### 1. Model checking of a specification: TLA+ with TLC, PlusCal, Apalache

What a person must write: a TLA+ or PlusCal model of the design, the properties (invariants, temporal properties), and a TLC model (constant values and, where needed, a state constraint) or an Apalache step bound.

| ID | Claim | Source URL | Quote | Tag |
|---|---|---|---|---|
| M1 | TLA+ models a design above the code level; it is not the code. | https://lamport.azurewebsites.net/tla/high-level-view.html | "TLA+ is a language for modeling software above the code level and hardware above the circuit level." | cited |
| M2 | The TLA+ author states that a model does not prevent coding errors. | https://lamport.azurewebsites.net/tla/high-level-view.html | "Writing a model above the code level doesn't prevent coding errors. Many methods and tools have been developed for finding coding errors, and they should be used." | cited |
| M3 | A model describes one aspect of a system and is never a complete description of it. | https://lamport.azurewebsites.net/tla/high-level-view.html | "No model is a completely accurate description of a real system. A model is a description of some aspect of the system, written for some purpose." | cited |
| M4 | What the tools check is that a property holds for every behaviour of the model. | https://lamport.azurewebsites.net/tla/high-level-view.html | "TLA+ can assert, and its tools can check, only that some property of an individual behavior is true of every possible behavior of the model." | cited |
| M5 | TLC is an explicit-state model checker for safety and liveness properties. | https://lamport.azurewebsites.net/tla/tools.html | "It is an explicit-state model checker that can check both safety and liveness properties." | cited |
| M6 | TLC needs a model in which a person assigns values to the specification's constants. | https://lamport.azurewebsites.net/tla/book-21-07-04.pdf (chapter 14, page 225) | "To do this, it must be given what we call a model of the specification. To define a model, we must assign values to the specification's constant parameters." | cited |
| M7 | In model-checking mode TLC tries to reach all states of that model; in simulation mode it samples behaviours. | https://lamport.azurewebsites.net/tla/book-21-07-04.pdf (chapter 14, page 226) | "You can also run TLC in simulation mode, in which it randomly generates behaviors, without trying to check all reachable states." | cited |
| M8 | A specification with infinitely many reachable states must be constrained to a finite one before TLC can check it exhaustively. | https://lamport.azurewebsites.net/tla/book-21-07-04.pdf (chapter 14, page 226) | "We must further constrain the model to make it finite--that is, so it allows only a finite number of possible states." | cited |
| M9 | Errors can exist that appear only on models larger than TLC can check exhaustively. | https://lamport.azurewebsites.net/tla/book-21-07-04.pdf (chapter 14, page 258) | "Many systems have errors that will show up only on models too large for TLC to check exhaustively." | cited |
| M10 | The TLC documentation tells the user to distrust a pass, because a safety property can hold vacuously. | https://lamport.azurewebsites.net/tla/book-21-07-04.pdf (chapter 14, page 258) | "You should also be suspicious if TLC finds no error when checking safety properties. It's very easy to satisfy a safety property by simply doing nothing." | cited |
| M11 | TLC stores 64-bit fingerprints of states, and a fingerprint collision makes it report full coverage of the model when states were skipped. | https://lamport.azurewebsites.net/tla/book-21-07-04.pdf (chapter 14, page 244) | "If this happens, TLC will not explore all the states that it should. In particular, with the default view, TLC will report that it has checked all reachable states when it hasn't." | cited |
| M12 | TLC's primitive values are Booleans, integers, strings and model values; the list has no real or floating-point numbers. | https://lamport.azurewebsites.net/tla/book-21-07-04.pdf (chapter 14, page 230) | "TLC can compute only a restricted class of values, called TLC values. Those values are built from the following four types of primitive values:" | cited |
| M13 | TLC has a stated upper limit on natural numbers. | https://lamport.azurewebsites.net/tla/current-tools.pdf (section 2.1) | "TLC cannot handle natural numbers greater than 2^31 - 1." (the exponent is a superscript in the PDF) | cited |
| M14 | A PlusCal algorithm is translated to a TLA+ model and checked with the same tools. | https://lamport.azurewebsites.net/tla/high-level-view.html | "A PlusCal algorithm is translated into a TLA+ model that can be checked with the TLA+ tools." | cited |
| M15 | In PlusCal the person decides what one atomic step is, by placing labels. | https://lamport.azurewebsites.net/tla/p-manual.pdf (section 2.6) | "A single step (atomic action) of a PlusCal algorithm consists of the execution from one label to the next." | cited |
| M16 | The PlusCal manual states that a program has no well-defined step, so the grain of atomicity is a modelling decision. | https://lamport.azurewebsites.net/tla/p-manual.pdf (introduction, before section 2.1) | "There is no well-defined notion of a step of a program." | cited |
| M17 | Apalache is a symbolic checker that checks inductive invariants and bounded executions. | https://raw.githubusercontent.com/apalache-mc/apalache/main/README.md | "Apalache can check inductive invariants (for fixed or bounded parameters) and check safety of bounded executions (bounded model checking)." | cited |
| M18 | Apalache assumes fixed finite parameters and analyses only executions of bounded length. | https://raw.githubusercontent.com/apalache-mc/apalache/main/docs/src/apalache/index.md | "As in TLC, all specification parameters are fixed and finite, i.e., the system state is initialized with integers, finite sets, and functions of finite domains and co-domains." and "Only finite executions of bounded length are analyzed." | cited |
| M19 | Apalache states that its default mode is incomplete: a pass means no violation up to the given length. | https://raw.githubusercontent.com/apalache-mc/apalache/main/docs/src/apalache/running.md | "Otherwise, it reports that no bug was found up to the given length. If a bug needs a long execution to get revealed, bounded model checking may miss it!" | cited |
| M20 | The default Apalache bound is 10 steps. | https://raw.githubusercontent.com/apalache-mc/apalache/main/docs/src/apalache/running.md | "`--length` specifies the maximal number of `Next` steps, *10 by default*" | cited |
| M21 | To cover executions of any length with Apalache, a person must supply an inductive invariant and check it in two runs. | https://raw.githubusercontent.com/apalache-mc/apalache/main/docs/src/apalache/running.md | "To check executions of arbitrary lengths, one usually finds a formula that satisfies the two following properties:" | cited |
| M22 | Apalache does not support real numbers. | https://raw.githubusercontent.com/apalache-mc/apalache/main/docs/src/apalache/features.md | Under the heading "Reals": "Not supported, not a priority" | cited |
| M23 | A paper whose authors include a developer of TLC describes a method, trace validation, that checks recorded implementation traces against a TLA+ specification by constrained model checking. | https://arxiv.org/abs/2404.16075 | "In this work we present a framework for relating traces of distributed programs to high-level specifications written in TLA+. The problem is reduced to a constrained model checking problem, realized using the TLC model checker." | cited |
| M24 | The instrumentation library of that framework is for Java. | https://arxiv.org/abs/2404.16075 | "Our framework consists of an API for instrumenting Java programs in order to record traces of executions, of a collection of TLA+ operators that are used for relating those traces to specifications, and of scripts for running the model checker." | cited |
| M25 | The trace validation paper states that the technique gives no formal correctness guarantee. | https://arxiv.org/pdf/2404.16075 (section 6) | "Although the technique does not provide formal correctness guarantees, mainly due to the necessary decisions on when to log an event corresponding to an atomic action, we have found it to be surprisingly effective for finding serious bugs in implementations that had previously been validated using traditional quality assurance techniques." | cited |
| M26 | Trace validation can accept a wrong trace when the trace records too little. | https://arxiv.org/pdf/2404.16075 (section 4) | "Regardless of whether we use a property or a postcondition, trace validation might incorrectly accept a trace if the trace provides incomplete information." | cited |
| M27 | The TLA+ wiki states that trace validation covers only the executions that were recorded. | https://docs.tlapl.us/using:tlc:trace_validation (a community wiki page on the TLA+ site that reproduces a comment by a TLC maintainer) | "However, TV is not exhaustive. It verifies that only a certain subset of all potential system executions aligns with the behaviors defined in the specification." | cited |
| M28 | A second paper, with the same TLC developer among its authors, reports binding a TLA+ specification to a C++ implementation. | https://arxiv.org/abs/2406.17455 | "We use the term smart casual verification to describe our hybrid approach, which combines the rigor of formal specification and model checking with the pragmatism of automated testing, in our case binding the formal specification in TLA+ to the C++ implementation." | cited |

Connection to C#/.NET, as far as the sources go.
The TLA+ tools run on Java and check a model, not C# code (V3, M1).
The only first-party route from a model to an implementation that was found is trace validation (M23 to M28), and its published tooling targets Java and C++.
No first-party C# or .NET instrumentation library for trace validation was found (see section (c)).

### 2. Systematic testing of concurrent C#: Coyote, and the P language

What a person must write for Coyote: a concurrency unit test, mocks that declare every source of nondeterminism, optional safety and liveness monitors, and a build step that rewrites the binaries.
What a person must write for P: a P model of the design as state machines, specification monitors, and a finite test driver.

| ID | Claim | Source URL | Quote | Tag |
|---|---|---|---|---|
| C1 | Coyote tests C# code itself, not a model of it. | https://raw.githubusercontent.com/microsoft/coyote/main/README.md | "Coyote is a cross-platform library and tool for testing concurrent C# code and deterministically reproducing bugs." | cited |
| C2 | Coyote states that it is not a verification system. | https://raw.githubusercontent.com/microsoft/coyote/main/docs/index.md | "Coyote is not a verification system. It does not use theorem proving to make correctness guarantees, instead it uses intelligent search strategies to drive systematic testing, based on deep understanding of concurrency primitives that you have used in your code." | cited |
| C3 | A Coyote run executes the test a configured number of times. | https://raw.githubusercontent.com/microsoft/coyote/main/README.md | "Coyote will take over and repeatedly execute the test from beginning to the end for N iterations (in the above example N was configured to `10`)." | cited |
| C4 | The command-line default is one iteration. | https://raw.githubusercontent.com/microsoft/coyote/main/docs/get-started/using-coyote.md | "If this option is not provided, the tester will perform 1 iteration by default." | cited |
| C5 | Coyote explores under a budget, and a larger schedule space is covered less. | https://raw.githubusercontent.com/microsoft/coyote/main/docs/concepts/binary-rewriting.md | "Since Coyote explores under a test "budget" (such as number of test iterations) the bigger the state space to explore, the less efficient Coyote will be." | cited |
| C6 | Coyote takes control by rewriting the IL of the test and production binaries. | https://raw.githubusercontent.com/microsoft/coyote/main/README.md | "Next, you run the `coyote rewrite` command from the CLI (typically as a post-build task) to automatically rewrite the IL of your test and production binaries." | cited |
| C7 | Reproducible replay requires that every source of nondeterminism is declared to Coyote. | https://raw.githubusercontent.com/microsoft/coyote/main/docs/concepts/concurrency-unit-testing.md | "This powerful testing ability, however, has one requirement: you must declare _all_ sources of non-determinism in your logic in a way that Coyote understands so that it is able to reproduce any nondeterministic bug that it finds and help you easily debug the issue." | cited |
| C8 | When a bug is found, Coyote writes a trace of all scheduling and nondeterministic choices that can be replayed. | https://raw.githubusercontent.com/microsoft/coyote/main/docs/overview/how.md | "If a bug is found, the `coyote test` tool reports a _reproducible_ bug trace that provides the global order of all scheduling decisions and nondeterministic choices made during the execution of a test." | cited |
| C9 | Coyote does not support every C# concurrency API. | https://raw.githubusercontent.com/microsoft/coyote/main/docs/concepts/binary-rewriting.md | "Coyote today does not support every single concurrency API in C#" (part of a longer sentence) | cited |
| C10 | The supported set is stated as `async`, `await`, `lock`, the common Task types and `Monitor`. | https://raw.githubusercontent.com/microsoft/coyote/main/docs/get-started/using-coyote.md | "Out of the box, Coyote supports finding and reproducing bugs in programs written using:" | cited |
| C11 | Coyote does not explore weak-memory behaviour. | https://raw.githubusercontent.com/microsoft/coyote/main/docs/concepts/binary-rewriting.md | "It does not explore weak-memory behaviors, such as a processor or the JIT reordering memory accesses. Every schedule that Coyote explores is sequentially consistent, so a bug that only manifests under a memory reordering can go unnoticed." | cited |
| C12 | Under systematic testing Coyote does not measure wall-clock time. | https://raw.githubusercontent.com/microsoft/coyote/main/docs/concepts/binary-rewriting.md | "The controlled scheduler serializes your program and decides itself when each operation runs, so it does not measure wall-clock time." | cited |
| C13 | Liveness checking in Coyote is heuristic. | https://raw.githubusercontent.com/microsoft/coyote/main/docs/concepts/specifications.md | "The tester resorts to heuristics: it considers a sufficiently long and hot execution as a proxy for a liveness violation." | cited |
| C14 | Other nondeterminism, such as failures and timeouts, is modelled by the person through a Coyote API inside mocks. | https://raw.githubusercontent.com/microsoft/coyote/main/docs/concepts/concurrency-unit-testing.md | "The `CoyoteRuntime.Random` API, for instance, returns a non-deterministic `bool` value. The exact value is chosen by the tester." | cited |
| C15 | A document in the Coyote repository, dated 2026-08-20, states that the released 1.7.11 command-line host cannot load a `net10.0` test assembly. | https://raw.githubusercontent.com/microsoft/coyote/main/NET10-COMPATIBILITY-ASSESSMENT.md | "The normal `coyote test` host is a `net8.0` process and fails to load a `net10.0` test assembly." | cited |
| C16 | The same document states that `System.Threading.Lock` was neither controlled nor reported as uncontrolled at that date. | https://raw.githubusercontent.com/microsoft/coyote/main/NET10-COMPATIBILITY-ASSESSMENT.md | "The latter is especially risky because it remains unreplaced without being reported as uncontrolled." | cited |
| C17 | Commits adding .NET 10 and .NET 11 support landed on `main` in November 2026, after the newest NuGet package (V7), so that support is not in a published package as of this date. | https://github.com/microsoft/coyote/commits/main.atom and V7 | Feed entry: "Add .NET 10 compatibility support (#534)", updated "2026-11-03T03:23:55Z". | unverified (inferred from the feed dates and the NuGet date; needs experiment X7) |
| P1 | P is a modelling language; a P program is a model of the design. | https://raw.githubusercontent.com/p-org/P/master/README.md | "P is a state machine based programming language for formally modeling and specifying complex distributed systems." | cited |
| P2 | The P compiler emits a C# assembly of the model, and the P checker explores that assembly. | https://raw.githubusercontent.com/p-org/P/master/Docs/docs/getstarted/usingP.md | "Compiling the ClientServer program generates a `ClientServer.dll`, this `dll` is the C# representation of the P program. The P Checker takes as input this `dll` and systematically explores behaviors of the program for the specified test case." | cited |
| P3 | The P checker explores a chosen number of schedules, one by default. | https://raw.githubusercontent.com/p-org/P/master/Docs/docs/getstarted/usingP.md | "specify how many different schedules to explore when running this test case (by default the checker explores a single schedule)." (end of a longer sentence) | cited |
| P4 | A P check runs under a finite test harness that a person writes. | https://raw.githubusercontent.com/p-org/P/master/Docs/docs/whatisP.md | "**Model checking scenario** — provides the finite non-deterministic test-harness under which the model checker verifies that the model satisfies its specifications" | cited |
| P5 | The same page describes a pass in stronger words than P3 supports. | https://raw.githubusercontent.com/p-org/P/master/Docs/docs/whatisP.md | "Once all checks pass, the P model is validated for correctness." | cited |
| P6 | The exhaustive P backend is described as covering small finite instances, and its sample output is bounded by a step limit. | https://raw.githubusercontent.com/p-org/P/master/Docs/docs/advanced/pex.md | "PEx is an exhaustive model checker for P programs that performs a systematic search to verify correctness properties for small (finite) instances of the system." and, from a sample result line, "Verified correct up to step 10,001" | cited |
| P7 | On a failure the P checker writes a schedule file that replays the error trace. | https://raw.githubusercontent.com/p-org/P/master/Docs/docs/getstarted/usingP.md | "A **schedule file** (e.g., `ClientServer_0_0.schedule`) that can be used to replay the error trace and single step through the P program with the generated error trace for debugging" | cited |
| P8 | The P documentation names the gap between the checked design and the shipped implementation. | https://raw.githubusercontent.com/p-org/P/master/Docs/docs/advanced/pobserve/pobserve.md | "But it's the implementation that gets shipped (and not design), how do we connect our design-level specifications to implementation?" | cited |
| P9 | P's answer to that gap is checking service logs against P specifications; the stream processing is implemented in Java. | https://raw.githubusercontent.com/p-org/P/master/Docs/docs/advanced/pobserve/pobserve.md | "PObserve is a distributed runtime monitoring framework that allows checking formal correctness specifications on systems implementation using service logs." and "The stream processing block in the figure is implemented using Java Streams" | cited |
| P10 | The P toolchain needs the .NET SDK, version 8.0 as stated. | https://raw.githubusercontent.com/p-org/P/master/Docs/docs/getstarted/install.md | "The P compiler is implemented in C# and hence the tool chain requires `dotnet`. P currently uses the specific version of [.Net SDK 8.0](https://dotnet.microsoft.com/en-us/download/dotnet/8.0)." | cited |

What exploring schedules establishes, as far as the sources go.
A found bug is real for the explored schedule and can be replayed (C8, P7).
A run without a bug establishes that the explored schedules, within the iteration budget and the controlled APIs, did not violate the assertions and monitors (C2, C3, C5, C9, P3).
It does not establish the absence of a bug in unexplored schedules, in uncontrolled or unsupported APIs, or under memory reordering (C5, C9, C11).

Connection to C#/.NET.
Coyote runs on the compiled C# assemblies (C6).
P uses C# only as the compilation target of the model (P2); the implementation under development is not what P checks (P1, P8).

### 3. Deductive verification: Dafny

What a person must write: the program in Dafny, with preconditions, postconditions, loop invariants and termination measures, and a specification for every external method.

| ID | Claim | Source URL | Quote | Tag |
|---|---|---|---|---|
| D1 | Dafny verifies functional correctness of a Dafny program against its specifications. | https://raw.githubusercontent.com/dafny-lang/dafny/master/docs/DafnyRef/Introduction.md | "The Dafny static program verifier can be used to verify the functional correctness of programs." | cited |
| D2 | Dafny can compile to C#. | https://raw.githubusercontent.com/dafny-lang/dafny/master/README.md | "When you're done, Dafny can **compile your code to C#, Go, Python, Java, or JavaScript** (more to come!), so it can integrate with your existing workflow." | cited |
| D3 | Only the code that originates from Dafny is verified; code it is combined with is not. | https://raw.githubusercontent.com/dafny-lang/dafny/master/docs/DafnyRef/UserGuide.md (section 13.8) | "The compiled code originating from `dafny` can be combined with other source and binary code, but only the `dafny`-originated code is verified." | cited |
| D4 | The compiled program is intended to be faithful to the verified program, and the manual states this is not always possible. | https://raw.githubusercontent.com/dafny-lang/dafny/master/docs/DafnyRef/UserGuide.md (section 13.6.1.4) | "The `dafny` tool intends that the compiled program in the target language be a semantically faithful rendering of the (verified) Dafny program. However, resource and language limitations make this not always possible." | cited |
| D5 | "Verified" requires all methods verified and no unproven assumptions. | https://raw.githubusercontent.com/dafny-lang/dafny/master/docs/DafnyRef/UserGuide.md (section 13.6.1.3) | "To be considered _verified_ all the methods in all the files in a program must be verified, with consistent sets of options, and with no unproven assumptions (see [`dafny audit`](#sec-dafny-audit) for a tool to help identify such assumptions)." | cited |
| D6 | The postcondition of an external (for example C#) method is assumed, not proved. | https://raw.githubusercontent.com/dafny-lang/dafny/master/docs/DafnyRef/UserGuide.md (section 13.6.1.8) | "If code implemented externally, and called from Dafny, has an `ensures` clause, Dafny assumes that it satisfies that clause. Since Dafny cannot prove properties about code written in other languages, adding tests to provide evidence that any `ensures` clauses do hold can improve assurance." | cited |
| D7 | Specifications are not present in the compiled output. | https://raw.githubusercontent.com/dafny-lang/dafny/master/docs/DafnyRef/Introduction.md | "Specifications and ghost constructs are used only during verification; the compiler omits them from the executable code." | cited |
| D8 | An `expect` statement is the documented way to keep a check at run time. | https://raw.githubusercontent.com/dafny-lang/dafny/master/docs/DafnyRef/UserGuide.md (section 13.6.1.8) | "Alternatively, converting it to an `expect` statement will cause it to be checked at runtime." | cited |
| D9 | Dafny is described as a sequential language. | https://raw.githubusercontent.com/dafny-lang/dafny/master/docs/DafnyRef/Introduction.md | "It is imperative, sequential, supports generic classes, inheritance and abstraction, methods and functions, dynamic allocation, inductive and coinductive datatypes, and specification constructs." | cited |
| D10 | In the reference manual at the 4.11.0 tag, the numeric types are `int` (all integers) and `real` (all real numbers); the string "fp64" does not occur in that file. | https://raw.githubusercontent.com/dafny-lang/dafny/v4.11.0/docs/DafnyRef/Types.md | "Dafny supports _numeric types_ of two kinds, _integer-based_, which includes the basic type `int` of all integers, and _real-based_, which includes the basic type `real` of all real numbers." | cited |
| D11 | In the C# runtime at the 4.11.0 tag, a rational type `BigRational` is defined as two arbitrary-precision integers (source code). | https://raw.githubusercontent.com/dafny-lang/dafny/v4.11.0/Source/DafnyRuntime/DafnyRuntime.cs (lines 1694 to 1700) | "public struct BigRational {" and "public readonly BigInteger num, den;" | cited |
| D12 | `real` compiles to this rational type in C#, so a proof over `real` says nothing about `double` arithmetic. | D10, D11 and the numeric comparison table at https://raw.githubusercontent.com/dafny-lang/dafny/master/docs/DafnyRef/Types.md (section 5.2.3.10, row "Hardware mapping") | The table row lists `real` against "BigRational". | unverified (the table is on the development branch; the mapping at 4.11.0 was not read in the compiler; needs experiment X8) |
| D13 | The development branch of the manual documents IEEE 754 types `fp32` and `fp64`; the manual at the latest release tag does not. | https://raw.githubusercontent.com/dafny-lang/dafny/master/docs/DafnyRef/Types.md (section 5.2.3) | "Dafny supports two floating-point types: `fp32` (IEEE 754 binary32, single-precision) and `fp64` (IEEE 754 binary64, double-precision)." | cited |
| D14 | On the development branch, `fp64` equality is defined differently from IEEE 754 equality, and arithmetic operators require proof that operands are not NaN. | https://raw.githubusercontent.com/dafny-lang/dafny/master/docs/DafnyRef/Types.md (sections 5.2.3.4 and 5.2.3.5) | "Both `fp32` and `fp64` types have equality semantics that differ from IEEE 754." and "All these arithmetic operations and comparisons require that operands are not NaN." | cited |
| D15 | The audit command that lists assumptions is marked as under development. | https://raw.githubusercontent.com/dafny-lang/dafny/master/docs/DafnyRef/UserGuide.md (section 13.6.1.8) | "The `dafny audit` command reports issues in the Dafny code that might limit the soundness claims of verification." followed by "_This command is under development._" | cited |
| D16 | The generated C# needs a Dafny runtime library and the .NET 8.0 tools. | https://raw.githubusercontent.com/dafny-lang/dafny/master/docs/DafnyRef/UserGuide.md (section 13.8) and https://raw.githubusercontent.com/dafny-lang/dafny/master/docs/Installation.md | "Code generated by `dafny` requires a Dafny-specific runtime library." and "Only the .NET 8.0 set of tools (which includes the C# compiler) is needed to compile and run the generated C# code." | cited |

Connection to C#/.NET.
Dafny does not verify existing C# source; the verified artifact is Dafny source, and C# is an output (D2, D3).
Hand-written C# that calls or is called by the generated code is outside the proof (D3, D6).

### 4. Property-based testing for .NET: FsCheck and CsCheck

What a person must write: the property (a predicate that must hold for every input), the generators when the defaults do not match the real input domain, and, for stateful code, a model and a set of operations.

| ID | Claim | Source URL | Quote | Tag |
|---|---|---|---|---|
| F1 | FsCheck tests a property on randomly generated cases and can be used from C#. | https://raw.githubusercontent.com/fscheck/FsCheck/master/README.md | "The programmer provides a specification of the program, in the form of properties that functions, methods or objects should satisfy, and FsCheck then tests that the properties hold in a large number of randomly generated cases." and "Specifications are expressed in F#, C# or VB, using combinators defined in the FsCheck library." | cited |
| F2 | An FsCheck test passes when the configured number of cases, 100 by default, ran without a counterexample. | https://raw.githubusercontent.com/fscheck/FsCheck/master/docs/RunningTests.fsx | "It passes when FsCheck can execute 100 tests (or whatever the configured number of tests is) successfully." | cited |
| F3 | With a precondition, fewer cases than the configured number can be what a reported result rests on. | https://raw.githubusercontent.com/fscheck/FsCheck/master/docs/Properties.fsx | "In this case a message such as "Arguments exhausted after 97 tests." indicates that 97 test cases satisfying the condition were found, and that the property held in those 97 cases." | cited |
| F4 | FsCheck shrinks a counterexample toward a minimal one. | https://raw.githubusercontent.com/fscheck/FsCheck/master/docs/QuickStart.fsx | "FsCheck also *shrinks* the counterexample: it tries to find the minimal counterexample that still fails the property." | cited |
| F5 | FsCheck prints the generator seed on failure, and a run can be replayed from it. | https://raw.githubusercontent.com/fscheck/FsCheck/master/docs/TipsAndTricks.fsx | "For this reason, FsCheck displays the seed of its pseudo-random number generator when a test fails." | cited |
| F6 | The C# form of a replay is a configuration call (source code of the documentation snippets). | https://raw.githubusercontent.com/fscheck/FsCheck/master/examples/FsCheck.Docs.CSharpSnippets/TipsAndTricks.cs | ".Check(Config.Quick.WithReplay(1145655947UL, 296144285UL));" | cited |
| F7 | FsCheck's model-based (stateful) testing is in an experimental namespace outside its versioning promise. | https://raw.githubusercontent.com/fscheck/FsCheck/master/docs/StatefulTesting.fsx | "*Caveat: since this is in the FsCheck.Experimental namespace, the rules of semantic versioning do not apply to this particular part of the API. In other words, minor version releases may break your code.*" | cited |
| F8 | In FsCheck's model-based testing, generated operation sequences are applied to the real object and to a model, and the two are compared after each operation. | https://raw.githubusercontent.com/fscheck/FsCheck/master/docs/StatefulTesting.fsx | "What you're actually defining is a state machine which can simultaneously apply operations, or state transitions, to the actual system under test (in this case, a simple object) and a model of the system under test." | cited |
| F9 | FsCheck's shrinking assumes a test can be re-executed with unchanged inputs, which mutable generated objects break. | https://raw.githubusercontent.com/fscheck/FsCheck/master/docs/TipsAndTricks.fsx | "This is certainly possible, but for shrinking FsCheck assumes that it can re-execute the same test multiple times without the inputs changing." | cited |
| F10 | The FsCheck documentation shows a generated list of floats that contains NaN. | https://raw.githubusercontent.com/fscheck/FsCheck/master/docs/QuickStart.fsx | "Consider a list of floats that contains `NaN` (not a number). Since `NaN <> NaN`, the reverse of the reverse of `[NaN]` is not actually equal to `[NaN]`." | cited |
| F11 | FsCheck integrates with xUnit through a property attribute whose methods take generated arguments. | https://raw.githubusercontent.com/fscheck/FsCheck/master/src/FsCheck.Xunit/README.md | "FsCheck.Xunit integrates FsCheck with xUnit.NET by adding a `PropertyAttribute` that runs FsCheck tests, similar to xUnit.NET's `FactAttribute`." | cited |
| K1 | CsCheck is a random testing library for C#. | https://raw.githubusercontent.com/AnthonyLloyd/CsCheck/master/README.md | "CsCheck is a C# random testing library inspired by QuickCheck." | cited |
| K2 | A CsCheck sample runs 100 iterations by default, or for a set time. | https://raw.githubusercontent.com/AnthonyLloyd/CsCheck/master/README.md | "The default sample size is 100 iterations. Set iter: to change this or time: to run for a number of seconds." | cited |
| K3 | CsCheck generation and shrinking are both driven by a seeded random number generator, not by a shrink tree. | https://raw.githubusercontent.com/AnthonyLloyd/CsCheck/master/README.md | "It differs in that generation and shrinking are both based on [PCG](https://www.pcg-random.org), a fast random number generator." | cited |
| K4 | A failing CsCheck sample prints a seed that replays the shrunk failure. | https://raw.githubusercontent.com/AnthonyLloyd/CsCheck/master/README.md | "**seed** - paste into `seed:` (or set environment variable `CsCheck_Seed`) to replay this exact failure." | cited |
| K5 | CsCheck's model-based sampling applies random operation sequences to the real object and a model and compares them after each operation. | https://raw.githubusercontent.com/AnthonyLloyd/CsCheck/master/README.md | "SampleModelBased generates an initial actual and model, then applies a random sequence of operations to both, checking that the actual and model stay equal after each operation." | cited |
| K6 | CsCheck's parallel sampling runs operations in parallel and accepts the result if some sequential order of them explains it. | https://raw.githubusercontent.com/AnthonyLloyd/CsCheck/master/README.md | "Starting from an initial state, some operations are run sequentially and then some in parallel. The parallel result is compared against every possible linearization of those operations, and at least one must match." | cited |
| K7 | Reproducing a parallel failure from its seed is retried up to a configured count, 100 by default. | https://raw.githubusercontent.com/AnthonyLloyd/CsCheck/master/README.md | "replay - The number of times to retry the seed to reproduce a SampleParallel fail (default 100)." | cited |
| K8 | The default `double` generator is a range from -1e50 to 1e50 (source code). | https://raw.githubusercontent.com/AnthonyLloyd/CsCheck/master/CsCheck/Gen.cs (line 2071) | "internal static readonly Gen<double> DefaultDouble = Double[-1e50, 1e50];" | cited |
| K9 | NaN, the infinities and the extreme values come from a separate generator that a person must select (source code). | https://raw.githubusercontent.com/AnthonyLloyd/CsCheck/master/CsCheck/Gen.cs (lines 2833 to 2862) | "0x0UL => double.NaN," and the documentation comment "With more special values like nan, inf, max, epsilon, -2, -1, 0, 1, 2." | cited |
| K10 | CsCheck's specification feature separates an exhaustive result on a small model from a sampled one. | https://raw.githubusercontent.com/AnthonyLloyd/CsCheck/master/README.md | "**`Exhaustive`** enumerates the whole reachable state space breadth first. When it closes, every requirement is *proved* for the model rather than sampled, including bounded `Response` requirements, whose outstanding deadlines are carried in the search state." | cited |
| K11 | The same feature states that the exhaustive result is about the model, and the conformance result is about the traces walked. | https://raw.githubusercontent.com/AnthonyLloyd/CsCheck/master/README.md | "Exhaustive proves the model. Conform checks the real object on the traces it walked." | cited |
| K12 | CsCheck reports when a requirement passed only because its trigger never occurred. | https://raw.githubusercontent.com/AnthonyLloyd/CsCheck/master/README.md | "If that never happened the row says NEVER: the check passed only because it was never in a position to fail:" | cited |
| K13 | CsCheck's guide positions random testing as an addition to example tests. | https://raw.githubusercontent.com/AnthonyLloyd/CsCheck/master/docs/GettingStarted.md | "CsCheck does not replace normal unit tests: keep important named examples, and add CsCheck tests where trying many inputs gives you extra confidence." | cited |
| K14 | The specification feature (`Spec.cs`) entered the repository on 2026-09-09, before the 5.0.1 release commit of 2026-11-03, so it is expected to be in the 5.0.1 package. | https://github.com/AnthonyLloyd/CsCheck/commits/master/CsCheck/Spec.cs.atom and https://github.com/AnthonyLloyd/CsCheck/commits/master.atom | Feed entries: "add specification testing (#68)", updated "2026-09-09T23:06:01Z"; "release 5.0.1", updated "2026-11-03T08:04:16Z". | unverified (inferred from commit dates; the package contents were not opened; needs experiment X5) |

What a passing run establishes, as far as the sources go.
The property held for each generated case in the sample, of the stated size, drawn from the stated generators (F2, K2).
It does not establish the property for inputs that were not generated; neither library's documentation claims otherwise, and neither states this limit in a sentence that could be quoted, except CsCheck's contrast between "proved" and "sampled" (K10, K11).
The generator bounds what can be found: CsCheck's default `double` generator cannot produce NaN or an infinity (K8, K9).

### 5. Run-time invariants in .NET

| ID | Claim | Source URL | Quote | Tag |
|---|---|---|---|---|
| R1 | `Debug.Assert` is declared conditional on the `DEBUG` symbol (source code). | https://raw.githubusercontent.com/dotnet/runtime/v10.0.0/src/libraries/System.Private.CoreLib/src/System/Diagnostics/Debug.cs (lines 80 to 83) | "[Conditional("DEBUG")]" | cited |
| R2 | The documentation states that `Debug.Assert` works only in debug builds by default. | https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.debug.assert?view=net-10.0 | "By default, the Debug.Assert method works only in debug builds. Use the Trace.Assert method if you want to do assertions in release builds." | cited |
| R3 | A side effect inside a `Debug.Assert` argument disappears in Release builds. | https://learn.microsoft.com/en-us/visualstudio/debugger/assertions-in-managed-code | "When you use System.Diagnostics.Debug.Assert, make sure that any code inside Assert doesn't change the results of the program if Assert is removed." | cited |
| R4 | `Trace.Assert` is declared conditional on the `TRACE` symbol (source code). | https://raw.githubusercontent.com/dotnet/runtime/v10.0.0/src/libraries/System.Diagnostics.TraceSource/src/System/Diagnostics/Trace.cs (lines 113 to 118) | "[Conditional("TRACE")]" | cited |
| R5 | The documentation states that `TRACE` is defined by default in both configurations and `DEBUG` only in Debug. | https://learn.microsoft.com/en-us/visualstudio/debugger/assertions-in-managed-code | "If you create your project using the Visual Studio wizards, the TRACE symbol is defined by default in both Release and Debug configurations. The DEBUG symbol is defined by default only in the Debug build." | cited |
| R6 | The .NET SDK's C# properties add `TRACE` without a configuration condition (source code). | https://raw.githubusercontent.com/dotnet/sdk/v10.0.100/src/Tasks/Microsoft.NET.Build.Tasks/targets/Microsoft.NET.Sdk.CSharp.props (lines 20 to 23) | "<DefineConstants>$(DefineConstants)TRACE</DefineConstants>" | cited |
| R7 | On Windows at runtime tag v10.0.0, a failed assertion with no debugger attached ends the process with `Environment.FailFast`; no dialog is shown (source code). | https://raw.githubusercontent.com/dotnet/runtime/v10.0.0/src/libraries/System.Private.CoreLib/src/System/Diagnostics/DebugProvider.Windows.cs (lines 16 to 27) | "Environment.FailFast(ex.Message, ex, errorSource);" preceded by the comment "// In Core, we do not show a dialog." | cited |
| R8 | The API page for `Debug.Assert` still describes a message box with Abort, Retry and Ignore; this disagrees with the source in R7. | https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.debug.assert?view=net-10.0 | "When the application runs in user interface mode, it displays a message box that shows the call stack with file and line numbers." | cited |
| R9 | A failed `Trace.Assert` in a Release build reaches the same fail-fast path through the default trace listener. | https://raw.githubusercontent.com/dotnet/runtime/v10.0.0/src/libraries/System.Diagnostics.TraceSource/src/System/Diagnostics/DefaultTraceListener.cs (lines 78 to 94) | "DebugProvider.FailCore(stackTrace, message, detailMessage, "Assertion Failed");" inside "if (AssertUiEnabled)" | unverified (the call chain from `Trace.Assert` to the listener and the default of `AssertUiEnabled` were not read; needs experiment X1) |
| R10 | Code Contracts are not supported on .NET 5 and later. | https://learn.microsoft.com/en-us/dotnet/framework/debug-trace-profile/code-contracts | "Code contracts aren't supported in .NET 5+ (including .NET Core versions). Consider using Nullable reference types instead." | cited |
| R11 | `Contract.Requires` still exists at runtime tag v10.0.0, is conditional on `CONTRACTS_FULL`, and its body only reports that the rewriter is required (source code). | https://raw.githubusercontent.com/dotnet/runtime/v10.0.0/src/libraries/System.Private.CoreLib/src/System/Diagnostics/Contracts/Contracts.cs (lines 296 to 301) | "[Conditional("CONTRACTS_FULL")]" and "AssertMustUseRewriter(ContractFailureKind.Precondition, "Requires");" | cited |
| R12 | The guard helper `ThrowIfNegative` throws when the value is negative, in every build configuration: the method has no conditional attribute and its body is a plain test (source code). | https://raw.githubusercontent.com/dotnet/runtime/v10.0.0/src/libraries/System.Private.CoreLib/src/System/ArgumentOutOfRangeException.cs (lines 139 to 144) and https://learn.microsoft.com/en-us/dotnet/api/system.argumentoutofrangeexception.throwifnegative?view=net-10.0 | "if (T.IsNegative(value))" and "Throws an ArgumentOutOfRangeException if value is negative." | cited |
| R13 | The class page lists the guard helpers `ThrowIfEqual`, `ThrowIfGreaterThan`, `ThrowIfGreaterThanOrEqual`, `ThrowIfLessThan`, `ThrowIfLessThanOrEqual`, `ThrowIfNegative`, `ThrowIfNegativeOrZero`, `ThrowIfNotEqual` and `ThrowIfZero`. | https://learn.microsoft.com/en-us/dotnet/api/system.argumentoutofrangeexception?view=net-10.0 | The method list of the page contains these nine names. | cited |
| R14 | The range guards compare with `CompareTo`, not with the `<` and `>` operators (source code). | https://raw.githubusercontent.com/dotnet/runtime/v10.0.0/src/libraries/System.Private.CoreLib/src/System/ArgumentOutOfRangeException.cs (lines 180 to 185) | "if (value.CompareTo(other) > 0)" | cited |
| R15 | For `double`, `CompareTo` orders NaN below every other value (source code). | https://raw.githubusercontent.com/dotnet/runtime/v10.0.0/src/libraries/System.Private.CoreLib/src/System/Double.cs (lines 290 to 293) | "return IsNaN(value) ? 0 : -1;" inside "if (IsNaN(m_value))" | cited |
| R16 | Therefore `ArgumentOutOfRangeException.ThrowIfGreaterThan(double.NaN, limit)` does not throw, and an upper-bound guard lets NaN through. | R14 and R15 | Inference from the two method bodies. | unverified (inferred from two cited bodies; needs experiment X2) |
| R17 | `UnreachableException` is the documented exception for a code path believed unreachable. | https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.unreachableexception?view=net-10.0 | "The exception that is thrown when the program executes an instruction that was thought to be unreachable." | cited |

What a run-time invariant establishes.
It establishes nothing before the run; it converts a violated assumption into a visible failure on the executions that occur, and only in the build configurations where the check is compiled in (R1, R4, R12).

### 6. Floating point in .NET

| ID | Claim | Source URL | Quote | Tag |
|---|---|---|---|---|
| N1 | The C# reference states that `float` and `double` conform to the IEEE 754 binary formats. | https://raw.githubusercontent.com/dotnet/docs/main/docs/csharp/language-reference/builtin-types/floating-point-numeric-types.md | "The `float` and `double` types conform to the IEEE 754 specification for binary floating-point arithmetic (`binary32` and `binary64`, respectively)." | cited |
| N2 | The C# standard permits an implementation to compute with more precision than the result type. | https://raw.githubusercontent.com/dotnet/csharpstandard/standard-v7/standard/types.md (section 8.3.7) | "Floating-point operations may be performed with higher precision than the result type of the operation. To force a value of a floating-point type to the exact precision of its type, an explicit cast ([§12.9.7](expressions.md#1297-cast-expressions)) can be used." | cited |
| N3 | The CLI standard states that the internal floating-point representation is implementation-dependent and can vary. | https://ecma-international.org/wp-content/uploads/ECMA-335_6th_edition_june_2012.pdf (partition I, section 12.1.3) | "The size of the internal floating-point representation is implementation-dependent, can vary, and shall have precision at least as great as that of the variable or expression being represented." | cited |
| N4 | The CLI standard fixes the rounding mode to round-to-nearest and gives no way to change it. | https://ecma-international.org/wp-content/uploads/ECMA-335_6th_edition_june_2012.pdf (partition I, section 12.1.3) | "The rounding mode defined in IEC 60559:1989 shall be set by the CLI to "round to the nearest number," and neither the CIL nor the class library provide a mechanism for modifying this setting." | cited |
| N5 | Floating-point operators never throw; they produce zero, an infinity or NaN. | https://raw.githubusercontent.com/dotnet/csharpstandard/standard-v7/standard/types.md (section 8.3.7) | "The floating-point operators, including the assignment operators, never produce exceptions. Instead, in exceptional situations, floating-point operations produce zero, infinity, or NaN, as described below:" | cited |
| N6 | Every comparison operator with a NaN operand is false, except `!=`. | https://raw.githubusercontent.com/dotnet/csharpstandard/standard-v7/standard/expressions.md (section 12.12.3) | "If either operand is NaN, the result is `false` for all operators except `!=`, for which the result is `true`." | cited |
| N7 | `Equals` and `==` disagree on NaN. | https://learn.microsoft.com/en-us/dotnet/api/system.double.equals?view=net-10.0 | "If two Double.NaN values are tested for equality by calling the Equals method, the method returns true. However, if two Double.NaN values are tested for equality by using the equality operator, the operator returns false." | cited |
| N8 | `double.IsFinite` is false for NaN and for both infinities. | https://learn.microsoft.com/en-us/dotnet/api/system.double.isfinite?view=net-10.0 and https://raw.githubusercontent.com/dotnet/runtime/v10.0.0/src/libraries/System.Private.CoreLib/src/System/Double.cs (line 166) | "Determines whether the specified value is finite (zero, subnormal, or normal)." and the source remark "This effectively checks the value is not NaN and not infinite." | cited |
| N9 | The `Double` documentation states that arithmetic results can differ by platform. | https://learn.microsoft.com/en-us/dotnet/fundamentals/runtime-libraries/system-double | "In addition, the result of arithmetic and assignment operations with Double values might differ slightly by platform because of the loss of precision of the Double type. For example, the result of assigning a literal Double value might differ in the 32-bit and 64-bit versions of .NET." | cited |
| N10 | The `Double.Equals` documentation states that a comparison of two particular numbers can change between .NET versions. | https://learn.microsoft.com/en-us/dotnet/api/system.double.equals?view=net-10.0 | "The precision of floating-point numbers beyond the documented precision is specific to the implementation and version of .NET. Consequently, a comparison of two particular numbers might change between versions of .NET because the precision of the numbers' internal representation might change." | cited |
| N11 | `Math.Sin` and `Math.Pow` are documented as able to give different exact results on different operating systems or architectures. | https://learn.microsoft.com/en-us/dotnet/api/system.math.sin?view=net-10.0 and https://learn.microsoft.com/en-us/dotnet/api/system.math.pow?view=net-10.0 | "This method calls into the underlying C runtime, and the exact result or valid input range may differ between different operating systems or architectures." | cited |
| N12 | The `Math.Sqrt` page, searched for the same sentence, does not contain it; this is a null result on one page and not a guarantee. | https://learn.microsoft.com/en-us/dotnet/api/system.math.sqrt?view=net-10.0 | No matching text. | cited |
| N13 | The tensor math primitives carry a similar remark that also names architecture-specific instructions. | https://learn.microsoft.com/en-us/dotnet/api/system.numerics.tensors.tensorprimitives.exp?view=net-10.0-pp | "This method may call into the underlying C runtime or employ instructions specific to the current architecture. Exact results may differ between different operating systems or architectures." | cited |
| N14 | A fused multiply-add gives a result that can differ from a separate multiply and add. | https://learn.microsoft.com/en-us/dotnet/api/system.math.fusedmultiplyadd?view=net-10.0 | "This differs from the non-fused sequence, which would compute (x * y) as if to infinite precision, round the result to the nearest representable value, add z to the rounded result as if to infinite precision, and finally round to the nearest representable value." | cited |
| N15 | Before .NET 9, conversion from floating point to integer differed by platform for out-of-range values; .NET 9 made it saturating on x86 and x64. | https://learn.microsoft.com/en-us/dotnet/core/compatibility/jit/9.0/fp-to-integer | "Floating point-to-integer conversions now have saturating behavior on x86 and x64 machines." and "This change was made to standardize all floating point-to-integer conversions to have saturating behavior and to make the behavior deterministic." | cited |
| N16 | The same page calls the earlier conversion behaviour non-deterministic and says other platforms already gave different results. | https://learn.microsoft.com/en-us/dotnet/core/compatibility/jit/9.0/fp-to-integer | "Using these intrinsics is tricky, however, because other target platforms (such Arm64) already produce different results." | cited |
| N17 | Parsing and formatting of floating-point values are documented as IEEE 754 compliant from .NET Core 3.0. | https://learn.microsoft.com/en-us/dotnet/core/compatibility/3.0 | "Starting with .NET Core 3.0, floating-point parsing and formatting operations are IEEE 754-compliant." | cited |
| N18 | A seeded `Random` is not guaranteed to give the same sequence in a different .NET version. | https://learn.microsoft.com/en-us/dotnet/fundamentals/runtime-libraries/system-random | "The implementation of the random number generator in the Random class isn't guaranteed to remain the same across major versions of .NET. As a result, you shouldn't assume that the same seed will result in the same pseudo-random sequence in different versions of .NET." | cited |
| N19 | String hash codes can differ between runs of the same program. | https://learn.microsoft.com/en-us/dotnet/api/system.string.gethashcode?view=net-10.0 | "In some cases, they can even differ by application domain. This implies that two subsequent runs of the same program may return different hash codes." | cited |
| N20 | The enumeration order of `Dictionary<TKey,TValue>` is undefined. | https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.dictionary-2?view=net-10.0 | "The order in which the items are returned is undefined." | cited |
| N21 | `TimeProvider` is the documented abstraction for making time controllable in tests. | https://learn.microsoft.com/en-us/dotnet/standard/datetime/timeprovider-overview | "By using TimeProvider, you ensure that your code is testable and predictable." | cited |

What the sources say about identical results across machines, runtimes or hardware.
The sources state conformance of the formats (N1) and of parsing and formatting (N17).
The sources state that results can differ in specific cases: by platform for arithmetic and literals (N9), by .NET version (N10), by operating system or architecture for library math functions (N11, N13), and, before .NET 9, by platform for out-of-range integer conversion (N15, N16).
The standards allow an implementation to use more precision internally (N2, N3).
No first-party statement was found that `double` results are identical across machines, runtimes or hardware.
A replay that must be identical on another machine therefore has no documented guarantee to rest on; it needs a measurement on each target (experiment X6), and it must also avoid the other documented sources of variation (N18, N19, N20).

### 7. Replay and determinism testing

Primary sources exist for deterministic simulation and for record and replay as methods.
They were written by the authors of two database systems and two debuggers.
None of them is about .NET, and none describes a fixed-step loop with recorded input.

| ID | Claim | Source URL | Quote | Tag |
|---|---|---|---|---|
| S1 | One database project describes deterministic simulation of a whole cluster in a single thread, and claims repeatability of a run. | https://apple.github.io/foundationdb/testing.html | "Simulation is able to conduct a deterministic simulation of an entire FoundationDB cluster within a single-threaded process. Determinism is crucial in that it allows perfect repeatability of a simulated run, facilitating controlled experiments to home in on issues." | cited |
| S2 | A second database project ties reproduction of a simulated failure to a seed and an exact source revision. | https://raw.githubusercontent.com/tigerbeetle/tigerbeetle/main/docs/internals/vopr.md | "Because our simulator is deterministic based on a _seed_ number and the Git commit, we can perfectly reproduce any bugs discovered in testing for easy local debugging." | cited |
| S3 | That project states the precondition: every nondeterministic part is replaced in the simulator. | https://raw.githubusercontent.com/tigerbeetle/tigerbeetle/main/docs/internals/vopr.md | "In the simulator, all non-deterministic parts of the system are stubbed out. This includes the clock, network, and disk operations." | cited |
| S4 | The same document pairs simulation with assertions kept on in production. | https://raw.githubusercontent.com/tigerbeetle/tigerbeetle/main/docs/internals/vopr.md | "Assertions are a force multiplier when used with simulation testing and fuzzing. If any assertion is broken under a specific set of circumstances, the simulation will crash and we debug that failure." | cited |
| S5 | A record-and-replay debugger claims that one recorded execution is replayed identically each time. | https://rr-project.org/ | "You record a failure once, then debug the recording, deterministically, as many times as you want. The same execution is replayed every time." | cited |
| S6 | The first-party Windows tool for record and replay is a debugger feature that captures a process trace. | https://learn.microsoft.com/en-us/windows-hardware/drivers/debuggercmds/time-travel-debugging-overview | "Time Travel Debugging (TTD) is a tool that captures a trace of your process as it executes and replays it later both forwards and backwards." | cited |
| S7 | Within .NET, the tool found that claims deterministic replay of a failing test is Coyote, for the nondeterminism it controls. | https://raw.githubusercontent.com/microsoft/coyote/main/docs/concepts/concurrency-unit-testing.md | "Coyote achieves this by automatically replaying all nondeterministic choices in your test that led to this bug." | cited |

What these sources claim.
They claim that a run can be repeated exactly when every source of nondeterminism is controlled or recorded, on the same code revision (S1, S2, S3, S5).
They do not claim that the simulated or recorded runs cover all runs.
None of the pages read states the limits of the method in a sentence that could be quoted.

## (c) Could not be established

Each item names what was looked for and where.

1. A first-party statement that `double` arithmetic gives identical results across machines, runtimes or hardware in .NET.
   Searched: the pages cited in N1 to N17, and one web search restricted to `github.com`, `learn.microsoft.com` and `devblogs.microsoft.com` with the query ".NET floating point results deterministic across platforms architectures RyuJIT double arithmetic IEEE 754 deterministic".
   Result: only statements of possible difference were found; issue threads and comments were not used as sources.
2. Whether the .NET JIT ever turns `a * b + c` into a fused multiply-add on its own.
   Searched: one web search on the same three domains.
   Result: no first-party document found; the question is open and is part of experiment X6.
3. Whether the CLI standard's allowance for wider internal precision (N3) is used by the current runtime on any supported platform.
   Read: ECMA-335 6th edition (2012), the edition found; the runtime's augments document at https://raw.githubusercontent.com/dotnet/runtime/main/docs/design/specs/Ecma-335-Augments.md was searched for "I.12.1.3", "IEEE", "IEC", "NaN" and "float".
   There is no match for "I.12.1.3"; the matches for "float" concern conversion opcodes and unrelated examples.
   Result: not established either way.
4. A first-party C# or .NET library for TLA+ trace validation.
   Searched: one web search restricted to `github.com`, `lamport.azurewebsites.net`, `tlapl.us`, `docs.tlapl.us`, `foundation.tlapl.us` and `apalache-mc.org`; the trace validation paper and wiki page.
   Result: none found; the published tooling is for Java (M24) and one report is for C++ (M28).
5. Coyote's release dates.
   The NuGet catalog gives 2024-03-18 for 1.7.11 (V7); the GitHub release page for `v1.7.11` shows the timestamp 2026-10-30.
   The two were not reconciled.
6. Whether Coyote on its `main` branch now controls `System.Threading.Lock` and other APIs named in C15 and C16.
   The assessment document predates the November 2026 commits; the rewriter source was not read.
7. Whether Coyote 1.7.11 can test an assembly on this machine's .NET SDK 10.0.400.
   C15 is a statement in a repository document, not an observation here; experiment X7.
8. P's exhaustive and proof backends in release 3.1.0.
   The overview page lists three additional engines; the repository change list says engines were removed and two are "to be added later" (https://raw.githubusercontent.com/p-org/P/master/ChangeList.md).
   The two documents disagree and neither was checked against the release.
9. The distribution of FsCheck's default `double` generator, including how often it produces NaN or an infinity.
   Only the documentation example (F10) was read; the generator source was not opened.
10. A sentence in the FsCheck documentation that says a pass is not a proof.
    Searched the seven documentation source files, the repository README and the package README for "exhaustive", "prove", "proof", "guarantee" and "absence".
    The only matches concern what generators produce; no such sentence was found.
11. Where the .NET SDK defines `DEBUG` for the Debug configuration.
    Searched `Microsoft.NET.Sdk.props`, `Microsoft.NET.Sdk.CSharp.props` and `Microsoft.NET.Sdk.BeforeCommon.targets` at tag v10.0.100 for "DEBUG"; no match.
    This is a search failure, not absence; R5 is the documentation claim and experiment X1 measures it.
12. Whether Dafny 4.11.0 rejects `fp64`, and how `real` is emitted in C# by the 4.11.0 compiler.
    Only the manual and the runtime file at the tag were read (D10, D11); experiment X8.
13. A primary source that describes input record and replay testing for a fixed-step update loop, or deterministic simulation for .NET.
    Searched: one web search restricted to four project domains; the result list held only third-party repositories, which were not used.
    The sources in section 7 were opened directly.
14. Apalache's support for temporal and liveness properties, the TLAPS proof system, and Coyote's actor model.
    Not researched; they are outside the seven questions.

Coverage of the sources.
Read in full: the TLA+ site pages `high-level-view` and `tools`, the TLA+ tools README, the Apalache README, the Coyote README and its pages `how`, `faq`, `concurrency-unit-testing`, `non-determinism` and `using-coyote`, the P pages `whatisP` and `pobserve`, the FsCheck page `StatefulTesting`, the trace validation wiki page, both paper abstracts, and the two simulation pages cited in S1 to S4.
Searched by keyword and read around the matches only: the TLC book (chapter 14 only), the current-tools document, the PlusCal manual, the trace validation paper body, the Apalache manual pages, the Coyote pages `index`, `binary-rewriting` and `specifications`, the P README and its other pages, the Dafny reference manual files, the FsCheck README and its other documentation files, the CsCheck README and `Gen.cs`, every learn.microsoft.com page, both standards, and every runtime and SDK source file.
A keyword search does not establish that a document says nothing else on the subject.

## (d) Proposed experiments

Nothing below was run.
The expected results are what the cited sources imply, not observations.
Machine assumed: Windows 11, .NET SDK 10.0.400, PowerShell.
Experiments X4, X5, X7 and X8 download packages or tools; X9 needs Java 11 or later and one downloaded file.
The experiments are ordered by effort, shortest first.
C# snippets go in `Program.cs` of a project created with the first command of each experiment unless another file is named.
API shapes in the snippets come from the cited documentation; a compile error is itself a result to record.

### X1. Assertions per build configuration (about 5 minutes; claims R1 to R9, item 11)

```csharp
using System.Diagnostics;

#if DEBUG
Console.WriteLine("DEBUG defined");
#else
Console.WriteLine("DEBUG not defined");
#endif
#if TRACE
Console.WriteLine("TRACE defined");
#else
Console.WriteLine("TRACE not defined");
#endif

int evaluations = 0;
bool Touch() { evaluations++; return true; }

Debug.Assert(Touch());
Console.WriteLine($"after Debug.Assert: {evaluations}");
Trace.Assert(Touch());
Console.WriteLine($"after Trace.Assert: {evaluations}");

if (args.Length > 0 && args[0] == "fail-debug") Debug.Assert(false, "debug assert failed");
if (args.Length > 0 && args[0] == "fail-trace") Trace.Assert(false, "trace assert failed");
Console.WriteLine("reached end");
```

```powershell
dotnet new console -n AssertProbe -o AssertProbe --framework net10.0
dotnet run -c Debug --project AssertProbe
dotnet run -c Release --project AssertProbe
dotnet run -c Debug --project AssertProbe -- fail-debug; "exit code $LASTEXITCODE"
dotnet run -c Release --project AssertProbe -- fail-debug; "exit code $LASTEXITCODE"
dotnet run -c Release --project AssertProbe -- fail-trace; "exit code $LASTEXITCODE"
```

Record: the two symbol lines and the two counters per configuration; for each failing run, whether "reached end" is printed, the exit code, and whether a dialog appears.
Implied by the sources: Release prints "DEBUG not defined", "TRACE defined", counters 0 then 1; `fail-debug` in Release reaches the end; `fail-debug` in Debug and `fail-trace` in Release end the process without a dialog.

### X2. NaN, guards and integer conversion (about 5 minutes; claims R12 to R16, N5 to N8, N15)

```csharp
double nan = double.NaN;
double negZero = -0.0;
double big = 1e20;

Console.WriteLine($"NaN bits: {BitConverter.DoubleToInt64Bits(nan):X16}");
#pragma warning disable CS1718
Console.WriteLine($"nan == nan: {nan == nan}");
Console.WriteLine($"nan != nan: {nan != nan}");
#pragma warning restore CS1718
Console.WriteLine($"nan.Equals(nan): {nan.Equals(nan)}");
Console.WriteLine($"nan.CompareTo(0.0): {nan.CompareTo(0.0)}");
Console.WriteLine($"nan < 0.0: {nan < 0.0}; nan >= 0.0: {nan >= 0.0}");
Console.WriteLine($"IsFinite(nan): {double.IsFinite(nan)}; IsFinite(+inf): {double.IsFinite(double.PositiveInfinity)}");
Console.WriteLine($"IsNegative(nan): {double.IsNegative(nan)}; IsNegative(-0.0): {double.IsNegative(negZero)}");
Console.WriteLine($"Math.Max(nan, 1.0): {Math.Max(nan, 1.0)}; Math.Clamp(nan, 0.0, 1.0): {Math.Clamp(nan, 0.0, 1.0)}");
Console.WriteLine($"(int)nan: {unchecked((int)nan)}; (int)big: {unchecked((int)big)}; (long)-big: {unchecked((long)(-big))}");

Probe("ThrowIfNegative(nan)", () => ArgumentOutOfRangeException.ThrowIfNegative(nan));
Probe("ThrowIfNegative(-0.0)", () => ArgumentOutOfRangeException.ThrowIfNegative(negZero));
Probe("ThrowIfLessThan(nan, 0.0)", () => ArgumentOutOfRangeException.ThrowIfLessThan(nan, 0.0));
Probe("ThrowIfGreaterThan(nan, 10.0)", () => ArgumentOutOfRangeException.ThrowIfGreaterThan(nan, 10.0));
Probe("ThrowIfGreaterThan(+inf, 10.0)", () => ArgumentOutOfRangeException.ThrowIfGreaterThan(double.PositiveInfinity, 10.0));

static void Probe(string name, Action action)
{
    try { action(); Console.WriteLine($"{name}: no exception"); }
    catch (ArgumentOutOfRangeException) { Console.WriteLine($"{name}: ArgumentOutOfRangeException"); }
}
```

```powershell
dotnet new console -n NanProbe -o NanProbe --framework net10.0
dotnet run -c Release --project NanProbe
```

Record: every line.
Implied by the sources: `nan == nan` False, `nan.Equals(nan)` True, `nan.CompareTo(0.0)` -1, `ThrowIfLessThan(nan, 0.0)` throws, `ThrowIfGreaterThan(nan, 10.0)` does not throw.
Not implied by any source read: the results for `ThrowIfNegative(nan)`, `ThrowIfNegative(-0.0)`, `Math.Max` and `Math.Clamp` with NaN, and the three conversions.

### X3. Seeds, hash codes and enumeration order across two runs (about 5 minutes; claims N18 to N20)

```csharp
var random = new Random(100100);
Console.WriteLine($"random: {random.Next()} {random.Next()} {random.NextDouble():R}");
string text = "replay";
Console.WriteLine($"string hash: {text.GetHashCode()}");
var set = new HashSet<string> { "alpha", "beta", "gamma", "delta", "epsilon" };
Console.WriteLine($"set order: {string.Join(",", set)}");
```

```powershell
dotnet new console -n OrderProbe -o OrderProbe --framework net10.0
dotnet run -c Release --project OrderProbe
dotnet run -c Release --project OrderProbe
```

Record: which of the three lines are equal between the two runs.
This measures one runtime version only; N18 is about different versions and cannot be confirmed on one SDK.

### X4. FsCheck 3.6.0 from C# (about 10 minutes; claims F2, F4, F5, F6, F10, item 9)

```csharp
using FsCheck;
using FsCheck.Fluent;

#pragma warning disable CS1718
Prop.ForAll<double>(x => x == x).QuickCheck();
#pragma warning restore CS1718
Prop.ForAll<double>(x => double.IsFinite(x)).QuickCheck();
Prop.ForAll<int>(x => x < 1000).QuickCheck();
Prop.ForAll<int>(x => x == x).QuickCheck();
Prop.ForAll((int x) => Math.Abs(x) >= 0).Check(Config.Quick.WithReplay(1145655947UL, 296144285UL));
```

```powershell
dotnet new console -n FsProbe -o FsProbe --framework net10.0
dotnet add FsProbe package FsCheck --version 3.6.0
dotnet run -c Release --project FsProbe
dotnet run -c Release --project FsProbe
```

Record: the exact output line of each property in both runs, including the number of tests, the shrunk counterexample and the seed text.
Questions answered: whether the default `double` generator produces NaN and infinities within 100 cases, what a passing line states, and whether the replayed property prints the same result in both runs.

### X5. CsCheck 5.0.1 (about 10 minutes; claims K2, K4, K6 to K9, K14)

```csharp
using System.Collections.Concurrent;
using CsCheck;

Count("Gen.Double", Gen.Double);
Count("Gen.Double.Special", Gen.Double.Special);

try { Gen.Int.Sample(i => i < 1000); }
catch (Exception e) { Console.WriteLine(e.Message); }

Console.WriteLine($"Spec type present: {typeof(Check).Assembly.GetType("CsCheck.Spec") is not null}");

Gen.Const(() => (new ConcurrentQueue<int>(), new Queue<int>()))
.SampleParallel(
    Gen.Int.Operation<ConcurrentQueue<int>, Queue<int>>(i => $"Enqueue({i})", (q, i) => q.Enqueue(i), (q, i) => q.Enqueue(i)),
    Gen.Operation<ConcurrentQueue<int>, Queue<int>>("TryDequeue()", q => q.TryDequeue(out _), q => q.TryDequeue(out _))
);
Console.WriteLine("parallel sample finished");

static void Count(string name, Gen<double> gen)
{
    long nan = 0, infinite = 0;
    double min = double.MaxValue, max = double.MinValue;
    gen.Sample(d =>
    {
        if (double.IsNaN(d)) nan++;
        else if (double.IsInfinity(d)) infinite++;
        else { min = Math.Min(min, d); max = Math.Max(max, d); }
        return true;
    }, iter: 1_000_000, threads: 1);
    Console.WriteLine($"{name}: NaN={nan} infinite={infinite} min={min:R} max={max:R}");
}
```

```powershell
dotnet new console -n CsProbe -o CsProbe --framework net10.0
dotnet add CsProbe package CsCheck --version 5.0.1
dotnet run -c Release --project CsProbe
```

Record: the two count lines, the full failure message of the failing sample (seed, shrinks, skipped, total), the `Spec` line, and whether the parallel sample finishes.
Then pass the printed seed back as `Gen.Int.Sample(i => i < 1000, seed: "<seed>")` and record whether the same counterexample is reported.
Implied by the sources: `Gen.Double` reports NaN=0 and infinite=0 with all values inside -1e50 to 1e50; `Gen.Double.Special` reports non-zero counts.

### X6. Bit identity of a fixed-step computation across configurations (about 20 minutes; claims N2, N3, N9, N11, N14, items 1 to 3)

```csharp
using System.Runtime.InteropServices;
using System.Runtime.Intrinsics.X86;

double x = 0.1, v = 1.0;
const double dt = 1.0 / 60.0;
for (int i = 0; i < 1_000_000; i++)
{
    double a = -4.0 * x - 0.1 * v + Math.Sin(i * dt);
    v += a * dt;
    x += v * dt;
}
double p = 0.1, q = 10.0, r = -1.0;
Console.WriteLine($"arch={RuntimeInformation.ProcessArchitecture} runtime={RuntimeInformation.FrameworkDescription} Fma={Fma.IsSupported} Avx2={Avx2.IsSupported}");
Console.WriteLine($"x={BitConverter.DoubleToInt64Bits(x):X16} v={BitConverter.DoubleToInt64Bits(v):X16}");
Console.WriteLine($"p*q+r={BitConverter.DoubleToInt64Bits(p * q + r):X16} fma={BitConverter.DoubleToInt64Bits(Math.FusedMultiplyAdd(p, q, r)):X16}");
Console.WriteLine($"sin={BitConverter.DoubleToInt64Bits(Math.Sin(1e22)):X16} pow={BitConverter.DoubleToInt64Bits(Math.Pow(1.1, 37.3)):X16} sqrt={BitConverter.DoubleToInt64Bits(Math.Sqrt(2.0)):X16}");
```

```powershell
dotnet new console -n FpProbe -o FpProbe --framework net10.0
dotnet run -c Debug --project FpProbe
dotnet run -c Release --project FpProbe
$env:DOTNET_TieredCompilation='0'; dotnet run -c Release --project FpProbe; Remove-Item Env:DOTNET_TieredCompilation
$env:DOTNET_EnableAVX2='0'; dotnet run -c Release --project FpProbe; Remove-Item Env:DOTNET_EnableAVX2
$env:DOTNET_EnableHWIntrinsic='0'; dotnet run -c Release --project FpProbe; Remove-Item Env:DOTNET_EnableHWIntrinsic
dotnet run -c Release -r win-x86 --project FpProbe
```

The setting `DOTNET_TieredCompilation` is documented at https://learn.microsoft.com/en-us/dotnet/core/runtime-config/compilation.
The names `EnableAVX2` and `EnableHWIntrinsic` were read in https://raw.githubusercontent.com/dotnet/runtime/v10.0.0/src/coreclr/jit/jitconfigvalues.h; that they take the `DOTNET_` prefix as environment variables is recalled, not sourced, so confirm that the `Fma=` and `Avx2=` fields change.
The last command downloads the x86 runtime pack.
Record: the four output lines for each of the six runs, and which hexadecimal fields differ between runs.
Reading the result: identical fields mean no difference was observed among these configurations on this one machine and runtime; they say nothing about another processor, operating system or .NET version.
A differing field is a counterexample to replay identity under that variation.
If `p*q+r` equals `fma` in some run and not in another, the JIT fused the expression in that configuration (item 2).

### X7. Coyote 1.7.11 on this SDK (about 20 minutes; claims C3, C4, C8, C15, C17, item 7)

File `CoyoteProbe/Class1.cs`:

```csharp
using System;
using System.Threading.Tasks;

public static class Probe
{
    [Microsoft.Coyote.SystematicTesting.Test]
    public static async Task Execute()
    {
        int value = 0;
        Task task = Task.Run(() => { value = 1; });
        if (value != 0) throw new InvalidOperationException("the task ran before the check");
        await task;
    }
}
```

```powershell
dotnet --list-runtimes
dotnet tool install --global Microsoft.Coyote.CLI --version 1.7.11
dotnet new classlib -n CoyoteProbe -o CoyoteProbe --framework net10.0
dotnet add CoyoteProbe package Microsoft.Coyote --version 1.7.11
dotnet build CoyoteProbe -c Debug
coyote rewrite CoyoteProbe\bin\Debug\net10.0\CoyoteProbe.dll
coyote test CoyoteProbe\bin\Debug\net10.0\CoyoteProbe.dll --iterations 1
coyote test CoyoteProbe\bin\Debug\net10.0\CoyoteProbe.dll --iterations 1000
```

Record: whether the tool installs and starts without a .NET 8 runtime, the full output of the rewrite and of both test runs, and the path of any trace file.
If a trace file is written, run `coyote replay CoyoteProbe\bin\Debug\net10.0\CoyoteProbe.dll <trace file>` twice and record whether both replays fail at the same point.
If the test host fails to load the assembly as C15 describes, repeat with `--framework net8.0` in the `dotnet new` command and the matching path, provided an 8.0 runtime is listed.
Question answered: what a one-iteration pass and a thousand-iteration result look like, and whether the released tool can be used at all on this machine.

### X8. Dafny 4.11.0: what `real` becomes in C# (about 20 minutes; claims D2, D10 to D13, item 12)

File `half.dfy`:

```dafny
method Half(x: real) returns (y: real)
  ensures y * 2.0 == x
{
  y := x / 2.0;
}

method Main() {
  var y := Half(0.1);
  print y, "\n";
}
```

File `fp.dfy`:

```dafny
method Keep(x: fp64) returns (y: fp64)
{
  y := x;
}
```

```powershell
dotnet tool install --global dafny --version 4.11.0
dafny --version
dafny verify half.dfy
dafny translate cs half.dfy
Get-ChildItem -Recurse -Filter *.cs | Select-String -Pattern "BigRational" | Select-Object -First 5
dafny resolve fp.dfy
```

Record: the version line, the verifier's summary line, the lines of generated C# that mention `BigRational`, and the full output of the last command.
Implied by the sources: the postcondition verifies, because `real` is exact; the generated C# uses the rational runtime type and not `double`; `fp64` is not a known type in 4.11.0.
The same postcondition written over C# `double` is false for some inputs; that is the point of the comparison and can be shown with FsCheck or CsCheck.

### X9. TLC on a three-action commit model, and the meaning of the bound (about 30 minutes; claims M4, M6, M8 to M11, M19, M20)

The specification below was written for this experiment and has not been parsed by any tool.

File `StepCommit.tla`:

```tla
---- MODULE StepCommit ----
EXTENDS Naturals
CONSTANT MaxTick
VARIABLES committed, staged, phase
vars == <<committed, staged, phase>>

Init == committed = 0 /\ staged = 0 /\ phase = "idle"

Begin == /\ phase = "idle"
         /\ committed < MaxTick
         /\ staged' = committed + 1
         /\ phase' = "staged"
         /\ UNCHANGED committed

Commit == /\ phase = "staged"
          /\ committed' = staged
          /\ phase' = "idle"
          /\ UNCHANGED staged

Abort == /\ phase = "staged"
         /\ staged' = committed
         /\ phase' = "idle"
         /\ UNCHANGED committed

Next == Begin \/ Commit \/ Abort
Spec == Init /\ [][Next]_vars

AllOrNothing == (phase = "idle") => (staged = committed)
====
```

File `StepCommit.cfg`:

```
SPECIFICATION Spec
CONSTANT MaxTick = 3
INVARIANT AllOrNothing
```

```powershell
java -version
java -cp tla2tools.jar tlc2.TLC -deadlock -config StepCommit.cfg StepCommit.tla
```

Get `tla2tools.jar` from the 1.7.4 release page named in V1.
The option `-deadlock` is documented in the current-tools document as "This tells TLC not to check for deadlock."; it is needed because the model stops when `committed` reaches `MaxTick`.
Record: the line that reports the number of distinct states, and the lines that report the fingerprint collision probability.
Repeat with `MaxTick = 6` and record the same lines.
Then replace `staged' = committed` in `Abort` with `UNCHANGED staged`, run again with `MaxTick = 3`, and record the counterexample trace.
Question answered: the pass is a statement about every reachable state of the model with that value of `MaxTick`, the state count changes with the constant, and the model says nothing about C# code.
Optional, with Apalache v0.63.0 installed: `apalache-mc check --inv=AllOrNothing --length=2 StepCommit.tla` and again with `--length=10`, after adding the type annotations and constant initialisation that Apalache requires; record what each run reports about the length checked.

## (e) Routing table

This table is inference.
No source states it.
Each cell names the claim IDs it rests on, and a row is only as strong as its weakest claim.
"A pass supports" is the strongest sentence the cited sources allow; none of the rows supports the word "exhaustive" for the C# program.

| Code shape | Techniques that fit | The claim a pass supports | What stays unchecked |
|---|---|---|---|
| (a) Fixed-step update loop that commits a step all-or-nothing | Model the step as begin, commit and abort actions in PlusCal or TLA+ and check an invariant with TLC (M4, M6, M14, M15). Model-based property testing of the C# loop: random step sequences with injected mid-step failures, compared with a model that applies a whole step or none (F8, K5). A run-time check at the commit boundary that is compiled into Release builds (R4, R12, R17). | TLC: the invariant holds in every reachable state of the finite model that was supplied (M4, M6, M8). Property testing: no counterexample among the sampled sequences, 100 by default (F2, K2). | Whether the C# code matches the model (M2, M3, M25). Models larger than the one checked (M9). A vacuous pass (M10). Sequences that were not sampled. Any invariant written with `Debug.Assert`, in Release (R1, R2). |
| (b) Command queue | Single-threaded: model-based property testing against a simple queue model (F8, K5). Concurrent producers and consumers written with tasks: Coyote schedule exploration (C1, C3, C6), or CsCheck parallel sampling against linearizations (K6). Ordering rules at design level: TLA+ or P (M4, P1). | Coyote: the explored schedules, within the iteration count and the controlled APIs, did not violate the assertions (C2, C3, C5). CsCheck parallel: each sampled parallel run matched some sequential order (K6). | Unexplored schedules (C5). Weak-memory effects (C11). APIs Coyote does not control, and the released tool's fit with the current .NET version (C9, C15, C16, C17). Parallel failures that do not reproduce on the first retry (K7). The model-to-code gap for TLA+ and P (M2, P8). |
| (c) Save, input replay and crash recovery | Round-trip property: save then load gives an equal state, tested on generated states (F1, K1). Replay test: record inputs, replay twice, compare state bit patterns, with time and randomness injected (S1, S2, S3, N21). Crash points as explicit nondeterministic choices in a Coyote test (C14) or as actions in a TLA+ model (M4). Trace validation of recorded runs against a specification, with self-built C# instrumentation (M23, M24). | Replay: the recorded input gave the same state on that build, that runtime and that machine, for the runs recorded (S1, S2). Round trip: no counterexample among the sampled states (F2, K2). Trace validation: the recorded traces are behaviours of the specification, if the traces log enough (M26, M27). | Identity on another machine, architecture or .NET version (N9, N10, N11, N13). Sequences from a re-seeded `Random` on another .NET version (N18). Anything that depends on hash codes or dictionary order (N19, N20). Crash points that were not modelled. Runs that were not recorded (M27). |
| (d) Rules computed over `double` fields | Property testing with a generator chosen to include NaN, both infinities and extreme values (F10, K8, K9). Explicit `double.IsFinite` checks at the boundary, and knowledge of how the guard helpers treat NaN (N8, R14, R15, R16). | No counterexample among the sampled values from the stated generator (F2, K2). | Values the generator cannot produce; CsCheck's default generator produces no NaN and no infinity (K8). Differences between platforms and versions (N9, N10, N11). Model checkers do not represent floating-point values (M12, M22). A Dafny proof over `real` does not transfer to `double`, and IEEE types are documented only on Dafny's development branch (D10, D12, D13). |
| (e) Small core algorithms | Dafny, when the algorithm works on integers, sequences or sets: write it with a specification, verify, and either compile to C# or keep it as the reference model for property tests of a hand-written C# version (D1, D2, F8, K5). TLC on an algorithm-level model with small bounds (M4, M6). CsCheck's exhaustive specification check for a small pure state machine (K10, K11, K14). | Dafny: every method meets its written specification for all inputs, provided no assumption is left unproven, and only for the Dafny-originated code (D1, D3, D5). CsCheck exhaustive: the requirements hold on the whole reachable state space of the model (K10, K11). | Whether the specification says what is wanted. A hand-written C# port, and any external method whose postcondition is assumed (D3, D6). Limits of the target language that the compiled output does not preserve (D4). Concurrency (D9). Larger models than the one checked (M9). |

## (f) Verification pass (2026-11-11)

All nine experiments X1 to X9 were run, including the optional Apalache part of X9; none was skipped.
114 claims were checked against their sources and 10 more were checked by a run only: 118 held as written, 6 say more than the evidence supports, none was refuted, and no source was unreachable.
The six that do not hold as written are V11 (P 3.1.0 is a tag and a NuGet package, not a GitHub release), R9 (`Trace.Assert` stops the process only with the default listener configuration), R12 (`ThrowIfNegative` is a sign test: it rejects `-0.0` and passes a NaN with a clear sign bit), K4 (a CsCheck seed reproduces a failure but not always the same counterexample), N15 (the saturating conversion of .NET 9 does not cover the small integer types until .NET 11) and C3 (a Coyote run stops at the first bug, before the configured iteration count).
The runs also produced four results that the claim tables do not contain and that guidance needs: a false FsCheck property (`x < 1000` over `int`) passed 100 and 100,000 tests because the default generator stayed within about -100 to 100; a Coyote test with a real race reported "Found 0 bugs" in 3 of 8 runs at the default of one iteration; `Math.Sin` gave different bits in a 32-bit and a 64-bit process on the same machine and runtime; and Apalache at its default bound reported no error for an invariant that TLC and a bound of 12 both showed to be false.
Not established by any run: N2 and N3 (permission to use extra precision; no extra precision was observed), N18 (the seeded `Random` sequence was identical on four runtime versions, so the documented non-guarantee was neither shown nor contradicted), N20 (the experiment used `HashSet`, not `Dictionary`), K6 (the parallel sample finished; the linearization check itself was not exercised) and M11 (the collision estimate was printed; no collision was observed).

Scope of every run below: one machine, Windows 11, x64 processor, on 2026-11-11.
Pinned SDK: `global.json` with `10.0.400` and `rollForward: disable`; a second folder pinned `11.0.100-rc.3.26522.148` for the `net11.0` runs.
Installed runtimes used: 8.0.25, 9.0.14, 10.0.11, 11.0.0-rc.3.26522.148.
The runtime source cited in section (b) was read at tag `v10.0.0`; the runs used runtime 10.0.11, a later patch.
All projects, packages and tools were placed in a scratch folder outside the repository, with `NUGET_PACKAGES` pointing into it; `<scratch>` below stands for that folder.
"Confirmed by run" means the observed output matches the claim on this machine and these versions, and nothing more.

### Table 1. Experiments

| ID | Claims tested | SDK and runtime | Commands | Observed output (trimmed) | Verdict |
|---|---|---|---|---|---|
| X1 | R1 to R9 | SDK 10.0.400, runtime 10.0.11 | `dotnet run -c Debug --project AssertProbe`<br>`dotnet run -c Release --project AssertProbe`<br>`dotnet run -c Debug --project AssertProbe -- fail-debug`<br>`dotnet run -c Release --project AssertProbe -- fail-debug`<br>`dotnet run -c Release --project AssertProbe -- fail-trace`<br>Exit codes read with `& .\AssertProbe\bin\<config>\net10.0\AssertProbe.exe <arg>; $LASTEXITCODE`.<br>Added: `Trace.Listeners.Clear(); Trace.Assert(false, ...)` and `((DefaultTraceListener)Trace.Listeners[0]).AssertUiEnabled = false; Trace.Assert(false, ...)`, both in a Release build. | Debug: `DEBUG defined`, `TRACE defined`, `after Debug.Assert: 1`, `after Trace.Assert: 2`.<br>Release: `DEBUG not defined`, `TRACE defined`, `after Debug.Assert: 0`, `after Trace.Assert: 1`.<br>Debug `fail-debug`: `Process terminated.` `Assertion failed.` `debug assert failed`, no `reached end`, exit code -2146232797 (0x80131623), process ended by itself in about 3 seconds.<br>Release `fail-debug`: `reached end`, exit code 0.<br>Release `fail-trace`: `Process terminated.` `Assertion Failed` `trace assert failed`, no `reached end`, exit code -2146232797.<br>Added, listeners cleared: `reached end after Trace.Assert(false) with no listeners`, exit code 0.<br>Added, switch off: `reached end after Trace.Assert(false) with AssertUiEnabled=false`, exit code 0. | R1 to R7: confirmed by run.<br>R8: the page text was confirmed in Table 2; the run shows the process ending without input, which a blocking message box would not allow.<br>R9: confirmed by run for the default configuration only; narrower, see Table 2. |
| X2 | R12 to R16, N5 to N8, N15 | SDK 10.0.400, runtime 10.0.11; added conversion lines also on 8.0.25, 9.0.14 and 11.0.0-rc.3 (SDK 11.0.100-rc.3 for `net11.0`) | `dotnet run -c Release --project NanProbe`<br>Added to the program: a NaN computed at run time (`double.Parse("0") / double.Parse("0")`), its negation, and conversions with operands parsed at run time, because every operand in the original is a compile-time constant.<br>Added project: `dotnet run -c Release -f net8.0 --project ConvMulti` (also `net9.0`, `net10.0`, and `net11.0` under the second SDK). | `NaN bits: FFF8000000000000`<br>`nan == nan: False`, `nan != nan: True`, `nan.Equals(nan): True`, `nan.CompareTo(0.0): -1`<br>`nan < 0.0: False; nan >= 0.0: False`<br>`IsFinite(nan): False; IsFinite(+inf): False`<br>`IsNegative(nan): True; IsNegative(-0.0): True`<br>`Math.Max(nan, 1.0): NaN; Math.Clamp(nan, 0.0, 1.0): NaN`<br>`(int)nan: 0; (int)big: 2147483647; (long)-big: -9223372036854775808`<br>`ThrowIfNegative(nan): ArgumentOutOfRangeException`<br>`ThrowIfNegative(-0.0): ArgumentOutOfRangeException`<br>`ThrowIfLessThan(nan, 0.0): ArgumentOutOfRangeException`<br>`ThrowIfGreaterThan(nan, 10.0): no exception`<br>`ThrowIfGreaterThan(+inf, 10.0): ArgumentOutOfRangeException`<br>Added: `ThrowIfNegative(-runtime 0/0): no exception`; `ThrowIfGreaterThan(runtime 0/0, 10.0): no exception`.<br>Added, by runtime: `(int)1e20` is -2147483648 on 8.0.25 and 2147483647 on 9.0.14, 10.0.11 and 11.0.0-rc.3; `(int)NaN` is -2147483648 on 8.0.25 and 0 on the later three; `(byte)300` is 44 on 8.0.25, 9.0.14 and 10.0.11 and 255 on 11.0.0-rc.3; `(short)70000.5` is 4464 on the first three and 32767 on 11.0.0-rc.3. | R14, R15, R16: confirmed by run.<br>N5 to N8: confirmed by run.<br>R12: narrower; the guard is a sign test, see Table 2.<br>N15: narrower; the small integer types changed in .NET 11, not .NET 9, see Table 2. |
| X3 | N18 to N20 | SDK 10.0.400, runtime 10.0.11; added seeded-random line also on 8.0.25, 9.0.14, 11.0.0-rc.3 and on a 32-bit 10.0.11 process | `dotnet run -c Release --project OrderProbe` (twice)<br>Added: the line `new Random(100100)` in the multi-target project of X6. | Run 1: `random: 1074157581 44981460 0.46586949539644157`, `string hash: -1036832716`, `set order: alpha,beta,gamma,delta,epsilon`.<br>Run 2: same `random` line, `string hash: 450297219`, same `set order` line.<br>Added: the `random` line was identical on 8.0.25, 9.0.14, 10.0.11 and 11.0.0-rc.3 (x64) and on 10.0.11 (x86). | N19: confirmed by run.<br>N18: not established by run; no difference was observed across four runtime versions, and the documented non-guarantee stands on the citation only.<br>N20: not tested; the program enumerates a `HashSet<string>`, not a `Dictionary`, and an equal order in two runs says nothing about a guarantee. |
| X4 | F2, F4, F5, F6, F10 | SDK 10.0.400, runtime 10.0.11; FsCheck 3.6.0 (`lib/net8.0` asset) | `dotnet add FsProbe package FsCheck --version 3.6.0`<br>`dotnet run -c Release --project FsProbe` (twice)<br>Changed: as written the experiment cannot test F4, F5 or F6, because no failing case shrank (`0 shrinks`) and the replayed property passes, so a replay is not observable.<br>Added project `FsProbe2`, run twice: A `Prop.ForAll<int>(x => x < 50).QuickCheck()`; B `Prop.ForAll<int[]>(xs => xs.Length < 5).QuickCheck()`; C `Prop.ForAll<int>(x => x < 50).Check(Config.Quick.WithReplay(1145655947UL, 296144285UL))`; D `Prop.ForAll<double>(x => x == x).Check(Config.Quick.WithReplay(3946711314501858534UL, 5289721438212207291UL))` with the seed printed by the first run; E `Prop.ForAll<int>(x => x < 1000).Check(Config.Quick.WithMaxTest(100000))`; F the minimum and maximum `int` seen in 100 default tests. | As written, run 1: `x == x` over `double`: `Falsifiable, after 8 tests (0 shrinks) (3946711314501858534,5289721438212207291).` `Original: nan`.<br>`IsFinite`: `Falsifiable, after 29 tests (0 shrinks)` `Original: infinity`.<br>`x < 1000` over `int`: `Ok, passed 100 tests.`<br>`x == x` over `int`: `Ok, passed 100 tests.`<br>Replay line: `Ok, passed 100 tests.`<br>Run 2: `nan` after 38 tests; `nan` after 11 tests; the three passing lines unchanged.<br>Added A: `Falsifiable, after 58 tests (2 shrinks)` `Original: 52` `Shrunk: 50`.<br>Added B: `Original: [\|0; -4; 2; 0; 0; 0; 0\|]` `Shrunk: [\|0; 0; 0; 0; 0\|]`.<br>Added C, identical in both runs: `Falsifiable, after 69 tests (1 shrink) (1145655947,296144285).` `Original: 57` `Shrunk: 50`.<br>Added D, identical in both runs and equal to the original failure: `Falsifiable, after 8 tests (0 shrinks) (3946711314501858534,5289721438212207291).` `Original: nan`.<br>Added E: `Ok, passed 100000 tests.`<br>Added F: `min=-83 max=82` and `min=-86 max=95`. | F2, F10: confirmed by run.<br>F4, F5, F6: confirmed by run, with the changed experiment.<br>New result: the false property `x < 1000` passed 100 and 100,000 tests. |
| X5 | K2, K4, K6 to K9, K14 | SDK 10.0.400, runtime 10.0.11; CsCheck 5.0.1 (`lib/net10.0` asset; the package also has `lib/net11.0`) | `dotnet add CsProbe package CsCheck --version 5.0.1`<br>`dotnet run -c Release --project CsProbe`<br>Added project `CsProbe2`: `Gen.Int.Sample(i => i < 1000, seed: "8_AXWSgFyxV1")` 8 times with default settings, 4 times with `iter: 1`, 4 times with `threads: 1`; a call counter inside a default `Sample`; reflection over `typeof(Check)` and the type `CsCheck.Spec`. | `Gen.Double: NaN=0 infinite=0 min=-9.999938469687091E+49 max=1E+50`<br>`Gen.Double.Special: NaN=4281 infinite=7783 min=-1.7976931348623157E+308 max=1.7976931348623157E+308` (of 1,000,000 draws each)<br>`Set seed: "8_AXWSgFyxV1" or -e CsCheck_Seed=8_AXWSgFyxV1 to reproduce (2 shrinks, 64 skipped, 100 total).` `1233`<br>`Spec type present: True`<br>`parallel sample finished`<br>Added, seed passed back with default settings: 5 of 8 attempts reported `1233` with the same seed; 3 of 8 reported another counterexample and another seed (`1212` with `d67G-AGVFmz1`, `1142` with `0hM8PENArI81`, `1200` with `dxNsCGUT2rx4`).<br>Added, `iter: 1`: `1233` in 4 of 4 attempts (`0 shrinks, 0 skipped, 1 total`).<br>Added, `threads: 1`: `1233` in 4 of 4 attempts.<br>Added: `default Sample calls: 100`; `Check.Iter = 100`; `Check.Replay = 100`; `Spec: public=True`. | K2, K8, K9, K14: confirmed by run.<br>K7: confirmed by run for the default value only (`Check.Replay = 100`); no parallel failure was produced, so the retry itself was not exercised.<br>K4: narrower, see Table 2.<br>K6: not tested; the sample finished without a failure, which does not exercise the comparison against linearizations. |
| X6 | N2, N3, N9, N11, N14 | SDK 10.0.400, runtime 10.0.11 for the six runs as written; added runs on 8.0.25, 9.0.14 and 11.0.0-rc.3 (SDK 11.0.100-rc.3 for `net11.0`) | `dotnet run -c Debug --project FpProbe`<br>`dotnet run -c Release --project FpProbe`<br>The same Release run with `DOTNET_TieredCompilation=0`, with `DOTNET_EnableAVX2=0`, and with `DOTNET_EnableHWIntrinsic=0`.<br>`dotnet run -c Release -r win-x86 --self-contained --project FpProbe`<br>Changed: `--self-contained` was added, because no 32-bit 10.0 shared runtime is installed.<br>Added: the same product with operands parsed at run time; a second loop without `Math.Sin` (arithmetic only); `dotnet run -c Release -f net8.0 --project FpMulti` (also `net9.0`, `net10.0`, `net11.0`, and `net10.0` with `-r win-x86 --self-contained`). | All five x64 runs on 10.0.11: `x=BFC3D97C53CECCE0 v=BFD2F219A0C46EC1`, `p*q+r=0000000000000000 fma=3C90000000000000`, `sin=BFEB453AB76BF397 pow=40417EC0CE0D1A5F sqrt=3FF6A09E667F3BCD`.<br>The first line read `Fma=True Avx2=True` in three runs and `Fma=False Avx2=False` under `DOTNET_EnableAVX2=0` and under `DOTNET_EnableHWIntrinsic=0`, so both variables took effect.<br>32-bit run on 10.0.11: `x=BFC3D97C53CECCCD v=BFD2F219A0C46EBE`, `sin=3FDA608E92BF3F80`; `pow`, `sqrt`, `p*q+r` and `fma` unchanged.<br>Added, arithmetic-only loop: `x=3F489A76F3C46BD2 v=3EF174E2C94234C4` in every run, 32-bit and 64-bit, on all four runtime versions.<br>Added, x64 on 8.0.25, 9.0.14 and 11.0.0-rc.3: every field equal to the 10.0.11 x64 values. | N9, N11: confirmed by run; the loop that calls `Math.Sin`, and `Math.Sin(1e22)` itself, differ between a 32-bit and a 64-bit process on the same machine and runtime version.<br>N14: confirmed by run; `Math.FusedMultiplyAdd` differs from `p*q+r` in every run, and the JIT did not fuse `p*q+r` in any configuration tested.<br>N2, N3: not established by run; they state a permission, and no use of extra precision was observed in these configurations. |
| X7 | C3, C4, C8, C15, C17 | Probe built with SDK 10.0.400; the Coyote 1.7.11 tool ran on runtime 8.0.25, and on 10.0.11 in the one run with a roll-forward setting | Changed: `--tool-path <scratch>\tools` instead of `--global`.<br>`dotnet tool install --tool-path <scratch>\tools Microsoft.Coyote.CLI --version 1.7.11`<br>`dotnet build CoyoteProbe -c Debug` (`net10.0`, package `Microsoft.Coyote` 1.7.11)<br>`coyote rewrite CoyoteProbe\bin\Debug\net10.0\CoyoteProbe.dll`<br>`coyote test CoyoteProbe\bin\Debug\net10.0\CoyoteProbe.dll --iterations 1`<br>Added: the same test with `DOTNET_ROLL_FORWARD=LatestMajor` and `--iterations 1000`.<br>Then, as the experiment prescribes, a `net8.0` copy: `coyote rewrite`, `coyote test ... --iterations 1`, `coyote test ... --iterations 1000`, `coyote replay <dll> <trace file>` twice.<br>Added: `coyote test <dll>` with no `--iterations` option, 8 times.<br>Added after the first three test runs: `COYOTE_CLI_TELEMETRY_OPTOUT=1`, because the tool printed `Anonymized telemetry is enabled`; the line did not appear in later runs. | Tool banner: `Microsoft (R) Coyote version 1.7.11.0 for .NET 8.0.25`.<br>Rewrite of the `net10.0` assembly: completed, exit code 0.<br>Test of the `net10.0` assembly: `Unable to load one or more of the requested types.` `Could not load file or assembly 'System.Runtime, Version=10.0.0.0, ...'`, exit code 1.<br>With roll-forward: banner `for .NET 10.0.11`; `Iteration #3 found bug #1`; `Explored 3 execution paths`; `Found 1 bug.`; the run stopped there although 1000 iterations were configured.<br>`net8.0`, `--iterations 1`: `Iteration #1 found bug #1`, `Found 1 bug.`, trace file `...\CoyoteOutput\CoyoteProbe8_0.trace` written, exit code 2.<br>`net8.0`, `--iterations 1000`: `Iteration #1 found bug #1`, `Explored 1 execution path`, exit code 2.<br>No `--iterations` option, 8 runs: each shows only `Iteration #1`; 5 runs `Found 1 bug.`, 3 runs `Found 0 bugs.`<br>Replay, both times: `Reproduced 1 bug`, same exception at the same source line, exit code 2. | C4, C8, C15: confirmed by run.<br>C17: confirmed (newest packages `Microsoft.Coyote` and `Microsoft.Coyote.CLI` are 1.7.11; the installed tool hosts on .NET 8).<br>C3: narrower by run; the run stops at the first bug, see the list below.<br>New result: at the default of one iteration, a test with a real race passed 3 times in 8. |
| X8 | D2, D10 to D13 | Dafny 4.11.0 tool (its own .NET 8 host); no project build | Changed: `--tool-path <scratch>\tools` instead of `--global`.<br>`dotnet tool install --tool-path <scratch>\tools dafny --version 4.11.0`<br>`dafny --version`<br>`dafny verify half.dfy`<br>Changed: the tool package contained no solver, so Z3 4.12.1 was downloaded from the Z3 release page and passed with `--solver-path <scratch>\dl-z3\z3-4.12.1-x64-win\bin\z3.exe`.<br>`dafny verify --solver-path <z3> half.dfy`<br>`dafny translate cs --solver-path <z3> half.dfy`<br>`grep -n BigRational half.cs`<br>`dafny resolve fp.dfy`<br>Added: a C# program that evaluates `(x / 2.0) * 2.0 == x` over `double` for six inputs (SDK 10.0.400, runtime 10.0.11). | `4.11.0+fcb2042d6d043a2634f0854338c08feeaaaf4ae2`<br>Without a solver: `CLI: Error: Z3 is not found. ...`, exit code 4.<br>With the solver: `Dafny program verifier finished with 2 verified, 0 errors`.<br>`half.cs` line 53: `public static Dafny.BigRational Half(Dafny.BigRational x)`; line 56: `y = (x) / (new Dafny.BigRational(BigInteger.Parse("2"), BigInteger.One));`; line 63: `_out0 = __default.Half(new Dafny.BigRational(BigInteger.One, BigInteger.Parse("10")));`.<br>`fp.dfy(1,33): Error: Type or type parameter is not declared in this scope: fp64`, `2 resolution/type errors detected in fp.dfy`, exit code 2.<br>Added, over `double`: `x=5E-324 y=0 y*2.0==x: False`; `x=1.5E-323 ... False`; `x=NaN ... False`; `x=0.1`, `x=1E+308` and `x=∞` gave `True`. | D2, D11, D12, D13: confirmed by run for 4.11.0.<br>D10: confirmed by citation (Table 2) and consistent with the run.<br>New result: the .NET tool package of 4.11.0 does not verify anything until a Z3 4.12.1 executable is supplied. |
| X9 | M4, M6, M8 to M11, M19, M20 | Java 24.0.2; `tla2tools.jar` from the v1.7.4 release page (banner `TLC2 Version 2.19 of 08 August 2024`); Apalache 0.63.0 from its release page | `java -cp tla2tools.jar tlc2.TLC -deadlock -config StepCommit.cfg StepCommit.tla` with `MaxTick = 3`, then with `MaxTick = 6`.<br>The same command on a copy with `UNCHANGED staged` in `Abort`.<br>The same command without `-deadlock`.<br>Added: a copy with `Begin` removed from `Next`.<br>Added: an invariant `NeverSix == committed < 6`, checked with `MaxTick = 3` and `MaxTick = 6`.<br>Apalache, on a copy with type annotations and `CInit == MaxTick = 6`: `java -jar apalache.jar check --cinit=CInit --inv=NeverSix StepCommitTyped.tla`, then with `--length=11`, then with `--length=12`; and `--inv=AllOrNothing` with `--length=2` and `--length=10`. | The specification parsed as written.<br>`MaxTick = 3`: `Model checking completed. No error has been found.` `calculated (optimistic): val = 1.1E-18` `10 states generated, 7 distinct states found` `The depth of the complete state graph search is 7.`<br>`MaxTick = 6`: `No error has been found.` `val = 4.2E-18` `19 states generated, 13 distinct states found`.<br>Broken `Abort`: `Error: Invariant AllOrNothing is violated.` with a 3-state trace ending in `staged = 1`, `committed = 0`, `phase = "idle"`; exit code 12.<br>Without `-deadlock`: `Error: Deadlock reached.`<br>Added, `Begin` removed: `No error has been found.` `1 distinct states found`.<br>Added, `NeverSix`: no error with `MaxTick = 3` (7 distinct states); `Error: Invariant NeverSix is violated.` with `MaxTick = 6`.<br>Apalache, `NeverSix`, default bound: `The outcome is: NoError` `Checker reports no error up to computation length 10`.<br>`--length=11`: `no error up to computation length 11`.<br>`--length=12`: `State 12: state invariant 0 violated.` `Found 1 error(s)`, exit code 12.<br>`AllOrNothing`: `no error up to computation length 2` and `no error up to computation length 10`. | M6, M8, M9, M10, M19, M20: confirmed by run (M9 and M10 with the added variants).<br>M4: consistent with the run; it is a statement about what the tool checks and rests on the citation.<br>M11: the collision estimate is printed; a collision was not observed, so the consequence stated in M11 rests on the citation. |

### Table 2. Citations

Each source was fetched on 2026-11-11 and searched for the quoted text.
GitHub release data was read from the repository's release API and its Atom feeds; NuGet data from the registration index of the package.
PDF files were converted to text with a local `pdftotext`.

| Claim ID | Verdict | Accurate statement and URL, where the verdict is not `confirmed` |
|---|---|---|
| V1, V2, V3, V4, V5, V6, V7, V8, V9, V10 | confirmed | V1: the release API gives v1.7.4 `published_at` 2024-08-05 and the v1.8.0 pre-release 2026-11-06; the jar on the v1.7.4 page identifies itself as built on 08 August 2024. V3: a search of the README for ".NET", "dotnet" and "C#" found no line. |
| V11 | narrower | The newest `P` package on NuGet is 3.1.0, published 2026-06-03 (https://api.nuget.org/v3/registration5-gz-semver2/p/index.json). The repository has an annotated tag `p-3.1.0` dated 2026-06-03 and no GitHub release for it: https://api.github.com/repos/p-org/P/releases/tags/p-3.1.0 returns 404, and https://github.com/p-org/P/releases/latest redirects to `peasyai-v1.0.0` (published 2026-03-05), a different component. The last commit on `master` is dated 2026-08-03. |
| V12, V13, V14, V15, V16, V17 | confirmed | V13: see the new result in X8. V17: the nine runtime files and the one SDK file fetched at those tags returned HTTP 200; which pages the first pass read cannot be checked. |
| C17 | confirmed | Feed entries "Add .NET 10 compatibility support (#534)" 2026-11-03 and "Add .NET 11 support (#539)" 2026-11-11; newest packages 1.7.11 of 2024-03-18; newest tag `v1.7.11`; X7. |
| D12 | confirmed | By run X8, for 4.11.0. |
| K14 | confirmed | By run X5: the 5.0.1 assembly contains a public type `CsCheck.Spec`. What the feature does was not exercised. |
| R9 | narrower | With the default trace listener and its assert switch on, a failed `Trace.Assert` in a Release build ends the process through `DebugProvider.FailCore` (observed exit code 0x80131623 on runtime 10.0.11). `DefaultTraceListener.Fail` makes that call only inside `if (AssertUiEnabled)` (source read). With the listeners cleared, or with `AssertUiEnabled` set to false, the failed assertion did not stop the process (run X1). https://raw.githubusercontent.com/dotnet/runtime/v10.0.0/src/libraries/System.Diagnostics.TraceSource/src/System/Diagnostics/DefaultTraceListener.cs |
| R16 | confirmed | By run X2. |
| M2, M3, M4, M6, M7, M8, M9, M10, M11, M13, M15, M16, M17, M18, M19, M20, M21, M22, M24, M25, M26, M27 | confirmed | |
| C2, C4, C5, C9, C10, C11, C12, C13, C15, C16 | confirmed | C15: the same document also says "A manual `dotnet exec` host override makes a baseline probe work", which matches the roll-forward run in X7. |
| P2, P3, P4, P5, P6, P7, P10 | confirmed | |
| D1, D3, D4, D5, D6, D7, D8, D9, D10, D11, D13, D14, D15, D16 | confirmed | |
| F2, F3, F7, F9 | confirmed | |
| K2, K3, K5, K7, K8, K9, K10, K11, K12 | confirmed | K8, K9: the source was read on the default branch; the run in X5 used the 5.0.1 package and agrees. |
| K4 | narrower | The README says the seed replays "this exact failure" (https://raw.githubusercontent.com/AnthonyLloyd/CsCheck/master/README.md). Observed with 5.0.1: passing the seed back reproduced a failure in every attempt; with default settings the run went on sampling and shrinking, and 3 of 8 attempts reported a different, smaller counterexample and a new seed; with `iter: 1` the same counterexample was reported in 4 of 4 attempts. The reported counterexamples for `i < 1000` were 1233, 1212, 1200, 1142 and 1025, so the result is not a minimal one. |
| R1, R2, R3, R4, R5, R6, R7, R8, R10, R11, R14, R15 | confirmed | R7: the method first calls a replaceable hook (`s_FailCore`) and breaks into an attached debugger; the fail-fast is the branch with no hook and no debugger. |
| R12 | narrower | `ThrowIfNegative` has no conditional attribute and its body is `if (T.IsNegative(value))`, a test of the sign. For `double` it throws for `-0.0` and for a NaN whose sign bit is set, which is the NaN that `0.0 / 0.0` produced here (`FFF8000000000000`); it does not throw for a NaN whose sign bit is clear (X2). It is not a guard against NaN and it rejects negative zero. https://raw.githubusercontent.com/dotnet/runtime/v10.0.0/src/libraries/System.Private.CoreLib/src/System/ArgumentOutOfRangeException.cs |
| N2, N5, N7, N9, N10, N11, N12, N16, N18, N19, N20 | confirmed | These are confirmations of what the pages say. N18 and N20 were not shown by a run (X3). |
| N15 | narrower | The page says conversions to `int`, `long`, `uint` and `ulong` saturate on x86 and x64 from .NET 9, and adds: "In .NET 11, this behavior extends to unchecked conversions to sbyte, byte, short, ushort, and char on CoreCLR (including its interpreter) and Native AOT, but not Mono." Observed (X2): `(int)1e20` changed between 8.0.25 and 9.0.14; `(byte)300.0` changed between 10.0.11 and 11.0.0-rc.3. https://learn.microsoft.com/en-us/dotnet/core/compatibility/jit/9.0/fp-to-integer |

Claims of section (b) that are in neither table were not checked in this pass.
That includes N3 and N4 (the CLI standard was not opened), N1, N13, N17, N21, R13, R17, S1 to S7, M1, M5, M12, M14, M23, M28, C1, C6, C7, C14, P1, P8, P9, F1, F8, F11, K1 and K13.
The ten claims with a verdict from a run only (listed under the error rate) did not have their citations re-opened.

### Error rate

Citations (Table 2): 114 claims checked; 109 confirmed, 5 narrower (V11, R9, R12, K4, N15), 0 refuted, 0 unreachable.
Three of the five (R9, R12, K4) quote their source correctly and were narrowed by a run, not by the page.
Claims with a verdict from a run only (Table 1): 10 (C3, C8, D2, F4, F5, F6, F10, N6, N8, N14); 9 confirmed, 1 narrower (C3).
Together: 124 claims with a verdict; 118 confirmed, 6 narrower, 0 refuted, 0 unreachable.
The five claims tagged `unverified` in section (b): 4 confirmed (C17, D12, K14, R16), 1 narrower (R9).
The expected results written under X1, X2, X5 and X8 in section (d) all matched what was observed.
Experiments that could not test their claims as written: X4 (F4, F5, F6), X3 (N18, N20), and X2 for run-time values (every operand was a constant).

### Claims not to use in guidance as written

- V11. Use: "The newest P package on NuGet is 3.1.0 (2026-06-03). It is a tag in the repository, not a GitHub release; the repository's latest release is a different component."
- R9. Use: "A failed `Trace.Assert` stops a Release process only while the default trace listener is registered and its `AssertUiEnabled` is true. With the listeners cleared or the switch off, execution continues."
- R12. Use: "`ThrowIfNegative` tests the sign bit in every build configuration. For `double` it rejects `-0.0`, rejects a NaN with the sign bit set, and passes a NaN with the sign bit clear. It is not a NaN guard."
- K4. Use: "Passing the printed seed back reproduces a failure. To get the same counterexample again, pass `iter: 1` as well; with default settings the run can report a different counterexample and seed. The counterexample is not guaranteed to be minimal."
- N15. Use: "From .NET 9, conversions from floating point to `int`, `long`, `uint` and `ulong` saturate on x86 and x64. Conversions to `sbyte`, `byte`, `short`, `ushort` and `char` saturate only from .NET 11, and not on Mono. The same out-of-range conversion gave different results on .NET 8, .NET 10 and .NET 11 on one machine."
- C3. Use: "A Coyote run executes the test up to the configured number of iterations and stops at the first bug it finds." Observed: stopped after iteration 3 of 1000 and after iteration 1 of 1000.

Claims that hold but mislead without an addition:

- F2, and the sentence in section (b) that the generator bounds what can be found. Add: "FsCheck's default `int` generator stayed between -86 and 95 in two runs of 100 tests, and the false property `x < 1000` passed 100,000 tests. A pass is a statement about the generator's range, not about the type." The default `double` generator produced a non-finite value within 100 tests in 4 of 4 property runs (NaN in three, an infinity in one).
- K9. Add: "`Gen.Double.Special` produced NaN in about 0.4% of draws (4,281 of 1,000,000), so a sample of 100 can contain none."
- C4. Add: "At the default of one iteration, a test with a real race reported no bug in 3 of 8 runs."
- C15. Add: "The 1.7.11 tool ran a `net10.0` assembly when started with `DOTNET_ROLL_FORWARD=LatestMajor`, and rewrote it without that setting. This is a host override, not support; C16 still applies."
- V13. Add: "The .NET tool package of Dafny 4.11.0 found no solver on this machine; `dafny verify` failed with 'Z3 is not found' until a Z3 4.12.1 executable was passed with `--solver-path`."
- M20. Add: "At the default bound of 10, Apalache reported no error for an invariant whose shortest violation has 12 steps."
- N9 and N11. Add: "Observed on one machine and one runtime version: a 32-bit and a 64-bit process disagree on `Math.Sin(1e22)` and on a loop that calls `Math.Sin`; a loop of `+`, `-` and `*` only was bit-identical in every configuration and on four runtime versions. The second half is an observation on one processor, not a guarantee."
- N18, N20. Do not present them as observed. The seeded `Random` sequence was the same on four runtime versions, and the set order was the same in two runs; only the documentation states the non-guarantee.
- Coyote, any use. Add: "The command-line tool sends anonymized telemetry unless `COYOTE_CLI_TELEMETRY_OPTOUT=1` is set."

### Worklist for a person

Table A, one row per finding, shortest first.

| ID | Question to decide | Where to look | Command | Minutes |
|---|---|---|---|---|
| R12 | Should guidance tell developers to guard `double` arguments with `double.IsNaN` or `double.IsFinite` instead of the `ThrowIf...` helpers? | Output lines `ThrowIfNegative(...)` and `ThrowIfGreaterThan(...)` | `dotnet run -c Release --project NanProbe` | 5 |
| R9 | Does any host in scope clear `Trace.Listeners` or replace the default listener, so that `Trace.Assert` cannot be recommended as a Release invariant? | The application's start-up code and logging setup | `dotnet run -c Release -f net10.0 --project ConvMulti -- clear` | 10 |
| N15 | Which runtime versions must a replay match, given that out-of-range conversions differ between .NET 8, 10 and 11? | The two conversion lines per runtime | `dotnet run -c Release -f net8.0 --project ConvMulti` | 10 |
| V11 | Is "tag and NuGet package" enough to call P 3.1.0 released, for the purpose of the guidance? | The release list and the tag page of the repository | `curl -s https://api.github.com/repos/p-org/P/releases?per_page=5` | 10 |
| K4 | Should guidance require `iter: 1` when a CsCheck seed is stored as a regression case? | The `seed, defaults` and `seed, iter:1` lines | `dotnet run -c Release --project CsProbe2` | 10 |
| F2 | Which generator ranges must guidance require for integer properties, given the default range seen? | Lines E and F | `dotnet run -c Release --project FsProbe2` | 15 |
| C3, C4 | What iteration count, and what stop rule, should guidance state for a Coyote test? | The `Iteration #` and `Found ... bug` lines over repeated runs | `coyote test CoyoteProbe8\bin\Debug\net8.0\CoyoteProbe8.dll` | 15 |
| N9, N11 | Is a 32-bit target in scope for replay, and if so which math functions must be avoided or replaced? | The `sin=` field and the two loop lines | `dotnet run -c Release -f net10.0 -r win-x86 --self-contained --project FpMulti` | 20 |

Table B, what this pass did not reach, shortest first.

| Item | What was applied | What could not be ruled out | Minutes |
|---|---|---|---|
| N20 | One run pair on `HashSet<string>` | Whether `Dictionary` enumeration order varies between runs, versions or after removals | 10 |
| K6, K7 | A parallel sample that passed | Whether a real linearization failure is detected and whether its seed reproduces it | 20 |
| K10, K11, K12, K14 | Presence of the type `CsCheck.Spec` only | What `Exhaustive` and `Conform` report on a model and an implementation | 30 |
| N3, N4, N13, N17 and the other claims of section (b) named as not checked | Not opened | Whether the pages say what the claims state | 30 |
| N2, N3, N10 | Runs on one x64 processor, four runtime versions, x86 and x64 processes | Results on Arm64, on another operating system, on another processor model, and under Native AOT | 60 |
| C16 | Citation only | Whether `System.Threading.Lock` is still passed through silently by the 1.7.11 package and by the unreleased default branch | 45 |
| C11, C12, C13 | Citations only | What Coyote reports for a bug that needs a memory reordering, a timeout or a liveness property | 60 |
| M21, M22, M25 to M27 | Citations only | Whether an inductive-invariant run and a trace-validation run behave as the documents say; no trace validation exists for .NET in the sources read | 90 |
| P1 to P10 | Citations for P2 to P7 and P10 only | Everything about running P; no P experiment exists in section (d) | 60 |
| S1 to S7 | Not opened | Whether the replay sources say what the claims state | 20 |
