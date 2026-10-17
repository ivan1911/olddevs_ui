// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test } from "vitest";
import { CommandPalette } from "../src/components/overlays/CommandPalette.js";

afterEach(cleanup);

const SECTIONS = [
  {
    id: "library",
    label: "Library",
    items: [
      { id: "upload", label: "Upload photos" },
      { id: "find", label: "Find similar", keywords: "similar" },
    ],
  },
];

test("hint mode hides the list only on an EMPTY query", async () => {
  const user = userEvent.setup();

  render(
    <CommandPalette
      open
      onClose={() => {}}
      onSelect={() => {}}
      emptyBehaviour="hint"
      sections={SECTIONS}
    />
  );

  // An empty query shows a hint instead of the list. The hint itself also arrives
  // as an item: react-aria's `renderEmptyState` is rendered inside the list.
  expect(screen.queryByRole("option", { name: /Upload photos/ })).toBeNull();
  expect(screen.getByText("Start typing an action name")).toBeTruthy();

  await user.type(screen.getByRole("searchbox"), "Uploa");

  // A typed query is an ordinary search. The condition used to be a constant, so the palette
  // could never find anything in this mode.
  expect(screen.getByRole("option", { name: /Upload photos/ })).toBeTruthy();
});

test("list mode shows everything on an empty query", () => {
  render(<CommandPalette open onClose={() => {}} onSelect={() => {}} sections={SECTIONS} />);

  expect(screen.getByRole("option", { name: /Upload photos/ })).toBeTruthy();
  expect(screen.getByRole("option", { name: /Find similar/ })).toBeTruthy();
});

test("search goes through synonyms too", async () => {
  const user = userEvent.setup();

  render(<CommandPalette open onClose={() => {}} onSelect={() => {}} sections={SECTIONS} />);
  await user.type(screen.getByRole("searchbox"), "similar");

  // The English word is not in the label; it lives in `keywords`.
  expect(screen.getByRole("option", { name: /Find similar/ })).toBeTruthy();
  expect(screen.queryByRole("option", { name: /Upload photos/ })).toBeNull();
});

/**
 * The palette exists only for the keyboard, so losing focus here is
 * a failure of its primary function.
 *
 * The component is built on a bare `DialogPrimitive.Content` with no `Trigger`: Radix
 * unconditionally calls `preventDefault()` and focuses `triggerRef`, which does not exist,
 * so focus moves to `<body>`. `Dialog` and `Drawer` have this wiring, but the palette
 * did not get it until now.
 */
test("closing returns focus to whoever opened the palette", async () => {
  const user = userEvent.setup();

  function Host() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        <CommandPalette
          open={open}
          onClose={() => setOpen(false)}
          sections={[{ id: "s", label: "Section", items: [{ id: "one", label: "First action" }] }]}
          onSelect={() => setOpen(false)}
        />
      </>
    );
  }

  render(<Host />);
  const opener = screen.getByRole("button", { name: "Open" });
  await user.click(opener);

  await user.keyboard("{Escape}");

  expect(document.activeElement).toBe(opener);
});

/**
 * The query does not survive closing.
 *
 * `query` lives in the component's state, not in the dialog's content, and with
 * `open=false` it was kept. After choosing an item, the user on the next opening
 * saw the previous query and the list filtered by it.
 */
test("the palette opens with an empty query after a pick", async () => {
  const user = userEvent.setup();

  function Host() {
    const [open, setOpen] = useState(true);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        <CommandPalette
          open={open}
          onClose={() => setOpen(false)}
          sections={[
            {
              id: "s",
              label: "Section",
              items: [
                { id: "one", label: "First action" },
                { id: "two", label: "Second action" },
              ],
            },
          ]}
          onSelect={() => setOpen(false)}
        />
      </>
    );
  }

  render(<Host />);
  await user.type(screen.getByRole("searchbox"), "Second");
  await user.click(screen.getByText("Second action"));

  await user.click(screen.getByRole("button", { name: "Open" }));

  expect(screen.getByRole("searchbox")).toHaveProperty("value", "");
});

/*
 * Next is the Nextable request: a search that lives on the server. Its three points of the
 * contract, each in a separate test.
 */

const SERVER_SECTION = {
  id: "tasks",
  label: "Tasks",
  prefiltered: true,
  items: [
    // The substring "meetings" appears in no label here; that is the whole point.
    { id: "t1", label: "Schedule a meeting" },
    { id: "t2", label: "Review the notes" },
  ],
};

/**
 * A section filtered from outside is not filtered a second time.
 *
 * Morphological search finds "Schedule a meeting" for the query "meetings", but a
 * local `contains` never matches that pair: there is no substring in the label.
 * Before the flag, the server found it, but the palette showed "no results found".
 */
test("a prefiltered section survives a query its labels do not contain", async () => {
  const user = userEvent.setup();

  render(
    <CommandPalette
      open
      onClose={() => {}}
      onSelect={() => {}}
      sections={[...SECTIONS, SERVER_SECTION]}
    />
  );

  await user.type(screen.getByRole("searchbox"), "meetings");

  expect(screen.getByRole("option", { name: /Schedule a meeting/ })).toBeTruthy();
  // The server's order is preserved too: the server, not the palette, ranked the results.
  expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
    "Schedule a meeting",
    "Review the notes",
  ]);
});

/** Sections of both kinds coexist in one list: commands are still filtered. */
test("a local section keeps filtering next to a prefiltered one", async () => {
  const user = userEvent.setup();

  render(
    <CommandPalette
      open
      onClose={() => {}}
      onSelect={() => {}}
      sections={[...SECTIONS, SERVER_SECTION]}
    />
  );

  await user.type(screen.getByRole("searchbox"), "Uploa");

  expect(screen.getByRole("option", { name: /Upload photos/ })).toBeTruthy();
  expect(screen.queryByRole("option", { name: /Find similar/ })).toBeNull();
  // The server section would return nothing for this query, but while it does return results,
  // it is shown as passed. The decision about its content is made outside.
  expect(screen.getByRole("option", { name: /Schedule a meeting/ })).toBeTruthy();
});

/** The query is passed out to the consumer, or a server search has nothing to run on. */
test("the typed query is reported to the consumer", async () => {
  const user = userEvent.setup();
  const seen: string[] = [];

  render(
    <CommandPalette
      open
      onClose={() => {}}
      onSelect={() => {}}
      onQueryChange={(q) => seen.push(q)}
      sections={SECTIONS}
    />
  );

  await user.type(screen.getByRole("searchbox"), "up");

  expect(seen).toEqual(["u", "up"]);
});

/**
 * The reset on close is passed out too.
 *
 * Without it, the consumer keeps a query that is no longer in the field, and
 * keeps sending network requests for it.
 */
test("closing reports the reset query", async () => {
  const user = userEvent.setup();
  const seen: string[] = [];

  function Host() {
    const [open, setOpen] = useState(true);
    return (
      <CommandPalette
        open={open}
        onClose={() => setOpen(false)}
        onSelect={() => {}}
        onQueryChange={(q) => seen.push(q)}
        sections={SECTIONS}
      />
    );
  }

  render(<Host />);
  await user.type(screen.getByRole("searchbox"), "up");
  await user.keyboard("{Escape}");

  expect(seen.at(-1)).toBe("");
});

/**
 * While a search is in progress, the empty state does not claim that nothing was found.
 *
 * That is exactly what happened on every keystroke: the server response was still in
 * flight, but the palette had already reported a result.
 */
test("loading replaces the not-found line", async () => {
  const user = userEvent.setup();

  render(
    <CommandPalette
      open
      loading
      loadingText="Searching…"
      onClose={() => {}}
      onSelect={() => {}}
      sections={SECTIONS}
    />
  );

  await user.type(screen.getByRole("searchbox"), "zzz");

  expect(screen.getByText("Searching…")).toBeTruthy();
  expect(screen.queryByText("Nothing found")).toBeNull();
});
