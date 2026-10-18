"use client";

import { RICH_TEXT_SCHEMA } from "../../core/schema.js";

/*
  The two attributes that place an image: the width preset and the side it floats to (ADR-0081). They
  are not independent, so every path that changes one of them (the commands, the panel, the popover,
  the handles, the parse of incoming HTML) goes through `layoutOf`, and the rules live in one place.
  Pure data and functions: the module has no engine, so the panel, the popover and the tests share it.
*/

/** Image width: a preset from the Schema, or `null` for a custom size no wider than the Document. */
export type ImageWidth = (typeof RICH_TEXT_SCHEMA.imageWidths)[number];

/** The side an image floats to; `null` is the centre, a line of its own. */
export type ImageAlign = (typeof RICH_TEXT_SCHEMA.imageAlignments)[number];

export const IMAGE_WIDTHS: readonly ImageWidth[] = RICH_TEXT_SCHEMA.imageWidths;

export const IMAGE_ALIGNMENTS: readonly ImageAlign[] = RICH_TEXT_SCHEMA.imageAlignments;

/** The width an image gets when it is aligned without a width that leaves room for the text. */
export const ALIGNED_DEFAULT_WIDTH: ImageWidth = "50";

/** The widest preset: a full-width image has no room for the text beside it. */
const FULL_WIDTH: ImageWidth = "100";

/** The presets an aligned image can have: every one but the full width. */
export const ALIGNED_WIDTHS: readonly ImageWidth[] = IMAGE_WIDTHS.filter(
  (width) => width !== FULL_WIDTH
);

/** Width from an attribute: only a Schema preset is accepted; anything else means "not set". */
export function widthOf(value: unknown): ImageWidth | null {
  return IMAGE_WIDTHS.find((width) => width === value) ?? null;
}

/** Alignment from an attribute: `left` or `right`; the centre, an unknown value and `null` give `null`. */
export function alignOf(value: unknown): ImageAlign | null {
  return IMAGE_ALIGNMENTS.find((align) => align === value) ?? null;
}

export interface ImageLayout {
  width: ImageWidth | null;
  align: ImageAlign | null;
}

/**
 * The layout after a change, with the rules of ADR-0081 applied.
 *
 * Text wraps only around an image narrower than the Document, so an aligned image always has one of
 * the narrower presets:
 * - Left or Right on an image at its own size or at 100% sets 50%, in the same edit;
 * - 100% on an aligned image is the centre again, not an aligned image that the text cannot wrap;
 * - clearing the width of an aligned image leaves 50%, because its own size may be as wide as the Document.
 *
 * `change` holds only what the author touched: a missing key keeps the current value.
 */
export function layoutOf(current: ImageLayout, change: Partial<ImageLayout>): ImageLayout {
  const width = widthOf("width" in change ? change.width : current.width);
  let align = alignOf("align" in change ? change.align : current.align);
  // The width the author just chose is stronger than the side they chose earlier.
  if (width === FULL_WIDTH && "width" in change && !("align" in change)) align = null;
  if (!align) return { width, align: null };
  return { width: width === null || width === FULL_WIDTH ? ALIGNED_DEFAULT_WIDTH : width, align };
}
