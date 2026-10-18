"use client";

import type { ComponentType } from "react";
import { Tooltip } from "../../../components/overlays/Tooltip.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon } from "../../../icons.js";
import { buttonClasses } from "../../../lib/button.js";
import type { ImageAlign } from "./imageLayout.js";

/** The three positions in the order of the group: the centre is the absence of a side. */
const POSITIONS: readonly { align: ImageAlign | null; icon: ComponentType<{ size?: number }> }[] = [
  { align: "left", icon: AlignLeftIcon },
  { align: null, icon: AlignCenterIcon },
  { align: "right", icon: AlignRightIcon },
];

/**
 * The image's three alignment toggles: left, centre, right (ADR-0081). The image panel and the "Edit
 * image" popover draw the same group, so it lives here.
 *
 * Toggle buttons with `aria-pressed`, like the width presets next to them, but exactly one is always
 * pressed: pressing the pressed one again keeps it (the centre is a position too, not "no choice").
 * The icons are the text alignment glyphs; the name says what is different about an image, that the
 * text wraps around it. `disabled` is for a table cell, where there is no room to wrap (ADR-0081, decision 7).
 */
export function ImageAlignGroup({
  value,
  onChange,
  disabled,
  variant,
}: {
  value: ImageAlign | null;
  onChange: (align: ImageAlign | null) => void;
  disabled: boolean;
  variant: "ghost" | "outline";
}) {
  const messages = useMessages().editor;
  const names = {
    left: messages.imageAlignLeft,
    center: messages.imageAlignCenter,
    right: messages.imageAlignRight,
  };
  return (
    <div role="group" aria-label={messages.imageAlign} className="flex gap-0.5">
      {POSITIONS.map(({ align, icon: Icon }) => {
        const name = names[align ?? "center"];
        return (
          <Tooltip key={align ?? "center"} content={name}>
            <button
              type="button"
              aria-label={name}
              aria-pressed={value === align}
              disabled={disabled}
              onClick={() => onChange(align)}
              className={buttonClasses({
                variant,
                size: "sm",
                iconOnly: true,
                selected: value === align,
              })}
            >
              <Icon size={16} aria-hidden />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
