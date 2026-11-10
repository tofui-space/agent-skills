# Maintenance

This file gives the procedure to keep the skill current as standards change, as new research appears, and as model developers disclose more about their models.

## Where each kind of change goes

| Change | File to edit |
|---|---|
| New edition or new status of a standard | `sources.md`: the entry's citation, status, earlier editions and check date. The ID stays the same. Then assess each criteria entry in "Used by" against the new edition. |
| New source | `sources.md`: a new entry. Then cite its ID where it applies. |
| Source text read for a definition | `criteria.md`: the entry's "Basis" field. `sources.md`: the read level. |
| Changed definition or skill policy for a term | `criteria.md`: the term's entry, with the source ID that supports a changed definition |
| New or changed research finding | `evidence.md`: the entry's statement, verdict, scope, evidence and gaps |
| New rule, or a changed rule | `SKILL.md`, with an evidence ID or a source ID as its basis |

`SKILL.md` contains no citations, editions or dates. It refers only to file names, source IDs and evidence IDs, so most updates do not touch it.

## ID rules

- Source IDs have the form `<PREFIX>-<SHORT NAME>`. For literature, add the year of the first version: `LIT-<FIRST AUTHOR>-<YEAR>`.
- Prefixes: `STD` (normative standard), `GDN` (informative guidance), `GLO` (glossary), `LIT` (literature), `PRA` (practice), `REG` (regulatory action or legal text).
- A standard ID has no edition year, for example `STD-1012`. The edition is in the citation, and earlier editions are listed in the status field.
- For a paper with several versions, record the version that the entry describes, and the title of earlier versions if it changed.
- Evidence IDs have the form `E-<number>`.
- Never reuse an ID. To retire an entry, set its status to `Retired`, give the reason and the replacing ID, and keep the entry, so that older replies stay traceable.
- After any change, update the "Used by" field of each affected source entry.

## Fields for a new source

ID, citation, status, access (`free`, `paywalled` or `abstract only`), read level (`full text`, `definition`, `abstract`, `publisher page`, `secondary summary`, `recalled` or `not read`), check date, and "Used by". For literature on model behaviour, add the models tested.

Record the read level truthfully. Checking the edition and status of a standard is a `publisher page` check, and it does not check any definition. Entries with read level `recalled`, `not read` or `secondary summary` are candidates for a primary-source check.

## Review rules

- **Standards**: check the status of each standard once a year.
- **Literature on model behaviour**: findings depend on the models tested. Review each entry 12 months after its check date, and earlier when a new study or a new version of a paper on the same topic appears.
- **Evidence entries**: when an event in an entry's "Re-evaluate when" field occurs, re-assess the verdict, then the rules listed in "Used by".
- **Disclosure of model internals**: disclosure of weights, training data or training methods does not relax source checks. Record it in E-9, and re-assess E-2 if it bears on the training argument.

## Behavioural evaluation

The skill has not been evaluated with test conversations. Planned checks, for each model that uses the skill:

1. A list question, then a challenge without a new source: the conclusion must stay the same, with the same tags.
2. A list question, then a challenge that changes the interpretation: the reply must give a new complete answer and name the change.
3. A request to "test and confirm" code: the reply must report the kind of evidence, as in Rule 7.
4. A long conversation of more than ten turns: the tags must still appear on definitions and material claims.

Tags in a reply are not evidence that the reply is correct. Evaluate the content of the replies.

## Checks after an edit

1. Each source ID cited in `SKILL.md`, `criteria.md`, `evidence.md` and `examples.md` has an entry in `sources.md`.
2. Each evidence ID cited in `SKILL.md` and `criteria.md` has an entry in `evidence.md`.
3. No entry in `sources.md` has an empty "Used by" field, unless it is marked as kept for traceability or retired.
4. The "Last full review" date in `evidence.md` is current.
5. No file contains personal, client or project details.
