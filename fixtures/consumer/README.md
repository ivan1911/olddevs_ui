# Consumer fixture

A Next.js App Router app that checks the package works from the outside. Run it from the repository root:

```bash
npm run check:consumer
```

The package is installed as a **tarball** from `npm pack`, not as an alias to `src`. An alias would test the source, not what goes to the registry, and it would stay green regardless of what is in the package.

The build proves:

- a kit component is imported directly into a server component, with no wrapper;
- pure utilities (`cn`, `tableStateToParams`) run on the server;
- component classes reach the consumer's CSS through `@source`;
- the subpath `@olddevs/ui/editor` works from a server component. The `/editor` page cleans the document with `sanitizeRichText` (DOMPurify on jsdom), highlights it with `highlightCodeBlocks`, and renders `RichTextView` with a code block. The script reads the prerendered HTML and requires the highlight tokens and the "Копировать" island, with no fake markup from the document. The page's `First Load JS` keeps its own budget (without the `@olddevs/ui/editor` entry in `optimizePackageImports`, it is 435 kB instead of 137);
- `RichTextEditor` with the `full` preset renders directly from a server component (page `/rich-text-editor`). The lazy chunks for the code block and the table are built from `dist` as separate files, and the page's `First Load JS` keeps its own budget;
- the setup from [`docs/getting-started.md`](../../docs/getting-started.md) works word for word. Any mismatch between the docs and the fixture breaks the build.

The `Alert` on the page is a probe for a lost `"use client"`. It calls a hook in its body. Without the directive, the build fails with the message "useMessages is on the client". A `Button` alone is **not enough** for such a probe. It has no hooks, so without the directive it would silently render on the server. This was verified with a deliberate break, not by assumption.

The fixture installs the optional editor peer dependencies (Tiptap, `lowlight`, `highlight.js`, `marked`) itself, with one command from the `RichTextEditor` page, as a real consumer of the subpath would. `dompurify` and `jsdom` are the server sanitizer. The kit does not install it either.

The fixture has its own dependencies and its own `package.json`: they do not go into the kit's `package.json`. The promise "one direct dependency and twelve peers" still holds. The kit itself is **not declared** in the fixture's dependencies. It is installed with `--no-save`, so the lock file is not rewritten on every release.

The decision and the measurements are in ADR-0029.
