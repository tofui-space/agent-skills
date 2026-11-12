# C# code the checker cannot enumerate

Read this when C# code has no admitted shape and reshaping cannot give it one: state that changes over a sequence of steps, concurrency, results that must repeat, floating-point arithmetic, or an algorithm over unbounded values.
This skill computes no checks for such code.
This page names the technique that fits each kind, the strongest sentence a pass of it supports, and what stays unchecked.

Every factual line below rests on a primary source opened on 2026-11-11 and re-opened by a second reader, or on a run made that day on one Windows x64 machine.
The runs used .NET runtime 10.0.11 unless a line names another version; a few compared runtimes 8, 9, 10 and an 11 release candidate.
"Observed" marks a run on that one machine; it is not a guarantee.
A line marked "by construction" follows from what the test does and has no source behind it.
Version numbers are as of that date: confirm them on the tool's own release page before repeating a version-specific line.

## Reporting rules

- Never call a result on this page exhaustive, complete or proven for the C# program.
  Use the sentence in the "A pass supports" column, with its numbers.
- State the parameters with every result: the model and its bounds, the number of iterations, the sample size and the generator.
- A result about a model is about the model.
  Say who compared the model with the code, or that nobody did.
- Keep the two claims apart in a report: admitted decisions with their computed checks, and everything else listed as outside the claim with the technique that was used on it, or none.
- First pull the finite decisions out of the code into admitted methods, where that preserves behavior.
  The rest stays outside.
- Do not install or start any of these tools unasked.
  Each is a cost the user decides on: a model someone writes and maintains, a Java or solver dependency, or a tool that reports usage data.

## Which technique fits

| Code | Technique | A pass supports | Stays unchecked |
|---|---|---|---|
| State that changes step by step: a state machine, a protocol, an all-or-nothing update | A TLA+ model of the design, checked with TLC. For the C# code itself, a model-based property test that applies random operation sequences to the code and to a simple model (CsCheck `SampleModelBased`). | TLC in model-checking mode: the property holds for every behavior of the finite model that was supplied, unless two states shared a fingerprint. Property test: no difference from the model in the sampled sequences. | Whether the code matches the model. Larger models. A property that holds because the model does nothing. Sequences that were not sampled. |
| Concurrent or asynchronous code | Coyote, which runs the compiled C# test under schedules it controls. | The schedules explored, within the iteration count and the APIs Coyote controls, did not violate the assertions. | Schedules not explored. Reordering of memory accesses. Concurrency APIs Coyote does not control. Elapsed time. |
| A result that must repeat: save and load, replay of recorded input | No tool was examined for this. A test of your own that feeds the same recorded input twice and compares the resulting state bit for bit, with time and randomness passed in as inputs. | By construction: that input gave the same state twice, on that build, that runtime and that machine. | Another machine, processor architecture or .NET version. Inputs that were not recorded. |
| Arithmetic over `double` | Property tests with a generator chosen to include NaN, both infinities and extreme values. Explicit `double.IsFinite` checks at the boundary; it is false for NaN and for both infinities. | No counterexample among the sampled values from the stated generator. | Every value the generator cannot produce. Differences between platforms and versions. |
| A small sequential algorithm over integers | Dafny: write the algorithm with its specification and verify it, then compile it to C#, or keep it as the reference for property tests of hand-written C#. | Every method of the Dafny program meets its written specification for all inputs, when no assumption is left unproven. The compiled C# is meant to behave the same, and Dafny's manual says that is not always possible. | Hand-written C#, including a port of the verified algorithm. External methods, whose postconditions are assumed. Whether the specification says what is wanted. Concurrency. |
| An invariant that must hold while the program runs | An explicit `if (...) throw` at the boundary, compiled into every build. | Nothing before the run. A violated assumption becomes a visible failure on the executions that occur. | Every execution that does not occur. |

## What to know before relying on a pass

### Models (TLA+, TLC, Apalache)

- The author of TLA+ states that a model above the code level does not prevent coding errors, and that no model describes a real system completely.
- TLC checks a model in which a person fixed the constants; an infinite state space must be constrained to a finite one first.
- The TLC documentation says to be suspicious of a pass, because a safety property is easy to satisfy by doing nothing.
  Observed: with one action removed from a model, TLC reported no error and one reachable state.
- Apalache checks executions up to a bound, 10 steps by default, and says a bug that needs a longer execution may be missed.
  Observed: at the default bound it reported no error for an invariant whose shortest violation has 12 steps.
- TLC also has a simulation mode that samples behaviors without trying to reach every state; a pass in that mode is a sample.
- TLC identifies states by 64-bit fingerprints.
  Its documentation says that after a collision it reports all reachable states as checked when some were skipped; it prints an estimate of that probability.
- Apalache does not support real numbers.
- Both tools check properties of the behaviors of a model.
  The TLA+ tools run on Java 11 or later.

### Schedule exploration (Coyote)

- Its documentation says: "Coyote is not a verification system."
- The command-line default is one iteration.
  Observed: at that default, a test with a real race reported no bug in 3 of 8 runs.
  A run stops at the first bug it finds.
- It does not explore weak-memory behavior and does not support every concurrency API.
- The newest published package, 1.7.11, hosts its test runner on .NET 8.
  Observed: it could not load a `net10.0` test assembly without a host override.
- The command-line tool sends anonymized usage data unless `COYOTE_CLI_TELEMETRY_OPTOUT=1` is set.
  Tell the user before the first run, and set the variable unless they decide otherwise.

### Property-based tests (FsCheck, CsCheck)

- Both run 100 cases by default.
  A pass is a statement about the generator's range, not about the type.
- Observed with FsCheck 3.6.0: in two runs of 100 tests the default `int` generator stayed between -86 and 95, and the false property `x < 1000` passed 100,000 tests.
- CsCheck's default `double` generator is the range -1e50 to 1e50.
  Observed with 5.0.1: no NaN and no infinity in 1,000,000 draws.
  `Gen.Double.Special` produced NaN in about 0.4% of draws, so a sample of 100 can contain none.
- Both print a seed on failure.
  Observed with CsCheck: the seed reproduced a failure every time, but 3 of 8 default replays reported a different counterexample; with `iter: 1` it was the same one each time.
- FsCheck's stateful testing lives in a namespace its documentation calls experimental and outside its versioning rules.

### Proof (Dafny)

- Only the code that originates from Dafny is verified; code it is combined with is not.
- The numeric types documented at release 4.11.0 are `int` and `real`.
  Observed: `real` compiles to an exact rational type in C#, so a proof over `real` says nothing about `double`.
- Observed: the 4.11.0 .NET tool verified nothing until a Z3 solver executable was supplied.

### Run-time invariants

- `Debug.Assert` is compiled only when `DEBUG` is defined.
  Observed: a Release build ran past a failed `Debug.Assert` and exited with code 0.
- `Trace.Assert` stops a Release process only while the default trace listener is registered and its `AssertUiEnabled` is true.
  Observed: with the listeners cleared, execution continued.
- Code Contracts are not supported on .NET 5 and later.
- Do not rely on the `ArgumentOutOfRangeException.ThrowIf...` helpers to stop NaN.
  Observed: `ThrowIfGreaterThan(double.NaN, 10.0)` did not throw, while `ThrowIfLessThan(double.NaN, 0.0)` did; `ThrowIfNegative` rejected `-0.0` and passed a NaN whose sign bit is clear.
  The other helpers were not run.

### Repeating a `double` result

- The research found no first-party statement that `double` results are identical across machines, runtimes or hardware, in the pages it read; that search was made once and not repeated.
  The .NET documentation states the opposite for specific cases: by platform for arithmetic, by .NET version for comparisons, and by operating system or architecture for `Math.Sin` and `Math.Pow`.
- Observed: a 32-bit and a 64-bit process on one machine and one runtime disagreed on `Math.Sin(1e22)`; a loop of `+`, `-` and `*` only was bit-identical in every configuration tried.
- Every comparison with NaN is false except `!=`; `Equals` and `==` disagree on NaN.
- Conversion of an out-of-range `double` to an integer type changed between .NET versions.
  Observed: `(int)1e20` differs between .NET 8 and .NET 9, and `(byte)300.0` between .NET 10 and a .NET 11 release candidate.
- A seeded `Random` is documented as not guaranteed to repeat across major .NET versions, string hash codes as able to differ between runs, and `Dictionary` enumeration order as undefined.
  Observed for hash codes only.

## Sources

Model checking: <https://lamport.azurewebsites.net/tla/high-level-view.html>, <https://lamport.azurewebsites.net/tla/book-21-07-04.pdf> (chapter 14), <https://github.com/apalache-mc/apalache> (`docs/src/apalache/running.md`, `features.md`).
Coyote: <https://github.com/microsoft/coyote> (`docs/index.md`, `docs/get-started/using-coyote.md`, `docs/concepts/binary-rewriting.md`, `NET10-COMPATIBILITY-ASSESSMENT.md`).
Dafny: <https://github.com/dafny-lang/dafny> (`docs/DafnyRef/UserGuide.md` on the default branch, `docs/DafnyRef/Types.md` at tag `v4.11.0`).
Property-based tests: <https://github.com/fscheck/FsCheck> (`docs/RunningTests.fsx`, `docs/StatefulTesting.fsx`), <https://github.com/AnthonyLloyd/CsCheck> (`README.md`, `CsCheck/Gen.cs`).
.NET: <https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.debug.assert>, <https://learn.microsoft.com/en-us/dotnet/framework/debug-trace-profile/code-contracts>, <https://learn.microsoft.com/en-us/dotnet/fundamentals/runtime-libraries/system-double>, <https://learn.microsoft.com/en-us/dotnet/api/system.math.sin>, <https://learn.microsoft.com/en-us/dotnet/core/compatibility/jit/9.0/fp-to-integer>, <https://learn.microsoft.com/en-us/dotnet/fundamentals/runtime-libraries/system-random>.
