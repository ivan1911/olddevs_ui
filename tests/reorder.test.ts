import { describe, expect, test } from "vitest";
import { insertionIndex, reorder } from "../src/lib/reorder.js";

const items = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }];
const ids = (list: { id: string }[] | null) => list?.map((i) => i.id) ?? null;

describe("reorder", () => {
  test("before the target and after it", () => {
    expect(ids(reorder(items, new Set(["1"]), { key: "3", dropPosition: "before" }))).toEqual([
      "2",
      "1",
      "3",
      "4",
    ]);
    expect(ids(reorder(items, new Set(["1"]), { key: "3", dropPosition: "after" }))).toEqual([
      "2",
      "3",
      "1",
      "4",
    ]);
  });

  test("a group moves as a whole and keeps its order", () => {
    expect(ids(reorder(items, new Set(["1", "2"]), { key: "4", dropPosition: "after" }))).toEqual([
      "3",
      "4",
      "1",
      "2",
    ]);
  });

  test("dropping onto itself does not lose the last item", () => {
    // Previously `findIndex` returned -1, and `slice(0, -1)` dropped "4" — the review
    // of 2.5.0 caught it. A drop onto itself is legal and changes nothing.
    expect(reorder(items, new Set(["1"]), { key: "1", dropPosition: "before" })).toBeNull();
    expect(reorder(items, new Set(["1"]), { key: "1", dropPosition: "after" })).toBeNull();
  });

  test("a target inside the moved group changes nothing either", () => {
    expect(reorder(items, new Set(["2", "3"]), { key: "3", dropPosition: "before" })).toBeNull();
  });

  test("there is nowhere to nest inside an item", () => {
    expect(reorder(items, new Set(["1"]), { key: "3", dropPosition: "on" })).toBeNull();
  });

  test("the source array is not touched", () => {
    const copy = [...items];
    reorder(items, new Set(["1"]), { key: "4", dropPosition: "after" });
    expect(items).toEqual(copy);
  });
});

describe("insertionIndex", () => {
  test("before an item is its own place, after it is the next one", () => {
    expect(insertionIndex(items, { key: "3", dropPosition: "before" })).toBe(2);
    expect(insertionIndex(items, { key: "3", dropPosition: "after" })).toBe(3);
    expect(insertionIndex(items, { key: "4", dropPosition: "after" })).toBe(4);
  });

  test("an empty list or a drop on the list itself takes the row at the end", () => {
    expect(insertionIndex([], null)).toBe(0);
    expect(insertionIndex(items, null)).toBe(4);
  });

  test("there is nowhere to nest inside an item, and an unknown target is no place", () => {
    expect(insertionIndex(items, { key: "3", dropPosition: "on" })).toBeNull();
    expect(insertionIndex(items, { key: "9", dropPosition: "before" })).toBeNull();
  });
});
