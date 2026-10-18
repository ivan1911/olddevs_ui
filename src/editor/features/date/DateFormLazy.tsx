"use client";

import { lazy, Suspense, type ReactNode } from "react";
import type { DateFormProps } from "./DateForm.js";

/*
  The popover form is a separate chunk (ADR-0079, item 4): it brings the `Calendar` and react-aria
  with it, and a Document without a date mention to insert or edit must not pay for them. The
  Tool's node and its Slash menu item stay in the start bundle; this file is their only door to the
  form, and `import()` is the border of the chunk.
*/
const LazyDateForm = lazy(() =>
  import("./DateForm.js").then((chunk) => ({ default: chunk.DateForm }))
);

/**
 * The form in a `Suspense` boundary. The fallback holds the size of the calendar, so that the
 * popover, which has already opened at the caret, does not jump when the chunk arrives.
 */
export function renderDateForm(props: DateFormProps): ReactNode {
  return (
    <Suspense fallback={<div aria-busy="true" className="h-80 w-72 max-w-full" />}>
      <LazyDateForm {...props} />
    </Suspense>
  );
}
