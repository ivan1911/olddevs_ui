// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Button } from "../src/components/actions/Button.js";
import { DragHandleIcon } from "../src/icons.js";

afterEach(cleanup);

/*
  AN ICON INSIDE A BUTTON MUST NOT BE A SEPARATE HIT TARGET.

  jsdom does not model hit testing, so this checks the rule, not the behavior: a guard
  against the class being removed as "dead". The real defect the rule was written for
  reproduced on an `EditableList` row with an action: a click on the icon's drawing gave
  both the button and the row action, because `event.target` was the `<svg>`, and
  react-aria checks the click target without walking up the ancestors.
*/
test("the icon inside a button is not a hit target of its own", () => {
  render(<Button icon={<DragHandleIcon size={12} />} iconOnly aria-label="Drag" />);

  expect(screen.getByRole("button", { name: "Drag" }).className).toContain(
    "[&_svg]:pointer-events-none"
  );
});
