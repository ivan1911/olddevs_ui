// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  TablePreferences,
  type TablePreferencesColumn,
} from "../src/components/table/TablePreferences.js";

afterEach(cleanup);

const COLUMNS: TablePreferencesColumn[] = [
  { id: "name", label: "Name", required: true },
  { id: "section", label: "Section" },
  { id: "updated", label: "Updated" },
];

const noop = () => {};

describe("TablePreferences: column visibility", () => {
  test("the checkboxes reflect the hidden columns", () => {
    render(
      <TablePreferences
        columns={COLUMNS}
        hiddenColumns={new Set(["updated"])}
        onHiddenColumnsChange={noop}
        density="comfortable"
        onDensityChange={noop}
      />
    );
    expect((screen.getByRole("checkbox", { name: "Section" }) as HTMLInputElement).checked).toBe(
      true
    );
    expect((screen.getByRole("checkbox", { name: "Updated" }) as HTMLInputElement).checked).toBe(
      false
    );
  });

  test("removal reports outwards and hides nothing itself", async () => {
    const user = userEvent.setup();
    const onHiddenColumnsChange = vi.fn();
    render(
      <TablePreferences
        columns={COLUMNS}
        hiddenColumns={new Set()}
        onHiddenColumnsChange={onHiddenColumnsChange}
        density="comfortable"
        onDensityChange={noop}
      />
    );

    await user.click(screen.getByRole("checkbox", { name: "Section" }));
    expect(onHiddenColumnsChange).toHaveBeenCalledWith(new Set(["section"]));
  });

  test("a required column cannot be unchecked", () => {
    render(
      <TablePreferences
        columns={COLUMNS}
        hiddenColumns={new Set()}
        onHiddenColumnsChange={noop}
        density="comfortable"
        onDensityChange={noop}
      />
    );
    expect(
      (screen.getByRole("checkbox", { name: "Name" }) as HTMLElement & { disabled?: boolean })
        .disabled
    ).toBe(true);
  });

  /**
   * A table without columns is not a state of the interface but a breakage: there would be
   * nothing left to hide, and the user could not get out of it.
   */
  test("the last visible column cannot be unchecked", () => {
    render(
      <TablePreferences
        columns={[
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ]}
        hiddenColumns={new Set(["b"])}
        onHiddenColumnsChange={noop}
        density="comfortable"
        onDensityChange={noop}
      />
    );
    expect(
      (screen.getByRole("checkbox", { name: "A" }) as HTMLElement & { disabled?: boolean }).disabled
    ).toBe(true);
    // A hidden column can still be shown again: the restriction is one-way.
    expect(
      (screen.getByRole("checkbox", { name: "B" }) as HTMLElement & { disabled?: boolean }).disabled
    ).toBe(false);
  });
});

describe("TablePreferences: column order", () => {
  test("without a handler there are no order buttons at all", () => {
    render(
      <TablePreferences
        columns={COLUMNS}
        hiddenColumns={new Set()}
        onHiddenColumnsChange={noop}
        density="comfortable"
        onDensityChange={noop}
      />
    );
    expect(screen.queryByRole("button", { name: /Move/ })).toBeNull();
  });

  test("the buttons name the column, not only the direction", () => {
    render(
      <TablePreferences
        columns={COLUMNS}
        hiddenColumns={new Set()}
        onHiddenColumnsChange={noop}
        columnOrder={[]}
        onColumnOrderChange={noop}
        density="comfortable"
        onDensityChange={noop}
      />
    );
    // Otherwise a list of ten columns would have twenty buttons labeled "Up" and "Down".
    expect(screen.getByRole("button", { name: "Move Section up" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Move Section down" })).toBeTruthy();
  });

  test("a partial order does not lose columns in the panel itself", () => {
    render(
      <TablePreferences
        columns={COLUMNS}
        hiddenColumns={new Set()}
        onHiddenColumnsChange={noop}
        columnOrder={["updated"]}
        onColumnOrderChange={noop}
        density="comfortable"
        onDensityChange={noop}
      />
    );
    // The previous guard, which compared lengths, let through a list of the same length with
    // other identifiers, and some columns disappeared from the panel.
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Move Updated up" })).toBeTruthy();
  });

  /**
   * At the edge the button is announced as unavailable, but it STAYS IN THE TAB ORDER.
   *
   * With the native `disabled`, the browser removed focus from the very button it stood
   * on: two Enter presses in a row on "up" moved the column to the edge, the button went
   * dim, focus moved to the document, and the tab order of the panel started over.
   */
  test("the edge buttons announce themselves unavailable without leaving the tab order", async () => {
    const user = userEvent.setup();
    const onColumnOrderChange = vi.fn();
    render(
      <TablePreferences
        columns={COLUMNS}
        hiddenColumns={new Set()}
        onHiddenColumnsChange={noop}
        columnOrder={[]}
        onColumnOrderChange={onColumnOrderChange}
        density="comfortable"
        onDensityChange={noop}
      />
    );

    const up = screen.getByRole("button", { name: "Move Name up" });
    expect(up.getAttribute("aria-disabled")).toBe("true");
    expect((up as HTMLButtonElement).disabled).toBe(false);

    // A press at the edge moves nothing and does not drop focus.
    up.focus();
    await user.click(up);
    expect(onColumnOrderChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(up);

    expect(
      screen.getByRole("button", { name: "Move Updated down" }).getAttribute("aria-disabled")
    ).toBe("true");
  });

  /** Order is changed from the keyboard: there is no drag-only path. */
  test("the order changes by buttons and works from the keyboard", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [order, setOrder] = useState<string[]>(["name", "section", "updated"]);
      return (
        <TablePreferences
          columns={COLUMNS}
          hiddenColumns={new Set()}
          onHiddenColumnsChange={noop}
          columnOrder={order}
          onColumnOrderChange={setOrder}
          density="comfortable"
          onDensityChange={noop}
        />
      );
    }
    render(<Controlled />);

    screen.getByRole("button", { name: "Move Updated up" }).focus();
    await user.keyboard("{Enter}");

    const boxes = screen.getAllByRole("checkbox").map((c) => c.getAttribute("aria-label") ?? "");
    const labels = screen.getAllByRole("checkbox").map((c) => c.closest("label")?.textContent);
    expect(labels[1]).toBe("Updated");
    expect(boxes.length).toBe(3);
  });

  /**
   * A table without columns is not a state of the interface but a breakage: there would be
   * nothing left to hide, and the user could not get out of it.
   */
  test("the last visible column cannot be unchecked", () => {
    render(
      <TablePreferences
        columns={[
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ]}
        hiddenColumns={new Set(["b"])}
        onHiddenColumnsChange={noop}
        density="comfortable"
        onDensityChange={noop}
      />
    );
    expect(
      (screen.getByRole("checkbox", { name: "A" }) as HTMLElement & { disabled?: boolean }).disabled
    ).toBe(true);
    // A hidden column can still be shown again: the restriction is one-way.
    expect(
      (screen.getByRole("checkbox", { name: "B" }) as HTMLElement & { disabled?: boolean }).disabled
    ).toBe(false);
  });
});

describe("TablePreferences: density", () => {
  test("the chosen density is marked, not only coloured", () => {
    render(
      <TablePreferences
        columns={COLUMNS}
        hiddenColumns={new Set()}
        onHiddenColumnsChange={noop}
        density="compact"
        onDensityChange={noop}
      />
    );
    expect(screen.getByRole("button", { name: "Compact" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
  });

  test("a change reports outwards", async () => {
    const user = userEvent.setup();
    const onDensityChange = vi.fn();
    render(
      <TablePreferences
        columns={COLUMNS}
        hiddenColumns={new Set()}
        onHiddenColumnsChange={noop}
        density="comfortable"
        onDensityChange={onDensityChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Compact" }));
    expect(onDensityChange).toHaveBeenCalledWith("compact");
  });
});

/**
 * The edge button LOOKS unavailable, not just announces itself as such.
 *
 * The move from `disabled` to `aria-disabled` kept the announcement and the tab order, but
 * the look depends on the `:disabled` pseudo-class, which such a button does not match: a
 * sighted mouse user saw an ordinary button with a pointer cursor, pressed it, and nothing
 * happened.
 */
test("an edge button is dimmed, not just announced unavailable", () => {
  render(
    <TablePreferences
      columns={COLUMNS}
      hiddenColumns={new Set()}
      onHiddenColumnsChange={noop}
      columnOrder={[]}
      onColumnOrderChange={noop}
      density="comfortable"
      onDensityChange={noop}
    />
  );

  const up = screen.getByRole("button", { name: "Move Name up" });
  expect(up.className).toContain("aria-disabled:opacity-50");
  expect(up.className).toContain("aria-disabled:cursor-default");
});
