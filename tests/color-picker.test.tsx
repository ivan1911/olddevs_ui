// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { ColorPicker } from "../src/components/inputs/ColorPicker.js";

/*
  Shim for `CSS.escape`, the same one as in `menu.test.tsx`: the react-aria popover
  calls it on open, and jsdom has no `CSS` object.
*/
if (typeof globalThis.CSS === "undefined")
  (globalThis as unknown as { CSS: { escape: (v: string) => string } }).CSS = {
    escape: (value: string) => String(value).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`),
  };

afterEach(cleanup);

function Brand({
  initial = "#4f7df3",
  presets,
  outputFormat,
  disabled = false,
  onValue = () => {},
}: {
  initial?: string;
  presets?: string[];
  outputFormat?: "hex" | "rgb" | "hsl";
  disabled?: boolean;
  onValue?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <ColorPicker
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
      label="Brand colour"
      presets={presets}
      outputFormat={outputFormat}
      disabled={disabled}
    />
  );
}

const trigger = () => screen.getByRole("button", { name: /Brand colour/ });

test("the trigger carries the label", () => {
  render(<Brand />);
  expect(trigger()).toBeTruthy();
});

/*
  In and out, the value is a string, not the library's `Color` object: the object
  would leak the RAC type into the consumer's state and into its signatures.
*/
test("the value goes out as a string in the requested format", async () => {
  const user = userEvent.setup();
  const onValue = vi.fn();
  render(<Brand outputFormat="rgb" onValue={onValue} />);

  await user.click(trigger());
  // There are several sliders: the saturation area and the hue strip. Take the
  // last one, the strip, because it is the most predictable to move.
  const sliders = await screen.findAllByRole("slider");
  (sliders.at(-1) as HTMLElement).focus();
  await user.keyboard("{ArrowRight}");

  expect(onValue).toHaveBeenCalled();
  const [next] = onValue.mock.calls.at(-1) as [string];
  expect(typeof next).toBe("string");
  expect(next.startsWith("rgb")).toBe(true);
});

test("the two-dimensional area and the hue slider are both reachable", async () => {
  const user = userEvent.setup();
  render(<Brand />);

  await user.click(trigger());
  // Two sliders: the two-dimensional saturation and brightness area, one control
  // with two axes, and the hue strip, the second. The roles come from react-aria
  // rather than being written here.
  expect(await screen.findAllByRole("slider")).toHaveLength(2);
});

/*
  There is no default for presets on purpose: the set of brand colours belongs to
  the consumer's domain. Without the prop the row must not render at all, not render empty.
*/
test("presets appear only when the consumer supplies them", async () => {
  const user = userEvent.setup();
  const { unmount } = render(<Brand />);

  await user.click(trigger());
  expect(screen.queryByText("Presets")).toBeNull();
  unmount();

  render(<Brand presets={["#e11d48", "#16a34a"]} />);
  await user.click(trigger());
  expect(await screen.findByText("Presets")).toBeTruthy();
});

test("a preset can be chosen and reports the new value", async () => {
  const user = userEvent.setup();
  const onValue = vi.fn();
  render(<Brand presets={["#e11d48", "#16a34a"]} onValue={onValue} />);

  await user.click(trigger());
  const swatches = await screen.findAllByRole("option");
  await user.click(swatches[1] as HTMLElement);

  expect(onValue).toHaveBeenCalled();
});

/*
  The input is always hexadecimal, and the label says so: `outputFormat` changes
  only the string that goes out. Labelling the field "HSL" while it accepts hex
  would lie to the user right on the screen.
*/
test("the input stays hexadecimal whatever the output format is", async () => {
  const user = userEvent.setup();
  render(<Brand outputFormat="hsl" />);

  await user.click(trigger());
  expect(await screen.findByText("HEX")).toBeTruthy();
  expect((screen.getByRole("textbox") as HTMLInputElement).value.startsWith("#")).toBe(true);
});

/*
  A disabled picker does not expand. The check exists because without it,
  removing the attribute from the trigger would fail no test: periphery
  components have no snapshots.
*/
test("a disabled picker does not open", async () => {
  const user = userEvent.setup();
  render(<Brand disabled />);

  expect(trigger().hasAttribute("disabled")).toBe(true);
  await user.click(trigger());
  expect(screen.queryByRole("slider")).toBeNull();
});

/*
  An unreadable string becomes black. This is react-aria's behavior, and the kit
  does not intercept it. But the consequence is worth pinning down: the first
  slider movement emits black, which replaces the value that was not understood
  with one that is.
*/
test("an unparsable value falls back to black instead of throwing", async () => {
  const user = userEvent.setup();
  const onValue = vi.fn();
  render(<Brand initial="not-a-colour" onValue={onValue} />);

  await user.click(trigger());
  const sliders = await screen.findAllByRole("slider");
  (sliders.at(-1) as HTMLElement).focus();
  await user.keyboard("{ArrowRight}");

  expect(onValue).toHaveBeenCalled();
});

/*
  `label` is required precisely because a screen reader announces an unnamed
  control as an empty word. It used to render only in the default branch, so
  passing `children`, the very reason the prop exists, left the button without
  a name. axe did not catch this: there is no story with `children`.
*/
test("the trigger keeps its name when children replace the default content", () => {
  render(
    <ColorPicker value="#4f7df3" onChange={() => {}} label="Brand colour">
      <span aria-hidden>🎨</span>
    </ColorPicker>
  );
  expect(screen.getByRole("button", { name: "Brand colour" })).toBeTruthy();
});

/*
  The library throws on a string it does not understand, and the throw happens
  during render, so it takes the consumer's whole subtree down with it. This is
  not an exotic case: `rebeccapurple` is a valid CSS colour that the library does
  not parse, and it is entirely natural to keep a brand palette in names.
*/
test("an unparsable preset is skipped instead of taking the render down", async () => {
  const user = userEvent.setup();
  render(<Brand presets={["#e11d48", "rebeccapurple", "not-a-colour", "#16a34a"]} />);

  await user.click(trigger());
  // Only the two parsed ones remain; the presets row itself is still rendered.
  expect(await screen.findAllByRole("option")).toHaveLength(2);
});

test("presets that are all unparsable hide the row rather than leave it empty", async () => {
  const user = userEvent.setup();
  render(<Brand presets={["nope", "also-nope"]} />);

  await user.click(trigger());
  expect(screen.queryByText("Presets")).toBeNull();
});
