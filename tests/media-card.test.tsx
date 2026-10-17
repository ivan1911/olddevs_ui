// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { MediaCard } from "../src/components/content/MediaCard.js";

afterEach(cleanup);

const preview = <div data-testid="preview">image</div>;

test("without selection props the selection axis is absent from the markup", () => {
  render(<MediaCard preview={preview} title="Frame" />);

  // A tile that does everything at once drags non-working markup into the DOM.
  expect(screen.queryByRole("button")).toBeNull();
});

test("selection is announced by state, not by a border", async () => {
  const user = userEvent.setup();
  const onSelectedChange = vi.fn();
  const { rerender } = render(
    <MediaCard preview={preview} selected={false} onSelectedChange={onSelectedChange} />
  );

  const button = screen.getByRole("button", { name: "Select" });
  // The frame is a visual signal; without a state, a user who cannot see it
  // would never learn about the selection.
  expect(button.getAttribute("aria-pressed")).toBe("false");

  await user.click(button);
  expect(onSelectedChange).toHaveBeenCalledWith(true);

  rerender(<MediaCard preview={preview} selected onSelectedChange={onSelectedChange} />);
  expect(screen.getByRole("button", { name: "Select" }).getAttribute("aria-pressed")).toBe("true");
});

test("the button label does not repeat the state", () => {
  render(<MediaCard preview={preview} selected onSelectedChange={() => {}} />);

  // `aria-pressed` already announces the state: a label like "Selected, deselect"
  // would be read twice.
  const button = screen.getByRole("button");
  expect(button.getAttribute("aria-label")).toBe("Select");
});

test("a custom select label overrides the catalog", () => {
  render(<MediaCard preview={preview} onSelectedChange={() => {}} selectLabel="Mark the frame" />);
  expect(screen.getByRole("button", { name: "Mark the frame" })).toBeTruthy();
});

test("overlay actions are reachable from the keyboard, not only on hover", async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();
  render(
    <MediaCard
      preview={preview}
      actions={
        <button type="button" onClick={onClick}>
          Download
        </button>
      }
    />
  );

  // An overlay under `display: none` on `:hover` is unreachable from the keyboard
  // altogether: not "less convenient", but "unusable". Here it is hidden with transparency.
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Download" }));
  await user.keyboard("{Enter}");
  expect(onClick).toHaveBeenCalledTimes(1);
});

test("the preview keeps the given ratio", () => {
  const { container } = render(<MediaCard preview={preview} ratio={16 / 9} />);

  // The existing `AspectRatio` keeps the proportion; the tile does not implement its own.
  const box = container.querySelector('[style*="aspect-ratio"]') as HTMLElement;
  expect(box).toBeTruthy();
  expect(screen.getByTestId("preview")).toBeTruthy();
});

test("badges sit above the preview and do not intercept the pointer", () => {
  render(<MediaCard preview={preview} badges={<span>Duplicate</span>} />);

  const badge = screen.getByText("Duplicate").parentElement!;
  // Otherwise the badge would block clicks on the tile itself.
  expect(badge.className).toContain("pointer-events-none");
  expect(badge.className).toContain("absolute");
});

test("the title and the second line are optional", () => {
  const { container } = render(<MediaCard preview={preview} />);
  // An empty strip under the preview would look like a clipped caption.
  expect(container.textContent).toBe("image");
});

/**
 * A hidden overlay must not swallow taps.
 *
 * The action overlay is always in the markup and is hidden with transparency,
 * but `opacity` does not affect pointer hit-testing. The neighboring badge block
 * got `pointer-events-none`; the overlay did not. On a phone `:hover` never
 * fires and the buttons stay permanently transparent, yet a tap on the tile's
 * top-right corner landed on the invisible select button instead of opening the
 * tile. The user selected an item without realizing they had tapped it.
 */
test("the hidden action overlay does not swallow a tap", () => {
  const onSelectedChange = vi.fn();
  const { container } = render(
    <MediaCard
      title="Sunset"
      preview={<span>preview</span>}
      selected={false}
      onSelectedChange={onSelectedChange}
    />
  );

  const overlay = container.querySelector(".opacity-0");
  expect(overlay).not.toBeNull();
  expect(overlay?.className).toContain("pointer-events-none");
});

test("the overlay accepts pointers once it is shown", () => {
  const { container } = render(
    <MediaCard title="Sunset" preview={<span>preview</span>} selected onSelectedChange={() => {}} />
  );

  // A selected tile keeps the overlay open, so it also gets pointer events back.
  const overlay = container.querySelector("[class*='opacity-100']");
  expect(overlay?.className).toContain("pointer-events-auto");
});

test("inside a grid `selected` alone draws the state and keeps the overlay open", () => {
  // The grid (`VirtualGrid`) owns the selection and the card only shows it:
  // `selected` without `onSelectedChange`. The frame and the overlay with the
  // grid's checkbox must stay open; otherwise a selected tile is visible only
  // under the cursor (OLDSUI-199).
  const { container } = render(
    <MediaCard preview={preview} selected actions={<span>flag</span>} />
  );
  const card = container.firstElementChild!;
  expect(card.className).toContain("border-accent-strong");
  expect(screen.getByText("flag").parentElement!.className).toContain("opacity-100");
  // The card has no select button of its own: it has no selection axis.
  expect(screen.queryByRole("button", { name: "Select" })).toBeNull();
});

test("without `selected` there is no selection frame", () => {
  const { container } = render(<MediaCard preview={preview} actions={<span>flag</span>} />);
  expect(container.firstElementChild!.className).not.toContain("border-accent-strong");
});
