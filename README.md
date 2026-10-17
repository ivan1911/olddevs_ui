# <img src="https://ivan1911.github.io/olddevs_ui/logo.svg" alt="" width="44" height="56" align="absmiddle"> @olddevs/ui

English · [Русский](README.ru.md)

[![npm version](https://img.shields.io/npm/v/@olddevs/ui)](https://www.npmjs.com/package/@olddevs/ui)
[![license](https://img.shields.io/npm/l/@olddevs/ui)](LICENSE)

Olddevs UI is a design system for React: design tokens, themes and 122 accessible components, built for admin interfaces and other data-heavy products. Behavior comes from [React Aria Components](https://react-aria.adobe.com/) and [Radix UI](https://www.radix-ui.com/); styling is [Tailwind CSS](https://tailwindcss.com/) 4. Your app's Tailwind build compiles the component classes.

Documentation: **[ui.olddevs.ru](https://ui.olddevs.ru)** · Showcase: **[Storybook](https://ivan1911.github.io/olddevs_ui/)**

## Requirements

- React 19
- Tailwind CSS 4, already set up in your app

## Installation

```bash
npm install @olddevs/ui react
```

React is the only peer dependency: your app picks its version. The kit brings everything else
itself, so you don't list these packages in your `package.json`:

| Package                                                                    | Used for                                                       |
| -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `react-aria-components`                                                    | Behavior and accessibility of most controls                    |
| `@radix-ui/react-dialog`, `-popover`, `-tooltip`, `-context-menu`, `-slot` | Dialogs, drawers, popovers, tooltips, context menus, `asChild` |
| `lucide-react`                                                             | The icon set behind `@olddevs/ui/icons`                        |
| `sonner`                                                                   | `Toaster` and `toast`                                          |
| `clsx`, `tailwind-merge`                                                   | Class composition                                              |
| `@internationalized/date`                                                  | Types for the date and time components                         |

The rich text engine (Tiptap) is not on the list. Only an app that imports `@olddevs/ui/editor` installs it; the command is on the [Rich text editor page](docs/components/inputs/rich-text-editor.md#installation).

## Adding the styles

Your app's CSS needs all three lines:

```css
@import "tailwindcss";
@import "@olddevs/ui/styles.css";
@source "./node_modules/@olddevs/ui/dist";
```

`@import "tailwindcss"` belongs to your app, not to the package: do not import Tailwind twice. `@source` is required. Tailwind 4 does not scan `node_modules` on its own, so without that line the build still succeeds, but the component classes are missing from the final CSS.

If you do not use the rich text editor, add a fourth line so its classes stay out of your CSS:

```css
@source not "./node_modules/@olddevs/ui/dist/editor";
```

In a Next.js App Router app, also add this to `next.config.mjs`, or a single `Button` import pulls the whole kit into the client bundle:

```js
export default { experimental: { optimizePackageImports: ["@olddevs/ui"] } };
```

Details are in [docs/getting-started.md](docs/getting-started.md).

## Usage

Import components from the package root and icons from `@olddevs/ui/icons`. Use only the public entry points listed in the `exports` field of `package.json` and in the [glossary](docs/glossary.md); never import from `src/`.

```tsx
import { useState } from "react";
import { Button, Form, FormField, Select, TextControl, type SelectId } from "@olddevs/ui";

export function CreateProject() {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<SelectId | null>(null);

  return (
    <Form onSubmit={() => save({ name, status })}>
      <FormField label="Name" htmlFor="name" required>
        <TextControl id="name" value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>
      <Select
        aria-label="Status"
        placeholder="Status"
        items={[
          { id: "draft", label: "Draft" },
          { id: "live", label: "Live" },
        ]}
        value={status}
        onChange={setStatus}
        clearable
      />
      <Button type="submit" tone="accent" variant="solid">
        Create
      </Button>
    </Form>
  );
}
```

Appearance across the kit is set by three shared axes: `size` (`sm`, `md`, `lg`), `tone` (`neutral`, `accent`, `success`, `warning`, `danger`) and `variant` (`solid`, `soft`, `outline`, `ghost`).

### Theme and language

The theme is an attribute on `<html>`: `data-theme` accepts `dark` (the default), `light` or `dim`, and `data-accent` accepts `blue` (the default) or `violet`.

```html
<html data-theme="light" data-accent="violet"></html>
```

The interface language defaults to English. Russian labels are added with one provider:

```tsx
import { UiProvider } from "@olddevs/ui";
import ru from "@olddevs/ui/locales/ru";

<UiProvider locale="ru-RU" messages={ru}>
  <App />
</UiProvider>;
```

See [Themes, tokens and brands](docs/theming.md) and [Localization](docs/i18n.md).

## Documentation

- [ui.olddevs.ru](https://ui.olddevs.ru): the documentation site
- [Storybook](https://ivan1911.github.io/olddevs_ui/): the showcase, every component's stories in each theme, built from the latest release
- [docs/index.md](docs/index.md): the Reference, the `docs/` folder in the package, with one page per component and "When to use" and "When not to use" sections
- [docs/components/index.md](docs/components/index.md): the component catalog
- [docs/accessibility.md](docs/accessibility.md): the accessibility contract

The Reference is written in English. Its Russian translation is on the [documentation site](https://ui.olddevs.ru/ru).

The package ships `docs/` and an `llms.txt` index, so the Reference matching your installed version is in `node_modules/@olddevs/ui/`. Point AI coding tools at `llms.txt` first.

## Contributing and support

- [CONTRIBUTING.md](CONTRIBUTING.md): how to propose and make changes
- [SECURITY.md](SECURITY.md): how to report a vulnerability
- [CHANGELOG.md](CHANGELOG.md): release notes
- [Issues](https://github.com/ivan1911/olddevs_ui/issues): bugs and ideas
- [Discussions](https://github.com/ivan1911/olddevs_ui/discussions): questions

## License

[MIT](LICENSE)
