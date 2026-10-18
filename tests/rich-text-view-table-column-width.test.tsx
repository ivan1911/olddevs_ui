// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test } from "vitest";
import { RICH_TEXT_SCHEMA } from "../src/editor/core/schema.js";
import { RichTextView } from "../src/editor/index.js";
import { PAPER_PROSE_CLASS, PROSE_CLASS } from "../src/editor/styles/prose.js";

afterEach(cleanup);

/**
 * Table column widths in the View and in the shared look (OLDSUI-310, ADR-0080): the View carries
 * `colgroup > col[data-width]` untouched, and one set of rules in `prose.ts` sizes the columns in
 * the Editor and the View alike. How the rules lay a table out is checked in real browsers (the
 * orchestrator's Playwright pass); here the rules themselves are pinned.
 */

const HTML =
  '<table><colgroup><col data-width="35"><col data-width="65"></colgroup><tbody><tr><td><p>a</p></td>' +
  "<td><p>b</p></td></tr></tbody></table>";

test("RichTextView passes the colgroup through as it is, with the server render too", () => {
  const { container } = render(<RichTextView html={HTML} />);
  expect(container.querySelector("div")!.innerHTML).toBe(HTML);
  expect(renderToStaticMarkup(<RichTextView html={HTML} />)).toContain(
    '<colgroup><col data-width="35"><col data-width="65"></colgroup>'
  );
});

const COLUMN_RULES = (classes: string) =>
  classes.split(/\s+/).filter((token) => token.startsWith("[&_col[data-width="));

test.each([
  ["the app theme", PROSE_CLASS],
  ["the paper surface", PAPER_PROSE_CLASS],
])("on %s there is one rule for each of the 19 shares, and no other", (_, classes) => {
  const { min, max, step } = RICH_TEXT_SCHEMA.tableColumnShares;
  const shares = Array.from({ length: (max - min) / step + 1 }, (_, i) => min + i * step);
  expect(shares).toHaveLength(19);

  expect(COLUMN_RULES(classes).sort()).toEqual(
    shares.map((share) => `[&_col[data-width='${share}']]:w-[${share}cqw]`).sort()
  );
});

test.each([
  ["the app theme", PROSE_CLASS],
  ["the paper surface", PAPER_PROSE_CLASS],
])(
  "on %s a table with a colgroup is a size container, so the container units mean its width",
  (_, classes) => {
    const tokens = classes.split(/\s+/);
    expect(tokens).toContain("[&_table:has(>colgroup)]:[container-type:inline-size]");
    // The scrolling block and the 6 rem minimum stay: they are what lets a narrow screen win.
    expect(tokens).toContain("[&_table]:block");
    expect(tokens).toContain("[&_table]:overflow-x-auto");
    expect(tokens).toContain("[&_:is(th,td)]:min-w-24");
  }
);

test("no rule uses a percentage or a pixel width on a column", () => {
  // `width: 35%` on a `col` has no table to be a share of inside the scrolling block.
  expect(COLUMN_RULES(PROSE_CLASS).every((token) => token.endsWith("cqw]"))).toBe(true);
});
