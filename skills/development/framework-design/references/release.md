# Release guidelines

How a framework or library declares, versions, checks, documents, and ships its surface. Tool facts below were checked against the tools' documentation on 2026-11-06; recheck a tool's page before relying on a flag, because several of these tools are experimental or changing.

## Contents

- Declare the public surface
- Version
- Check compatibility before every release
- Deprecate
- Mark experimental surface
- Changelog and release notes
- Pre-releases
- Test the release
- Dependencies
- Support policy
- Security process
- Supply chain
- Release checklist

## Declare the public surface

SemVer requires it: software using Semantic Versioning must declare a public API [SemVer]. Declare it in two ways:

- **Mechanically**, so the toolchain enforces it: hide everything else with the language's visibility and packaging mechanisms. For example: the `"exports"` field of a Node.js package, which makes every unlisted subpath unavailable to importers (adding it to an existing package is itself likely a breaking change) [Node-Exports]; Java module `exports`; Kotlin `internal`; Rust `pub(crate)`; C# `internal`; Go `internal/` directories.
- **As a reviewed file**: an API report generated from the code and committed, so that every surface change shows up in review as a diff of that file. The compatibility checkers below produce or consume such reports.

## Version

- **SemVer** for libraries and frameworks: major for incompatible changes to the public API, minor for compatible additions, patch for compatible fixes [SemVer].
- **Go modules**: from major version 2, the module path must end in a major version suffix such as `/v2` [Go-Modules].
- **Alternative**: never break; add under new names instead, so that a new major is never needed [Hickey-Spec]. Suits ecosystems where libraries depend on each other and cannot upgrade in step.

## Check compatibility before every release

Run a checker in CI that compares the surface with the last release and fails on an unmarked break:

| Platform | Tool | Notes |
|---|---|---|
| Java | japicmp | Compares two versions of a jar. Revapi also exists, with low recent activity. |
| Kotlin | Kotlin Gradle plugin ABI validation | Experimental since Kotlin 2.2; the standalone binary-compatibility-validator plugin is in maintenance mode. |
| Rust | cargo-semver-checks | Compares against the previous version published on crates.io by default. |
| .NET | Package validation (`EnablePackageValidation`), ApiCompat | Runs after `Pack`; baseline-version, compatible-runtime, and compatible-framework validators. |
| TypeScript | API Extractor | Writes an API report (`etc/<package>.api.md`) that is committed; validation fails when it is stale. |
| Go | gorelease, apidiff (golang.org/x/exp) | Experimental, outside the Go 1 compatibility promise. |
| Python | griffe (`griffe check <package>`) | Compares against the latest Git tag by default. |

A checker sees signatures, not behavior. Behavioral breaks are caught by the tests that pin promised behavior, and by downstream tests (below). Tools built on a compiler's own programming interface can lag behind a new compiler major; check that the checker supports the compiler version in use, and record a workaround if it does not.

Before restructuring a framework's internals, commit the API report as it stands, known leaks included, as the baseline, and replace tests that import internal paths with tests through the public surface; otherwise the restructuring cannot show what it changed for consumers [Practice-2026-11-1].

## Deprecate

1. **Add the replacement first**, in a minor release.
2. **Mark the old element** with the language's mechanism, naming the replacement and the planned removal version: Java `@Deprecated(since = …, forRemoval = true)`; Rust `#[deprecated(since = …, note = …)]`; Python `@warnings.deprecated` (3.13 and later); C# `[Obsolete]`; JSDoc `@deprecated` for TypeScript.
3. **Keep it for at least one minor release** that contains the deprecation before removing it in a major [SemVer]. Python's own policy, for projects that follow it, requires the warning in at least two minor versions, and prefers five years [PEP387].
4. **Give a migration path**: the replacement in the deprecation message, migration steps in the release notes, and a codemod when the change is mechanical.
5. **Remove in a major version**, listed first in the release notes.

## Mark experimental surface

Surface that is not covered by the compatibility promise must say so in the code, not only in the documentation, so that consumers opt in knowingly: Kotlin `@RequiresOptIn` markers, used with `@OptIn`; .NET `ExperimentalAttribute` (from .NET 8), which takes a diagnostic ID; Rust items behind a cargo feature documented as unstable. State in writing that experimental surface may change or disappear in any release, and set a date to stabilize or remove each item.

## Changelog and release notes

- Keep a changelog in the Keep a Changelog form: an `Unreleased` section at the top, and the categories Added, Changed, Deprecated, Removed, Fixed, Security [KeepChangelog].
- Write entries for consumers: what changes for them, not which files changed.
- Put breaking changes first in a major release's notes, each with its migration steps.

## Pre-releases

Use SemVer pre-release identifiers (`2.0.0-alpha.1`, `-beta.1`, `-rc.1`) for majors and for large features, and publish them on a separate distribution tag or channel so that default installs do not pick them up.

## Test the release

- The framework's own tests, including the tests that pin promised behavior.
- The compatibility checker.
- **Downstream tests**: run known dependents' test suites against the release candidate. Rust's crater does this for the whole published crate ecosystem [Crater]; a smaller project can keep a list of representative dependents.
- **The supported range**: the oldest and newest supported runtime and language versions, and the oldest supported versions of the framework's own dependencies.
- **The scenario set**: the consumer code of the top scenarios (`scenarios.md`) builds and runs against the release.

## Dependencies

- **Few.** Every dependency of a library is a liability for the library and for its consumers [JLBP-1].
- **Ranges or pins, by what is distributed.** A library published to a registry and combined with other libraries in consumers' builds declares broad version ranges, so that consumers can resolve one version of a shared dependency: Cargo's caret requirements, not exact pins or `*` [Cargo-Resolver]; npm `peerDependencies` for the host a plugin extends, as broad as possible [npm-peer]. Applications, and frameworks distributed as one versioned whole whose consumers take the stack as given, may pin exact versions with a lockfile for reproducibility; the cost is that consumers cannot deduplicate shared dependencies. State the choice in the release policy.
- **Own what is on the critical path.** When a generator or tool the framework depends on enters maintenance mode, or breaks on the next compiler major, consider owning that piece; weigh it with criterion L7 in `tradeoffs.md`.
- **Consumption-side supply-chain controls**: locked restores, registry source mapping, blocked install scripts, and a minimum release age for new dependency versions protect the framework's own builds; count them in L7.
- **A new capability ships with a small consumer of it**, so that the capability is exercised from the first release.
- **No dependency types in the public surface** (problem-map A10).
- **Lockfiles**: committing one affects only the library's own builds, not its consumers; Cargo's current guidance leaves the choice to the project's needs [Cargo-FAQ].

## Support policy

Publish which versions receive fixes and security patches, and until when. Consumers plan upgrades around it.

## Security process

- A `SECURITY.md` that names the supported versions and how to report a vulnerability privately [GitHub-SecPolicy].
- Private advisories for fixing before disclosure, and a CVE identifier for each published vulnerability; GitHub repository security advisories support both [GitHub-Advisories].
- Patch releases for every supported line, and the Security category in the changelog.

## Supply chain

- Build releases in CI from a tagged commit, not on a developer's machine.
- Publish build provenance: SLSA describes build levels from "provenance exists" to "hardened builds" [SLSA]; npm publishes provenance with `npm publish --provenance` from supported CI providers [npm-provenance]; PyPI Trusted Publishing replaces long-lived tokens with short-lived ones issued to CI [PyPI-TP].
- Sign artifacts; Sigstore offers keyless signing recorded in a public transparency log [Sigstore].
- Track the project's security posture with OpenSSF Scorecard, which scores checks such as a security policy and pinned dependencies [Scorecard].

## Release checklist

1. The API report diff since the last release is reviewed; every change is classified (`compatibility.md`).
2. The compatibility checker passes, or every break is intended and the version is a major.
3. The version number matches the classification.
4. Deprecations carry the replacement and the removal version; due removals are done only in a major.
5. Experimental surface is marked in code.
6. The changelog's `Unreleased` section is complete and moved under the new version; breaking changes come first with migration steps.
7. Own tests, downstream tests, the supported range, and the scenario set pass.
8. Security fixes are in every supported line, with advisories ready.
9. The release is built in CI from the tag, with provenance and signatures.
