"use client";

import type { ReactNode } from "react";
import {
  ColorArea,
  ColorPicker as AriaColorPicker,
  ColorField,
  ColorSlider,
  ColorSwatch,
  ColorSwatchPicker,
  ColorSwatchPickerItem,
  ColorThumb,
  parseColor,
  Input,
  Label,
  SliderTrack,
  type Color,
} from "react-aria-components";
import { useMessages } from "../../i18n/useMessages.js";
import { useDescribedBy } from "../../hooks/useFieldDescription.js";
import { cn } from "../../lib/cn.js";
import { FIELD_SHELL_CLASS } from "../../lib/field.js";
import { Popover, PopoverContent, PopoverTrigger } from "../overlays/Popover.js";

export interface ColorPickerProps {
  /** Current color as a string: `#4f7df3`, `rgb(...)`, `hsl(...)`. */
  value: string;
  /** Called when the color changes, with a string in the `outputFormat` format. */
  onChange: (value: string) => void;
  /** Field label. Required: a screen reader announces an unnamed control by its role alone. */
  label: string;
  /**
   * Presets below the color area.
   *
   * There is no default on purpose: a set of "brand" colors is the consumer's domain, not
   * the kit's. The theme's token values are passed here by whoever knows which of them
   * apply to their entity.
   *
   * An unrecognized preset is **skipped** rather than breaking the render. This is not the
   * same as silently editing `value`: the consumer stores the value and passes it on, but a
   * preset is decoration, and the component must not fall over because of decoration.
   * The library throws on an unrecognized string **in the render phase**, which means it
   * takes the consumer's whole subtree down with it.
   */
  presets?: string[];
  /**
   * Format of the string the component passes to `onChange`.
   *
   * The input field under the sliders stays **always hexadecimal**, and this is named in
   * the prop's name. `rgb` and `hsl` are not one field but three channel fields, that is, a
   * different control, not a different format of the same one. The field's label is
   * therefore always `HEX` too: labeling it "HSL" while accepting hex would be lying to the
   * user right on screen.
   */
  outputFormat?: "hex" | "rgb" | "hsl";
  /** Disables the trigger button: the color picker panel does not open. */
  disabled?: boolean;
  /** Content of the trigger button, instead of the swatch with a label. */
  children?: ReactNode;
  /** Classes on the trigger button. */
  className?: string;
}

/**
 * Presets that the library can actually parse.
 *
 * `parseColor` throws on an unrecognized string, and the throw happens in the render phase.
 * And the breakage is not an exotic edge case: `rebeccapurple` is a legitimate CSS color that
 * the library does not take, while keeping a brand palette as names is perfectly natural.
 */
function parsablePresets(presets: string[] | undefined): string[] {
  if (!presets) return [];
  /*
    Duplicates are removed along the way, for the React key rather than for the picture.
    `ColorSwatchPicker` itself collapses identical colors, so the repeat is not visible on
    screen anyway, while `key={preset}` on it would give two nodes with one key.
    No separate test checks this: there is no observable difference.
  */
  return [...new Set(presets)].filter((preset) => {
    try {
      parseColor(preset);
      return true;
    } catch {
      return false;
    }
  });
}

const AREA_CLASS = "h-[132px] w-full rounded-md";
const THUMB_CLASS =
  "h-4 w-4 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]";

/**
 * Custom color picker.
 *
 * A WRAPPER, NOT ITS OWN COLOR MATH. Color space conversions, string parsing, accessible
 * descriptions of hues for screen readers, and keyboard handling of the two-dimensional
 * area are all already in `react-aria-components` (publicly available since 1.4.0). Here
 * there is only a token dictionary on top and the layout.
 *
 * THE COMPONENT RETURNS A COLOR OUTSIDE THE TOKEN SYSTEM, and that is its purpose, not an
 * oversight. Everything else in the kit takes its color from the theme. Here the user names
 * their own color, and the result by construction obeys neither the theme nor the brand.
 * It follows that the kit does not check, and cannot check, the contrast of the chosen
 * color: it does not know what this color will sit on.
 *
 * IT LIVES IN A SEPARATE ENTRY, `@olddevs/ui/color`, not in the barrel. The RAC color
 * subsystem weighs 61 kB gzip, as much as the rest of the kit. The reasoning is in ADR-0038
 * and in the JSDoc of `src/color.ts`.
 *
 * ON INPUT AND ON OUTPUT IT IS A STRING, not the library's `Color` object. The object would leak the
 * RAC type into the consumer's signatures and state. The string is what the component stores
 * anyway, and what it sends to the server.
 *
 * AN UNRECOGNIZED STRING IN `value` BECOMES BLACK. This is react-aria's behavior, and the
 * kit does not intercept it: silently replacing someone else's value is the same as silently
 * fixing it. But the consequence is worth knowing. The first movement of a slider gives
 * `onChange` black, that is, it replaces the unrecognized value with a recognized one.
 * Validating the string is the consumer's job, since they are the one who formed it.
 */
export function ColorPicker({
  value,
  onChange,
  label,
  presets,
  outputFormat = "hex",
  disabled = false,
  children,
  className,
}: ColorPickerProps) {
  const messages = useMessages();
  const describedBy = useDescribedBy(undefined);
  const swatches = parsablePresets(presets);

  return (
    <AriaColorPicker
      value={value}
      onChange={(color: Color) => onChange(color.toString(outputFormat))}
    >
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            /*
              The name sits on the button unconditionally, not drawn as a label inside. With
              `children`, the label goes nowhere, and the button would stay unnamed, which is
              exactly what the `label` JSDoc declares unacceptable.
            */
            aria-label={label}
            {...(describedBy ? { "aria-describedby": describedBy } : {})}
            className={cn(
              FIELD_SHELL_CLASS,
              "flex cursor-pointer items-center gap-2 px-2.5 py-1.5",
              "disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
          >
            {children ?? (
              <>
                <ColorSwatch className="border-line rounded-2xs h-[18px] w-[18px] shrink-0 border" />
                <span className="text-fg-0 text-[13px]">{label}</span>
              </>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-[268px] p-3">
          <div className="flex flex-col gap-2.5">
            <ColorArea
              colorSpace="hsb"
              xChannel="saturation"
              yChannel="brightness"
              className={AREA_CLASS}
            >
              <ColorThumb className={THUMB_CLASS} />
            </ColorArea>

            <ColorSlider colorSpace="hsb" channel="hue">
              <SliderTrack className="h-3 w-full rounded-full">
                <ColorThumb className={cn(THUMB_CLASS, "top-1/2")} />
              </SliderTrack>
            </ColorSlider>

            <ColorField className="flex items-center gap-2">
              <Label className="text-fg-2 text-caption">{messages.colorPicker.hex}</Label>
              <Input
                data-disable-focus-ring="true"
                className={cn(
                  FIELD_SHELL_CLASS,
                  "text-fg-0 min-w-0 flex-1 px-2 py-1 text-[13px] outline-none"
                )}
              />
            </ColorField>

            {swatches.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-fg-2 text-caption">{messages.colorPicker.presets}</span>
                <ColorSwatchPicker className="flex flex-wrap gap-1.5">
                  {swatches.map((preset) => (
                    <ColorSwatchPickerItem
                      key={preset}
                      color={preset}
                      className="focus-visible:outline-accent-strong selected:ring-accent-strong selected:ring-2 selected:ring-offset-1 rounded-2xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      <ColorSwatch className="border-line rounded-2xs h-[22px] w-[22px] border" />
                    </ColorSwatchPickerItem>
                  ))}
                </ColorSwatchPicker>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </AriaColorPicker>
  );
}
