# Source register

One entry per source. Other files refer to sources only by ID. To change a citation, an edition or a status, edit the entry here; `maintenance.md` gives the procedure.

Fields:

- **ID**: stable identifier. A standard ID carries no edition year, so a new edition does not change the ID.
- **Citation**: full reference, with the current edition or version.
- **Status**: publication status on the check date, and earlier editions.
- **Access**: `free` (full text or definitions available without payment), `paywalled`, or `abstract only`.
- **Read level**: what was read to write the entry: `full text`, `definition` (the definition text of a term), `abstract`, `publisher page` (edition and status only), `secondary summary`, `recalled`, or `not read`.
- **Checked**: date of the last check.
- **Used by**: files and entries that cite the source.

Presence in this register does not make content checked. Rule 3 of `SKILL.md` uses the read level to decide the `recalled` marker.

## Standards (STD)

| ID | Citation | Status | Access | Read level | Checked | Used by |
|---|---|---|---|---|---|---|
| STD-24765 | ISO/IEC/IEEE 24765:2017, Systems and software engineering, Vocabulary. Maintained online as SEVOCAB (see GLO-SEVOCAB). | Current | paywalled; definitions free through GLO-SEVOCAB | publisher page | 2026-10-14 | GLO-SEVOCAB |
| STD-29119-1 | ISO/IEC/IEEE 29119-1:2022, Software testing, Part 1: General concepts | Current; replaces the 2013 edition | paywalled; terms clause visible in the ISO Online Browsing Platform | publisher page | 2026-10-14 | criteria: Test |
| STD-29119-2 | ISO/IEC/IEEE 29119-2, Software testing, Part 2: Test processes | Edition year not checked | paywalled | recalled | not checked | kept for traceability |
| STD-29119-3 | ISO/IEC/IEEE 29119-3, Software testing, Part 3: Test documentation | Edition year not checked | paywalled | recalled | not checked | kept for traceability |
| STD-29119-4 | ISO/IEC/IEEE 29119-4, Software testing, Part 4: Test techniques | Edition year not checked | paywalled | recalled | not checked | criteria: Test design technique; examples |
| STD-20246 | ISO/IEC 20246:2017, Software and systems engineering, Work product reviews | Current; confirmed in 2022 | paywalled | abstract | 2026-10-14 | criteria: Review |
| STD-1028 | IEEE 1028-2008, Standard for Software Reviews and Audits | Inactive-reserved since 2019-11-07; still the usual source for the five review types | paywalled | abstract | 2026-10-14 | criteria: Review |
| STD-1012 | IEEE 1012-2024, Standard for System, Software, and Hardware Verification and Validation | Active; published 2025-08-22. Earlier editions: 2016, 2012, 2004, 1998. | paywalled | abstract | 2026-10-14 | criteria: Verification, Validation, IV&V |
| STD-730 | IEEE 730-2026, Standard for Software Quality Assurance Processes | Active. Earlier edition: 2014. | paywalled | abstract | 2026-10-14 | criteria: Quality assurance |
| STD-9000 | ISO 9000:2026, Quality management, Fundamentals and vocabulary. Fifth edition, 2026-05. | Current. Replaces the fourth edition, ISO 9000:2015 ("Quality management systems, Fundamentals and vocabulary"), which was technically revised; the title changed. | paywalled; terms clause visible in the ISO Online Browsing Platform | definition (clauses 3 and 4.3, licensed copy; the copy is not part of this skill) | 2026-10-14 | criteria: Review, Verification, Validation, Quality assurance, Conformance |
| STD-25010 | ISO/IEC 25010:2023, Systems and software Quality Requirements and Evaluation (SQuaRE), Product quality model | Current; published 2023-11-15. Earlier edition: 2011. | paywalled | abstract | 2026-10-14 | criteria: Quality of a product |
| STD-12207 | ISO/IEC/IEEE 12207:2026, Systems and software engineering, Software life cycle processes. Edition 2. | Published 2026-04-29. Replaces the 2017 edition, now withdrawn. IEEE 730-2026 references the 2017 edition. | paywalled | publisher page | 2026-10-14 | kept for traceability; candidate for Rule 8 discussions |
| STD-WCAG-EM | Retired. W3C WCAG-EM is a Group Note, not a standard. See GDN-WCAG-EM. | Retired 2026-10-14: misclassified | not applicable | not applicable | 2026-10-14 | none |

## Guidance (GDN)

Informative documents. They describe methods or explain concepts, and they do not set normative requirements.

| ID | Citation | Status | Access | Read level | Checked | Used by |
|---|---|---|---|---|---|---|
| GDN-WCAG-EM | W3C, Website Accessibility Conformance Evaluation Methodology (WCAG-EM) 2.0. Group Note, 2026-07-23. | Current. Earlier version: WCAG-EM 1.0, Working Group Note, 2014-07-10. Informative: it does not change the normative WCAG requirements. | free | publisher page | 2026-10-14 | criteria: Conformance |
| GDN-NASA-IVV | NASA, IV&V Overview, nasa.gov/ivv-overview. Defines verification, validation and the three independence dimensions, which it attributes to IEEE. | Agency web page | free | full text (page text) | 2026-10-14 | criteria: IV&V |
| GDN-ISO-QA | ISO, "Quality assurance: A critical ingredient for organizational success", explanatory article, iso.org/quality-management/quality-assurance | Explanatory article, not a standard clause | free | full text (saved page) | 2026-10-14 | criteria: Quality assurance; STD-9000 |

## Glossaries (GLO)

| ID | Citation | Status | Access | Read level | Checked | Used by |
|---|---|---|---|---|---|---|
| GLO-ISTQB | ISTQB, Standard Glossary of Terms used in Software Testing, online at glossary.istqb.org | Maintained online; glossary application v4.5 announced by ISTQB | free | publisher page | 2026-10-14 | criteria: Test, Coverage, Static analysis; examples |
| GLO-SEVOCAB | IEEE Computer Society, SEVOCAB, Systems and software engineering vocabulary, online at computer.org/sevocab. Online database behind STD-24765. | Maintained online | free | publisher page | 2026-10-14 | criteria: Formal verification |

## Literature on engineering practice (LIT)

| ID | Citation | Status | Access | Read level | Checked | Used by |
|---|---|---|---|---|---|---|
| LIT-FEATHERS-2004 | Feathers, M. *Working Effectively with Legacy Code*. Prentice Hall, 2004. Source of the term "characterization test". Also: Feathers, M. "Characterization Testing", michaelfeathers.silvrback.com, 2016-08-08. | Book; article | book paywalled; article free | book recalled; article full text (saved page) | 2026-10-14 | criteria: Test; examples |
| LIT-FAGAN-1976 | Fagan, M. E. "Design and code inspections to reduce errors in program development". IBM Systems Journal 15(3), 1976. | Paper | paywalled | recalled | not checked | criteria: Review |
| LIT-DEMILLO-1978 | DeMillo, R. A., Lipton, R. J. and Sayward, F. G. "Hints on test data selection: Help for the practicing programmer". IEEE Computer, 1978. | Paper | paywalled | recalled | not checked | examples |
| LIT-CLAESSEN-2000 | Claessen, K. and Hughes, J. "QuickCheck: A lightweight tool for random testing of Haskell programs". ICFP 2000. | Paper | paywalled | recalled | not checked | examples |
| LIT-ROBINSON-2006 | Robinson, I. "Consumer-Driven Contracts: A Service Evolution Pattern". martinfowler.com, 2006. | Article | free | recalled | not checked | examples |

## Literature on model behaviour and AI-assisted development (LIT)

Findings in this group apply to the models and settings that were tested. `maintenance.md` gives the review rule for this group.

| ID | Citation | Models tested | Access | Read level | Checked | Used by |
|---|---|---|---|---|---|---|
| LIT-KABIR-2024 | Kabir, S., Udo-Imeh, D. N., Kou, B. and Zhang, T. "Is Stack Overflow Obsolete? An Empirical Study of the Characteristics of ChatGPT Answers to Stack Overflow Questions". CHI 2024. DOI 10.1145/3613904.3642596. arXiv 2308.02312. | ChatGPT, 2023 | free (arXiv) | abstract | 2026-10-14 | E-1 |
| LIT-SPRACKLEN-2025 | Spracklen, J. et al. "We Have a Package for You! A Comprehensive Analysis of Package Hallucinations by Code Generating LLMs". USENIX Security 2025. arXiv 2406.10279. | 16 code-generating models | free (arXiv) | abstract | 2026-10-14 | E-1 |
| LIT-KALAI-2025 | Kalai, A. T., Nachum, O., Vempala, S. S. and Zhang, E. "Why Language Models Hallucinate". arXiv 2509.04664, 2025. | Theoretical argument | free | abstract | 2026-10-14 | E-2 |
| LIT-SHARMA-2024 | Sharma, M. et al. "Towards Understanding Sycophancy in Language Models". ICLR 2024. arXiv 2310.13548. | Five AI assistants, 2023 | free | abstract | 2026-10-14 | E-3 |
| LIT-LABAN-2025 | Laban, P., Hayashi, H., Zhou, Y. and Neville, J. "LLMs Get Lost In Multi-Turn Conversation". arXiv 2505.06120, 2025. Venue not checked. | Top open- and closed-weight models, 2025, in simulated conversations | free | abstract | 2026-10-14 | E-4 |
| LIT-KONSTANTINOU-2024 | Konstantinou, M., Degiovanni, R. and Papadakis, M. "Can we find bugs using LLM-generated oracles?". arXiv 2410.21136, version 2, 2026-10-05. Version 1 (2024-10-28) was titled "Do LLMs generate test oracles that capture the actual or the expected program behaviour?". Venue not checked. | Several models, including a reasoning model | free | abstract (version 2) | 2026-10-14 | E-5 |
| LIT-YU-2026 | Yu, B. et al. "SWE-ABS: Adversarial Benchmark Strengthening Exposes Inflated Success Rates on Test-based Benchmark". ICML 2026. arXiv 2603.00520. | Top 30 agents on SWE-Bench Verified | free | abstract | 2026-10-14 | E-5 |
| LIT-WANG-2026 | Wang, Y., Pradel, M. and Liu, Z. "Are 'Solved Issues' in SWE-bench Really Solved Correctly? An Empirical Study". ICSE 2026. arXiv 2503.15223. | Agents on SWE-bench | free | abstract | 2026-10-14 | E-5 |
| LIT-PANICKSSERY-2024 | Panickssery, A. et al. "LLM Evaluators Recognize and Favor Their Own Generations". NeurIPS 2024. arXiv 2404.13076. | GPT-4, Llama 2 | free | abstract | 2026-10-14 | E-6 |
| LIT-PLACANI-2024 | Placani, A. "Anthropomorphism in AI: hype and fallacy". AI and Ethics 4(3), 691–698, 2024. | Not applicable (philosophical argument) | abstract only | abstract | 2026-10-14 | E-7 |
| LIT-INIE-2024 | Inie, N., Druga, S., Zukerman, P. and Bender, E. M. "From 'AI' to Probabilistic Automation: How Does Anthropomorphization of Technical Systems Descriptions Influence Trust?". FAccT 2024. DOI 10.1145/3630106.3659040. | Not applicable (survey of 954 people) | free (arXiv) | abstract | 2026-10-14 | E-7 |
| LIT-PERRY-2023 | Perry, N., Srivastava, M., Kumar, D. and Boneh, D. "Do Users Write More Insecure Code with AI Assistants?". CCS 2023. DOI 10.1145/3576915.3623157. | codex-davinci-002 | free (arXiv) | abstract | 2026-10-14 | E-8 |
| LIT-PRATHER-2024 | Prather, J. et al. "The Widening Gap: The Benefits and Harms of Generative AI for Novice Programmers". ICER 2024. arXiv 2405.17739. | Generative AI tools, 2024 | free | abstract | 2026-10-14 | E-8 |
| LIT-METR-2025 | METR. "Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity". Blog post 2025-07-10 and paper. | Early-2025 tools, mainly Cursor | free | primary blog post | 2026-10-14 | E-8 |
| LIT-METR-2026 | METR. "We are Changing our Developer Productivity Experiment Design". Blog post 2026-02-24. | Late-2025 tools | free | primary blog post | 2026-10-14 | E-8 |
| LIT-FMTI-2025 | Wan, A., Klyman, K., Kapoor, S., Maslej, N., Longpre, S., Xiong, B., Liang, P. and Bommasani, R. "The 2025 Foundation Model Transparency Index". arXiv 2512.10169. | Developers of foundation models, 2025 | free | abstract | 2026-10-14 | E-9 |

## Practices (PRA)

| ID | Citation | Status | Access | Read level | Checked | Used by |
|---|---|---|---|---|---|---|
| PRA-OWASP-ASVS | OWASP Application Security Verification Standard. Current version not checked. | Community standard | free | recalled | not checked | criteria: Conformance |
| PRA-PACT | Pact, consumer-driven contract testing tool | Open-source tool | free | recalled | not checked | examples |
| PRA-TYPE-TESTS | Type-level testing in TypeScript: `@ts-expect-error`, tsd, expect-type | Language feature and open-source tools | free | recalled | not checked | examples |
| PRA-OPENAPI-TOOLS | OpenAPI schema validation and diff tools | Open-source tools | free | recalled | not checked | examples |

## Regulatory actions (REG)

| ID | Citation | Status | Access | Read level | Checked | Used by |
|---|---|---|---|---|---|---|
| REG-SEC-2024 | US Securities and Exchange Commission, settled charges against Delphia (USA) Inc. and Global Predictions Inc. for false claims about their use of AI, announced 2024-03-18 | Settled | free | secondary summary (law-firm publication) | 2026-10-14 | E-7 |
