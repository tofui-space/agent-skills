# Page behavior and config

## What the page does

Check every line after changing the script, the config, or the palette.

- **Summary first:** counts per status under the title, "waiting on you" emphasized in the waiting color. The summary counts the whole file, whichever label is chosen.
- **Sticky filter bar:** To do (open, in progress, and waiting), Waiting on you, Done, All, and "All details" when any item has detail fields. Notes show only under All.
- **Labels:** each item shows its labels as `#name` after its ID. A "Label" select, labelled above, sits under the summary when any item has a label: "All labels", each declared label that some item carries, and "No label" when some item has none. The filter bar's counts cover the chosen label, and reserve the width of the largest possible count so no button changes width. Without labels the select is absent.
- **Empty result:** when the filter and label show nothing, the page says "Nothing matches this filter."
- **Remembered filter and label:** both choices are saved per viewer in `localStorage`, inside `try`/`catch`. Without storage the page still works and starts on All and All labels. A saved label that is no longer offered falls back to All labels.
- **Theme toggle:** a 44 px icon button in the header. In light mode it shows a moon and is named "Switch to dark theme"; in dark mode, a sun and "Switch to light theme". The name, set as `aria-label` and `title`, always says what a press does. The page follows the system theme until the viewer presses it; the choice is saved per viewer in `localStorage`, inside `try`/`catch`.
- **Item links:** each item shows its ID before its text, as a link to itself, and the item's `id` attribute is that ID. Opening a link to an item scrolls it to just below the sticky bar, outlines it in the accent color, and switches the filter to All and the label to All labels when either hides it.
- **Status chips in words:** "Done", "In progress", "Open", "Waiting on you", "Note". A status never depends on color alone.
- **Code set as code:** backticked text, commit hashes (7 to 40 hex characters with at least one digit and one letter a-f), and file paths with a known extension. Anything else that is code, such as a folder path, a command, or an all-digit hash, is backticked in the tasks file.
- **Written for the reader:** the heading "Waiting on <person>" becomes "Waiting on you".
- **Details legend:** a line under the bar explains each standard detail field used.
- **Footer:** the source path and when the file was last changed.
- **Phone first:** 16 px body text, every button and toggle at least 44 px tall, no sideways scrolling at 360 px. Chips sit above the text on phones and in a side column from 600 px.

## Config keys

| Key | Default | Meaning |
|---|---|---|
| `source` | required | Tasks file path, relative to the config file. |
| `out` | `tasks.html` | Output path, relative to the config file. |
| `sourceLabel` | `source` | Path shown in the footer. |
| `title` | the file's `#` heading | Page title. |
| `eyebrow` | none | Small line above the title, such as the product's tagline. |
| `person` | none | The person's name as written in "Waiting on <name>". |
| `rename` | none | Extra heading renames, `{ "Old": "New" }`. |
| `timeZone` | the machine's | IANA zone for the footer time. |
| `locale` | `en-GB` | Date format for the footer. |
| `lang` | `en` | Page language, used with `--standalone`. |
| `fonts` | system fonts | `{ body: { family, google }, display: { family, google } }`. |
| `palette` | neutral palette | `{ light: {…}, dark: {…} }`; any token left out keeps its default. |
