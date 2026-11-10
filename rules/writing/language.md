---
paths:
  - "**/*"
---

# Writing language

This rule sets the language, and the variety of that language, for everything written: chat prose, documentation, comments, commit messages, error messages, user-interface text, and new identifiers.

Write in English, in the international variety: the English of scientific and engineering publications, of programming languages, and of their standard libraries.
Do not write British English.

The reader is assumed to use English as a working language, not necessarily as a first one.
They have met the international forms in papers, API names, and reference documentation, and a second spelling of the same word is a second thing to recognize and a second string to search for.

## Spelling

For spelling, International English coincides with American English.
Where the British and the international spelling of a word differ, write the international one.

| Pattern                    | Write                                            | Not                                                  |
|----------------------------|--------------------------------------------------|------------------------------------------------------|
| `-or`                      | color, flavor, honor, neighbor                   | colour, flavour, honour, neighbour                   |
| `-ize`, `-yze`             | initialize, organize, serialize, analyze         | initialise, organise, serialise, analyse             |
| `-er`                      | center, fiber, caliber                           | centre, fibre, calibre                               |
| `-og`                      | catalog, dialog, analog                          | catalogue, dialogue, analogue                        |
| `-ense`                    | license (noun and verb), defense, offense        | licence, defence, offence                            |
| `-ice` as a verb           | practice (noun and verb)                         | practise                                             |
| single `l` before a suffix | modeling, labeled, canceled, traveling           | modelling, labelled, cancelled, travelling           |
| `e` for `ae` and `oe`      | encyclopedia, anesthesia, maneuver               | encyclopaedia, anaesthesia, manoeuvre                |
| `-ed` past forms           | learned, spelled, burned                         | learnt, spelt, burnt                                 |
| single words               | program, gray, artifact, aging, skeptical, check | programme, grey, artefact, ageing, sceptical, cheque |

The table lists patterns, not every word.
For a word it does not cover, use the spelling that the keywords and standard library of a mainstream programming language use for it; when that gives no answer, use the first-listed spelling in an American English dictionary.

Derived forms follow the base word: `organize` gives `organization`, `organizational`, and `reorganize`.

## Words and grammar

* Prefer the word understood in every region over a regional one: "while" and "among", not "whilst" and "amongst"; "two weeks", not "a fortnight".
* Do not use idioms, sports metaphors, or cultural references that belong to one country, British or American.
  State the meaning literally: "a rough estimate", not "a ballpark figure"; "an obstacle", not "a spanner in the works".
* A collective noun takes a singular verb: "the team is", "the committee has", not "the team are".
* Do not describe a thing with a clause whose subject or agent is "nothing", "nobody", "no one", or "none".
  Negate the verb, or use the established term for the condition.

  | Write                                                | Not                                                         |
  |------------------------------------------------------|-------------------------------------------------------------|
  | a function that is never called; an unused function  | a function that nothing calls; a function called by nothing |
  | an undefined term                                    | a term that nothing defines                                 |
  | a log that is not read; an unread log                | a log that nobody reads                                     |
  | a variable with no references                        | a variable that nothing references                          |

  The same holds for a passive with a negative agent anywhere in a sentence: "is never called", not "is called by nothing".
  A plain statement that an owner or actor is missing is not this pattern: "Nobody owns this service" stays.

## Keep the established form

The international spelling applies to text you author.
It does not apply to a form that someone else already fixed:

* Quoted text, titles of works, and proper names keep their original spelling, including an organization that spells its own name with "Centre" or "Programme".
* Existing identifiers, API names, configuration keys, file names, and URLs are written exactly as they are defined.
  A field that an external API names `colour` is `colour` in the code and in the prose that refers to it.
* A term fixed by a standards body or a formal nomenclature keeps the standardized form, even where it looks British: the element names "aluminium" and "caesium" are the IUPAC spellings.
* Content written for a named regional audience keeps that region's variety: a British English locale file stays British.

## Existing text

* New text follows this rule, including in a file that is otherwise in British English.
* Do not convert lines you were not asked to change; a spelling sweep buries the requested change in the diff.
  Say once that the file mixes varieties, and leave the conversion to the user.
* Do not rename an existing identifier to correct its spelling.
  A rename is a behavior change for every caller, not a spelling fix.

## Precedence

* An explicit user instruction to write in another language, or in another variety of English, wins for the text it covers.
* A request to translate, or to write content for a named locale, is such an instruction.
