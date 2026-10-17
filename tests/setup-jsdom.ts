/**
 * jsdom polyfills. Without them, react-aria crashes on its own internals.
 *
 * jsdom has no `CSS.escape` at all, and react-aria calls it to build selectors for collection
 * navigation: any input in `Combobox`, `CommandPalette` or `Table` fails the test with
 * "Cannot read properties of undefined (reading 'escape')". This is a gap in the ENVIRONMENT,
 * not in component behavior. Moving the test to a browser to work around it (ADR-0012) would
 * push checks there that run perfectly well at level 0.
 *
 * The implementation matches the spec: everything is escaped except letters, digits, hyphens and
 * underscores. The full version is more involved (code points, a leading digit), but our
 * collection keys are made only of these characters.
 */
const g = globalThis as { CSS?: { escape?: (value: string) => string } };
g.CSS ??= {};
g.CSS.escape ??= (value: string) => String(value).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);

/**
 * `Range` geometry for ProseMirror.
 *
 * After focus, the Editor (`@olddevs/ui/editor`) scrolls the selection into view and measures it
 * with `Range.getClientRects()`. jsdom has no layout, and `Range` has none of these methods at
 * all, so the call fails after the test has finished, in the next frame, as an unhandled error.
 * An empty list of rectangles is an honest answer from an environment without layout, and
 * ProseMirror handles it.
 *
 * The check uses `typeof`: there is no `Range` class in the node environment.
 */
if (typeof Range !== "undefined") {
  Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect ??= () => new DOMRect();
}
