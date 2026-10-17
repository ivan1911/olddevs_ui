/**
 * Shell of an input field: border, focus and disabled state.
 *
 * Extracted from `TextControl` when `NumberInput` appeared, a second component
 * with the same shell. Copy-pasting these lines would make them drift apart. In the
 * frontend app, before the package existed, that is exactly what happened: five
 * hand-written search fields painted focus in `--tg`, while ordinary fields through
 * `TextControl` used `--accent-strong`, and the mismatch could only be seen by opening
 * the five files side by side.
 *
 * IMPORTANT about the `+` concatenation below: it is safe, and it is not the same thing
 * that `variants.ts` forbids. Tailwind scans the sources as TEXT and looks for class
 * candidates in it. Every class name here appears in the file in full, inside a literal,
 * and `+` only joins finished strings. What is forbidden is building the class NAME itself
 * (`` `hover:${t.bg}` ``): that text does not exist in the file, and it never reaches the
 * CSS, silently, with no build error. `tests/class-coverage.test.ts` guards this.
 */

import { INVALID_BORDER_CLASS } from "./variants.js";

/**
 * The border lives on the shell, not on the field itself. The split is not cosmetic:
 * it lets you put an icon or a counter inside without fighting the browser's own
 * styling of the field.
 *
 * The focus highlight goes through `focus-within`, and the color comes from `--accent-strong`,
 * not `--accent`: the focus indicator is non-text and sits below the 3:1 threshold, while
 * `--accent` is designed for white text on top of it.
 *
 * The disabled state dims the SHELL, not the field: `disabled:opacity-50` on the field itself
 * would dim only the text and leave the border as bright as in a neighboring enabled field.
 *
 * The selector targets the field itself (`has-[input:disabled]`, `has-[textarea:disabled]`),
 * not any disabled descendant (`has-[:disabled]`, as it was before `NumberInput` appeared).
 * The difference is not theoretical. The number field's shell holds two more buttons, the
 * step buttons, and at the `min`/`max` boundary one of them is legitimately disabled. The old
 * selector dimmed the whole field, value included, because of that button. An audit with axe
 * caught it: the inherited transparency dropped the value's contrast from 4.5 to 4.07.
 *
 * AN INVALID STATE PAINTS THE SAME SHELL, AND IT HAS TWO SOURCES. On react-aria controls the
 * flag sits as a `data-invalid` attribute on the shell itself, and the `invalid:` variant from
 * the plugin picks it up. On fields built on native `input`/`textarea`, the shell is a plain
 * `div` with nothing to hook into: there the flag lives on the field as `aria-invalid`, and the
 * shell reaches it through `has-`. One selector was not enough. Before this change,
 * `INVALID_BORDER_CLASS` was declared but applied in exactly one place, by hand in `NumberInput`,
 * so `TextControl`, `Combobox`, `TagInput`, and the one built on the first `SearchControl`
 * could not show an error at all.
 *
 * The order in the string matters: `invalid:` comes AFTER `focus-within:`, so a focused field
 * with an error keeps its border red. The number field behaved this way before the rule moved
 * here, and that order should not change as a side effect of the move.
 */
export const FIELD_SHELL_CLASS =
  "border-line bg-bg-2 rounded-control border px-3 shadow-[var(--shadow-1)] " +
  "transition-[border-color,box-shadow] duration-150 " +
  "focus-within:border-accent-strong focus-within:ring-[3px] focus-within:ring-[color:var(--focus-ring)] " +
  INVALID_BORDER_CLASS +
  " has-[input[aria-invalid=true]]:border-danger-strong " +
  "has-[textarea[aria-invalid=true]]:border-danger-strong " +
  "has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50 " +
  "has-[textarea:disabled]:cursor-not-allowed has-[textarea:disabled]:opacity-50";

/**
 * The field itself is reset completely: without this, Safari and Chrome render it differently.
 * The global `:focus-visible` rule in `styles.css` is switched off by the `data-disable-focus-ring`
 * attribute on the element. An outline around the field would be redundant here, because the
 * shell provides the highlight.
 *
 * `leading-5` is not cosmetic. It is the declared line-box height of the control, and it also
 * holds the total height at 42px: `20 + 2×10 padding + 2 border`. Without it the box came from the
 * inherited `1.5` multiplier at `text-[13px]`, that is 19.5px, and the field was 41.5px. The number
 * is arbitrary and nothing else can match it: the `Select` trigger with a 22px icon came out at 44px
 * and was off from the neighboring field by a couple of pixels. Now the height is set, not derived,
 * and `Select` arrived at the same 42, with the same `leading-5` on its trigger.
 *
 * Caveat: the declaration holds only until a consumer passes its own font size. `cn` is `twMerge`,
 * and a foreign `text-*` in `className` displaces the whole `text-[13px] leading-5` pair. With the
 * size steps of the scale this is harmless, because they have their own line box (`text-sm` is the
 * same 13/20). But an arbitrary `text-[15px]` returns the height to the one derived from the multiplier.
 */
export const FIELD_INPUT_CLASS =
  "text-fg-0 w-full [appearance:none] border-0 bg-transparent px-0 py-[10px] text-[13px] leading-5 " +
  "shadow-none outline-none [-webkit-tap-highlight-color:transparent] " +
  "focus:border-0 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none " +
  "disabled:cursor-not-allowed";

/**
 * Compact size of the field: 36 pixels instead of 42.
 *
 * ONE VALUE, THE VERTICAL PADDING, AND NOTHING ELSE: border, radius, shadow, font and line box
 * stay the same. `20 + 2×7 + 2 = 36` is exactly the height of `Button size="md"` and of the
 * `Select` pill trigger, that is, a number the kit has already picked on its own twice. In a
 * single row of a control bar, the field used to fall out of line by itself.
 *
 * WHY A SIZE AT ALL, IF THE HEIGHT IS ALREADY REACHABLE. It is reachable: `className` goes to the
 * end of `cn(FIELD_INPUT_CLASS, …, className)`, and `cn` is `twMerge`, so `py-0` from outside
 * displaces `py-[10px]`. That is exactly how two consumers did it, with two different numbers (34
 * and 36) and two different fonts. The argument is the same as for `SearchControl` itself: five
 * hand-written search fields in the frontend painted focus in the wrong color, and that could only
 * be seen by opening the five files side by side.
 *
 * The hit area stays above the threshold: 36 is one and a half times the minimum WCAG 2.5.8 target size.
 */
export const FIELD_INPUT_COMPACT_CLASS = "py-[7px]";

/**
 * Clear button inside the field shell.
 *
 * Extracted when `TreeSelect` wrote it a third time, copying `Select` character for character.
 * They would have drifted apart silently: both are a × icon in the corner of the field, and only
 * someone who placed them side by side would notice the difference.
 *
 * `relative` and `z-10` are not cosmetic. The field trigger has a stretched pseudo-element that
 * forms its hit zone, and without the lift a click on the × would open the list instead of clearing.
 */
export const FIELD_CLEAR_CLASS =
  "bg-bg-3 text-fg-2 hover:text-fg-0 focus-visible:outline-accent-strong relative z-10 flex h-4 w-4 " +
  "shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2";
