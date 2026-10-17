/**
 * The look of a tag: one pill shared by `TagGroup` and the tags inside `TagInput`.
 *
 * Extracted once a tag showed up in a second place. A user should recognize a tag
 * as one concept, and two hand-written copies of these strings would drift apart
 * on the first padding change, silently.
 *
 * No template interpolation in these strings: Tailwind scans the sources as plain
 * text, and each class has to appear in the file in full (`tests/class-coverage.test.ts`).
 */

/**
 * The tag pill.
 *
 * The right padding depends on the remove button: react-aria sets
 * `data-allows-removing` on a tag that has one. Without the button the padding is
 * symmetric, `pr-2.5`; with it, `pr-1`. Otherwise the × would sit twice as far from
 * the edge as the label sits from the left.
 *
 * The focus ring is accent-colored and offset: tags sit tightly in the flow, and a
 * ring without the offset would eat into the neighboring tags.
 */
export const TAG_CLASS =
  "bg-bg-3 text-fg-1 flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm outline-none " +
  "data-[allows-removing]:pr-1 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent-strong)]";

/** The remove button inside a tag. */
export const TAG_REMOVE_CLASS =
  "text-fg-3 hover:text-fg-0 flex cursor-pointer items-center rounded-full p-0.5 outline-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--accent-strong)]";
