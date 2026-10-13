---
sourceHash: 7fafe8d11f89
---

# `@olddevs/ui` Reference

This Reference is the contract for developers and AI agents who use the package's public API. The source of
truth for the exports is [`src/index.ts`](../src/index.ts). Component sources, tests and Storybook confirm the
behavior claims on the pages.

## Start here

1. [Install the package](getting-started.md): imports, CSS and Tailwind 4.
2. [Choose a component](component-selection.md): pick the meaning first, not a similar look.
3. [Shared conventions](conventions.md): the prop vocabulary, controlled state and the limits of the public API.
4. [Glossary](glossary.md): the terms of the kit and the Editor, and what not to confuse them with.
5. [Accessibility](accessibility.md): the required rules for names, focus and the keyboard.
6. [Themes, tokens and brands](theming.md): the four token layers and how to add your own brand in one CSS block.
7. [Palette](palette.md): the palette primitive values and the roles by theme, in one table.
8. [Localization](i18n.md): the provider, the message catalog and how to connect to the consumer's `I18nProvider`.
9. [Component catalog](components/index.md): the full index of the public components.

## Rules for AI

- **Start with `llms.txt`** at the package root. It is an index of all Reference pages, with a description of
  each one. A script builds it from `docs/`, so it cannot fall behind them.
- Import only the public entry points of the package (the list is in the [glossary](glossary.md)). Do not
  import files from the package's `src/` directly.
- Before you read a page's API, read "When to use" and "When not to use". Components that look alike can
  express different actions.
- Do not replace a semantic component with hand-written markup if the package already provides a suitable
  public export.
- Follow the controlled and uncontrolled contract described in the Reference, and the requirements for the
  label (`label`), focus and Escape. A look in a screenshot does not replace these contracts.
- Document a change to the public API in the same change as the code. The full maintenance rules are in the
  `CLAUDE.md` of the kit's repository. That file does not ship in the package, and there is no link to it here
  on purpose.

## Scope

The documents live in the package repository. **Since 3.8.0 they ship with the package** to the registry: the
whole `docs/` folder and the `llms.txt` index at the package root (ADR-0044). An agent in someone else's
repository no longer needs a link to that repository or access to it. The Reference is in
`node_modules/@olddevs/ui/docs/`, in the version that is installed, not the version that is on `main` now.

The kit has a public documentation site, but the index does not link to it. The index has no `https://…`
links. All its paths are relative and point inside the package.

**What the package does not include is the ADRs.** Reference pages refer to decisions by number, `ADR-NNNN`,
many times. But the decisions are kept apart from the code and are not in the package. This does not stop the
Reference from being complete: the contract, the API and accessibility are described on the pages themselves.
"Why it was decided this way" stays in the decision records. The trade-off was made on purpose (ADR-0044). If
you need the reasoning, ask in the repository's issues.
