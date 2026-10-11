import type * as PopoverPrimitive from "@radix-ui/react-popover";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ComponentPropsWithoutRef } from "react";
import { describe, expect, expectTypeOf, test } from "vitest";
import type { HoverCardTriggerProps, PopoverContentProps } from "../src/index.js";

/**
 * The positioning props of `PopoverContent` and `HoverCardContent` come from
 * Radix, which ships no JSDoc for them: the Reference tables showed 26 rows
 * without a description. The kit redeclares them with its own documentation, and
 * these tests keep two promises: every such prop is documented, and the types
 * stay the same as Radix's, so a consumer who passes Radix props never gets a
 * new compile error.
 */
const source = (file: string) =>
  readFileSync(join(import.meta.dirname, "../src/components/overlays", file), "utf8");

/** A property is documented when a JSDoc block ends on the line right above its declaration. */
function documented(text: string, prop: string): boolean {
  return new RegExp(`\\*/\\s*\\n\\s*${prop}\\??:`).test(text);
}

const CONTENT_PROPS = [
  "asChild",
  "side",
  "sideOffset",
  "align",
  "alignOffset",
  "arrowPadding",
  "avoidCollisions",
  "collisionBoundary",
  "collisionPadding",
  "sticky",
  "hideWhenDetached",
  "updatePositionStrategy",
];

describe("positioning props of the popover panel", () => {
  test.each(CONTENT_PROPS)("PopoverContentProps documents %s", (prop) => {
    expect(documented(source("Popover.tsx"), prop)).toBe(true);
  });

  test.each(["asChild", "virtualRef"])("HoverCardTriggerProps documents %s", (prop) => {
    expect(documented(source("HoverCard.tsx"), prop)).toBe(true);
  });

  test("the types of the redeclared props are exactly Radix's", () => {
    type Radix = ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>;
    expectTypeOf<PopoverContentProps["side"]>().toEqualTypeOf<Radix["side"]>();
    expectTypeOf<PopoverContentProps["align"]>().toEqualTypeOf<Radix["align"]>();
    expectTypeOf<PopoverContentProps["collisionPadding"]>().toEqualTypeOf<
      Radix["collisionPadding"]
    >();
    expectTypeOf<PopoverContentProps["collisionBoundary"]>().toEqualTypeOf<
      Radix["collisionBoundary"]
    >();
    expectTypeOf<PopoverContentProps["sticky"]>().toEqualTypeOf<Radix["sticky"]>();
    expectTypeOf<PopoverContentProps["updatePositionStrategy"]>().toEqualTypeOf<
      Radix["updatePositionStrategy"]
    >();
    expectTypeOf<Radix>().toMatchTypeOf<PopoverContentProps>();
    expectTypeOf<PopoverContentProps>().toMatchTypeOf<Radix>();
  });

  test("HoverCardTriggerProps still takes the Radix anchor props", () => {
    expectTypeOf<HoverCardTriggerProps["virtualRef"]>().toEqualTypeOf<
      ComponentPropsWithoutRef<typeof PopoverPrimitive.Anchor>["virtualRef"]
    >();
  });
});
