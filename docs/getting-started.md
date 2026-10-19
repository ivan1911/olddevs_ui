# Setting up `@olddevs/ui`

## Installation

```bash
npm install @olddevs/ui react
```

React is the kit's only peer dependency (ADR-0072): the app picks its version, and the app
must have exactly one copy of it. The kit brings every other library itself, in its own
`dependencies`: Radix, `react-aria-components`, `@internationalized/date`, `lucide-react`,
`sonner`, `clsx` and `tailwind-merge`. You don't need to list them in your app's `package.json`.

If your app uses one of them directly, keep its range compatible with the kit's. Otherwise the
build ends up with two copies, and the layers, contexts and providers of one copy can't see the
other's (see [Troubleshooting](#troubleshooting)). For the same reason, import `LucideProvider`
from `@olddevs/ui/icons` and `toast` from `@olddevs/ui`, not from `lucide-react` and `sonner`.

The Editor engine is not on the list: only an app that imports `@olddevs/ui/editor` installs
it — the command is on the [Editor page](components/inputs/rich-text-editor.md#installation).

## Importing components

```tsx
import { Button, TextControl } from "@olddevs/ui";
import { AddIcon } from "@olddevs/ui/icons";
```

Import only the package's public entry points — they are all listed in `exports` of
`package.json` and in the [glossary](glossary.md) (`.`, `/icons`, `/color`, `/editor`,
`/editor/schema`, `/editor/highlight`, `/locales/ru`, `/locales/en`, plus
`styles.css`). Do not import `@olddevs/ui/src/components/...`: that path is not part of the package contract and may
change without a migration.

## Adding the CSS

The consumer's CSS needs all three lines:

```css
@import "tailwindcss";
@import "@olddevs/ui/styles.css";
@source "./node_modules/@olddevs/ui/dist";
```

`@import "tailwindcss"` belongs to the consumer app, not to the package. Do not
import Tailwind a second time. `@source` is required: Tailwind 4 does not scan
`node_modules` automatically, so without it the build can succeed
with no component classes in the final CSS.

If the app does not use the Editor (`@olddevs/ui/editor`), add a fourth line:

```css
@source not "./node_modules/@olddevs/ui/dist/editor";
```

`@source` over the whole `dist` scans the Editor too, so its classes (the Toolbar, menus,
`.ProseMirror`) end up in the CSS even when the entry point is never imported. Measured on a
Next.js 16 app without the Editor: 160 kB of CSS without the line, 113 kB with it. Once you
import the Editor, remove the line: otherwise its classes do not reach the CSS, and the
build, just as without `@source`, passes silently.

## The package in server components

Kit components can be imported **straight into a server component** of the Next.js App
Router — you do not need to wrap them in your own file with `"use client"`: the directive sits
in the package itself, file by file.

But the consumer's config needs one more line:

```js
// next.config.mjs
export default { experimental: { optimizePackageImports: ["@olddevs/ui"] } };
```

It is required in exactly the same sense as `@source` for Tailwind: without it
the build passes, but the result is unusable. Measured on a Next.js 15.5 app
(`First Load JS`, package installed from a tarball):

| What the page imports              | Without the line | With the line |
| ---------------------------------- | ---------------- | ------------- |
| nothing from the kit (baseline)    | 102 kB           | 103 kB        |
| `AddIcon` from `@olddevs/ui/icons` | 103 kB           | 103 kB        |
| one `Button` from the root         | **408 kB**       | 114 kB        |
| `cn` and `tableStateToParams`      | **408 kB**       | 103 kB        |

Read the third row like this: importing a single button brought the user **the whole
kit**. The fourth: a server component that needs two pure
functions and no components shipped the same 306 kB of client code.

The cause is not how the package is built but the boundary of the client graph: the root
entry point re-exports about a hundred client modules, and tree shaking does not work across that
boundary. `optimizePackageImports` rewrites the import from the
root entry point into a set of targeted ones, and the cost drops back to something reasonable. Details in
ADR-0029.

**The Editor subpath needs its own line.** The `@olddevs/ui/editor` entry point is the same
kind of barrel: next to the server-side `RichTextView` it re-exports the client
`RichTextEditor`. The root line does not cover the subpath, and a page that needs only a Document
View ships the whole Editor together with the engine:

```js
// next.config.mjs — if you import @olddevs/ui/editor
export default {
  experimental: { optimizePackageImports: ["@olddevs/ui", "@olddevs/ui/editor"] },
};
```

Measured on a consumer fixture (`RichTextView` with a code Block in a server
component): **435 kB** of `First Load JS` without the second line and 137 kB with it — only
the Island of the "Copy" button goes to the client. The `@olddevs/ui/editor/schema`
and `@olddevs/ui/editor/highlight` entry points are not barrels and contain no client modules,
so they do not need the line.

Utilities (`cn`, `tableStateToParams`, `formatMask` and the rest of
[api/utilities.md](api/utilities.md)) are server-safe: they do not
import React and do not pull anything into the client graph. The package has no separate entry point such as
`@olddevs/ui/server` and none is planned — with the line above it is
not needed.

## Import size

The package ships its source, and unused code is dropped by tree shaking: only what the
consumer imported ends up in its bundle. Measured on 3.47.3. The figures are the contribution of **the package itself**;
React and the kit's third-party libraries are treated as external, and the metric is gzip:

| What the consumer imports                                                                                | gzip     |
| -------------------------------------------------------------------------------------------------------- | -------- |
| `cn` and `tableStateToParams`                                                                            | 0.6 kB   |
| one `Button`                                                                                             | 1.6 kB   |
| `DataTable`                                                                                              | 9.8 kB   |
| the whole kit (`import *`)                                                                               | 77.9 kB  |
| `RichTextEditor` from `@olddevs/ui/editor`, without the engine, "start"                                  | 98.5 kB  |
| `RichTextEditor` with the Tiptap engine, "start" (static graph, `basic`)                                 | 332.1 kB |
| `RichTextEditor` with the Tiptap engine, "full" (with all lazy chunks, `full`)                           | 501.3 kB |
| `RichTextView` from `@olddevs/ui/editor`, Tiptap engine included in the measurement                      | 16.1 kB  |
| `sanitizeRichText` and `richTextSanitizeConfig` from `@olddevs/ui/editor/schema`, Tiptap engine included | 6.4 kB   |
| `highlightCodeBlocks` from `@olddevs/ui/editor/highlight`, with lowlight                                 | 22.6 kB  |
| `highlightCodeNodes` from `@olddevs/ui/editor/highlight`, with lowlight                                  | 22.6 kB  |

The last seven rows are separate Editor entry points with their own budgets
(ADR-0050). The Editor has three rows, and two of
them are scenarios (ADR-0058, item 11.7):
**"start"** is the static graph, what ships immediately and what the `basic` Preset costs; **"full"** is the same
plus all the lazy chunks of the entry point, what `full` ends up loading. The code Block and the table (absent from `basic`,
and their Extensions weigh more than 10 kB) load lazily; until they arrive, an Editor that includes them shows a Skeleton.
`npm run size` checks that their modules are not in "start". The kit's own code is measured at "start".

In the scenarios the engine is **included in the measurement** on purpose: the consumer installs Tiptap, but
the kit chooses the set of its extensions. With code Block highlighting, lowlight and eight
highlight.js grammars are included too (ADR-0051). The figures in the table come from the same
pipeline as the others (vite in library mode, where whitespace stays during minification);
an app bundler with full minification produced about 133 kB (measured before the Toolbar).

For `RichTextView`, Tiptap and lowlight are included in the measurement as a check. Its row contains only
typography, the Island of the "Copy" button on code Blocks (the kit's button and tooltip, the message catalog)
and the search for formulas and video in the HTML with the loaders of their Islands; KaTeX and the player themselves
are in lazy chunks that a page without formulas or video does not load. The measurement proves that its graph
contains neither the engine nor a highlighter. The lightweight
`@olddevs/ui/editor/schema` entry point is measured the same way (6.4 kB): the Schema, `richTextSchema`, the
`sanitizeRichText` sanitizer with hooks for DOMPurify, including for the rules of custom Tools, and `markRange`.

Server-side highlighting in `@olddevs/ui/editor/highlight` (22.6 kB — almost entirely the highlight.js core and
grammars) costs only an app that imports it, and usually only on the server. The
`highlightCodeNodes` helper for `CodeView` weighs the same: React is not in the measurement
(ADR-0052). An app that does not import the
`@olddevs/ui/editor` entry point pays for neither the engine nor the Editor code; only the Editor's English
labels in the shared message catalog reach the main entry point, about 1 kB gzip (ADR-0050, item 5).

The Editor's custom color Popover (`ColorPicker` and the color subsystem of `react-aria-components`, about
51 kB gzip) loads lazily on the first "Custom color…": it is not in "start", and "full" includes
only the kit's own code, since react-aria is not in the measurement. The script does not drop the lazy chunks
silently: it prints their weight on top of "start" next to each row. The chunks can be preloaded ahead
of time: the consumer sets `modulepreload` on them.

The numbers are enforced in CI and checked against this table: `npm run size` measures the package's
contribution and fails if the documentation has drifted from the measurement, and
`npm run check:consumer` measures the `First Load JS` of a consumer
app page. The budgets for both are in
`scripts/bundle-size.budgets.mjs`.

If a component grew for a good reason, the budget goes up — **in a separate line in the
merge request, with an explanation of what exactly grew**. A budget that is moved
along with a component change stops enforcing anything within a couple of
releases.

### What is in the package

Details of the decision — ADR-0042.

Besides `dist` and `styles.css`, the **sources** (`src`, without stories) and their
source maps are published. This does not affect the consumer's bundle by a single byte: only the imported code from `dist`
goes to the browser, while the sources and maps are for tools —
the debugger and the editor. The price is install size: on 3.47.3 the package weighs about 9.2 MB
unpacked (the tarball is about 2.4 MB), of which the sources are about 2.7 MB
(`npm pack --dry-run`).

What they buy is working debugging. Without `src`, the maps sat in the package as dead
weight: they refer to the source by a relative path, the file was not there, and
the debugger quietly showed compiled code. Now a breakpoint inside the kit
opens the real `.tsx` — with comments that explain why the
component is built the way it is — and "go to definition" leads there too, rather than to
`.d.ts`.

This does not widen the public entry points: `exports` is a closed map, and
`import "@olddevs/ui/src/components/content/Link.tsx"` is rejected by Node and by any
`exports`-respecting bundler with `ERR_PACKAGE_PATH_NOT_EXPORTED`. The sources in the
package are material for tools, not a second way to import the kit.

Since 3.8.0 the **Reference** ships next to them — the whole of `docs/` and the `llms.txt` index at the package root
(ADR-0044).
The same trade as with the sources: not a single byte goes to the browser, and the install size
grows by 2.5 MB unpacked (on 3.47.3). The point is the reader: a comment in the code explains why a
component is built the way it is, while a Reference page answers what to pick and when, and before
3.8.0 the second question had no answer in the package at all.

Open the Reference straight from `node_modules/@olddevs/ui/`: start with `llms.txt` —
the index of all the Reference pages — then follow the links. The Reference cannot be imported, any more than the
sources: `import "@olddevs/ui/docs/index.md"` is rejected with the same
`ERR_PACKAGE_PATH_NOT_EXPORTED`.

## Quick example

```tsx
import { Button, FormField, TextControl } from "@olddevs/ui";
import { AddIcon } from "@olddevs/ui/icons";

export function CreateProjectForm() {
  return (
    <form>
      <FormField label="Project name" htmlFor="name">
        <TextControl id="name" name="name" />
      </FormField>
      <Button type="submit" icon={<AddIcon aria-hidden />}>
        Create
      </Button>
    </form>
  );
}
```

Next step: [pick a component for your task](component-selection.md), then
open its page in the [catalog](components/index.md).

## A page in the app shell

Since 2.1.0 you no longer need to write the app shell yourself: the side navigation, the header and the layout
come from the kit.

```tsx
import { AppShell, NavGroup, NavItem, SideNav, TopBar } from "@olddevs/ui";
import { DashboardIcon } from "@olddevs/ui/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AppShell
      routeKey={pathname}
      sidebar={
        <SideNav>
          <NavGroup label="Work">
            <NavItem
              label="Dashboard"
              icon={<DashboardIcon />}
              active={pathname.startsWith("/dashboard")}
              asChild
            >
              <Link href="/dashboard" />
            </NavItem>
          </NavGroup>
        </SideNav>
      }
      header={<TopBar brand={<Logo />} />}
    >
      {children}
    </AppShell>
  );
}
```

Three things the kit deliberately leaves to you: **route comparison**
(`active` is a prop), **persisting the collapsed state** of the sidebar, and **applying the theme**.
Details are on the [AppShell](components/app-shell/app-shell.md) and
[SideNav](components/app-shell/side-nav.md) pages.

## Interface language

The kit defaults to English. Russian labels are added with one
line:

```tsx
import { UiProvider } from "@olddevs/ui";
import ru from "@olddevs/ui/locales/ru";

<UiProvider locale="ru-RU" messages={ru}>
  <App />
</UiProvider>;
```

The message catalog does not load automatically: otherwise it would end up in everyone's bundle, including those who
only need English. The order in which a string is resolved, partial catalogs and
integration with react-aria's `I18nProvider` — [i18n.md](i18n.md).

## Troubleshooting

### Escape in a dropdown also closes the dialog

**Symptom.** A `Dialog` is open with a `Select`, `TimePicker` or calendar expanded inside it.
Pressing Escape should close only the topmost layer, the dropdown. Instead it closes the
dialog too, taking the unsaved form with it.

**Cause.** Your app has more than one copy of `@radix-ui/react-dismissable-layer`. Radix keeps
the stack of open layers in a module-level variable, so every copy of the module has its own
independent stack, and each layer believes it is the topmost one. Radix pins its internal
packages to **exact** versions, with no caret, so `dialog`, `popover` and `tooltip`
released at different times pull in different copies, and npm has to duplicate them. Nothing looks
wrong in the layout; the problem shows only in behavior.

**How to check.** There should be exactly one copy:

```bash
npm ls @radix-ui/react-dismissable-layer
find node_modules -name "react-dismissable-layer" -type d   # exactly one match
```

In the `npm ls` output there is one version, and the other occurrences are marked `deduped`.

**How to fix.** Radix comes with the kit (ADR-0072), and on a fresh install `dialog`, `popover`,
`tooltip` and `context-menu` all resolve to one copy of `react-dismissable-layer`. A second copy
appears when something else pulls Radix into the app: your own code or another library. First,
line up the versions so that every package pulls in the same copy. The kit is tested on
`dialog@1.1.23`, `popover@1.1.23`, `tooltip@1.2.16` and `context-menu@2.3.7`, which all resolve to
`react-dismissable-layer@1.1.19`. If versions alone cannot bring them together, pin one copy with
`overrides` in your app's `package.json`:

```json
{
  "overrides": {
    "@radix-ui/react-dismissable-layer": "1.1.19"
  }
}
```

In pnpm this is `pnpm.overrides`; in Yarn it is `resolutions`. The ranges in the kit's
`dependencies` do not help here: the package cannot see which internal versions your package manager
will choose. Repeat the check after every Radix update. `react-focus-scope` and `react-presence`
also keep module-level state, so check their copies too.

### "Invalid hook call" after `npm i file:` or `npm link`

**Symptom.** The package is installed from a local path, with `npm i file:../olddevs_ui` or
`npm link`, and the app crashes with "Invalid hook call" for no obvious reason.

**Cause.** A package installed this way is a symlink to the kit's working copy. It resolves React
from **its own** `node_modules`, where React is installed as a development dependency. The app
ends up with two instances of React. `peerDependencies` do not prevent this: they apply when you
install from the registry, not through a symlink.

**How to check.** Both paths should lead to the same file:

```bash
node -p "require.resolve('react')"
node -p "require.resolve('react', { paths: [require('fs').realpathSync('node_modules/@olddevs/ui')] })"
```

**Prefer a published version:** `npm i @olddevs/ui@X.Y.Z`, an exact version with no caret.
If you need a local build, pack it into a tarball (`npm pack` in the kit's repository) and install that:
`npm i ../olddevs_ui/olddevs-ui-X.Y.Z.tgz`. Installing from a tarball puts a real copy
instead of a symlink, so there is no second React.

If you have to keep the symlink, make your bundler resolve React to a single copy. In Vite:

```ts
// vite.config.ts
export default { resolve: { dedupe: ["react", "react-dom"] } };
```

Other bundlers do the same with an alias that points `react` and `react-dom` at the copies in your
app's `node_modules` (in Next.js, `resolve.alias` in the `webpack` function of `next.config.js`). Before
you commit, put the registry version back in `package.json`.
