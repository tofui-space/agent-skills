# Migrating format 1 and 2 tasks files

Read this when a tasks file has no `Format:` line. Apply the steps in order, starting at the file's format, then go back to the SKILL.md "Format version" section for the step from format 3 to 4.

A file with no `Format:` line is format 1 if it has no `IDs:` line, and format 2 if it has one.

1. **Format 1 to 2, item IDs.** Ask the person for the prefix as the SKILL.md "Item IDs" section describes, and wait for the answer. Then number the existing items 1, 2, 3, … in file order, notes included, and add the `IDs:` line with `next` one above the last.
2. **Format 2 to 3, labels.** If the `IDs:` line has no `next`, such as `IDs: CA`, add it: `IDs: CA · next CA-<n>`, with `<n>` one above the highest item number in the file. An item whose text starts with `#` right after its ID would now be read as a label: backtick that word. Then add `Format: 3` under the description line.
