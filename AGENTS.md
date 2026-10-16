# AGENTS.md — `@olddevs/ui`

Instructions for agents and developers working in this repository. Read them
before the code. Then read [README.md](README.md), [docs/index.en.md](docs/index.en.md)
and the page for the component you are working on.

`@olddevs/ui` is a design system: tokens, themes and accessible UI primitives for
several products, mainly admin interfaces. The public API is the set of entry
points that the `exports` field of [`package.json`](package.json) declares, and
nothing else:

- `@olddevs/ui` — components, hooks and types; the runtime API is defined
  **only** in [`src/index.ts`](src/index.ts)
- `@olddevs/ui/icons` — the icon vocabulary
- `@olddevs/ui/color` — `ColorPicker`, kept apart so that its weight is visible
  in the import
- `@olddevs/ui/editor` — the rich text Editor
- `@olddevs/ui/editor/schema` — the Editor's Schema and HTML sanitizing, without React
  or Tiptap
- `@olddevs/ui/editor/highlight` — server-side code highlighting
- `@olddevs/ui/locales/ru` and `@olddevs/ui/locales/en` — message catalogs
- `@olddevs/ui/styles.css` — tokens, themes and base styles

The code is the source of truth: documentation, mockups and retellings follow it,
not the other way round.

## Code and documentation

The dividing rule: **whatever has to change together with the code, in the same
change, lives in this repository** (`docs/components/`, `docs/api/`).
Architectural decisions (ADRs) and conventions that outlive a single release and
explain why things are the way they are are kept apart from the code. Refer to a
decision by its number, `ADR-NNNN`, as a record rather than as a file in this
repository.

Examples in the documentation carry no product-specific data. If you come across
such an example while editing a page, replace it with a neutral one; don't make a
separate campaign of it.

## Using components

- Start with the [catalog](docs/components/index.en.md) and the page of the
  candidate component. Choose by "When to use" and "When not to use", not by
  appearance. The selection rules are in [component-selection.en.md](docs/component-selection.en.md).
- A consumer imports only the entry points listed at the top of this file. Paths
  in `src/` are not public API.
- Don't replace an existing semantic primitive with hand-written markup. And
  don't move domain texts, status vocabularies, requests or the layout of a
  specific screen into the package: they belong to the consumer.
- With Tailwind 4, the consumer must have `@import "@olddevs/ui/styles.css"` and
  `@source "./node_modules/@olddevs/ui/dist"`. See [getting-started.en.md](docs/getting-started.en.md).

## Prop axes

Unless a component page says otherwise, three independent axes apply: `size`
(`sm|md|lg`), `tone` (`neutral|accent|success|warning|danger`) and `variant`
(`solid|soft|outline|ghost`). States are named positively: `selected`,
`disabled`, `loading`. Alternatives (`kind`, `status`) and negative boolean props
are not introduced without a separate public decision. Such decisions are
recorded in the vocabulary in [`docs/conventions.en.md`](docs/conventions.en.md):
`active` marks only the current navigation item, `appearance` is the
shape of a variant, `level` is a heading level.

An axis is turned on by an **explicit prop**: a component that supports every
axis at once puts dead weight into the markup. A component doesn't store domain
state; it accepts a value and a callback.

## Names in code

Variables, constants, parameters and functions are written in **Latin**. Cyrillic
stays in code only where it is the text itself: in strings, comments and
documentation. This holds everywhere, including story exports and showcase
sections.

For which language goes where, see ADR-0034 and [`docs/conventions.en.md`](docs/conventions.en.md).
In short: comments, the Originals in `docs/` and ADRs are in Russian; the
showcase, tests and scripts are in English. `AGENTS.md`, `README.md` and the
community files (`CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, the
issue templates) are in English as well. Cyrillic in a line of code is allowed
only where it is the **subject** of a check or input data; `tests/i18n-gate.test.ts`
enforces this with an allowlist of three justified reasons.

## Documentation is part of the public API

- When you add, remove or change a public runtime export of any entry point, update
  the component page and the [catalog](docs/components/index.en.md) in the same
  change.
- Compound exports of one family are documented on one page, with an explicit
  list of all the exports.
- A component page is written in Russian and contains: a short purpose statement
  for AI; "When to use"; "When not to use", with alternatives; a minimal example
  with a public import; the semantics of props, state and events; accessibility
  and keyboard support; anti-patterns; links to the source, tests and Storybook.
- Describe meaning and limits. Don't copy TypeScript types without explanation,
  and don't document internal paths as a contract.
- `README.md` is a short description and the setup steps; the detailed reference
  lives in `docs/`.
- The English Translation of a page is its neighbor `X.en.md`, carrying the
  `sourceHash` of the Original (ADR-0062). The Original is written first; the
  Translation repeats its shape: the same headings at the same levels, the same
  code blocks, the same frontmatter. `tests/docs-translations.test.ts` enforces
  this. Links in a Translation are written as in the Original: the `.md` path and the
  Original's Russian anchor, never a Latin anchor from the English heading (the site
  derives the English one); the same test checks every anchor against the Original's
  heading slugs. Editing an Original doesn't wait for its Translation: a stale one shows
  up in `npm run docs:translations`. Notes about Russian colloquialisms to avoid are
  not carried into a Translation, because they mean nothing to an English reader.

## Components on react-aria-components

Take state **from a render prop where you style a descendant**, and **from a
variant (`hover:`, `selected:`) where you style the element itself** that carries
the `data-*` attribute. RAC attributes sit on their own element. A child node (the
box of a checkbox, the circle of a radio) could reach them only through the
`group-selected:` form, and that class would have to be assembled from a prefix
and a tone. Tailwind can't see an assembled class: it scans the sources as text,
so a class built at runtime silently doesn't make it into the CSS. A render prop
hands the state to JS, and a ready literal string is taken from a table (the class
tables in `src/lib/variants.ts` are flat lists of literals).

**Check the react-aria API against the installed package**, not against memory or
the documentation: `@deprecated` tags, renames and pairs such as `CheckboxField` /
`CheckboxButton` are visible only in `node_modules/react-aria-components`.

## Source layout

The decision is ADR-0060; `tests/structure.test.ts` enforces it.

- **A new component** goes into `src/components/<category>/`, the same folder
  where its page lives in `docs/components/`. There are eight categories; they
  are the subfolders of the Reference, and there are no files in the root of
  `src/components/`. Files are flat inside a category: `overlays/Dialog.tsx`,
  `overlays/Dialog.stories.tsx`. An internal part lives next to its owner. A
  component changes category by moving its page and its code together.
- **The Editor** (`src/editor/`): the root holds only the entry points,
  `RichTextEditor`, `RichTextView` and their stories. The engine and the Tool
  registry live in `core/`, shared plumbing in `ui/`, the palette and styling
  classes in `styles/`, hooks in `hooks/`, and a whole feature (node, commands,
  Tool, its own UI) in `features/<feature>/`.
- **Barrels (`index.ts`) are forbidden** in categories, layers and features:
  import the file directly. A barrel is only an entry point of the package.

## ADRs

Architectural decisions are written down as ADRs and kept outside this
repository; refer to them by number (`ADR-NNNN`).

A new ADR is written when a change carries an architectural decision: a new
dependency, a changed contract with consumers, a chosen trade-off, a rejected
experiment. Routine work under decisions that are already accepted doesn't need
one. Reversing an accepted decision means a new ADR plus the status `Superseded`
on the old one; old ADRs are not rewritten after the fact. If your change calls
for an ADR, raise it in the issue or pull request before you start: it is on the
"ask first" list below.

## Quality bar: core and periphery

The full ritual (behavioral tests, class coverage, axe, local snapshots, a
rationale on the component page in `docs/`) is mandatory for the **core**. The
periphery, which means wrappers over the ready-made behavior of
`react-aria-components`, needs only a reduced set. The boundary and the
reasoning are in ADR-0014.

## Versions

The kit follows strict semver: **breaking changes ship only in a major version.**
The public API is the set of entry points listed at the top of this file, with
their exports, types and documented behavior, plus `@olddevs/ui/styles.css`.
`minor` and `patch` releases don't break it.

Renaming a public API goes through a **deprecated alias**: the old name keeps
working and gets `@deprecated` pointing to the new one. The alias lives for one
major version and is removed in the next. Removing something without a preceding
alias is allowed only in a major version, with an entry in
[docs/api/migration-notes.en.md](docs/api/migration-notes.en.md).

## Commits

Conventional Commits, one line, in English. A maintainer's commit message ends
with the key of the internal issue tracker in parentheses:
`fix(keyboard): keep the caret after a layout switch (OLDSUI-<number>)`. The key
is required: the private repository links a commit to its task only through the
key, so a commit without one doesn't show up in the task. The same key goes into
the branch name (`fix/OLDSUI-<number>-<slug>`) and the pull request title. An
outside contribution doesn't need a key (see [CONTRIBUTING.md](CONTRIBUTING.md)).

## Checks

```bash
npm test                 # Vitest
npm run typecheck
npm run lint             # + npm run format:check
npm run build
npm run build-storybook
npm run contrast         # token contrast across all themes and surfaces
npm run test:a11y        # axe over the stories
npm run test:interactions
npm run test:visual      # snapshots, local only (ADR-0013)
npm run release:check    # everything above for a release, in one entry point
```

Checks run locally: **the list of commands above is not a formality. It is the
only thing standing between a change and the consumer.** Run it as described
below, and run `npm run release:check` in full before a release. The browser
checks (`test:a11y`, `test:interactions`, `test:visual`) are **not part of it**:
snapshots depend on the platform, so they are run separately.

### Heavy checks run locally, not in GitHub Actions

The full Vitest run, the consumer build (`check:consumer`), the size budget and
the Playwright browser checks all run **locally**: `release:check` before a tag,
the browser checks separately. GitHub Actions doesn't repeat them: `release.yml`
only builds the package and publishes it on a tag, and `pages.yml` only builds
and deploys the showcase. Snapshots depend on the platform, so a rerun on a Linux
runner wouldn't be a second opinion, and CI time isn't spent on what has already
been checked before the tag. Don't add tests to a workflow without agreeing it
with the maintainer first.

- After editing only documentation: run Prettier on the affected files, `npm run llms:check`
  and a check of relative links.
- After editing a component, the public API or the package scripts: run the
  related unit tests, then the full list above; if the visual or accessibility
  contract changed, also the showcase and Playwright.
- Don't fix unrelated formatting violations or failing tests within a task
  without first separating the baseline defect from your change.

### Updating Radix

After any bump of the `@radix-ui/*` packages in `devDependencies`, there must
still be exactly one copy of `@radix-ui/react-dismissable-layer`:
`npm ls @radix-ui/react-dismissable-layer`. Two copies mean two independent
layer stacks, and Escape in a dropdown also closes the dialog under it. What the
consumer sees and how to fix it is in [getting-started.en.md](docs/getting-started.en.md#common-problems),
"Common problems".

### Install scripts

npm 11 blocks dependency install scripts unless `allowScripts` in `package.json`
covers them. `esbuild`, `@parcel/watcher` and `fsevents` are denied: their
native binaries arrive prebuilt, as platform packages (`@esbuild/<platform>`,
`@parcel/watcher-<platform>`) or inside the package itself (`fsevents.node`),
and the build, the showcase and the tests pass without the scripts. When an install reports a new package with an install
script, read what the script does and record `npm install-scripts deny <pkg>`,
or `approve <pkg>` if the package can't work without it. Never
`approve --all`: it runs code nobody reviewed on every `npm ci`.

### Overrides

`overrides` in `package.json` lifts a transitive dev dependency that its parent
pins to a vulnerable version. `@parcel/watcher` `^2.6.0`: `@tailwindcss/cli`
(used by the CSS tests) pins 2.5.1, which pulls in `micromatch` and `braces`
with denial-of-service advisories; 2.6.0 switched to `picomatch`. Remove the
entry once `@tailwindcss/cli` depends on 2.6 or later. `npm audit` stays at
zero: an advisory in a dev tool is fixed by a version bump or an override, and
only an entry nobody can reach is left with its reason written here.

### Contrast

`npm run contrast` calculates contrast directly from the tokens in `styles.css`
and takes the pairs from `variantClasses()`, so a new tone or atom is checked
automatically. It calculates against the **worst of the surfaces**, the
`SURFACES` list in `scripts/contrast.mjs`. A new surface changes the gate: it
turns red, and that is correct, because the list of surfaces is the model of where
a primitive can stand. When you move tokens, **aim for 4.6, not 4.5**: the browser
rounds channels before painting, so a token tuned to exactly 4.50 shows 4.49 in an
axe audit. `[data-accent="violet"]` isn't tied to a theme and serves `dark` and
`dim` at once, so the worst case applies; the same goes for `success`, `warning`
and `danger`, which `dim` doesn't override. The script and axe don't replace each
other: the first goes through combinations that are never shown, the second sees
the real overlaps in the DOM.

### Snapshots and the focus trap

- **Snapshots are local only**, with the baseline in
  `tests-visual/__snapshots__/darwin/`. The platform is part of the file path:
  font rendering differs between macOS and Linux, and a baseline taken in a
  container is useless. Stories are captured, not application screens: screens
  need a backend and live data.
- **The version of `@playwright/test` determines the Chromium build, and with it
  the anti-aliasing.** Bump it in a separate commit that retakes the whole
  baseline (`npm run test:visual:update`), not as a side effect of a component
  change.
- **Set the theme with the `globals` parameter in the story URL**
  (`/iframe.html?id=…&globals=theme:dark;accent:blue`), before the first render.
  Don't switch it after load: Chromium propagates inherited CSS variables into the
  subtree on the next recalculation, so the snapshot would show the old theme.
- **Don't test a focus trap in jsdom.** It doesn't move focus on Tab the way a
  browser does, and a check that passes either way is worse than no check. Check
  focus and the seam between the two libraries (a react-aria menu inside a Radix
  dialog and the other way round) in a browser with `test:interactions`;
  neither a snapshot, nor axe, nor jsdom sees this.

## Boundaries

**Always:** a new component ships together with its documentation page, a story,
a test and a row in the catalog, all in one change. Every user-visible string goes
through the message catalog with a fallback. A change that a consumer can see
carries a changeset entry (`npm run changeset`); the rules are in
[.changeset/README.md](.changeset/README.md). A breaking change is recorded in
[docs/api/migration-notes.en.md](docs/api/migration-notes.en.md), with the action
the consumer takes.

**Ask first:** a new dependency or peer dependency; a change to token values that
visibly changes the look; any architectural decision (an ADR); the publishing
setup, meaning the registry endpoint and publish rights.

**Never:** publish or commit without an explicit request; bring domain texts or
the layout of a specific screen into the kit; introduce a primitive for the sake
of a single CSS combination (only for recurring semantics, API and accessibility
requirements).
