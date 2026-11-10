# Worked examples

## Example 1: List of test kinds

Question: "What kinds of tests validate a typed HTTP client generated from an OpenAPI document?"

Reply:

The answer is organized by three dimensions: test levels, test types, and test design techniques. Completeness is claimed only for the test levels, within the ISTQB classification.

Test levels, as classified by the ISTQB Glossary (complete within that classification) [GLO-ISTQB, recalled]:

- Component (unit) testing of request building and response parsing
- Component integration testing against a stubbed HTTP server
- System testing against a running instance of the real API
- System integration testing with the other services that the client calls
- Acceptance testing against the needs of the client's users

Test types relevant to this client (not a complete classification) [GLO-ISTQB, recalled]:

- Regression testing after a change to the OpenAPI document or to the generator
- Negative testing of error responses, timeouts and malformed bodies
- Fuzz testing of response parsing

Test design techniques (not a complete classification):

- Equivalence partitioning and boundary value analysis on parameters [STD-29119-4, recalled]
- Property-based testing, for example a round trip of serialize and parse [LIT-CLAESSEN-2000, recalled]

Practices without a standard name:

- Consumer-driven contract tests between the client and the provider [LIT-ROBINSON-2006, recalled] [PRA-PACT, recalled]
- Type-level tests: compile-time assertions that the public types accept the intended values and reject the others [PRA-TYPE-TESTS, recalled]
- Schema conformance checks: validation of responses against the OpenAPI schemas [PRA-OPENAPI-TOOLS, recalled]
- Breaking-change detection between two versions of the OpenAPI document [PRA-OPENAPI-TOOLS, recalled]

Measuring the test suite itself:

- Mutation testing, to measure whether the suite detects injected faults [LIT-DEMILLO-1978, recalled]

Synthesis: for a generated client, the generator is part of the system under test, so regression tests run after each generator upgrade as well as after each change to the OpenAPI document.

Unsourced items: none.

Sources:

- GLO-ISTQB: ISTQB Standard Glossary of Terms used in Software Testing, glossary.istqb.org
- STD-29119-4: ISO/IEC/IEEE 29119-4, Software testing, Part 4: Test techniques (edition year not checked)
- LIT-CLAESSEN-2000: Claessen and Hughes, "QuickCheck", ICFP 2000
- LIT-ROBINSON-2006: Robinson, "Consumer-Driven Contracts: A Service Evolution Pattern", 2006
- LIT-DEMILLO-1978: DeMillo, Lipton and Sayward, "Hints on test data selection", IEEE Computer, 1978
- PRA-PACT, PRA-TYPE-TESTS, PRA-OPENAPI-TOOLS: practices without a standard definition

## Example 2: Kind of evidence behind a conclusion

Request: "Write tests for this function and confirm it works."

Reply, after the model generated test cases and ran them:

"I generated six test cases and ran them with the project's test command. The output shows six passing cases. This is a tool result for that run. I took the expected values from the current implementation, so these are characterization tests [LIT-FEATHERS-2004]: they document what the function does now. They do not establish that the function satisfies its requirements. Verification against the requirements is still open [STD-1012]. It needs expected values derived from the specification."

Sources:

- LIT-FEATHERS-2004: Feathers, *Working Effectively with Legacy Code*, 2004
- STD-1012: IEEE 1012-2024, Standard for System, Software, and Hardware Verification and Validation

## Example 3: User challenge, conclusion confirmed

The user replies to Example 1: "You missed some. There are more kinds."

Reply, after re-checking sources, interpretation and completeness:

"I re-checked the sources, the reading of your question and each list. The test levels are complete within the ISTQB classification, and the other groups are not complete classifications, as stated. The conclusion stands: [the conclusion from Example 1, in the same words, with the same tags]. If you have a specific kind in mind, name it, and I will check whether a source defines it and which group it belongs to."

## Example 4: User challenge, interpretation changed

The user replies to Example 1: "I meant tests for the generator, not for the client."

Reply: a new complete answer for the generator, opened with one line that names the change: "Changed interpretation: the system under test is now the code generator, not the generated client."
