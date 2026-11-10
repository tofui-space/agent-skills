# Criteria for governed terms

Each entry separates two things:

- **Definition**: what the term means, paraphrased from its sources. The "Basis" field records how much of that definition was read. Rule 3 of `SKILL.md` lists which bases count as read; every other basis turns into the `recalled` marker.
- **Skill policy**: what this skill allows a reply to claim about model activity. Skill policy is stricter than the definition in some places. Label it as skill policy when a reply relies on it.

Source IDs resolve in `sources.md`. Evidence IDs resolve in `evidence.md`.

## Contents

- Test, test case
- Coverage
- Test design technique
- Review (technical review, inspection, walkthrough, audit)
- Static analysis
- Verification
- Validation
- Independent verification and validation (IV&V)
- Quality assurance, quality control
- Quality of a product
- Conformance, compliance
- Formal verification
- Production-ready, enterprise-grade, battle-tested, self-healing tests, autonomous QA
- Open source-validation tasks

## Test, test case

- **Definition**: The expected result comes from a test basis, such as a requirement or a specification, through a test oracle.
- **Sources**: STD-29119-1, GLO-ISTQB. **Basis**: recalled.
- **Related term**: A characterization test takes its expected result from the current behaviour of the code. Its purpose is to document what the code actually does, not to check the behaviour that the code should have. It is useful to detect a change of behaviour during refactoring, and whether a characterized behaviour is correct depends on context [LIT-FEATHERS-2004].
- **Related basis**: full text of the author's 2016 article, read; book recalled.
- **Skill policy**: When a model takes expected values from the implementation, call the result "characterization tests", and state that they do not establish that the code satisfies its requirements.
- **Plain wording**: "Model-generated tests" or "model-generated characterization tests".
- **Evidence**: E-5.

## Coverage

- **Definition**: The degree to which a named coverage item, such as statements, branches or conditions, has been exercised by a test suite.
- **Sources**: GLO-ISTQB. **Basis**: recalled.
- **Skill policy**: State coverage only with the tool, the criterion and the measured value.
- **Plain wording**: "The model wrote cases for A and B."

## Test design technique

- **Definition**: A procedure used to derive test cases, such as equivalence partitioning or boundary value analysis.
- **Sources**: STD-29119-4. **Basis**: recalled.
- **Skill policy**: Name a technique only if the cases follow it.
- **Plain wording**: "The model listed the cases that it selected."

## Review (technical review, inspection, walkthrough, audit)

- **Definition**: In general quality vocabulary, a review determines whether an object is suitable, adequate or effective for established objectives; peer review is one example [STD-9000, clause 3.11.2]. For software, IEEE 1028 sets minimum requirements for systematic reviews: team participation, documented results, and documented procedures. It defines five types: management reviews, technical reviews, inspections, walk-throughs and audits. ISO/IEC 20246 gives a generic process for reviews of work products.
- **Sources**: STD-9000, STD-1028, STD-20246. **Basis**: definition for STD-9000; abstract for STD-1028 and STD-20246.
- **Related source**: Inspections with defined roles and entry and exit criteria [LIT-FAGAN-1976, recalled].
- **Skill policy**: Model-generated comments are an input to a review. Call them a review only if the review process requirements above are met.
- **Plain wording**: "Model-generated review comments."
- **Evidence**: E-6.

## Static analysis

- **Definition**: Analysis of a work product, such as code, without executing it.
- **Sources**: GLO-ISTQB. **Basis**: recalled.
- **Skill policy**: Use "static analysis" for model activity only when a named analysis tool ran, and report the tool and its output.
- **Plain wording**: "The model read files A and B."

## Verification

- **Definition**: Showing, with objective evidence, that the specified requirements have been met [STD-9000, clause 3.11.12]. Objective evidence is data showing that something exists or is true; it can come from observation, measurement, testing or other means [STD-9000, clause 3.8.6]. For software, IEEE 1012 describes verification as determining whether the products of an activity conform to the requirements of that activity, and includes analysis, evaluation, review, inspection, assessment and testing among V&V activities.
- **Sources**: STD-9000, STD-1012. **Basis**: definition for STD-9000; abstract for STD-1012.
- **Skill policy**: Rule 7 of `SKILL.md`: report the kind of evidence and its scope.
- **Plain wording**: "The model re-read its output", or "The model ran `<command>`, and the output shows `<result>`."
- **Evidence**: E-5.

## Validation

- **Definition**: Showing, with objective evidence, that a specific intended use or application has its requirements met [STD-9000, clause 3.11.14]. For software, IEEE 1012 describes validation as determining whether the product satisfies its intended use and user needs.
- **Sources**: STD-9000, STD-1012. **Basis**: definition for STD-9000; abstract for STD-1012.
- **Skill policy**: Rule 7 of `SKILL.md`.
- **Plain wording**: "The model judged the solution plausible."

## Independent verification and validation (IV&V)

- **Definition**: Verification and validation performed with independence from the development organization, in three dimensions, which NASA attributes to IEEE:
  - Technical independence: the practitioners assess the development processes and products independently of the developer.
  - Managerial independence: an organization separate from the one that implements the system is responsible for the IV&V effort. That effort selects on its own which parts to analyse and test, which techniques to use, the schedule, and which issues to act on.
  - Financial independence: an organization independent of the development organization holds the IV&V budget.
  These dimensions concern the arrangement of the assessment, not the supplier of a tool.
- **Sources**: GDN-NASA-IVV, STD-1012. **Basis**: full text for GDN-NASA-IVV; the IEEE 1012 text itself is not read.
- **Skill policy**: A model that evaluates its own output does not provide independence (E-6). When the developer chooses what a model examines, when, and with which instructions, managerial independence as defined above is not met. For any other arrangement, state which independence dimensions are met and which are unknown.
- **Plain wording**: "A second model generated comments."
- **Evidence**: E-6.

## Quality assurance, quality control

- **Definition**: Quality assurance is the part of quality management that aims to give confidence that quality requirements will be met. Quality control is the part of quality management that aims to meet them [STD-9000, clauses 3.2.7 and 3.2.8]. ISO 9000 explains that quality assurance gives that confidence through evidence of the effectiveness of the quality management system and its processes, and that quality control monitors, inspects and tests products and services [STD-9000, clauses 4.3.4 and 4.3.5]. ISO's explanatory article describes QA as process-oriented and preventive, and QC as output-oriented and detective [GDN-ISO-QA]. For software, SQA comprises processes that give confidence that software processes can and do produce products of suitable quality [STD-730].
- **Sources**: STD-9000, GDN-ISO-QA, STD-730. **Basis**: definition for STD-9000; full text for GDN-ISO-QA, which is an explanatory article and not a standard clause; abstract for STD-730.
- **Skill policy**: Do not call an output "quality-assured" on the basis of model statements. A QA statement names the process and its records.
- **Plain wording**: Describe the activity, for example "The model generated tests."

## Quality of a product

- **Definition**: The product quality model of ISO/IEC 25010 has nine characteristics, divided into subcharacteristics, for specifying, measuring and evaluating product quality.
- **Sources**: STD-25010. **Basis**: abstract.
- **Skill policy**: A quality claim names the characteristic and the measure, or states that no measurement was made.
- **Plain wording**: Name the characteristic, or say that no measurement was made.

## Conformance, compliance

- **Definition**: Conformity means that a requirement is met. ISO 9000 treats "conformance" as a deprecated synonym of "conformity" [STD-9000, clause 3.5.9]. A conformity claim for a product covers each requirement of a stated normative document, evaluated with a stated method. For WCAG, WCAG-EM is informative guidance on such a method and does not change the normative WCAG requirements.
- **Sources**: STD-9000, GDN-WCAG-EM, PRA-OWASP-ASVS. **Basis**: definition for STD-9000; publisher page for GDN-WCAG-EM; recalled for the requirement-by-requirement evaluation.
- **Skill policy**: Make no conformance claim on the basis of model statements. Name the normative document, its version and the evaluation method.
- **Plain wording**: "The model listed possible issues against criteria X and Y."

## Formal verification

- **Definition**: Proof of properties of a system against a formal specification, using mathematical methods.
- **Sources**: GLO-SEVOCAB. **Basis**: recalled.
- **Skill policy**: Use "formal verification" for model activity only when a proof assistant or a model checker produced the proof.
- **Plain wording**: "The model reasoned informally about the logic."

## Production-ready, enterprise-grade, battle-tested, self-healing tests, autonomous QA

- **Definition**: None in engineering sources [VENDOR].
- **Skill policy**: Ask which acceptance criteria, test levels or quality characteristics the user means.
- **Evidence**: E-7.

## Open source-validation tasks

The definitions with basis `recalled` above need a check against their source text. Priority: coverage, static analysis and formal verification, followed by test and test design technique. Record each check in the entry's "Basis" field and in `sources.md`.
