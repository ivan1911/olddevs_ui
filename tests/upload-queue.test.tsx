// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { UploadQueue, type UploadItem } from "../src/components/inputs/UploadQueue.js";
import { TONE_TOKENS } from "../src/lib/variants.js";

afterEach(cleanup);

const items: UploadItem[] = [
  { id: "1", name: "first.pdf", state: "success" },
  { id: "2", name: "second.docx", state: "running", progress: 40 },
  { id: "3", name: "third.jpg", state: "failed", meta: "The server rejected the file" },
];

test("the queue is a real named list", () => {
  render(<UploadQueue items={items} />);

  // A set of `div`s tells a screen reader neither that this is a queue nor how many items it holds.
  expect(screen.getByRole("list", { name: "Upload queue" })).toBeTruthy();
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
});

test("the summary is announced by a live region and counts partial success", () => {
  // The queue announces a SETTLED result: since wave 26 it announces the total, not each step. The
  // previous set contained `running`, and the text changed on every file transition: twelve files
  // produced twelve messages in a row, and `polite` does not collapse them.
  render(
    <UploadQueue
      items={[
        { id: "1", name: "first.pdf", state: "success" },
        { id: "2", name: "second.docx", state: "success" },
        { id: "3", name: "third.jpg", state: "failed", meta: "The server rejected the file" },
      ]}
    />
  );

  // Partial success is otherwise visible only to someone who scans the list by eye.
  expect(screen.getByRole("status").textContent).toBe("2 of 3 uploaded, 1 failed");
});

test("without errors the summary says nothing about them", () => {
  render(<UploadQueue items={[{ id: "1", name: "a.pdf", state: "success" }]} />);
  expect(screen.getByRole("status").textContent).toBe("1 of 1 uploaded");
});

test("an empty queue yields no summary, but the region is mounted", () => {
  render(<UploadQueue items={[]} empty={<p>The queue is empty</p>} />);

  // "Zero of zero" is not a message. And a live region inserted together with its text is announced
  // unreliably, so it is always mounted.
  expect(screen.getByRole("status").textContent).toBe("");
  expect(screen.getByText("The queue is empty")).toBeTruthy();
});

test("unknown progress differs from zero", () => {
  render(
    <UploadQueue
      items={[
        { id: "1", name: "a", state: "running", progress: null },
        { id: "2", name: "b", state: "running", progress: 0 },
      ]}
    />
  );

  const bars = screen.getAllByRole("progressbar");
  // `null` means "the total amount of work is unknown", and ARIA distinguishes this from a bar at
  // zero by the absence of `aria-valuenow`.
  expect(bars[0]!.hasAttribute("aria-valuenow")).toBe(false);
  expect(bars[1]!.getAttribute("aria-valuenow")).toBe("0");
});

test("without progress there is no bar at all", () => {
  render(<UploadQueue items={[{ id: "1", name: "a", state: "pending" }]} />);
  expect(screen.queryByRole("progressbar")).toBeNull();
});

test("the bar name names the file, not a faceless upload", () => {
  render(
    <UploadQueue items={[{ id: "1", name: "estimate.xlsx", state: "running", progress: 10 }]} />
  );
  expect(screen.getByRole("progressbar", { name: "Uploading estimate.xlsx" })).toBeTruthy();
});

test("the kit invents neither a domain label nor domain actions", () => {
  render(
    <UploadQueue
      items={[
        {
          id: "1",
          name: "a",
          state: "failed",
          statusLabel: "Duplicate",
          actions: <button type="button">Retry</button>,
        },
      ]}
    />
  );

  // "Duplicate" is application knowledge; the kit stores only the state mechanics.
  expect(screen.getByText("Duplicate")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
});

test("the queue does not store itself", () => {
  const { rerender } = render(<UploadQueue items={items} />);
  expect(screen.getAllByRole("listitem")).toHaveLength(3);

  // Items come in as props: remove one from outside and it disappears inside.
  rerender(<UploadQueue items={items.slice(0, 1)} />);
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
});

test("each of the four states yields its own tone", () => {
  // The vocabulary has been shared with `Timeline` since 3.0.0 (ADR-0031). Before the merge, neither
  // type had any covering tests, so the branch would be silently lost.
  render(
    <UploadQueue
      items={[
        { id: "1", name: "pending", state: "pending", statusLabel: "queued" },
        { id: "2", name: "running", state: "running", statusLabel: "in progress" },
        { id: "3", name: "success", state: "success", statusLabel: "finished" },
        { id: "4", name: "failed", state: "failed", statusLabel: "broken" },
      ]}
    />
  );

  // The tones are named literally — see the same test in `Timeline`: an expectation taken from the
  // table under test makes the gate permanently green.
  for (const [label, tone] of [
    ["queued", "neutral"],
    ["in progress", "accent"],
    ["finished", "success"],
    ["broken", "danger"],
  ] as const) {
    expect(screen.getByText(label).className).toContain(TONE_TOKENS[tone].fg);
  }
});

test("an unknown state does not break the queue", () => {
  // The same safeguard as in `Timeline`: a consumer in JS gets states from the backend, and a fifth
  // kind of them must not cost the screen. When the dictionaries were merged, the safeguard had to
  // survive in both, not only in the Timeline.
  render(
    <UploadQueue
      items={[
        { id: "1", name: "scan.pdf", state: "quarantined" as never, statusLabel: "quarantine" },
        { id: "2", name: "estimate.xlsx", state: "success" },
      ]}
      aria-label="Queue"
    />
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getByText("quarantine").className).toContain(TONE_TOKENS.neutral.fg);
});

/**
 * The settled total is announced, not every intermediate transition.
 *
 * The text of the live region changed on every file transition to `success` / `failed`: sending
 * twelve files produced twelve messages in a row. The queue is `polite` and does not collapse them,
 * so a screen reader user got a minute of continuous speech instead of one message about the result.
 */
test("a queue still running announces nothing", () => {
  render(
    <UploadQueue
      items={[
        { id: "1", name: "a.png", state: "success", progress: 100 },
        { id: "2", name: "b.png", state: "running", progress: 40 },
      ]}
    />
  );

  expect(screen.getByRole("status").textContent).toBe("");
});

test("the summary appears once the queue has settled", () => {
  render(
    <UploadQueue
      items={[
        { id: "1", name: "a.png", state: "success", progress: 100 },
        { id: "2", name: "b.png", state: "failed", progress: 100 },
      ]}
    />
  );

  expect(screen.getByRole("status").textContent).toContain("1");
});

/**
 * The tone of the status is separate from its label: "Duplicate" on a technically successful upload
 * is a warning, not a success. The customer deliberately did not fill in `statusLabel`, because the
 * badge glowed green.
 */
test("a domain tone overrides the badge tone derived from the state", () => {
  render(
    <UploadQueue
      items={[
        { id: "1", name: "a.png", state: "success", statusLabel: "Duplicate", tone: "warning" },
      ]}
    />
  );

  const badge = screen.getByText("Duplicate");
  expect(badge.className).toContain(TONE_TOKENS.warning.fg);
  expect(badge.className).not.toContain(TONE_TOKENS.success.fg);
});

test("without a tone the badge follows the state, as before", () => {
  render(
    <UploadQueue items={[{ id: "1", name: "a.png", state: "success", statusLabel: "Done" }]} />
  );

  expect(screen.getByText("Done").className).toContain(TONE_TOKENS.success.fg);
});

test("an unknown state with a tone takes the tone; without it, stays neutral", () => {
  render(
    <UploadQueue
      items={[
        {
          id: "1",
          name: "scan.pdf",
          state: "quarantined" as never,
          statusLabel: "Flagged",
          tone: "danger",
        },
        { id: "2", name: "doc.pdf", state: "quarantined" as never, statusLabel: "Unknown" },
      ]}
    />
  );

  expect(screen.getByText("Flagged").className).toContain(TONE_TOKENS.danger.fg);
  expect(screen.getByText("Unknown").className).toContain(TONE_TOKENS.neutral.fg);
});

test("an unknown tone is ignored instead of breaking the queue", () => {
  // A JS consumer builds the tone from its own status dictionary: a typo or a fifth kind of tone
  // must not cost the screen (the same safeguard as for `state`).
  render(
    <UploadQueue
      items={[
        { id: "1", name: "a.png", state: "success", statusLabel: "Odd", tone: "info" as never },
      ]}
    />
  );

  expect(screen.getByText("Odd").className).toContain(TONE_TOKENS.success.fg);
});

test("the failed meta text follows the state, not the tone", () => {
  render(
    <UploadQueue
      items={[
        {
          id: "1",
          name: "a.png",
          state: "failed",
          tone: "neutral",
          statusLabel: "Skipped",
          meta: "The server rejected the file",
        },
        {
          id: "2",
          name: "b.png",
          state: "success",
          tone: "danger",
          statusLabel: "Suspicious",
          meta: "Looks fine to the server",
        },
      ]}
    />
  );

  // Error text is the mechanics of sending: it failed means it failed, whatever the domain says.
  // And the reverse: a red badge does not turn a successful item into a failure.
  expect(screen.getByText("The server rejected the file").className).toContain(
    TONE_TOKENS.danger.fg
  );
  expect(screen.getByText("Looks fine to the server").className).not.toContain(
    TONE_TOKENS.danger.fg
  );
});

test("the progress bar shares the tone of the badge in the same row", () => {
  render(
    <UploadQueue
      items={[
        {
          id: "1",
          name: "a.png",
          state: "success",
          progress: 100,
          statusLabel: "Duplicate",
          tone: "warning",
        },
      ]}
    />
  );

  // A row of one color: a green stripe next to a yellow badge says two different things about the
  // same item.
  const bar = screen.getByRole("progressbar");
  expect(bar.querySelector(`.${TONE_TOKENS.warning.dotBg}`)).not.toBeNull();
  expect(bar.querySelector(`.${TONE_TOKENS.success.dotBg}`)).toBeNull();
});

test("a state named after an inherited object key stays neutral", () => {
  // The state comes from the backend: `"constructor"` would be found in a plain object as an
  // inherited function, and the badge would fail on a nonexistent token.
  render(
    <UploadQueue
      items={[
        {
          id: "1",
          name: "a.png",
          state: "constructor" as never,
          statusLabel: "Weird",
          progress: 5,
        },
      ]}
    />
  );

  expect(screen.getByText("Weird").className).toContain(TONE_TOKENS.neutral.fg);
});
