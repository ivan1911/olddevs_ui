"use client";

import type { CustomIslandProps } from "@olddevs/ui/editor";
import { useState } from "react";

/**
 * The Island of a custom Block: a consumer client component from a module with
 * the directive. The `/editor` server page gets only a reference to it from the
 * import and passes that reference in the View's `tools`.
 */
export function FixtureBadge({ attributes, text }: CustomIslandProps) {
  const [on, setOn] = useState(false);
  return (
    <button type="button" aria-pressed={on} onClick={() => setOn(!on)}>
      {attributes.fixture_label ?? text}
    </button>
  );
}
