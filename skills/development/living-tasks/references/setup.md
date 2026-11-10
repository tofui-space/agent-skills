# Setup: palette, fonts, and the rebuild hook

Read at first setup in a project, when the generator reports a contrast failure, and when the person asks for the rebuild hook.

## Palette and fonts come from the project

Look for the project's design tokens, in this order: CSS custom properties in the global stylesheet, the Tailwind theme, a design-token JSON file, then the app's main layout. If none are found, keep the script's defaults and tell the person.

Map the project's tokens to the page tokens:

| Token | Use |
|---|---|
| `ground` | Page background |
| `ink`, `text2`, `text3` | Body text, secondary text, muted text |
| `rule` | Dividers and borders |
| `accent` | Eyebrow, "Details" toggles, focus ring, the `decided` field name |
| `done`, `doing`, `wait`, `open`, `note` | Status chips: done green, in progress blue, waiting red, open neutral, note muted purple |
| `press`, `onPress` | Background and text of the selected filter button |

Give both `light` and `dark` values. If the project has no dark theme, derive one from its light palette and tell the person the dark values were derived.

Keep the semantic hues for the status colors even when the project's palette has none: map the project's own green, blue, and red where it has them.

The script refuses to write the page if any text color falls below 4.5:1 contrast on its background (WCAG 2.2 AA), and names each failing pair. Adjust the failing token and rebuild.

Fonts: set `fonts.body` and `fonts.display` to the project's families. `google` is the family string for the Google Fonts CSS API, such as `Source+Sans+3:wght@400;600`; omit it for fonts the reader's system already has. Without `fonts`, the page uses the system font stack.

## Optional: rebuild hook (Claude Code only)

Set this up only when the person asks for it. Other agents, such as Codex or Gemini CLI, run the rebuild step by hand; that step is the default everywhere.

The hook rebuilds the page after every Edit or Write to the tasks file, and ignores edits to other files. It saves the rebuild call, about 100 tokens and one round trip per update; publishing still needs the agent. It is worth it in long sessions with many record-only changes, such as "mark X done".

1. Copy the `hooks` block from `assets/hooks/settings.example.json` into `.claude/settings.local.json` in the project. That file is local; if git does not ignore it, add it to `.git/info/exclude`. Do not use `.claude/settings.json`: it is committed.
2. Replace `<skill-dir>` with this skill's absolute path, and the config placeholder with the config's absolute path. Add `--standalone` after the config path if the page needs it.
3. Make one edit to the tasks file and check that the hook reports "Task page rebuilt".

After a successful rebuild, the hook adds one line for the agent with the page path. If the build fails, it exits with code 2, so the generator's error reaches the agent; fix the tasks file and the next edit rebuilds the page. To remove the hook, delete its block from the settings file.
