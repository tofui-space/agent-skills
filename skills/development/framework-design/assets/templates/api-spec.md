# <Feature area>: scenario-driven API specification

Status: draft | review | accepted · Version: <target release> · Updated: <date>
PRD: <link> · Design record: <link>

## Contents

- Scenarios
- Misuse scenarios
- Surface
- Contracts
- Extension contracts
- Constraints
- Compatibility
- Enforcement
- Open questions

## Scenarios

For each scenario, the consumer code comes first; the surface below exists to make this code work.

### SC-1 <Scenario name>

Consumer kind: <kind> · Importance: <high / medium / low>

```<language>
<consumer code>
```

Expected outcome: <what the consumer observes>

### SC-2 <Scenario name>

<Same form. Behavior-only scenarios use: Given / When / Then.>

## Misuse scenarios

| ID | Misuse | Expected outcome: compile error / startup error / call-time error with message / allowed | Message text |
|---|---|---|---|
| MS-1 | | | |

## Surface

| Element | Kind: call / extension / internal | Scenarios | Why published |
|---|---|---|---|

## Contracts

### `<element>`

- Signature: `<signature>`
- Behavior: <what it does, as observed by the consumer>
- Defaults: <each default and why it is safe>
- Errors: <each error, when it occurs, what the message says>
- Threading and async: <thread or loop, cancellation, timeout default>
- Ownership: <who releases what>
- May grow: <fields, values, or error types that may be added later>
- Scope label: <if the contract depends on a language or ecosystem>

## Extension contracts

### `<extension point>`

- Implementations that exist: <at least two, with links>
- Called when, how often, in what order: <…>
- Thread, loop, and re-entrancy: <…>
- When consumer code throws, blocks, or is slow: <…>
- May grow: <…>

## Constraints

| Constraint | Choke point | Default | Opt-out name and scope | Check |
|---|---|---|---|---|

## Compatibility

| Change from the previous version | Callers | Implementers | Source / binary / behavioral | Version bump |
|---|---|---|---|---|

## Enforcement

| Rule | Stage | Message | Valid fixture | Invalid fixture |
|---|---|---|---|---|

## Open questions

| ID | Question | Options | Decides |
|---|---|---|---|
