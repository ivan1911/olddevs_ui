// @vitest-environment jsdom
import { act } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Table } from "../src/components/content/Table.js";
import { DataTable } from "../src/components/table/DataTable.js";
import { DEFAULT_TABLE_STATE } from "../src/lib/table-state.js";

/*
  Hydration of a sortable table (OLDSUI-193).

  react-aria in `useTableColumnHeader` decides on `aria-sort` by platform: on Android
  (TalkBack does not support the attribute) it is not set at all, while on the others a
  sortable column always has it — `none` on an unsorted one. The server does not know the
  platform and always writes the "not Android" variant, so during hydration an Android
  client saw markup that did not match its own, and React logged "A tree hydrated but
  some attributes… didn't match" on every column.
*/
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ROWS = [
  { id: "1", name: "Contract", amount: 3 },
  { id: "2", name: "Report", amount: 5 },
];
type Row = (typeof ROWS)[number];
const COLUMNS = [
  { id: "name", header: "Name", sortable: true, cell: (r: Row) => r.name },
  { id: "amount", header: "Amount", sortable: true, cell: (r: Row) => r.amount },
  { id: "plain", header: "Plain", cell: (r: Row) => r.id },
];

const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile";
const DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126";

const tableElement = () => (
  <Table
    aria-label="Documents"
    columns={COLUMNS}
    items={ROWS}
    sort={{ column: "name", direction: "ascending" }}
    onSortChange={() => {}}
  />
);

const dataTableElement = () => (
  <DataTable
    aria-label="Documents"
    columns={COLUMNS}
    items={ROWS}
    state={{
      ...DEFAULT_TABLE_STATE,
      density: "comfortable",
      sort: { column: "name", direction: "ascending" },
    }}
    onStateChange={() => {}}
  />
);

let roots: Root[] = [];
let hosts: HTMLElement[] = [];
let errors: string[] = [];

beforeEach(() => {
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...args) => {
    errors.push(args.map(String).join(" "));
  });
});

afterEach(() => {
  for (const root of roots) act(() => root.unmount());
  for (const host of hosts) host.remove();
  roots = [];
  hosts = [];
  vi.restoreAllMocks();
});

/**
 * The server writes markup without knowing the platform; the client hydrates it under
 * the given user agent.
 */
async function hydrateAs(userAgent: string, element: React.ReactElement): Promise<HTMLElement> {
  vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(DESKTOP);
  const html = renderToString(element);

  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.append(host);
  hosts.push(host);

  vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(userAgent);
  await act(async () => {
    roots.push(hydrateRoot(host, element));
  });
  return host;
}

const ariaSorts = (host: HTMLElement) =>
  [...host.querySelectorAll("th")].map((th) => th.getAttribute("aria-sort"));

const hydrationErrors = () => errors.filter((message) => /hydrat|didn't match/i.test(message));

describe.each([
  ["Table", tableElement],
  ["DataTable", dataTableElement],
])("%s hydration with a sort descriptor", (_name, element) => {
  test("an Android client hydrates the server markup without a mismatch", async () => {
    await hydrateAs(ANDROID, element());
    expect(hydrationErrors()).toEqual([]);
  });

  test("a desktop client hydrates the server markup without a mismatch", async () => {
    await hydrateAs(DESKTOP, element());
    expect(hydrationErrors()).toEqual([]);
  });

  test("after hydration a desktop client announces the sort state on sortable columns", async () => {
    const host = await hydrateAs(DESKTOP, element());
    expect(ariaSorts(host)).toEqual(["ascending", "none", null]);
  });

  test("Android keeps react-aria's own rule after hydration: no aria-sort at all", async () => {
    const host = await hydrateAs(ANDROID, element());
    expect(ariaSorts(host)).toEqual([null, null, null]);
  });

  test("the server markup carries no aria-sort but already shows the direction mark", () => {
    const html = renderToString(element());
    expect(html).not.toContain("aria-sort");
    // The direction mark is drawn by the component itself, not by react-aria,
    // so it does not wait for hydration.
    expect(html).toContain("rotate-180");
  });
});
