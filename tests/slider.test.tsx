// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { RangeSlider, Slider } from "../src/components/inputs/Slider.js";

afterEach(cleanup);

test("an arrow moves by step, Shift by a large step", async () => {
  const user = userEvent.setup();
  const onChangeSpy = vi.fn();

  render(
    <Slider
      label="Quality"
      defaultValue={50}
      minValue={0}
      maxValue={100}
      step={5}
      onChange={onChangeSpy}
    />
  );

  const thumb = screen.getByRole("slider", { name: "Quality" });
  thumb.focus();

  await user.keyboard("{ArrowRight}");
  expect(onChangeSpy).toHaveBeenLastCalledWith(55);

  // react-aria computes the large step from the range (10%), not from `step`. Otherwise, on a scale
  // of a thousand units, Shift would not change anything noticeable.
  await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
  const last = onChangeSpy.mock.calls.at(-1)![0] as number;
  expect(last).toBeGreaterThan(60);
});

test("the range ends do not come closer than the minimum gap", async () => {
  const user = userEvent.setup();
  const onChangeSpy = vi.fn();

  render(
    <RangeSlider
      label="Size"
      value={[300, 400]}
      minValue={0}
      maxValue={1000}
      step={100}
      minGap={100}
      onChange={onChangeSpy}
    />
  );

  const ends = screen.getAllByRole("slider");
  ends[0]!.focus();
  await user.keyboard("{ArrowRight}");

  // The step would bring the ends together: "from 400 to 400". The value is CLAMPED, not
  // discarded. Discarding would jam the slider for good once it was ever in a state where the gap
  // was already violated.
  expect(onChangeSpy).toHaveBeenCalledWith([400, 500]);
});

test("from a violated gap the thumb gets out instead of jamming", async () => {
  const user = userEvent.setup();
  const onChangeSpy = vi.fn();

  render(
    <RangeSlider
      label="Size"
      value={[500, 500]}
      minValue={0}
      maxValue={1000}
      step={100}
      minGap={100}
      onChange={onChangeSpy}
    />
  );

  screen.getAllByRole("slider")[1]!.focus();
  await user.keyboard("{ArrowRight}");

  // A "saved filter" with a zero-width range is a valid starting state, and it must be possible to
  // get out of it.
  expect(onChangeSpy).toHaveBeenCalled();
  const [low, high] = onChangeSpy.mock.calls.at(-1)![0] as [number, number];
  expect(high - low).toBeGreaterThanOrEqual(100);
});

test("movement within the gap goes through", async () => {
  const user = userEvent.setup();
  const onChangeSpy = vi.fn();

  render(
    <RangeSlider
      label="Size"
      defaultValue={[300, 900]}
      minValue={0}
      maxValue={1000}
      step={100}
      minGap={100}
      onChange={onChangeSpy}
    />
  );

  screen.getAllByRole("slider")[0]!.focus();
  await user.keyboard("{ArrowRight}");

  expect(onChangeSpy).toHaveBeenCalledWith([400, 900]);
});

/**
 * The baseline for "which end was moved" must not be frozen at `defaultValue`.
 *
 * For an uncontrolled slider, `rest.value` is always `undefined`, and `defaultValue` never changes.
 * After the first movement, the comparison was made against the INITIAL value instead of the
 * previous one, so the wrong end got clamped.
 */
test("an uncontrolled range keeps clamping the thumb that did not move", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();

  render(
    <RangeSlider
      label="Price"
      defaultValue={[300, 900]}
      minGap={100}
      step={100}
      minValue={0}
      maxValue={1000}
      onChange={onChange}
    />
  );

  const thumbs = screen.getAllByRole("slider");

  // First move the LOWER end away from its default. While it is still at 300, the frozen baseline
  // matches the current value, so the discrepancy does not show.
  thumbs[0]!.focus();
  await user.keyboard("{ArrowRight>2/}");

  // Now drag the UPPER end down until it hits the gap.
  thumbs[1]!.focus();
  await user.keyboard("{ArrowLeft>5/}");

  const [low, high] = onChange.mock.calls.at(-1)?.[0] as [number, number];
  expect(high - low).toBe(100);
  // The upper end was moved, so it stays under the finger, and the lower end moves away. With the
  // baseline frozen at `defaultValue`, the check `low !== prevLow` returned TRUE (the lower end had
  // already moved earlier), and the upper end got clamped: it jumped away from where it was being
  // dragged.
  expect(high).toBe(500);
  expect(low).toBe(400);
});

/**
 * Vertical is a behavior, not only a look: the screen reader announces the orientation, and the
 * up/down arrow keys become the primary ones. The test checks that the prop reaches react-aria,
 * rather than living only in CSS.
 */
test("a vertical slider announces its orientation", () => {
  render(<Slider label="Level" defaultValue={65} orientation="vertical" />);

  const thumb = screen.getByRole("slider", { name: "Level" });
  expect(thumb.getAttribute("aria-orientation")).toBe("vertical");
});

test("on a vertical slider up raises the value and down lowers it", async () => {
  const user = userEvent.setup();
  const onChangeSpy = vi.fn();

  render(
    <Slider
      label="Level"
      defaultValue={50}
      minValue={0}
      maxValue={100}
      step={5}
      orientation="vertical"
      onChange={onChangeSpy}
    />
  );

  screen.getByRole("slider", { name: "Level" }).focus();

  // Up means more: the fill grows from the bottom edge, so the arrow key must move the thumb in the
  // same direction the fill points.
  await user.keyboard("{ArrowUp}");
  expect(onChangeSpy).toHaveBeenLastCalledWith(55);
  await user.keyboard("{ArrowDown}{ArrowDown}");
  expect(onChangeSpy).toHaveBeenLastCalledWith(45);

  await user.keyboard("{End}");
  expect(onChangeSpy).toHaveBeenLastCalledWith(100);
  await user.keyboard("{Home}");
  expect(onChangeSpy).toHaveBeenLastCalledWith(0);
});

/**
 * The main risk of the vertical orientation is a slider that accepts the prop and still renders
 * horizontally. That is why `orientation` was removed from the type. The fill size is what the eye
 * sees: a vertical slider sets it by height, a horizontal one by width, and never both at once.
 */
test("the fill grows along the slider's own axis", () => {
  const { container: vertical } = render(
    <Slider label="Level" defaultValue={65} orientation="vertical" />
  );
  const verticalFill = vertical.querySelector<HTMLElement>("[data-fill]")!;
  expect(verticalFill.style.height).toBe("65%");
  expect(verticalFill.style.width).toBe("");
  cleanup();

  const { container: horizontal } = render(<Slider label="Level" defaultValue={65} />);
  const horizontalFill = horizontal.querySelector<HTMLElement>("[data-fill]")!;
  expect(horizontalFill.style.width).toBe("65%");
  expect(horizontalFill.style.height).toBe("");
});

test("a range slider stays horizontal at the type level", () => {
  // Vertical is available only for a single slider: the fill geometry between two ends has not been
  // built for height. A prop that compiles and does nothing is worse than no prop at all.
  // @ts-expect-error — `orientation` is intentionally absent from RangeSlider
  render(<RangeSlider label="Size" defaultValue={[20, 80]} orientation="vertical" />);
  expect(screen.getAllByRole("slider")).toHaveLength(2);
});

/**
 * A disabled slider is dimmed as a whole (OLDSUI-37; for the reason, see `DIMMED_WHEN_DISABLED` in
 * `Slider.tsx`). jsdom does not compute CSS, so the test checks the link between the flag and the
 * look: `data-disabled` on the root, the dimming class bound to it, and `aria-disabled` on the group.
 */
test.each([
  ["Slider", <Slider key="h" label="Level" defaultValue={40} isDisabled />],
  [
    "vertical Slider",
    <Slider key="v" label="Level" defaultValue={40} orientation="vertical" isDisabled />,
  ],
  ["RangeSlider", <RangeSlider key="r" label="Level" defaultValue={[20, 80]} isDisabled />],
])("a disabled %s is dimmed as a whole", (_, element) => {
  render(element);
  const root = screen.getByRole("group");

  expect(root.hasAttribute("data-disabled")).toBe(true);
  expect(root.className.split(" ")).toContain("disabled:opacity-50");
  expect(root.getAttribute("aria-disabled")).toBe("true");
});

test("a consumer's own render still wraps the root", () => {
  // The kit sets `aria-disabled` through `render`. The consumer's own `render` must still run, and
  // must not silently disappear.
  render(
    <Slider
      label="Level"
      defaultValue={40}
      isDisabled
      render={(props) => <div {...props} data-consumer="yes" />}
    />
  );

  const root = screen.getByRole("group");
  expect(root.getAttribute("data-consumer")).toBe("yes");
  expect(root.getAttribute("aria-disabled")).toBe("true");
});

test("the wheel moves the value by one step: up increases, down decreases", () => {
  const onChangeSpy = vi.fn();

  render(<Slider label="Quality" defaultValue={50} step={5} onChange={onChangeSpy} />);

  const group = screen.getByRole("group");
  fireEvent.wheel(group, { deltaY: -100 });
  expect(onChangeSpy).toHaveBeenLastCalledWith(55);

  fireEvent.wheel(group, { deltaY: 100 });
  expect(onChangeSpy).toHaveBeenLastCalledWith(50);
});

test("a disabled slider ignores the wheel", () => {
  const onChangeSpy = vi.fn();
  render(<Slider label="Quality" defaultValue={50} isDisabled onChange={onChangeSpy} />);

  fireEvent.wheel(screen.getByRole("group"), { deltaY: -100 });
  expect(onChangeSpy).not.toHaveBeenCalled();
});

test("at the edge of the scale the wheel is left to the page", () => {
  const onChangeSpy = vi.fn();
  render(<Slider label="Quality" defaultValue={100} onChange={onChangeSpy} />);

  const group = screen.getByRole("group");
  // `fireEvent` returns `false` if the event's default action was cancelled.
  expect(fireEvent.wheel(group, { deltaY: -100 })).toBe(true);
  expect(onChangeSpy).not.toHaveBeenCalled();

  // Scrolling back from the edge moves the value, and the page stays put.
  expect(fireEvent.wheel(group, { deltaY: 100 })).toBe(false);
  expect(onChangeSpy).toHaveBeenLastCalledWith(99);
});

test("the vertical slider follows the wheel in the same direction", () => {
  const onChangeSpy = vi.fn();
  render(<Slider label="Level" orientation="vertical" defaultValue={50} onChange={onChangeSpy} />);

  fireEvent.wheel(screen.getByRole("group"), { deltaY: -100 });
  expect(onChangeSpy).toHaveBeenLastCalledWith(51);
});

test("small trackpad deltas add up to one step", () => {
  const onChangeSpy = vi.fn();
  render(<Slider label="Quality" defaultValue={50} onChange={onChangeSpy} />);

  const group = screen.getByRole("group");
  fireEvent.wheel(group, { deltaY: -15 });
  fireEvent.wheel(group, { deltaY: -15 });
  expect(onChangeSpy).not.toHaveBeenCalled();
  fireEvent.wheel(group, { deltaY: -15 });
  expect(onChangeSpy).toHaveBeenCalledTimes(1);
});

test("the wheel on a range moves the end nearest to the cursor", () => {
  const onChangeSpy = vi.fn();
  render(
    <RangeSlider
      label="Size"
      defaultValue={[200, 800]}
      minValue={0}
      maxValue={1000}
      step={50}
      onChange={onChangeSpy}
    />
  );

  // jsdom does not lay out the page, so the 0–1000 px track is set by hand.
  const track = screen.getAllByRole("slider")[0]!.parentElement!.parentElement!.parentElement!;
  track.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 1000, height: 6, right: 1000, bottom: 6 }) as DOMRect;

  const group = screen.getByRole("group");
  fireEvent.wheel(group, { deltaY: -100, clientX: 750 });
  expect(onChangeSpy).toHaveBeenLastCalledWith([200, 850]);

  fireEvent.wheel(group, { deltaY: -100, clientX: 150 });
  expect(onChangeSpy).toHaveBeenLastCalledWith([250, 850]);
});

test("the wheel on a range keeps the minimum gap", () => {
  const onChangeSpy = vi.fn();
  render(
    <RangeSlider
      label="Size"
      value={[300, 400]}
      minValue={0}
      maxValue={1000}
      step={100}
      minGap={100}
      onChange={onChangeSpy}
    />
  );

  const track = screen.getAllByRole("slider")[0]!.parentElement!.parentElement!.parentElement!;
  track.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 1000, height: 6, right: 1000, bottom: 6 }) as DOMRect;

  fireEvent.wheel(screen.getByRole("group"), { deltaY: -100, clientX: 300 });
  expect(onChangeSpy).toHaveBeenCalledWith([400, 500]);
});

test("Ctrl + wheel is browser zoom and is left alone", () => {
  const onChangeSpy = vi.fn();
  render(<Slider label="Quality" defaultValue={50} onChange={onChangeSpy} />);

  expect(fireEvent.wheel(screen.getByRole("group"), { deltaY: -100, ctrlKey: true })).toBe(true);
  expect(onChangeSpy).not.toHaveBeenCalled();
});

test.each([
  { name: "up moves the upper one", deltaY: -100, expected: [500, 550] },
  { name: "down moves the lower one", deltaY: 100, expected: [450, 500] },
])("equal range ends: scrolling $name", ({ deltaY, expected }) => {
  const onChangeSpy = vi.fn();
  render(
    <RangeSlider
      label="Size"
      defaultValue={[500, 500]}
      minValue={0}
      maxValue={1000}
      step={50}
      onChange={onChangeSpy}
    />
  );

  const track = screen.getAllByRole("slider")[0]!.parentElement!.parentElement!.parentElement!;
  track.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 1000, height: 6, right: 1000, bottom: 6 }) as DOMRect;

  fireEvent.wheel(screen.getByRole("group"), { deltaY, clientX: 500 });
  expect(onChangeSpy).toHaveBeenLastCalledWith(expected);
});

test("a leftover from an old gesture or the opposite direction does not eat the next one", () => {
  vi.useFakeTimers();
  try {
    const onChangeSpy = vi.fn();
    render(<Slider label="Quality" defaultValue={50} onChange={onChangeSpy} />);
    const group = screen.getByRole("group");

    // A partial scroll up, then a pause, and a scroll down immediately produces a step.
    fireEvent.wheel(group, { deltaY: -30 });
    vi.advanceTimersByTime(500);
    fireEvent.wheel(group, { deltaY: 100 });
    expect(onChangeSpy).toHaveBeenCalledTimes(1);
    expect(onChangeSpy).toHaveBeenLastCalledWith(49);

    // A reversal without a pause: the leftover upward delta is not subtracted from the downward one.
    fireEvent.wheel(group, { deltaY: -30 });
    fireEvent.wheel(group, { deltaY: 100 });
    expect(onChangeSpy).toHaveBeenCalledTimes(2);
    expect(onChangeSpy).toHaveBeenLastCalledWith(48);
  } finally {
    vi.useRealTimers();
  }
});

test("the sideways trackpad scroll on a horizontal slider: right increases", () => {
  const onChangeSpy = vi.fn();
  render(<Slider label="Quality" defaultValue={50} onChange={onChangeSpy} />);

  fireEvent.wheel(screen.getByRole("group"), { deltaX: 100, deltaY: 0 });
  expect(onChangeSpy).toHaveBeenLastCalledWith(51);
});

test("wheel lines (Firefox) count as a notch", () => {
  const onChangeSpy = vi.fn();
  render(<Slider label="Quality" defaultValue={50} onChange={onChangeSpy} />);

  // deltaMode 1 means lines: three lines of 16 px each is above the threshold, so it is one notch.
  fireEvent.wheel(screen.getByRole("group"), { deltaY: -3, deltaMode: 1 });
  expect(onChangeSpy).toHaveBeenLastCalledWith(51);
});

test("the wheel ends the change like the keyboard: onChangeEnd fires once per step", () => {
  const onChangeEndSpy = vi.fn();
  render(<Slider label="Quality" defaultValue={50} onChangeEnd={onChangeEndSpy} />);

  fireEvent.wheel(screen.getByRole("group"), { deltaY: -100 });
  expect(onChangeEndSpy).toHaveBeenCalledTimes(1);
  expect(onChangeEndSpy).toHaveBeenLastCalledWith(51);
});
