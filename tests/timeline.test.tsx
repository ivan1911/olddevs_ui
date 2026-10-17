// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Timeline } from "../src/components/content/Timeline.js";
import { TONE_TOKENS } from "../src/lib/variants.js";

afterEach(cleanup);

const items = [
  { id: "1", label: "fetch", status: "success" as const },
  { id: "2", label: "upload", status: "running" as const },
  { id: "3", label: "publish", status: "pending" as const },
];

test("the feed is an ordered list, not a pile of blocks", () => {
  render(<Timeline items={items} aria-label="Task steps" />);
  // The screen reader must announce both the order and the total count; a set of divs
  // announces neither.
  const list = screen.getByRole("list", { name: "Task steps" });
  expect(list.tagName).toBe("OL");
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
});

test("the running step is marked for a screen reader", () => {
  render(<Timeline items={items} />);
  const current = screen.getAllByRole("listitem").filter((li) => li.getAttribute("aria-current"));
  expect(current).toHaveLength(1);
  expect(current[0]?.textContent).toContain("upload");
  expect(current[0]?.getAttribute("aria-current")).toBe("step");
});

test("after the last step there is no line", () => {
  const { container } = render(<Timeline items={items} />);
  // A line after the last step would promise a continuation that does not exist.
  const connectors = container.querySelectorAll(".bg-line-soft");
  expect(connectors).toHaveLength(items.length - 1);
});

test("an empty feed is not drawn at all", () => {
  const { container } = render(<Timeline items={[]} />);
  expect(container.firstChild).toBeNull();
});

test("details and the status label are shown when passed", () => {
  render(
    <Timeline
      items={[
        {
          id: "1",
          label: "download",
          status: "failed",
          statusLabel: "failed",
          details: "Not enough photos",
          time: "14:02:19",
        },
      ]}
    />
  );
  expect(screen.getByText("failed")).toBeTruthy();
  expect(screen.getByText("Not enough photos")).toBeTruthy();
  expect(screen.getByText("14:02:19")).toBeTruthy();
});

test("each of the four states yields its own tone", () => {
  // The vocabulary is shared by the whole kit (ADR-0031), and before 3.0.0 neither of its
  // two consumers had a single covering test: merging the two vocabularies into one could
  // silently drop a branch.
  render(
    <Timeline
      items={[
        { id: "1", label: "pending", status: "pending" },
        { id: "2", label: "running", status: "running" },
        { id: "3", label: "success", status: "success" },
        { id: "4", label: "failed", status: "failed" },
      ]}
    />
  );

  // The tone is named LITERALLY, not derived from the table under test: a test that takes
  // its expectation from the same place as the value stays green whatever that table holds,
  // and the very first version of this check was exactly that. Wave 21 rule: a gate that
  // cannot turn red is not considered done.
  const expected = {
    pending: "neutral",
    running: "accent",
    success: "success",
    failed: "danger",
  } as const;

  for (const [status, tone] of Object.entries(expected)) {
    const dot = screen.getByText(status).closest("li")?.querySelector("span[aria-hidden]");
    expect(dot?.className).toContain(TONE_TOKENS[tone].dotBg);
  }
});

test("an unknown status does not break the feed", () => {
  // A defect found in review: the tone was taken as TONE_TOKENS[STATUS_TONE[status]], and
  // a fifth kind of step from the backend gave undefined.dotBg, which crashed the whole
  // activity screen. The consumer is in JS, and the compiler does not check its data.
  render(
    <Timeline
      items={[
        { id: "1", label: "skip", status: "skipped" as never },
        { id: "2", label: "ok", status: "success" },
      ]}
      aria-label="Steps"
    />
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getByText("skip")).toBeTruthy();
});
