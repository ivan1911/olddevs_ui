// @vitest-environment jsdom
import { expect, test } from "vitest";
import {
  equalShares,
  insertShare,
  isShares,
  moveBoundary,
  nudgeShare,
  parseCssWidth,
  readColumnShares,
  removeShares,
  snapShares,
} from "../src/editor/features/table/tableShares.js";

/*
  Column widths as shares (OLDSUI-310, ADR-0080): the pure rules behind the table node, the commands,
  the pointer handle and the paste cleanup. The Editor-level behavior is in
  `rich-text-editor-table-column-width.test.tsx`.
*/

const sum = (shares: readonly number[]) => shares.reduce((a, b) => a + b, 0);

test("a Document's shares are 2 to 20 multiples of 5 that add up to 100", () => {
  expect(isShares([35, 65])).toBe(true);
  expect(isShares(Array.from({ length: 20 }, () => 5))).toBe(true);
  for (const bad of [
    null,
    [100],
    [50, 50, 5],
    [33, 67],
    [0, 100],
    [100, 0],
    [97.5, 2.5],
    ["50", "50"],
    Array.from({ length: 21 }, () => 5),
  ]) {
    expect(isShares(bad), JSON.stringify(bad)).toBe(false);
  }
});

test("widths round to steps of 5, never below 5, and always add up to 100", () => {
  expect(snapShares([200, 200, 200])).toEqual([35, 35, 30]);
  expect(snapShares([1, 1, 1, 1])).toEqual([25, 25, 25, 25]);
  expect(snapShares([176, 112, 96, 112, 80])).toEqual([30, 20, 15, 20, 15]);
  // A sliver of a column still keeps the minimum, taken from the widest.
  expect(snapShares([1000, 1])).toEqual([95, 5]);
  expect(snapShares([1, 1000, 1])).toEqual([5, 90, 5]);
  for (const weights of [
    [3, 7],
    [1, 2, 3, 4, 5, 6, 7],
    [13, 13, 13, 13, 13, 13],
  ]) {
    const shares = snapShares(weights)!;
    expect(sum(shares)).toBe(100);
    expect(isShares(shares)).toBe(true);
  }
});

test("nothing to share: one column, more than twenty, or a weight that is not positive", () => {
  expect(snapShares([5])).toBeNull();
  expect(snapShares(Array.from({ length: 21 }, () => 1))).toBeNull();
  expect(snapShares([1, 0])).toBeNull();
  expect(snapShares([1, Number.NaN])).toBeNull();
  expect(equalShares(1)).toBeNull();
  expect(equalShares(3)).toEqual([35, 35, 30]);
  expect(equalShares(20)).toEqual(Array.from({ length: 20 }, () => 5));
});

test("a boundary moves between two columns and the others stay put", () => {
  expect(moveBoundary([25, 25, 50], 1, 40)).toEqual([40, 10, 50]);
  // Snaps to a step, and keeps 5% on either side.
  expect(moveBoundary([25, 25, 50], 1, 31)).toEqual([30, 20, 50]);
  expect(moveBoundary([25, 25, 50], 1, 99)).toEqual([45, 5, 50]);
  expect(moveBoundary([25, 25, 50], 1, -4)).toEqual([5, 45, 50]);
  // Nothing changed: no edit.
  expect(moveBoundary([25, 25, 50], 1, 26)).toBeNull();
  expect(moveBoundary([25, 25, 50], 0, 26)).toBeNull();
  expect(moveBoundary([25, 25, 50], 3, 26)).toBeNull();
});

test("a nudge takes from the right neighbour, from the left one for the last column", () => {
  expect(nudgeShare([40, 30, 30], 0, 1)).toEqual([45, 25, 30]);
  expect(nudgeShare([40, 30, 30], 1, -1)).toEqual([40, 25, 35]);
  expect(nudgeShare([40, 30, 30], 2, 1)).toEqual([40, 25, 35]);
  expect(nudgeShare([40, 30, 30], 2, -1)).toEqual([40, 35, 25]);
  expect(nudgeShare([45, 5, 50], 0, 1)).toBeNull();
  expect(nudgeShare([5, 45, 50], 0, -1)).toBeNull();
  expect(nudgeShare([95, 5], 0, 1)).toBeNull();
  expect(nudgeShare([95, 5], 1, 1)).toEqual([90, 10]);
});

test("a new column takes half of the share beside it, rounded down to a step", () => {
  expect(insertShare([40, 60], 0, 0)).toEqual([20, 20, 60]);
  expect(insertShare([40, 60], 1, 0)).toEqual([20, 20, 60]);
  expect(insertShare([40, 60], 2, 1)).toEqual([40, 30, 30]);
  expect(insertShare([25, 75], 1, 0)).toEqual([15, 10, 75]);
  expect(insertShare([15, 85], 0, 0)).toEqual([5, 10, 85]);
  expect(insertShare([10, 90], 0, 0)).toEqual([5, 5, 90]);
});

test("beside a column at 5% the widest gives, and with no room the shares are dropped", () => {
  expect(insertShare([5, 95], 0, 0)).toEqual([5, 5, 90]);
  expect(insertShare([20, 5, 75], 2, 1)).toEqual([20, 5, 5, 70]);
  const full = Array.from({ length: 20 }, () => 5);
  expect(insertShare(full, 0, 0)).toBeNull();
  const nineteen = [...Array.from({ length: 18 }, () => 5), 10];
  expect(insertShare(nineteen, 0, 0)).toEqual([5, 5, ...Array.from({ length: 17 }, () => 5), 5]);
  expect(sum(insertShare(nineteen, 0, 0)!)).toBe(100);
});

test("a removed column gives its share to the left neighbour, the first to the new first", () => {
  expect(removeShares([30, 30, 40], 1, 2)).toEqual([60, 40]);
  expect(removeShares([30, 30, 40], 2, 3)).toEqual([30, 70]);
  expect(removeShares([30, 30, 40], 0, 1)).toEqual([60, 40]);
  expect(removeShares([20, 20, 20, 40], 1, 3)).toEqual([60, 40]);
  // One column left: no shares to keep.
  expect(removeShares([30, 70], 0, 1)).toBeNull();
});

test("lengths are read in the units foreign HTML writes them", () => {
  expect(parseCssWidth("120")).toEqual({ value: 120, percent: false });
  expect(parseCssWidth(" 90pt ")?.value).toBeCloseTo(120);
  expect(parseCssWidth("1.5in")?.value).toBeCloseTo(144);
  expect(parseCssWidth("35%")).toEqual({ value: 35, percent: true });
  for (const bad of ["auto", "0", "-5px", "", null, undefined, "calc(1px)", "12 px 3"]) {
    expect(parseCssWidth(bad), String(bad)).toBeNull();
  }
});

const table = (html: string) => {
  const root = document.createElement("div");
  root.innerHTML = `<table>${html}<tbody><tr><td></td></tr></tbody></table>`;
  return root.querySelector("table")!;
};

test("a colgroup in the Editor's own markup is read as it is, and dropped whole when invalid", () => {
  expect(
    readColumnShares(table('<colgroup><col data-width="35"><col data-width="65"></colgroup>'))
  ).toEqual([35, 65]);
  for (const bad of [
    '<colgroup><col data-width="35"><col data-width="60"></colgroup>',
    '<colgroup><col data-width="33"><col data-width="67"></colgroup>',
    '<colgroup><col data-width="100"></colgroup>',
    '<colgroup><col data-width="50"><col data-width="50" style="width:1px"><col></colgroup>',
  ]) {
    expect(readColumnShares(table(bad)), bad).toBeNull();
  }
});

test("a foreign colgroup is turned into shares: pixels, points, percent and span", () => {
  expect(
    readColumnShares(
      table('<colgroup><col width="176"><col width="112"><col width="112"></colgroup>')
    )
  ).toEqual([45, 30, 25]);
  expect(
    readColumnShares(table("<col width=64 style='width:48pt'><col width=128 style='width:96pt'>"))
  ).toEqual([35, 65]);
  expect(
    readColumnShares(table('<colgroup><col style="width: 25%"><col style="width: 75%"></colgroup>'))
  ).toEqual([25, 75]);
  expect(
    readColumnShares(table('<colgroup><col span="2" width="50"><col width="100"></colgroup>'))
  ).toEqual([25, 25, 50]);
});

test("a colgroup without usable widths leaves the table to the content", () => {
  for (const html of [
    "<colgroup><col><col><col></colgroup>",
    '<colgroup><col width="100"><col></colgroup>',
    '<colgroup><col width="100"><col style="width:50%"></colgroup>',
    '<colgroup><col width="100"></colgroup>',
    "",
  ]) {
    expect(readColumnShares(table(html)), html).toBeNull();
  }
});
