# UI frameworks and component libraries

Framework design applied to user interfaces: component libraries, design systems, UI frameworks, and the UI side of metaframeworks, across React, Angular, Vue, Svelte, Solid, Astro, React Native, web components, and plain HTML. Ecosystem-specific guidance carries its scope label (`cheat-sheet.md`).

## Contents

- What a UI framework's surface is
- Problems and defaults
- Accessibility: what framework design can and cannot do
- Checks for UI frameworks
- Weights for UI work

## What a UI framework's surface is

Beyond the usual surface (`SKILL.md`, Terms), a UI library publishes:

- **The component API**: properties or inputs, events or outputs, children, slots, or projected content.
- **The rendered structure**: element types, roles, ARIA attributes, and class names. Consumers style it with selectors and query it in tests, so it becomes surface whether or not it is documented [Hyrum].
- **Design tokens**: the names of colors, spacing, and typography values used for theming. Renaming a token breaks every theme that sets it.
- **Interaction behavior**: keyboard handling, focus movement, announcements to assistive technology. Users and their assistive technology depend on it.
- **Rendering cost**: what each component adds to the client bundle and to hydration.

## Problems and defaults

### U1 Component configuration keeps growing

**Signals**: a component with dozens of properties; boolean properties that switch whole regions on and off; requests for one more property per layout variation.

**Default**: composition over configuration. Let consumers pass content and subcomponents: `children` `{React}`, slots `{Vue}` `{Svelte}` `{web}`, content projection `{Angular}`. Split a large component into compound parts that share state (a list with its own item and header components) rather than adding properties for each part.

**Alternatives**: a configuration-driven component wins where the configuration is data that comes from elsewhere (a table described by column definitions loaded from a schema). Keep the configuration to the data contract (descriptors, manifests); do not promise generic rendering from it when variants need tailored layouts [Practice-2026-11-9].

**Principles**: P3, P5, P8. Problem-map A2, C1.

### U2 Who owns the state

**Signals**: consumers cannot reset or synchronize a component's value; or every consumer must wire state for the simplest case.

**Default**: support both controlled use (the consumer owns the value and receives change events) and uncontrolled use (the component owns it, with an initial value), with one naming pattern across the library, following the platform's form idiom (for example two-way binding `{Vue}`, `ControlValueAccessor` for forms `{Angular}`).

**Principles**: P2, P12.

### U3 Styling and theming

**Signals**: consumers override styles with selectors into the component's internal structure; theme changes require forking components.

**Default**: publish design tokens as the theming surface, in a standard interchange format where one fits (the Design Tokens Community Group's format module, a community group report rather than a W3C Recommendation [DTCG]), and a deliberate styling surface for structure: class or style pass-through on the root, named parts where the platform supports them (`::part` in shadow DOM `{web}`). Document which internal structure is not surface, and expect consumers to depend on it anyway: changing it is a behavioral break for many of them.

**Principles**: P4, P15. Problem-map E3.

### U4 Behavior and presentation in one package

**Signals**: teams fork a component library to change its look, and lose its keyboard and focus behavior in the process.

**Default**: separate behavior and accessibility (a layer of hooks or unstyled primitives, often called headless) from presentation (the styled components built on it), so that a design system can restyle without reimplementing interaction. React Aria and Radix Primitives are established libraries that provide accessible behavior and leave the styling to the consumer `{React}`.

**Principles**: P7, P2 (the low layer stays reachable).

### U5 Rendering mode and client cost

**Default**: decide per component whether it needs client-side code at all. Islands render interactive parts on the client inside server-rendered pages [Islands], and Astro ships no client JavaScript unless a component asks for it `{Astro}`; server components keep non-interactive parts off the client bundle `{React-based}` [RSC]. Measure each component's bundle contribution; mark the package as side-effect-free where true, so bundlers can drop unused components. See `stacks.md`.

### U6 One library for web and native

**Default**: share logic, state, and tokens across platforms; let presentation follow each platform's conventions, because users expect the controls and gestures of their platform. React Native renders native components rather than HTML `{React Native}`, so markup-level guidance does not transfer directly; its accessibility properties map to each platform's accessibility API.

### U7 Forms

**Default**: validation at the boundary into typed values (problem-map C2); error messages associated with their fields programmatically, not only by position or color; custom form controls that participate in native form submission and validation (form-associated custom elements `{web}`).

### U8 Text and locale

**Default**: the locale is an explicit input; strings are never concatenated from fragments, so translators can reorder them; plural and gender forms use a message format that supports them (for example ICU MessageFormat); layouts support right-to-left text.

### U9 Control semantics and interaction behavior

A component library owns interaction behavior, so its scenarios cover it explicitly [Practice-2026-11-9]:

- **Control semantics match the state model.** A control with exactly one value selected at all times is a radio group (segmented); a control that can be off is a checkbox or toggle; the two never share a look. One component serves every instance of a concept, everywhere it appears.
- **State has a second channel besides color** (a pattern, glyph, or word), as WCAG 1.4.1 Use of Color requires [WCAG22].
- **Custom gesture controls expose their semantics**: an adjustable role, range and value, increment and decrement actions, and a disabled state assistive technology can read.
- **Pointer scenarios**: gestures abandoned midway, activation on release rather than press (2.5.2 Pointer Cancellation), an alternative to every drag (2.5.7 Dragging Movements), target size (2.5.8 Target Size (Minimum)), conflicts with platform gestures [WCAG22].
- **Timing scenarios**: rapid repeats, races with optimistic updates, focus after a cancel or a failure, undo, and state that must persist.
- **State-dependent views** get a transition table, and tests that run whole workflows, not single actions.

### U10 Evolving a component library

**Default**: treat properties, events, slots, tokens, and documented structure as published surface (`compatibility.md`); deprecate properties with a development-mode warning naming the replacement; encourage consumers to query components in tests by role and accessible name rather than by structure, which keeps their tests independent of internal markup. Testing Library puts role queries first: "The more your tests resemble the way your software is used, the more confidence they can give you" [Testing-Library].

## Accessibility: what framework design can and cannot do

**What it can do: make accessible behavior the default.** Accessibility is a business constraint, and `constraints-by-default.md` applies:

- **Native elements first.** Use a native element with the needed semantics and behavior instead of adding roles to a generic one; this is the first rule of ARIA use [Using-ARIA].
- **Accessible names required by type.** A component that renders an icon-only button cannot be constructed without a label.
- **Keyboard interaction built in**, following the patterns of the WAI-ARIA Authoring Practices Guide [APG] for each widget.
- **Focus management built in**: trapping and restoring focus for dialogs, moving focus after client-side navigation, announcing changes through live regions (for example the Angular CDK's accessibility utilities `{Angular}`).
- **Contrast and motion in the tokens**: check color pairs against contrast requirements when the tokens are built; respect reduced-motion preferences by default.
- **Checks shipped with the library**: lint rules (for example eslint-plugin-jsx-a11y `{React}`), automated checks in component tests and stories (axe-core, and the Storybook accessibility addon built on it), and test helpers that query by role.

**What it cannot do: guarantee conformance.** "Tools cannot check all accessibility aspects automatically. Human judgement is required" [WAI-Tools]; a tool vendor's own study found its automated tests fully covering 57 percent of issues by volume [Deque-57]. A conformance claim against WCAG 2.2 [WCAG22] therefore needs manual evaluation, including testing with assistive technology. Much of what WCAG requires is the consumer's: the text of labels and alternatives, the reading order of their layouts, their content's structure. A UI framework therefore states, per component, which success criteria the component itself takes care of and which remain the application's responsibility, and its documentation says so.

**Web components** `{web}`: ID references such as `aria-labelledby` can only refer to elements in the same node tree, so they do not reach across a shadow root boundary, which limits labeling between components; `ElementInternals` lets custom elements expose roles and states and take part in forms [MDN-ElementInternals]. The Reference Target feature addresses the boundary; as of 2026-11 it has shipped in Chromium-based browsers only. Check current browser support before designing around it.

## Checks for UI frameworks

| Stage | Check |
|---|---|
| Types | Required label properties; distinct types for safe and unsafe markup |
| Lint | Accessibility lint rules for the framework's templates or JSX |
| Component tests | Queries by role and accessible name; automated accessibility checks on every story or test case |
| Visual and interaction tests | Keyboard-only walkthrough of each interactive component; focus order |
| Manual | A test plan per widget pattern with at least one screen reader per platform supported |

## Weights for UI work

Use the benefit profile in `tradeoffs.md`: ease of learning and familiarity usually rank high for UI libraries, because consumers include designers and developers new to the library. Where accessibility is required by law or contract in the markets the product serves, move the accessibility misuse scenarios into gate G1. Bundle size enters through K10 and K7.
