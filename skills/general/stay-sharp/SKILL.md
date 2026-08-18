---
name: stay-sharp
description: Assistant-to-user directive — don't take the above on faith. After technical, security, architectural, or regulatory-sensitive recommendations for a professional project, append a compact "Stay sharp" footer with 1–3 official sources, 2–5 concrete self-check steps, and a time estimate, so the user stays in the loop and doesn't let reliance on the assistant atrophy their own checking muscle. Trigger on authoritative claims about GDPR, NIS2, DORA, WCAG, OWASP ASVS, ECSS, crypto/auth flows, version-pinned framework behavior, cloud/deployment configs, EU legal obligations, or architectural stack choices for a real build. Skip brainstorming, opinions, trivial debugging, or topics where the user has already demonstrated mastery in the session (cites specs accurately, corrects the assistant with sources, frames questions with expert-level precision). Also trigger on "verify this", "how do I check this myself", "sources?", or the skill name ("stay-sharp").
---

# Stay-Sharp

A directive from the assistant to the user: don't take the above on faith. After an authoritative technical or regulatory answer, this skill appends a short **Stay sharp** footer that points to the best official sources and the cheapest independent checks. It exists to keep the user's judgment engaged — the assistant can be confidently wrong, and more importantly, even when the assistant is right, a user who never checks gradually loses the instinct to check at all.

## Why this exists

The risk isn't primarily that the assistant makes mistakes. The assistant does what it's designed to do — synthesize from a training-cutoff snapshot, fill gaps with plausible-sounding text, compress nuance. The real risk is on the user side: a drift from "AI gave me a lead" to "AI gave me the answer", and with it an atrophy of the reflex to open the spec, run the command, read the regulation.

Professional work — especially EU-regulated, security-sensitive, or production-bound — has an asymmetric cost of being subtly wrong. Missing a GDPR caveat, mixing up a .NET 10 vs .NET 9 API, or citing a retired WCAG technique can cost days or expose real risk. Those failures look like AI errors in the post-mortem, but they're usually the result of the user having stopped checking.

This skill is a handoff. The assistant does its part; the footer tells the user which 2–5 minutes of their own work will keep them from sliding into auto-pilot. It is not a disclaimer, not a performance of humility. It assumes a competent reader and tells them where to press.

## When to trigger

**Trigger** when the response contains one or more of:

- Architectural or stack decisions for a real project (framework choice, DB, auth model, deployment shape)
- Security / compliance guidance — GDPR, NIS2, DORA, ePrivacy, ISO 27001, OWASP ASVS, ECSS, SOC2, PCI-DSS
- Accessibility claims — WCAG 2.x techniques, EAA obligations, ARIA patterns presented as normative
- Cryptographic, authentication, session, or data-handling recommendations
- Version-specific API or framework behavior where outdated info is costly (e.g., "in .NET 10 this changed", "Angular 21 requires", "Next.js 15 App Router")
- Legal / regulatory assertions — deadlines, thresholds, obligations, fines, supervisory-authority guidance
- Best-practice claims likely to be copied verbatim into production code, configs, or policy docs

**Skip** when:

- The exchange is exploratory — brainstorming, naming, comparing vibes, weighing personal preferences
- The user is debugging a concrete error with a clear log trail and Claude is just parsing symptoms
- The response is short and non-authoritative (e.g., 1–3 sentences confirming syntax or a typo)
- The user has already demonstrated mastery of the exact sub-topic in the current session — signals include: they cite the spec accurately before asking, they correct you with specific references, the question itself encodes the authoritative framing (e.g., "per GDPR Art. 17(1)(b), do I also need…")
- The topic is well inside the user's known baseline (routine frontend JS/TS, home networking basics, music-production workflow, generic Git operations) *and* the specific answer is introductory-level

**Always trigger** when the user says the skill name, or asks: "verify this", "verification steps", "how do I check this myself", "where's the source", "is that still current", "official docs for this".

When in doubt, lean toward triggering for regulated/security content, and toward skipping for stylistic/exploratory content.

## Output format

Place the footer at the very end of the response, after all main content. Separate with a single blank line (no horizontal rule unless one is already used in the response). Inherit the response's speech form — if the main response uses trimmed/compact speech, so does the footer.

Template:

```
**Stay sharp** (~Xmin)
- [Source title](URL) — what to confirm here
- [Source title](URL) — what to confirm here

- [ ] Concrete check 1
- [ ] Concrete check 2
```

Rules:
- No preamble like "To verify my answer…" — the heading does that work
- One optional context line is allowed only if it tells the user *what to look for*, not general framing
- If there's exactly one source and it covers the whole check, collapse sources and checklist into a single list
- Checklist items start with a verb and reference a specific section, file, command, or clause where possible

## Selecting sources

Pick 1–3 using these priorities, in order:

1. **Normative / primary source** — the spec, regulation text, RFC, vendor documentation, standards-body page. Preferred publishers: EUR-Lex, EDPB, CNPD (Luxembourg supervisory authority), ENISA, W3C, IETF, NIST, OWASP Foundation, Microsoft Learn (pinned to version), official framework docs (Next.js, Angular, .NET, Payload, Marten).
2. **Human-readable over technically-authoritative** — when both exist, prefer the rendered HTML guideline over a 200-page PDF; prefer a vendor's "Overview + API reference" split over a raw OpenAPI dump. The user needs to actually read the page.
3. **Relevance over breadth** — one source that directly addresses the specific claim beats three tangential ones.

Version pinning: for framework / library behavior, link to the version-pinned URL whenever the docs host supports it (Microsoft Learn, Angular, Next.js all do). Don't link to `/latest/` if the response is about a specific version.

Avoid:
- Blog posts, even popular/authoritative ones, unless the author *is* the normative source (e.g., a core maintainer's changelog post)
- Stack Overflow, Reddit, Medium articles
- Paywalled aggregators unless no free alternative exists
- archive.org snapshots unless the live source is gone
- Aggregator sites that re-host spec text (e.g., GDPR mirror sites) — use EUR-Lex

## Writing the checklist

2–5 items. Each one is a concrete, independently-executable action. The user should be able to do it without re-reading your main response.

Good vs. bad:

- ❌ "Verify GDPR compliance"
- ✅ "Open the EDPB 05/2020 consent guidelines §3.1 and confirm the withdrawal-ease requirement matches what I said about the revoke flow"

- ❌ "Check the docs"
- ✅ "Run `dotnet --list-sdks` and confirm a 10.0.x SDK is present before copying the csproj target"

- ❌ "Test the code"
- ✅ "Load the admin page in Firefox with DevTools → Accessibility, and confirm the dialog receives focus on open"

Prefer checks that take <2 min each. If a check genuinely requires deeper reading, say so in the time estimate rather than pretending it's quick.

## Time estimate

Put an approximate total at the top of the footer. Ranges are fine when genuinely uncertain; otherwise pick a single number.

- `~2min` — single doc scan or single command
- `~5–10min` — 2–3 doc sections plus a config/code check
- `~15–30min` — reading a standard's section, cross-referencing versions
- `~30min+` — real research; flag it explicitly and suggest timeboxing or deferring if the decision isn't blocking

Round up. The goal is calibrated trust, not speed.

## Scaling to context

The footer scales with the response's stakes, not its length.

| Response scope                                          | Footer size                                            |
| ------------------------------------------------------- | ------------------------------------------------------ |
| Quick factual technical answer                          | 1 source, 2 checks, ~2–3min                            |
| Standard recommendation (config choice, API usage)      | 1–2 sources, 2–3 checks, ~5–10min                      |
| Multi-part design / architecture proposal               | 2–3 sources, 3–5 checks, ~10–20min                     |
| Major regulatory / security analysis (GDPR assessment, NIS2 scoping) | Can exceed limits; group sources by sub-topic |

If the footer would dwarf the main response, either the main response was under-developed or this skill is the wrong fit — reconsider before appending.

## Manual invocation

Trigger the full footer retroactively when the user says any of:

- The skill name ("stay-sharp")
- "verify this" / "verification steps for that" / "check this"
- "how do I check this myself"
- "sources?" / "official docs?"

In this mode, apply the footer to the *previous substantive response*, not the current user turn.

## Examples

**Example 1 — triggered on an architecture recommendation**

> Main response (abbreviated): recommends Marten v8 for dot-cmp event store + document DB, explains Martin's schema-evolution model for forgettable payloads, notes NpgsqlDataSource should be shared.

```
**Stay sharp** (~8min)
- [Marten v8 docs — Schema Migrations](https://martendb.io/schema/migrations.html) — confirm the feature flags for hot schema evolution match what I described
- [EDPB Guidelines 05/2020 on consent](https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052020-consent-under-regulation-2016679_en) §5 — cross-check the erasure expectations for consent logs

- [ ] Open the Marten migrations page, search for "schema evolution" — confirm forgettable-payload pattern isn't contradicted
- [ ] Run `dotnet list package` in the dot-cmp solution — confirm Marten is at 8.x, not pre-release
- [ ] Skim EDPB §5.1 on "withdrawal as easy as giving" — confirm my revoke-endpoint design fits
```

**Example 2 — skipped**

> User: "quick one — what's the TS type for a React ref to a button?"
> Main response: `React.RefObject<HTMLButtonElement>` with a one-liner example.

No footer. This is routine frontend TS well inside the user's baseline, and the answer is a single well-known type name.

**Example 3 — manual trigger**

> User (after a previous response on WCAG modal patterns): "stay-sharp"

```
**Stay sharp** (~6min)
- [WCAG 2.2 — Understanding 2.4.3 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) — confirm the initial-focus target matches my recommendation
- [ARIA Authoring Practices — Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) — confirm the `aria-modal` + focus-trap pairing

- [ ] Open APG dialog pattern → "Keyboard Interaction" table; confirm Esc + Tab-cycle behavior matches my code
- [ ] Run axe DevTools on the modal; confirm zero violations and focus-trap warning is absent
```
