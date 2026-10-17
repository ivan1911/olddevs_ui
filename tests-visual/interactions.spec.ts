import { expect, test, type Locator, type Page } from "@playwright/test";
import { focusToolbarButton } from "./editor-toolbar.js";

/**
 * The behavior that has to be checked in a real browser.
 *
 * Level 0 (`npm test`, jsdom) covers almost everything, but not what depends on
 * the browser's own machinery: activating a `<label>` with a click on its
 * descendant, moving focus with Tab, pointer events. A test for that in jsdom
 * either always passes or fails on a working component, and both are worse than
 * having no test at all. The split is recorded in ADR-0012.
 *
 * These are not snapshots: the file sits next to them only because both suites
 * run through one Playwright against the static build of the showcase.
 */
/*
 * The names here are in ENGLISH, and that is deliberate: since 2.0.0 the kit's
 * fallback is English, and the showcase renders without `UiProvider`, so it shows
 * the kit as it is out of the box. Russian labels are checked in `tests/`, where
 * the locale is wired in explicitly through `tests/ru.tsx`.
 */

test("Checkbox: clicking the label toggles the box", async ({ page }) => {
  await page.goto("/iframe.html?id=inputs-checkbox--playground&globals=theme:dark;accent:blue");

  const box = page.getByRole("checkbox");
  await expect(box).not.toBeChecked();

  // Click on the text itself: the label must be part of the hit area, not just
  // sit next to the box.
  await page.getByText("Show in the feed").click();
  await expect(box).toBeChecked();
});

test("Checkbox: a click does not clear the third state", async ({ page }) => {
  await page.goto("/iframe.html?id=inputs-checkbox--matrix&globals=theme:dark;accent:blue");

  const mixed = page.getByRole("checkbox", { name: "accent, indeterminate" });
  await expect(mixed).toHaveJSProperty("indeterminate", true);

  // We click the `<label>`, not the input itself: it sits inside `VisuallyHidden`,
  // and Playwright refuses to click what is invisible, which is fair, since a user
  // cannot either. A checkbox's hit area without a label is the box inside the label.
  await page.locator('label:has(input[aria-label="accent, indeterminate"])').click();

  // The caller sets "partial" after recounting the set; a click does not clear it.
  await expect(mixed).toHaveJSProperty("indeterminate", true);
});

test("TextControl: a growing field grows with the content and stops at maxRows", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=inputs-textcontrol--growing&globals=theme:dark;accent:blue");

  const growing = page.getByLabel("Grows with content");
  const before = (await growing.boundingBox())!.height;

  await growing.click();
  await growing.press("End");
  await growing.pressSequentially("\nsecond\nthird");

  const after = (await growing.boundingBox())!.height;
  expect(after).toBeGreaterThan(before);

  // The limit: a field with `maxRows={4}` is never taller than four lines, however
  // much text it holds, and scrolls inside itself.
  const capped = page.getByLabel("Grows to a limit, then scrolls");
  const cappedBox = (await capped.boundingBox())!;
  const scrollable = await capped.evaluate(
    (el) => (el as HTMLTextAreaElement).scrollHeight > (el as HTMLTextAreaElement).clientHeight
  );
  expect(scrollable).toBe(true);
  expect(cappedBox.height).toBeLessThan(after + 200);
});

test("TextControl: the counter counts characters, not keystrokes", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=inputs-textcontrol--with-counter&globals=theme:dark;accent:blue"
  );

  const field = page.getByLabel("With a limit");
  await expect(page.getByText("16/40")).toBeVisible();

  await field.click();
  await field.press("Backspace");
  await expect(page.getByText("15/40")).toBeVisible();
});

test("SearchControl: the on-screen keyboard replaces the selection, switches the layout and returns focus", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=inputs-searchcontrol--on-screen-keyboard&globals=theme:dark;accent:blue"
  );

  const input = page.getByRole("searchbox", { name: "Search the library" });
  await input.evaluate((node) => {
    const field = node as HTMLInputElement;
    field.focus();
    field.setSelectionRange(2, 4);
    field.dispatchEvent(new Event("select", { bubbles: true }));
  });

  const trigger = page.getByRole("button", { name: "Open the on-screen keyboard" });
  await trigger.click();
  const keyboard = page.getByRole("dialog", { name: "Russian keyboard" });
  await expect(keyboard).toBeVisible();
  await expect(keyboard).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(input).toBeFocused();

  const handle = keyboard.getByRole("button", { name: "Move the on-screen keyboard" });
  const before = await handle.boundingBox();
  if (before == null) throw new Error("drag handle has no bounding box");
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 - 80, before.y + before.height / 2 - 48);
  await page.mouse.up();
  const after = await handle.boundingBox();
  expect(after?.x).toBeLessThan(before.x - 60);
  expect(after?.y).toBeLessThan(before.y - 32);

  await page.getByRole("button", { name: "Show symbols" }).click();
  await page.getByRole("button", { name: "*" }).click();
  await expect(input).toHaveValue("su*et");
  await expect(input).toBeFocused();

  await page.getByRole("button", { name: "Show the extra symbol set" }).click();
  await expect(page.getByRole("button", { name: "√" })).toBeVisible();
  await page.getByRole("button", { name: "√" }).click();
  await expect(input).toHaveValue("su*√et");
  await expect(input).toBeFocused();

  await page.getByRole("button", { name: "Show the primary symbol set" }).click();
  await page.getByRole("button", { name: "Show Russian letters" }).click();

  await page.getByRole("button", { name: "Shift" }).click();
  await expect(page.getByRole("button", { name: "№" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Semicolon" })).toBeVisible();
  await page.getByRole("button", { name: "№" }).click();
  await expect(input).toHaveValue("su*√№et");
  await expect(page.getByRole("button", { name: "3" })).toBeVisible();

  await page.getByRole("button", { name: "Switch layout to English" }).click();
  await expect(page.getByRole("dialog", { name: "English keyboard" })).toBeVisible();
  await expect(input).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "English keyboard" })).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await expect(page.getByRole("dialog", { name: "English keyboard" })).toBeVisible();
  await input.click();
  await expect(page.getByRole("dialog", { name: "English keyboard" })).toBeHidden();
  await expect(input).toBeFocused();
});

test("SearchControl: the on-screen keyboard is available only from the medium breakpoint", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=inputs-searchcontrol--on-screen-keyboard&globals=theme:dark;accent:blue"
  );

  const trigger = page.locator('button[aria-label="Open the on-screen keyboard"]');

  await page.setViewportSize({ width: 375, height: 667 });
  await expect(trigger).toHaveCSS("display", "none");

  await page.setViewportSize({ width: 768, height: 900 });
  await expect(trigger).toHaveCSS("display", "flex");
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Russian keyboard" })).toBeVisible();
});

test("Keyboard: the matrix shows both closed and immediately open search scenarios", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=content-keyboard--matrix&globals=theme:dark;accent:blue");

  await expect(page.getByRole("searchbox", { name: "open · Russian · query" })).toHaveValue(
    "sunset"
  );
  await expect(page.getByRole("searchbox", { name: "open · English · query" })).toHaveValue(
    "sunset"
  );
  await expect(page.getByRole("dialog", { name: "Russian keyboard" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "English keyboard" })).toBeVisible();

  const triggers = page.getByRole("button", { name: "Open the on-screen keyboard" });
  await expect(triggers).toHaveCount(4);
  await expect(
    page.locator('button[aria-label="Open the on-screen keyboard"][aria-expanded="true"]')
  ).toHaveCount(2);

  await page.setViewportSize({ width: 768, height: 1000 });
  // Popovers move with the field not at the moment the width changes but on the
  // next frame: floating-ui recalculates the position asynchronously. A one-off
  // measurement under load caught the old two-column layout, where the panels sit
  // in one row, so the gap is polled until the layout settles.
  await expect
    .poll(async () => {
      const russianKeyboard = await page
        .getByRole("dialog", { name: "Russian keyboard" })
        .boundingBox();
      const englishKeyboard = await page
        .getByRole("dialog", { name: "English keyboard" })
        .boundingBox();
      if (russianKeyboard == null || englishKeyboard == null) return null;
      return englishKeyboard.y - (russianKeyboard.y + russianKeyboard.height);
    })
    .toBeGreaterThan(0);

  await page
    .getByRole("dialog", { name: "Russian keyboard" })
    .getByRole("button", { name: "Submit search" })
    .click();
  await expect(page.getByRole("status")).toHaveText("Search submitted");
});

test("SearchControl: double-clicking Shift holds Caps Lock", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=inputs-searchcontrol--on-screen-keyboard&globals=theme:dark;accent:blue"
  );

  const input = page.getByRole("searchbox", { name: "Search the library" });
  await input.evaluate((node) => {
    const field = node as HTMLInputElement;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
    field.dispatchEvent(new Event("select", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Open the on-screen keyboard" }).click();

  const shift = page.getByRole("button", { name: "Shift" });
  await shift.dblclick();
  await expect(shift).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Й", exact: true }).click();
  await expect(input).toHaveValue("sunsetЙ");
  await expect(input).toBeFocused();

  await shift.click();
  await expect(shift).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "й", exact: true })).toBeVisible();
});

test("SearchControl: the old empty popover area does not intercept a click after the move", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=inputs-searchcontrol--on-screen-keyboard&globals=theme:dark;accent:blue"
  );

  await page.getByRole("button", { name: "Open the on-screen keyboard" }).click();
  const keyboard = page.getByRole("dialog", { name: "Russian keyboard" });
  const originalBounds = await keyboard.boundingBox();
  if (originalBounds == null) throw new Error("keyboard popover has no bounding box");

  const handle = keyboard.getByRole("button", { name: "Move the on-screen keyboard" });
  const handleBounds = await handle.boundingBox();
  if (handleBounds == null) throw new Error("drag handle has no bounding box");
  await page.mouse.move(
    handleBounds.x + handleBounds.width / 2,
    handleBounds.y + handleBounds.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    handleBounds.x + handleBounds.width / 2 - 80,
    handleBounds.y + handleBounds.height / 2 - 48
  );
  await page.mouse.up();

  // This point lay inside the Popover before the move, but is now outside the
  // visible panel. The click must count as outside and close the keyboard.
  await page.mouse.click(
    originalBounds.x + originalBounds.width - 4,
    originalBounds.y + originalBounds.height - 4
  );
  await expect(keyboard).toBeHidden();
});

test("SearchControl: Escape closes the keyboard but not the dialog under it", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=inputs-searchcontrol--keyboard-in-dialog&globals=theme:dark;accent:blue"
  );

  const dialog = page.getByRole("dialog", { name: "Search inside a dialog" });
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Open the on-screen keyboard" }).click();
  await expect(page.getByRole("dialog", { name: "Russian keyboard" })).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.getByRole("dialog", { name: "Russian keyboard" })).toBeHidden();
  await expect(dialog).toBeVisible();
});

/*
  The seam between two libraries: a react-aria menu inside a Radix dialog.

  The only place in the package where two independent focus managers meet on one
  screen. The check lives here, not in jsdom, because jsdom does not move focus on
  Tab the way a browser does: a focus-trap test would pass there regardless, so it
  would check nothing (ADR-0012).
*/
test("Menu inside Dialog: Escape closes the menu but not the window", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=overlays-menu--menu-inside-dialog&globals=theme:dark;accent:blue"
  );

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await page.getByRole("button", { name: "Actions" }).click();
  await expect(page.getByRole("menu")).toBeVisible();

  await page.keyboard.press("Escape");
  // The menu closed and the window stayed: otherwise one Escape would dismiss the
  // whole form along with unsaved changes.
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

/*
  The same seam in the Editor: the "¶" menu (the Block type, OLDSUI-64) is a
  react-aria menu, and the window is Radix. jsdom does not reproduce this
  combination (`tests/rich-text-editor-block-menu.test.tsx` checks the layer stack
  on `ModalOverlay`), so the `Dialog` lives here. The path is keyboard-only, as for
  a user without a mouse: `Alt+F10` into the Toolbar, arrows to "¶", `Enter` opens it.
*/
test("RichTextEditor inside Dialog: Escape closes the block type menu, not the window", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=inputs-richtexteditor--inside-dialog&globals=theme:dark;accent:blue"
  );

  const dialog = page.getByRole("dialog", { name: "Edit the note" });
  const field = page.getByRole("textbox", { name: "Document" });
  await expect(dialog).toBeVisible();
  await field.click();
  await page.mouse.move(0, 0);

  // Alt+F10 into the Toolbar, arrows to "¶".
  const button = await focusToolbarButton(page, "Block type: Text");
  await expect(button).toBeFocused();

  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu", { name: "Block type: Text" });
  await expect(menu).toBeVisible();
  await expect(page.getByRole("menuitemradio", { name: /^Text/ })).toHaveAttribute(
    "aria-checked",
    "true"
  );

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(button).toBeFocused();

  // Choosing an item changes the Block and returns focus to the Document; the
  // window stays put. `↓` opens the menu on the first item; "Heading 2" is the third.
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitemradio", { name: /^Text/ })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitemradio", { name: /^Heading 2/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  await expect(field.locator("h2")).toHaveCount(1);
  await expect(field).toBeFocused();
  await expect(page.getByRole("button", { name: "Block type: Heading 2" })).toBeVisible();
  await expect(dialog).toBeVisible();
});

/*
  The Alignment and Lists menus (OLDSUI-66) are the same react-aria menus inside a
  Radix window: Escape closes the menu, not the window, and choosing an item from
  the keyboard changes the Block and returns focus to the Document.
*/
test("RichTextEditor inside Dialog: the alignment and lists menus work from the keyboard, Escape keeps the window", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=inputs-richtexteditor--inside-dialog&globals=theme:dark;accent:blue"
  );

  const dialog = page.getByRole("dialog", { name: "Edit the note" });
  const field = page.getByRole("textbox", { name: "Document" });
  await expect(dialog).toBeVisible();
  await field.locator("p").first().click();
  await page.mouse.move(0, 0);

  const lists = await focusToolbarButton(page, "Lists");
  await page.keyboard.press("Enter");
  const listMenu = page.getByRole("menu", { name: "Lists" });
  await expect(listMenu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(listMenu).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(lists).toBeFocused();

  // "Numbered" is the second item; choosing it wraps the Block, and the button names it.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitemradio", { name: /^Numbered list/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(field.locator("ol > li")).toHaveCount(1);
  await expect(field).toBeFocused();
  await expect(page.getByRole("button", { name: "List: numbered" })).toBeVisible();

  await focusToolbarButton(page, "Alignment: left");
  await page.keyboard.press("ArrowDown");
  const alignMenu = page.getByRole("menu", { name: "Alignment: left" });
  await expect(alignMenu).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitemradio", { name: /^Align center/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(alignMenu).toBeHidden();
  await expect(field.locator('li p[data-align="center"]')).toHaveCount(1);
  await expect(field).toBeFocused();
  await expect(page.getByRole("button", { name: "Alignment: center" })).toBeVisible();
  await expect(dialog).toBeVisible();
});

/*
  The Insert menu opened by `/` (OLDSUI-43). jsdom has no layout, so "the list at
  the caret" cannot be checked there: all nodes have zero coordinates. Here it is real.
*/
test("RichTextEditor insert menu: the slash list opens at the caret and Enter applies", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=inputs-richtexteditor--insert-menu-slash&globals=theme:dark;accent:blue"
  );

  const field = page.getByRole("textbox", { name: "Document" });
  const listbox = page.getByRole("listbox", { name: "Insert block" });
  await expect(listbox).toBeVisible();
  // Focus stays in the field: the list is part of the combobox, not a new stop.
  await expect(field).toBeFocused();

  // The list sits under the typed `/`: its left edge lines up with it, and its top is below it.
  const command = field.locator(".suggestion");
  const caret = (await command.boundingBox())!;
  const panel = (await listbox.boundingBox())!;
  expect(Math.abs(panel.x - caret.x)).toBeLessThan(24);
  expect(panel.y).toBeGreaterThanOrEqual(caret.y + caret.height - 1);

  const first = await field.getAttribute("aria-activedescendant");
  await page.keyboard.press("ArrowDown");
  await expect(field).not.toHaveAttribute("aria-activedescendant", first!);

  // The second row of the "Insert" section is a divider.
  await page.keyboard.press("Enter");
  await expect(listbox).toBeHidden();
  await expect(field.locator("hr")).toHaveCount(1);
  await expect(field).not.toContainText("/");
});

test("RichTextEditor inside Dialog: Escape closes the insert menu, not the window", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=inputs-richtexteditor--inside-dialog&globals=theme:dark;accent:blue"
  );

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // The last paragraph is empty: `/` at the start of a Block opens the menu.
  await page.locator('[contenteditable="true"] p').last().click();
  await page.keyboard.type("/");
  const listbox = page.getByRole("listbox", { name: "Insert block" });
  await expect(listbox).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(listbox).toBeHidden();
  await expect(dialog).toBeVisible();
  // What was typed stays as text.
  await expect(page.locator('[contenteditable="true"] p').last()).toHaveText("/");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

/*
  Block commands (OLDSUI-63). jsdom assembles the event by hand, but here the
  browser assembles it: `key` under Shift and Alt, `⌘` on Mac and `Ctrl` on the
  rest (`ControlOrMeta` is the same fork as in ProseMirror). This checks that the
  engine's key combinations match what arrives from a real keyboard.
*/
test("RichTextEditor block commands: Alt+Shift+arrows move, Mod+] and Mod+[ shift, Mod+Shift+D duplicates", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=inputs-richtexteditor--playground&globals=theme:dark;accent:blue"
  );

  const document = page.getByRole("textbox", { name: "Document" });
  const steps = document.locator("ol > li");
  await expect(steps).toHaveText(["Step one", "Step two"]);
  await steps.first().locator("p").click();
  // ProseMirror reads the browser's selection via `selectionchange`, not instantly.
  await page.waitForTimeout(300);

  await page.keyboard.press("Alt+Shift+ArrowDown");
  await expect(steps).toHaveText(["Step two", "Step one"]);
  await page.keyboard.press("Alt+Shift+ArrowUp");
  await expect(steps).toHaveText(["Step one", "Step two"]);

  // The caret moved with the item and is now in "Step one"; next, into the second item.
  await steps.nth(1).locator("p").click();
  await page.keyboard.press("End");
  await page.waitForTimeout(300);
  await page.keyboard.press("ControlOrMeta+]");
  await expect(document.locator("ol > li > ol > li")).toHaveText(["Step two"]);
  await page.keyboard.press("ControlOrMeta+[");
  await expect(document.locator("ol > li > ol")).toHaveCount(0);
  await expect(steps).toHaveText(["Step one", "Step two"]);

  await page.keyboard.press("ControlOrMeta+Shift+D");
  await expect(steps).toHaveText(["Step one", "Step two", "Step two"]);
  // The caret is in the copy: what is typed lands in the third item.
  await page.keyboard.type("!");
  await expect(steps).toHaveText(["Step one", "Step two", "Step two!"]);
});

/*
  The highlight theme is variables on the element with `data-theme`, and a code
  block takes them from the NEAREST ancestor with a theme (OLDSUI-50, ADR-0051).
  That is how the future "paper" works: a Document with `data-theme="light"` inside
  a dark app. Rules of the form "theme → token under it" would fight over file order
  with nested themes, and a light paper would show dark tokens, so the cascade is
  checked live.
*/
test("RichTextView code theme: a nested data-theme wrapper picks its own GitHub theme", async ({
  page,
}) => {
  const colours = () =>
    page.evaluate(() => {
      const keyword = document.querySelector(".hljs-keyword")!;
      const pre = keyword.closest("pre")!;
      return {
        keyword: getComputedStyle(keyword).color,
        pre: getComputedStyle(pre).backgroundColor,
      };
    });

  await page.goto(
    "/iframe.html?id=content-richtextview--code-blocks&globals=theme:dark;accent:blue"
  );
  await page.locator(".hljs-keyword").first().waitFor();
  expect(await colours()).toEqual({ keyword: "rgb(255, 123, 114)", pre: "rgb(13, 17, 23)" });

  // A light paper inside a dark app: GitHub Light.
  await page
    .locator("#storybook-root")
    .evaluate((root) => root.setAttribute("data-theme", "light"));
  expect(await colours()).toEqual({ keyword: "rgb(215, 58, 73)", pre: "rgb(255, 255, 255)" });

  // And the other way round: a dark island inside a light page: GitHub Dark.
  await page.goto(
    "/iframe.html?id=content-richtextview--code-blocks&globals=theme:light;accent:blue"
  );
  await page.locator(".hljs-keyword").first().waitFor();
  expect((await colours()).keyword).toBe("rgb(215, 58, 73)");
  await page.locator("#storybook-root").evaluate((root) => root.setAttribute("data-theme", "dim"));
  expect(await colours()).toEqual({ keyword: "rgb(255, 123, 114)", pre: "rgb(13, 17, 23)" });
});

/*
  The Paper (`surface="paper"`, OLDSUI-52) in a live browser: the Document is light
  in a dark, dim and branded app, while the Editor's Toolbar follows the app's
  theme. The jsdom test (`tests/rich-text-paper-css.test.tsx`) checks the same on
  rendered layers; here it is the real cascade with the Tailwind layers.
*/
for (const globals of [
  "theme:dark;accent:blue",
  "theme:dim;accent:blue",
  "theme:dark;accent:blue;brand:teal",
]) {
  test(`paper surface stays light inside the app — ${globals}`, async ({ page }) => {
    await page.goto(`/iframe.html?id=inputs-richtexteditor--paper-surface&globals=${globals}`);
    const sheet = page.locator('[data-surface="paper"]');
    await sheet.locator(".hljs-keyword").first().waitFor();
    const colours = await page.evaluate(() => {
      const paper = document.querySelector('[data-surface="paper"]')!;
      const at = (selector: string) => getComputedStyle(paper.querySelector(selector)!);
      const toolbar = document.querySelector('[role="toolbar"]')!.parentElement!;
      return {
        sheet: getComputedStyle(paper).backgroundColor,
        text: at("p").color,
        danger: at('span[data-color="danger"]').color,
        marker: at('mark[data-color="yellow"]').backgroundColor,
        keyword: at(".hljs-keyword").color,
        code: at("pre").backgroundColor,
        heading: at("th").backgroundColor,
        toolbar: getComputedStyle(toolbar).backgroundColor,
        insideToolbar: !!paper.querySelector('[role="toolbar"]'),
      };
    });
    expect(colours).toMatchObject({
      sheet: "rgb(255, 255, 255)",
      text: "rgb(23, 33, 43)",
      danger: "rgb(184, 45, 45)",
      marker: "rgb(255, 234, 128)",
      keyword: "rgb(215, 58, 73)",
      code: "rgb(255, 255, 255)",
      heading: "rgb(248, 250, 252)",
      insideToolbar: false,
    });
    // The Toolbar sits on the field's background in the APP theme, which is dark.
    expect(colours.toolbar).not.toBe("rgb(255, 255, 255)");
    expect(colours.toolbar).toMatch(/^rgb\((\d{1,2}), (\d{1,2}), (\d{1,2})\)$/);
  });
}

/*
  The bright marker (OLDSUI-61) in a live browser: the three colours are the same
  in every theme, the text on them is dark, and the former names keep their old
  values with the theme's text.
*/
for (const theme of ["dark", "light", "dim"]) {
  test(`marker palette is bright with dark text in every theme — ${theme}`, async ({ page }) => {
    await page.goto(
      `/iframe.html?id=content-richtextview--marker-palette&globals=theme:${theme};accent:blue`
    );
    await page.locator('mark[data-color="yellow"]').first().waitFor();
    const paint = await page.evaluate(() => {
      const at = (name: string) => {
        const style = getComputedStyle(document.querySelector(`mark[data-color="${name}"]`)!);
        return { background: style.backgroundColor, text: style.color };
      };
      return { yellow: at("yellow"), green: at("green"), pink: at("pink"), blue: at("blue") };
    });
    for (const [name, background] of [
      ["yellow", "rgb(255, 234, 128)"],
      ["green", "rgb(170, 255, 128)"],
      ["pink", "rgb(255, 128, 191)"],
    ] as const) {
      expect(paint[name], name).toEqual({ background, text: "rgb(26, 26, 26)" });
    }
    // The former name reads with its own value and does not take the marker's dark text.
    expect(paint.blue.text).not.toBe("rgb(26, 26, 26)");
  });
}

test("RichTextEditor inside Dialog: Alt+F10 reaches the code language menu, Escape closes it, not the window", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=inputs-richtexteditor--inside-dialog&globals=theme:dark;accent:blue"
  );

  const dialog = page.getByRole("dialog", { name: "Edit the note" });
  await expect(dialog).toBeVisible();

  // A code fence with a language in an empty paragraph: a Python code block (OLDSUI-50).
  await page.locator('[contenteditable="true"] p').last().click();
  await page.keyboard.type("```python ");
  await page.keyboard.type("print(1)");
  const trigger = page.getByRole("button", { name: "Language: Python" });
  await expect(trigger).toBeVisible();

  await page.keyboard.press("Alt+F10");
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu", { name: "Language: Python" });
  await expect(menu).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(trigger).toBeFocused();
  // The menu outlives its exit (ADR-0043), and while it is in the DOM the window
  // does not take Escape by itself (`hasOpenAriaOverlay`, the same selector). Wait
  // until it is gone entirely: otherwise the check below would pass thanks to the
  // animation, not the header, as it did before the fix.
  await expect(page.locator("[data-rac][data-placement]")).toHaveCount(0);
  // Escape on the button itself returns to the code, and the window stays. The
  // window's visibility would not prove this: a closed window also outlives its
  // exit and is still visible for a while. Radix drops `data-state="open"` at once,
  // in the same frame.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("textbox", { name: "Document" })).toBeFocused();
  await expect(dialog).toHaveAttribute("data-state", "open");
  await page.keyboard.press("Alt+F10");
  await expect(trigger).toBeFocused();

  // Choosing from the keyboard: the language changed, and focus returned to the code.
  await page.keyboard.press("Enter");
  await page.getByRole("menuitemradio", { name: "YAML" }).press("Enter");
  await expect(page.getByRole("button", { name: "Language: YAML" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Document" })).toBeFocused();
  await expect(dialog).toHaveAttribute("data-state", "open");
});

test("RichTextView code blocks: Copy puts the plain code text on the clipboard", async ({
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(
    "/iframe.html?id=content-richtextview--code-block-header&globals=theme:dark;accent:blue"
  );

  // The buttons are inserted by a client-side Island after mounting; the block is
  // highlighted on the "server", and the tokens do not go into the clipboard.
  // Six: three blocks each in the Editor and in the View.
  const copy = page.getByRole("button", { name: "Copy" });
  await expect(copy).toHaveCount(6);
  await expect(page.locator(".hljs-keyword").first()).toBeVisible();
  await page.locator("[data-code-block]").first().getByRole("button", { name: "Copy" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toHaveCount(1);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    '# Greets a user\ndef greet(name: str) -> str:\n    return f"Hello, {name}!" * 2'
  );
});

test("RichTextEditor code blocks: Alt+F10 goes language, copy, toolbar; Enter on copy copies", async ({
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(
    "/iframe.html?id=inputs-richtexteditor--code-blocks&globals=theme:dark;accent:blue"
  );

  const first = page.locator("[data-code-header]").first();
  await first.getByRole("button", { name: "Language: Python" }).waitFor();
  // Both buttons are outside the Tab order; the entry point is the caret in the block and `Alt+F10`.
  await expect(first.getByRole("button", { name: "Copy" })).toHaveAttribute("tabindex", "-1");
  const document = page.getByRole("textbox", { name: "Document" });
  // Highlighting is decoration: until the tokens exist, the editor has not settled
  // yet, and a click could land on a block that is about to re-render.
  await expect(document.locator("pre code .hljs-keyword").first()).toBeVisible();
  await document.locator("pre code").first().click();
  // ProseMirror reads the browser's selection via `selectionchange`, not instantly:
  // a shortcut pressed right after a click still sees the previous selection.
  await page.waitForTimeout(300);
  await page.keyboard.press("Alt+F10");
  await expect(first.getByRole("button", { name: "Language: Python" })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(first.getByRole("button", { name: "Copy" })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Alt+F10");
  await expect(first.getByRole("button", { name: "Copy" })).toBeFocused();

  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("def greet");
  expect(await page.evaluate(() => navigator.clipboard.readText())).not.toContain("hljs");

  await page.keyboard.press("Alt+F10");
  await expect(page.locator('[role="toolbar"] :focus')).toHaveCount(1);
});

test("RichTextEditor inside Dialog: Escape closes the link popover, not the window", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=inputs-richtexteditor--inside-dialog&globals=theme:dark;accent:blue"
  );

  const dialog = page.getByRole("dialog", { name: "Edit the note" });
  await expect(dialog).toBeVisible();

  // The word is selected with a double click, the way a person does it; the popover
  // opens from the keyboard, bypassing the Toolbar.
  await page.getByRole("textbox", { name: "Document" }).getByText("Escape").dblclick();
  await page.keyboard.press("ControlOrMeta+k");
  const address = page.getByRole("textbox", { name: "Address" });
  await expect(address).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(address).toBeHidden();
  await expect(dialog).toBeVisible();
  // Escape cancels and returns focus to the document, not to `<body>`.
  await expect(page.getByRole("textbox", { name: "Document" })).toBeFocused();
});

test("RichTextEditor inside Dialog: Escape closes the shortcuts reference, not the window, and focus returns to its button", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=inputs-richtexteditor--inside-dialog&globals=theme:dark;accent:blue"
  );
  const dialog = page.getByRole("dialog", { name: "Edit the note" });
  await expect(dialog).toBeVisible();

  const button = page.getByRole("button", { name: "Keyboard shortcuts" });
  await button.click();
  const reference = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(reference).toBeVisible();
  await expect(reference.getByRole("columnheader")).toHaveText(["Command", "Shortcut"]);

  await page.keyboard.press("Escape");
  await expect(reference).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(button).toBeFocused();

  // A click outside: an empty spot in the window closes the reference and returns focus to the button.
  await button.click();
  await expect(reference).toBeVisible();
  await dialog.getByRole("heading", { name: "Edit the note" }).click();
  await expect(reference).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(button).toBeFocused();
});

test("RichTextEditor inside Dialog: Escape closes the colour picker, then the custom colour popover, then the window", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=inputs-richtexteditor--inside-dialog&globals=theme:dark;accent:blue"
  );

  const dialog = page.getByRole("dialog", { name: "Edit the note" });
  await expect(dialog).toBeVisible();

  // A plain word rather than "Escape": that one is inline code, and colour is unavailable on it.
  await dblclickWord(page, "inside");
  // "Color" › "Custom color…" of the text grid (OLDSUI-153). "Color" is the button
  // of the Bubble menu (OLDSUI-154); the Toolbar has only "Highlight".
  await page
    .getByRole("toolbar", { name: "Selection formatting", exact: true })
    .getByRole("button", { name: "Color: Default", exact: true })
    .click();
  await page
    .getByRole("group", { name: "Text color" })
    .getByRole("menuitemradio", { name: "Custom color…" })
    .click();
  const popover = page.getByRole("dialog", { name: "Custom text color" });
  await expect(popover).toBeVisible();
  await popover.getByRole("button", { name: /^Color #/ }).click();
  const hex = page.getByRole("textbox", { name: "HEX" });
  await expect(hex).toBeVisible();

  // Each Escape closes exactly one layer (ADR-0041).
  await page.keyboard.press("Escape");
  await expect(hex).toBeHidden();
  await expect(popover).toBeVisible();
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
  await expect(dialog).toBeVisible();
  // Focus returned to the document, not to `<body>`.
  await expect(page.getByRole("textbox", { name: "Document" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

/*
  The Highlight popover and the "…" menu inside a window and a drawer (OLDSUI-65,
  OLDSUI-153). jsdom checks the layer stack on `ModalOverlay`; the real `Dialog`
  and `Drawer` are here: with the mouse and from the keyboard.
*/
/** Double-click exactly on a word: the middle of its rectangle, not of the paragraph. */
async function dblclickWord(page: Page, word: string) {
  // Until Readiness, a Skeleton stands in the field's place (OLDSUI-110): the same
  // text, but without `role="textbox"`, so the word search below would find nothing.
  // Wait for the engine.
  await expect(page.getByRole("textbox", { name: "Document" })).toBeVisible();
  const point = await page.evaluate((text) => {
    const field = document.querySelector('[role="textbox"][aria-label="Document"]')!;
    const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.textContent!.indexOf(text);
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + text.length);
      const box = range.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }
    throw new Error(`no "${text}" in the document`);
  }, word);
  await page.mouse.dblclick(point.x, point.y);
  // ProseMirror reads the Document's selection from the DOM asynchronously: a key
  // pressed earlier would move focus with the caret instead of the word. The Bubble
  // menu appears only when the selection is non-empty in the Editor's state, and
  // that is the honest synchronization point.
  await expect(
    page.getByRole("toolbar", { name: "Selection formatting", exact: true })
  ).toBeVisible();
}

for (const [story, word] of [
  ["inside-dialog", "Escape"],
  ["inside-drawer", "word"],
] as const) {
  test(`RichTextEditor ${story}: a mouse picks Highlight › Pink and focus returns to the document`, async ({
    page,
  }) => {
    await page.goto(
      `/iframe.html?id=inputs-richtexteditor--${story}&globals=theme:dark;accent:blue`
    );
    const layer = page.getByRole("dialog", { name: "Edit the note" });
    const field = page.getByRole("textbox", { name: "Document" });
    await expect(layer).toBeVisible();

    await dblclickWord(page, word);
    // The Toolbar's buttons: a Bubble menu over the selection has its own too.
    const toolbar = page.getByRole("toolbar", { name: "Formatting", exact: true });
    await toolbar.getByRole("button", { name: "Highlight: None" }).click();
    await page.getByRole("menuitemradio", { name: "Pink" }).click();

    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(field.locator('mark[data-color="pink"]')).toHaveText(word);
    await expect(field).toBeFocused();
    await expect(layer).toBeVisible();

    // The mark from the "…" menu, also with the mouse.
    await toolbar.getByRole("button", { name: "More formatting" }).click();
    await page.getByRole("menuitemcheckbox", { name: /Underline/ }).click();
    await expect(field.locator("u")).toHaveText(word);
    await expect(field).toBeFocused();
    await expect(layer).toBeVisible();
  });

  test(`RichTextEditor ${story}: the keyboard walks the Highlight grid, Escape closes it and not the layer`, async ({
    page,
  }) => {
    await page.goto(
      `/iframe.html?id=inputs-richtexteditor--${story}&globals=theme:dark;accent:blue`
    );
    const layer = page.getByRole("dialog", { name: "Edit the note" });
    const field = page.getByRole("textbox", { name: "Document" });
    await expect(layer).toBeVisible();
    await dblclickWord(page, word);
    await page.mouse.move(0, 0);

    // Alt+F10 into the Toolbar, arrows to "Highlight".
    const button = await focusToolbarButton(page, "Highlight: None");
    await expect(button).toBeFocused();

    // Enter opens the row, and focus lands on the first swatch (the word has no highlight yet).
    await page.keyboard.press("Enter");
    const grid = page.getByRole("menu", { name: "Highlight" });
    await expect(grid).toBeVisible();
    await expect(page.getByRole("menuitemradio", { name: "Gray" })).toBeFocused();

    // Escape closes only the popover and returns focus to the button.
    await page.keyboard.press("Escape");
    await expect(grid).toBeHidden();
    await expect(button).toBeFocused();
    await expect(layer).toBeVisible();

    // Choosing from the keyboard: Gray → Brown → Orange → Yellow → Green, Enter.
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitemradio", { name: "Gray" })).toBeFocused();
    for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("menuitemradio", { name: "Green" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(field.locator('mark[data-color="green"]')).toHaveText(word);
    await expect(field).toBeFocused();
    await expect(layer).toBeVisible();
  });
}

test("Menu inside Dialog: after the menu closes focus stays in the window", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=overlays-menu--menu-inside-dialog&globals=theme:dark;accent:blue"
  );

  const trigger = page.getByRole("button", { name: "Actions" });
  await trigger.click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");

  // Focus must return to the trigger, not drift to `<body>`: otherwise a keyboard
  // user loses their place in the form.
  await expect(trigger).toBeFocused();
});

test("Menu inside Dialog: the focus trap does not let go while the menu is open", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=overlays-menu--menu-inside-dialog&globals=theme:dark;accent:blue"
  );

  await page.getByRole("button", { name: "Actions" }).click();
  await expect(page.getByRole("menu")).toBeVisible();

  // Ten Tabs is certainly more than the elements in the window: if the trap leaks,
  // focus will by then have moved to the page under the overlay.
  for (let i = 0; i < 10; i++) await page.keyboard.press("Tab");

  // What is checked is NOT "focus inside the dialog": with the menu open, focus
  // legitimately lies in the menu's portal, which is not a descendant of the dialog.
  // What matters to the user is checked: focus has not moved to the page behind the overlay.
  const escaped = await page.evaluate(() => {
    const active = document.activeElement;
    if (active == null || active === document.body) return false;
    const opener = document.querySelector("button");
    return active === opener;
  });
  expect(escaped).toBe(false);

  // And the positive half: focus is where it belongs, in the window or in the menu.
  const contained = await page.evaluate(() => {
    const active = document.activeElement;
    const dialog = document.querySelector('[role="dialog"]');
    const menu = document.querySelector('[role="menu"]');
    return (
      active != null && ((dialog?.contains(active) ?? false) || (menu?.contains(active) ?? false))
    );
  });
  expect(contained).toBe(true);
});

/*
  A mouse click on a react-aria overlay inside a Radix modal layer (OLDSUI-51).

  A modal Radix sets an inline `pointer-events: none` on `<body>` and gives the
  pointer back only to ITS OWN layers. The react-aria menu panel and the suggestion
  list live in a portal directly under `<body>`, inherited `none`, and the click fell
  through to the backdrop: an item could only be picked from the keyboard. The checks
  above pressed Escape and never picked an item with the mouse, which is why the
  defect survived until the Editor epic.

  The click here is WITHOUT `force`: the check that "the element accepts the pointer"
  in Playwright is exactly what was broken. The second half of each test: the window
  stays open, and Radix must not count a click on the portal as a "click outside".
*/
test("Menu inside Dialog: a mouse click on an item runs it and keeps the window", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=overlays-menu--menu-inside-dialog&globals=theme:dark;accent:blue"
  );

  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Duplicate" }).click();

  await expect(page.getByText("Last action: Duplicate")).toBeVisible();
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(page.getByRole("dialog", { name: "Collection settings" })).toBeVisible();
});

test("Menu inside Drawer: a mouse click on an item runs it and keeps the panel", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=overlays-menu--menu-inside-drawer&globals=theme:dark;accent:blue"
  );

  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Archive" }).click();

  await expect(page.getByText("Last action: Archive")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Collection settings" })).toBeVisible();
});

test("Combobox inside Dialog: a mouse click on a suggestion picks it", async ({ page }) => {
  await page.goto("/iframe.html?id=inputs-combobox--inside-dialog&globals=theme:dark;accent:blue");

  await page.getByRole("combobox", { name: "Category" }).fill("ci");
  await page.getByRole("option", { name: "City" }).click();

  await expect(page.getByText("Picked: city")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Category" })).toHaveValue("City");
  await expect(page.getByRole("dialog", { name: "Collection settings" })).toBeVisible();
});

test("Combobox inside Drawer: a mouse click on a suggestion picks it", async ({ page }) => {
  await page.goto("/iframe.html?id=inputs-combobox--inside-drawer&globals=theme:dark;accent:blue");

  await page.getByRole("combobox", { name: "Category" }).fill("sp");
  await page.getByRole("option", { name: "Space" }).click();

  await expect(page.getByText("Picked: space")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Collection settings" })).toBeVisible();
});

/*
  Toasts are checked only in the browser.

  jsdom has no animations, no portal layout, and no timers by which a toast lives
  and leaves: a check there would reduce to "the function was called", that is, a
  test of sonner rather than of the package.
*/
test("toast: the tones are called and show text with a description", async ({ page }) => {
  await page.goto("/iframe.html?id=actions-toaster--tones&globals=theme:dark;accent:blue");

  await page.getByRole("button", { name: "Success" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();

  await page.getByRole("button", { name: "Error with a description" }).click();
  await expect(page.getByText("Could not save")).toBeVisible();
  // The description is the second line: the consumer puts the server's text here.
  await expect(page.getByText("The channel does not answer — code 502")).toBeVisible();
});

test("toast: dismiss removes every toast", async ({ page }) => {
  await page.goto("/iframe.html?id=actions-toaster--tones&globals=theme:dark;accent:blue");

  await page.getByRole("button", { name: "Success" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();

  await page.getByRole("button", { name: "Dismiss all" }).click();
  await expect(page.getByText("Settings saved")).toBeHidden();
});

test("toast: a promise goes through pending to a result", async ({ page }) => {
  await page.goto("/iframe.html?id=actions-toaster--tones&globals=theme:dark;accent:blue");

  await page.getByRole("button", { name: "Promise" }).click();
  await expect(page.getByText("Saving…")).toBeVisible();
  // The same toast changes its content instead of a second one appearing next to it.
  await expect(page.getByText("Saved")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Saving…")).toBeHidden();
});

/**
 * A control's height is declared (`leading-5` in `lib/field.ts`), not derived from
 * the line-height multiplier, and it is held only by a check in the browser.
 *
 * A snapshot does not catch this: on it, equal heights have to be measured by eye,
 * and a trigger off by half a pixel looks like anti-aliasing. That is how
 * `DateRangePicker` drifted: the fields and `Select` got the fix, but it stayed at
 * the old 41.5 and became the only mismatch in the form. Review caught it, not the
 * baseline, although the baseline had been regenerated along with the mismatch in it.
 */
test("form: fields and triggers share one height", async ({ page }) => {
  await page.goto("/iframe.html?id=inputs-formfield--matrix&globals=theme:dark;accent:blue");

  // What is measured is the control's visible box, and for all of them that is the
  // target's parent: for a field it is the bordered wrapper (`lib/field.ts`), for a
  // trigger it is the pill carrying the consumer's padding. The field itself sits
  // 2px lower inside the wrapper, and comparing it with the pill would compare different things.
  const boxes = {
    TextControl: page.getByLabel("Label only"),
    SearchControl: page.getByLabel("Find photos"),
    Select: page.getByRole("button", { name: "Nature" }),
    DateRangePicker: page.getByRole("button", { name: /Mar 09, 2026/ }),
  };

  for (const [label, target] of Object.entries(boxes)) {
    const box = (await target.locator("xpath=..").boundingBox())!;
    expect(box.height, `${label} in the form`).toBe(42);
  }

  // `DatePicker` is deliberately left out of this check: its trigger is an underlined
  // line with a single border at the bottom, not a field box, and in the form it
  // gives 40.5. Bringing it to 42 would mean giving it a boxed look, a separate
  // decision, not a consequence of fixing the inline box.
});

/**
 * Picking an item in a `Combobox`. Level 0 does not see this: the react-aria list
 * lives in a portal, and in jsdom its items cannot be reached. The announcer says
 * "2 options available", and there are no nodes in the document. Exactly the case
 * for which ADR-0012 splits the levels.
 */
test("Combobox: picking from the list puts the label into the field", async ({ page }) => {
  await page.goto("/iframe.html?id=inputs-combobox--playground&globals=theme:dark;accent:blue");

  const field = page.getByRole("combobox", { name: "Category" });
  await field.click();
  await page.getByRole("option", { name: "City" }).click();

  await expect(field).toHaveValue("City");
});

test("Combobox: a custom value stays in the field and is not reset by the list", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=inputs-combobox--free-input&globals=theme:dark;accent:blue");

  const field = page.getByRole("combobox", { name: "Category" });
  await field.fill("Custom category");
  // A click outside closes the list; a value outside the set must survive. That is
  // what sets `Combobox` apart from `Select`.
  await page.keyboard.press("Escape");

  await expect(field).toHaveValue("Custom category");
});

/**
 * The command palette. Level 0 does not see it whole: the window lives in a Radix
 * portal, the list is a react-aria collection, and in jsdom its items cannot be reached.
 */
test("CommandPalette: a synonym from keywords finds the action", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=overlays-commandpalette--playground&globals=theme:dark;accent:blue"
  );

  await page.getByRole("button", { name: "Open the palette" }).click();

  const field = page.getByRole("searchbox", { name: "Search actions" });
  await field.fill("similar");

  // The English word does not appear in the label; it lives in `keywords`.
  await expect(page.getByRole("option")).toHaveCount(1);
  await expect(page.getByRole("option")).toHaveText(/Find similar/);
});

test("CommandPalette: picking an item yields it and closes the window", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=overlays-commandpalette--playground&globals=theme:dark;accent:blue"
  );

  await page.getByRole("button", { name: "Open the palette" }).click();
  await page.getByRole("option", { name: /New campaign/ }).click();

  // Leaving the palette open over the result would demand a second gesture where
  // the user has already said everything.
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await expect(page.getByText("Picked: new")).toBeVisible();
});

test("CommandPalette: an empty query shows the whole list in sections", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=overlays-commandpalette--playground&globals=theme:dark;accent:blue"
  );

  await page.getByRole("button", { name: "Open the palette" }).click();

  // The palette works as a table of contents: people open it to remember what exists.
  await expect(page.getByRole("option")).toHaveCount(5);
});

/**
 * Table column keys are kept apart by a prefix inside the component: in react-aria,
 * columns and rows live in one namespace, and matching identifiers collapsed one
 * of them. What goes outward must be the original identifier, otherwise sorting
 * would reach the server with someone else's field name. In jsdom a click on the
 * heading is unavailable: react-aria calls `CSS.escape`, which is not there.
 */
test("Table: sorting yields the original column id outwards", async ({ page }) => {
  await page.goto("/iframe.html?id=content-table--basic-table&globals=theme:dark;accent:blue");

  const heading = page.getByRole("columnheader", { name: /Size/ });
  await heading.click();

  // If the internal key went outward, the direction would not apply: the story
  // compares `sort.column` with its own `id`.
  await expect(heading).toHaveAttribute("aria-sort", "ascending");
});

/**
 * `onRowAction`: an action on a row next to the selection (OLDSUI-193). A click on
 * the row opens the record and does not tick the checkbox; Enter on the focused row
 * does the same, and only the checkbox selects. Real pointer events and row focus
 * cannot be checked in jsdom.
 */
test("Table: a row click and Enter run the row action, only the checkbox selects", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=content-table--table-with-row-action&globals=theme:dark;accent:blue"
  );

  const status = page.getByText(/^(Nothing opened|Opened: )/);
  await expect(status).toHaveText("Nothing opened");

  await page
    .getByRole("row", { name: /Fog in the mountains/ })
    .getByText("Nature")
    .click();
  await expect(status).toHaveText("Opened: Fog in the mountains");
  await expect(
    page.getByRole("row", { name: /Fog in the mountains/ }).getByRole("checkbox")
  ).not.toBeChecked();

  const night = page.getByRole("row", { name: /Night city/ });
  await night.focus();
  await page.keyboard.press("Enter");
  await expect(status).toHaveText("Opened: Night city");
  await expect(night.getByRole("checkbox")).not.toBeChecked();

  // Selects via the checkbox, and the action is not called in this case.
  await page
    .getByRole("row", { name: /Sunset over the sea/ })
    .locator("label")
    .click();
  await expect(
    page.getByRole("row", { name: /Sunset over the sea/ }).getByRole("checkbox")
  ).toBeChecked();
  await expect(status).toHaveText("Opened: Night city");
});

test("Drawer: the backdrop and the panel land on the requested layer together", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=overlays-drawer--over-foreign-overlay&globals=theme:dark;accent:blue"
  );

  await page.getByRole("button", { name: "Open the drawer" }).click();
  const panel = page.getByRole("dialog");
  await expect(panel).toBeVisible();

  // The layer is read from the computed style, not the class: the class may be in the
  // markup and never reach the CSS, and then the drawer would silently slide under
  // someone else's window.
  const layer = async (l: ReturnType<typeof page.locator>) =>
    l.evaluate((el) => getComputedStyle(el).zIndex);

  const underlay = page
    .locator("[data-radix-popper-content-wrapper], .animate-fadein.fixed")
    .first();

  expect(await layer(panel)).toBe("100");
  expect(await layer(underlay)).toBe("100");

  // The application's foreign overlay stays below; that is why the prop exists.
  const foreign = page.locator(".z-95");
  expect(await layer(foreign)).toBe("95");
});

test("Drawer: closing returns focus to whoever opened it", async ({ page }) => {
  await page.goto("/iframe.html?id=overlays-drawer--from-right&globals=theme:dark;accent:blue");

  const open = page.getByRole("button", { name: "Open the drawer" });
  await open.click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  // Without an explicit return, Radix leaves focus on `body`: opening is controlled
  // from outside, and it has no standard target to return to.
  await expect(open).toBeFocused();
});

test("TagInput: the cross on a tag removes it", async ({ page }) => {
  await page.goto("/iframe.html?id=inputs-taginput--playground&globals=theme:dark;accent:blue");

  const group = page.getByRole("grid");
  await expect(group.getByRole("row")).toHaveCount(2);

  /*
    The check lives here, not in jsdom, and that is not a matter of convenience:
    react-aria renders the content of `Tag` in a second pass, and in jsdom the
    collection's children do not appear at all, so the button is physically absent
    there. A level 0 test for it would either always fail or check emptiness. The
    boundary is recorded in ADR-0012.

    The mouse is the main way to remove a tag, and until this test it was never
    checked: only Backspace was covered, that is, the keyboard path.
  */
  await page.getByRole("button", { name: "Remove tag sunset" }).click();
  await expect(group.getByRole("row")).toHaveCount(1);
  await expect(group.getByRole("row")).toHaveText("night city");
});

/**
 * The stickiness of `SelectionBar` is something jsdom cannot check at all: there is
 * no scrolling, no `position: sticky`, and no working `IntersectionObserver`. The
 * hook's unit tests check only the computation of `rootMargin` from a variable.
 *
 * Here the whole contract is checked at once (ADR-0016): the bar takes the ACTUAL
 * height of the panel from `--topbar-h`, sits exactly under it, and once it reaches
 * it, loses its top rounding. Otherwise the corners would peek the page background
 * at the joint.
 */
test("SelectionBar: the bar lands under the panel and loses its top rounding", async ({ page }) => {
  await page.goto("/iframe.html?id=navigation-selectionbar--sticky&globals=theme:dark;accent:blue");

  const bar = page.getByRole("group", { name: "Actions on selection" });
  await expect(bar).toBeVisible();

  // Before scrolling, the bar lies in the flow: its corners are round on all sides.
  await expect(bar).toHaveCSS("border-top-left-radius", "16px");
  const beforeTop = (await bar.boundingBox())?.y ?? 0;
  expect(beforeTop).toBeGreaterThan(56);

  await page.mouse.wheel(0, 600);

  // Stuck to the top, the bar sits EXACTLY under the panel: 56px, taken from the
  // variable, not from a hard-coded number.
  await expect.poll(async () => Math.round((await bar.boundingBox())?.y ?? -1)).toBe(56);

  await expect(bar).toHaveCSS("border-top-left-radius", "0px");
  await expect(bar).toHaveCSS("border-bottom-left-radius", "16px");

  // Back up: the rounding returns, so the state does not stick.
  await page.mouse.wheel(0, -600);
  await expect(bar).toHaveCSS("border-top-left-radius", "16px");
});

test("SelectionBar: without the panel variable the bar sticks to the top of the window", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=navigation-selectionbar--sticky&globals=theme:dark;accent:blue");
  const bar = page.getByRole("group", { name: "Actions on selection" });
  await expect(bar).toBeVisible();

  // A missing variable is a legitimate state, not an error: a consumer may have no
  // header at all.
  await page.evaluate(() => document.documentElement.style.removeProperty("--topbar-h"));
  await page.mouse.wheel(0, 600);

  await expect.poll(async () => Math.round((await bar.boundingBox())?.y ?? -1)).toBe(0);
});

/**
 * The bar's layout at a medium width (OLDSUI-200) is also browser-only: jsdom does
 * not measure sizes. In an 830 px column, six actions do not fit in one row with the
 * counter. Previously flex shrank the buttons: labels broke onto two lines and icons
 * were squashed by width. Now the actions wrap as whole buttons.
 */
test("SelectionBar: in a narrow column the actions wrap instead of shrinking", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=navigation-selectionbar--many-actions&globals=theme:dark;accent:blue"
  );
  const bar = page.getByRole("group", { name: "Actions on selection" });
  await expect(bar).toBeVisible();

  const ACTIONS = [
    "To the schedule",
    "Change category",
    "To a collection",
    "Find similar",
    "Duplicate",
    "Delete",
  ];
  for (const name of ACTIONS) {
    const button = bar.getByRole("button", { name, exact: true });
    // A single-line label: the height of an `sm` button is exactly 30 px.
    const box = await button.boundingBox();
    expect(Math.round(box?.height ?? 0), await button.innerText()).toBe(30);
    // The icon is a square of its own size, not a strip squashed by the flex item.
    const svg = button.locator("svg").first();
    if ((await svg.count()) === 0) continue;
    const icon = await svg.boundingBox();
    expect(Math.round(icon?.width ?? 0), await button.innerText()).toBe(
      Math.round(icon?.height ?? -1)
    );
  }

  // The actions do not fit on one row and wrap onto the next.
  const tops = new Set(
    await Promise.all(
      (await bar.getByRole("button", { name: /schedule|Delete/ }).all()).map(async (b) =>
        Math.round((await b.boundingBox())?.y ?? 0)
      )
    )
  );
  expect(tops.size).toBeGreaterThan(1);
});

/**
 * The same stickiness, but the variable's publisher is now the kit's own `TopBar`
 * (ADR-0019). This is a separate story, not a replacement for the previous one: the
 * contract with an EXTERNAL header still holds, and a new header must not break it.
 *
 * The `ResizeObserver` is also checked indirectly here: the height is not hard-coded
 * into the story, but measured by the header in a live browser.
 */
test("the kit TopBar publishes its height and the bar lands right under it", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=app-shell-topbar--with-sticky-bar&globals=theme:dark;accent:blue"
  );

  const header = page.getByRole("banner");
  const bar = page.getByRole("group", { name: "Actions on selection" });
  await expect(header).toBeVisible();
  await expect(bar).toBeVisible();

  const headerHeight = Math.round((await header.boundingBox())?.height ?? 0);
  expect(headerHeight).toBeGreaterThan(0);

  // The header publishes the variable, not the story: the value must match its
  // measured height.
  const published = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--topbar-h").trim()
  );
  expect(published).toBe(`${headerHeight}px`);

  await page.mouse.wheel(0, 600);

  // The bar sits exactly under the header, with no gap.
  await expect.poll(async () => Math.round((await bar.boundingBox())?.y ?? -1)).toBe(headerHeight);
  await expect(bar).toHaveCSS("border-top-left-radius", "0px");
});

test("PinInput: pasting the code into the first field fills them all", async ({ page }) => {
  await page.goto("/iframe.html?id=inputs-pininput--playground&globals=theme:dark;accent:blue");

  // The clipboard is closed by default in headless mode: without the permission,
  // `writeText` throws, and there would be nothing to check.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

  const fields = page.getByRole("textbox");
  await fields.first().click();

  // Exactly what cannot be checked in jsdom: with `maxLength=1` the browser itself
  // trims the pasted text to the first character, and without intercepting the event,
  // a code from an SMS would turn into a single digit.
  await page.evaluate(() => navigator.clipboard.writeText("482913"));
  await page.keyboard.press("ControlOrMeta+V");

  await expect(fields.nth(0)).toHaveValue("4");
  await expect(fields.nth(5)).toHaveValue("3");
});

test("PinInput: typing over an occupied field replaces the digit", async ({ page }) => {
  await page.goto("/iframe.html?id=inputs-pininput--filled&globals=theme:dark;accent:blue");

  const fields = page.getByRole("textbox");
  await fields.nth(1).click();
  await page.keyboard.press("7");

  // With `maxLength=1`, typing over an occupied field does not go through at all
  // unless the content is selected on focus, and this can only be checked in a browser.
  await expect(fields.nth(1)).toHaveValue("7");
});

test("InlineEdit: Escape restores the value and focus to the button", async ({ page }) => {
  await page.goto("/iframe.html?id=inputs-inlineedit--playground&globals=theme:dark;accent:blue");

  const trigger = page.getByRole("button");
  await trigger.click();

  const field = page.getByRole("textbox", { name: "Name" });
  await expect(field).toBeFocused();

  await field.fill("Other");
  await page.keyboard.press("Escape");

  // The focus return is visible only in a real browser: in jsdom, `document
  // .activeElement` behaves differently after unmounting, and the test would pass
  // on a broken component.
  await expect(page.getByRole("button")).toBeFocused();
  await expect(page.getByRole("button")).toContainText("Daily collection");
});

test("InlineEdit: clicking away confirms and does not steal focus", async ({ page }) => {
  await page.goto("/iframe.html?id=inputs-inlineedit--list&globals=theme:dark;accent:blue");

  await page.getByRole("button", { name: /Night city/ }).click();
  const field = page.getByRole("textbox", { name: "Name" });
  await field.fill("Sunrise");

  const neighbour = page.getByRole("button", { name: /Ada Lovelace/ });
  await neighbour.click();

  await expect(page.getByRole("button", { name: /Sunrise/ })).toBeVisible();
  // The user went where they wanted: the neighbour's edit opened, and focus did not
  // jump back.
  await expect(page.getByRole("textbox", { name: "Author" })).toBeFocused();
});

test("TreeView: the keyboard expands and collapses a node with arrows", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=navigation-treeview--without-selection&globals=theme:dark;accent:blue"
  );

  // "Nature" is collapsed here: only "City" is expanded.
  const nature = page.getByRole("row", { name: /Nature/ });
  await nature.click();
  await expect(nature).toHaveAttribute("aria-expanded", "true");

  // The keyboard is entirely react-aria's, and it is checked where it works, in the
  // browser: jsdom does not reproduce the collection's arrow navigation.
  await page.keyboard.press("ArrowLeft");
  await expect(nature).toHaveAttribute("aria-expanded", "false");

  await page.keyboard.press("ArrowRight");
  await expect(nature).toHaveAttribute("aria-expanded", "true");

  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("row", { name: /Forest/ })).toBeFocused();
});

test("TreeView: activeKey moves with onAction and keeps the rows free of checkboxes", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=navigation-treeview--current-node&globals=theme:dark;accent:blue"
  );

  await expect(page.getByRole("row", { name: /Sunset/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("checkbox")).toHaveCount(0);

  // Leaf: the action moves the current node, and the previous one loses its mark.
  await page.getByRole("row", { name: /Storm/ }).click();
  await expect(page.getByRole("row", { name: /Storm/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("row", { name: /Sunset/ })).not.toHaveAttribute("aria-current");

  // Folder: a click on the row calls `onAction`, and the story expands it.
  const city = page.getByRole("row", { name: /City/ });
  await expect(city).toHaveAttribute("aria-expanded", "false");
  await city.click();
  await expect(city).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("row", { name: /Storm/ })).toHaveAttribute("aria-current", "page");
});

test("MaskedInput: the caret stays in the middle of the number instead of jumping to the end", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=inputs-maskedinput--filled&globals=theme:dark;accent:blue");

  const field = page.getByRole("textbox", { name: "Phone" });
  await field.click();
  // Put the caret right after the third digit and edit the middle.
  await field.evaluate((el: HTMLInputElement) => el.setSelectionRange(7, 7));
  await page.keyboard.press("Backspace");

  await expect(field).toHaveValue("+7 (911) 234-56-7");
  // Native browser behavior: formatting re-renders the whole string, and without
  // restoring the position the caret would jump to the end. jsdom does not show this.
  expect(await field.evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(6);
});

test("MaskedInput: clicking the skeleton lands in the field, not in the underlay", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=inputs-maskedinput--playground&globals=theme:dark;accent:blue");

  const field = page.getByRole("textbox", { name: "Phone" });
  const skeleton = page.getByText("+7 (___) ___-__-__");

  // We click AT THE COORDINATES of the skeleton, not through the locator:
  // `locator.click()` waits until the element starts accepting events, and with
  // `pointer-events: none` it simply times out. Here the event goes to a point, and
  // the browser itself picks the target, so exactly what the user does is checked.
  //
  // The skeleton sits in the same grid cell as the field and takes its width. If it
  // intercepted the pointer, the field would stop focusing on a click on its own
  // text. This is unprovable in jsdom: there is no layout there, no loaded CSS, and
  // `pointer-events` has no effect.
  const box = (await skeleton.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(field).toBeFocused();

  await page.keyboard.type("916");
  // The skeleton is consumed left to right: the visible remainder starts exactly
  // where the input ended, and this is visible only with a real layout.
  await expect(page.getByText(") ___-__-__")).toBeVisible();
});

test("MaskedInput: an unsuitable key is announced instead of vanishing silently", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=inputs-maskedinput--playground&globals=theme:dark;accent:blue");

  const field = page.getByRole("textbox", { name: "Phone" });
  await field.click();
  await page.keyboard.type("x");

  await expect(field).toHaveValue("");
  // The discard was silent: the user saw that the keypress "did not work" and was
  // left without an explanation.
  await expect(page.getByRole("status")).toHaveText("A digit is expected here");
});

test("SortableList: keyboard dragging is announced in the provider locale", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=content-sortablelist--russian-locale&globals=theme:dark;accent:blue"
  );

  // The observer is attached AFTER hydration: attached to a tree that is not built
  // yet, it would see none of the announcements.
  await page.waitForTimeout(300);

  // Announcements live for fractions of a second: we catch them with an observer,
  // not with polling.
  await page.evaluate(() => {
    (window as { __live?: string[] }).__live = [];
    new MutationObserver(() => {
      document.querySelectorAll("[aria-live]").forEach((n) => {
        const t = n.textContent?.trim();
        const log = (window as { __live?: string[] }).__live!;
        if (t && !log.includes(t)) log.push(t);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });

  await page.keyboard.press("Tab");
  // The Right arrow moves focus from the row to its handle: navigation inside the
  // row belongs to the behavior layer.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  // Targets are moved between with ARROWS, although the announcement suggests Tab:
  // in a list of five rows, Tab moves focus out of the drop-target ring and cancels
  // the drag, as verified. The announcement describes the general case; the
  // measurement is our own.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);

  const announcements = await page.evaluate(() =>
    (window as { __live?: string[] }).__live!.join(" | ")
  );
  // The list has no live region of its own: these strings come from react-aria, and
  // they are localized out of the box.
  expect(announcements).toContain("Начато перетаскивание");
  expect(announcements).toContain("Перетаскивание завершено");

  // The order went outward and came back through the prop.
  await expect(page.getByTestId("order")).toHaveText("2,1,3,4,5");
});

test("SortableList: a row moves to another list of its group with the mouse", async ({ page }) => {
  await page.goto("/iframe.html?id=content-sortablelist--board&globals=theme:dark;accent:blue");
  await page.waitForTimeout(300);

  const board = page.getByTestId("board");
  await expect(board).toHaveText("todo:a,b doing:c done:");

  // The "Write the brief" row is dropped onto the top of the "Book the speakers" row
  // in the neighbouring column.
  const column = (name: string) => page.getByRole("grid", { name });
  await column("To do")
    .getByRole("row")
    .first()
    .dragTo(column("In progress").getByRole("row").first(), { targetPosition: { x: 60, y: 3 } });
  await expect(board).toHaveText("todo:b doing:a,c done:");

  // Reordering inside a group's list still works: `onReorder`, not `onMove`.
  await column("In progress")
    .getByRole("row")
    .first()
    .dragTo(column("In progress").getByRole("row").last(), { targetPosition: { x: 60, y: 30 } });
  await expect(board).toHaveText("todo:b doing:c,a done:");

  // An empty list accepts a row when it is dropped onto the list itself.
  await column("In progress").getByRole("row").last().dragTo(column("Done"));
  await expect(board).toHaveText("todo:b doing:c done:a");
});

test("SortableList: a row moves to another list of its group from the keyboard", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=content-sortablelist--board&globals=theme:dark;accent:blue");
  await page.waitForTimeout(300);

  // Focus on the first row of "To do", Right arrow to its handle, Enter to pick it up.
  await page.getByRole("grid", { name: "To do" }).getByRole("row").first().focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  // Tab moves to the next list of the group: the same behavior layer as the targets inside a list.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);

  await expect(page.getByTestId("board")).toHaveText(/^todo:b doing:(a,c|c,a) done:$/);
});

test("VirtualGrid: only visible cells live in the DOM, the scrolling is its own", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=content-virtualgrid--playground&globals=theme:dark;accent:blue");
  await page.waitForTimeout(300);

  const grid = page.getByRole("grid", { name: "Frames" });
  const snapshot = () =>
    grid.evaluate((el) => ({
      inDOM: el.querySelectorAll("[data-key]").length,
      containerHeight: el.clientHeight,
      contentHeight: el.scrollHeight,
      first: (el.querySelector("[data-key]") as HTMLElement | null)?.innerText ?? "",
    }));

  const before = await snapshot();
  // Six hundred cells, but only tens of nodes. This is not checked in jsdom at all:
  // there is no layout there, and the virtualizer renders nothing.
  expect(before.inDOM).toBeGreaterThan(0);
  expect(before.inDOM).toBeLessThan(120);
  // The scrolling is ITS OWN: the content is many times taller than the container.
  expect(before.contentHeight).toBeGreaterThan(before.containerHeight * 5);

  await grid.evaluate((el) => el.scrollTo(0, 4000));
  await page.waitForTimeout(250);
  const after = await snapshot();

  // The virtualization window has moved: different cells are rendered now.
  expect(after.first).not.toBe(before.first);
  expect(after.inDOM).toBeLessThan(120);
});

const VIRTUAL_GRID_ACTIONS =
  "/iframe.html?id=content-virtualgrid--actions-and-menu&globals=theme:dark;accent:blue";

test("VirtualGrid: onAction opens a cell by click and Enter without selecting it", async ({
  page,
}) => {
  await page.goto(VIRTUAL_GRID_ACTIONS);
  const cells = page.getByRole("grid", { name: "Frames" }).getByRole("row");

  await cells.nth(2).click();
  await expect(page.getByTestId("opened")).toHaveText("Opened: 2");

  await cells.nth(3).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("opened")).toHaveText("Opened: 3");

  // Neither the click nor Enter selects: selection stays with Space.
  await expect(page.getByTestId("selected")).toHaveText("Selected: none");
  await page.keyboard.press("Space");
  await expect(page.getByTestId("selected")).toHaveText("Selected: 3");
});

test("VirtualGrid: Shift+F10 on a focused cell opens its menu and Escape returns focus", async ({
  page,
}) => {
  await page.goto(VIRTUAL_GRID_ACTIONS);
  const cell = page.getByRole("grid", { name: "Frames" }).getByRole("row").nth(1);

  await cell.focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Rename" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  // Focus returned to the cell instead of vanishing to the start of the page.
  await expect(cell).toBeFocused();
});

test("VirtualGrid: a menu item neither selects the cell nor opens it", async ({ page }) => {
  await page.goto(VIRTUAL_GRID_ACTIONS);
  const cells = page.getByRole("grid", { name: "Frames" }).getByRole("row");

  // A selected cell, so that we notice if the menu item shifts the selection.
  await cells.nth(4).focus();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("selected")).toHaveText("Selected: 4");

  // The right button, and a mouse click on the item.
  await cells.nth(0).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await expect(page.getByTestId("picked")).toHaveText("Menu: rename 0");

  // From the keyboard: Shift+F10, Down arrow, Enter.
  await cells.nth(1).focus();
  await page.keyboard.press("Shift+F10");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("picked")).toHaveText("Menu: open 1");

  await expect(page.getByTestId("selected")).toHaveText("Selected: 4");
  await expect(page.getByTestId("opened")).toHaveText("Opened: none");
});

test("ContextualSaveBar: the bar stays at the bottom edge of the scroll area", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=navigation-contextualsavebar--in-form&globals=theme:dark;accent:blue"
  );

  // The bar is absent while the form is untouched: it appears with the first edit.
  await expect(page.getByRole("group", { name: "Unsaved changes" })).toHaveCount(0);

  await page.getByRole("textbox").fill("Procurement team");
  const bar = page.getByRole("group", { name: "Unsaved changes" });
  await expect(bar).toBeVisible();

  // Stickiness is not checked in jsdom at all: there is no layout or scrolling there.
  const area = page.locator(".overflow-auto").first();
  const box = (await area.boundingBox())!;
  const before = (await bar.boundingBox())!;
  expect(before.y + before.height).toBeLessThanOrEqual(box.y + box.height + 1);

  await area.evaluate((el) => el.scrollTo(0, 600));
  await page.waitForTimeout(150);

  expect(await area.evaluate((el) => el.scrollTop)).toBeGreaterThan(300);

  const after = (await bar.boundingBox())!;
  // The bar is still inside the area and pinned to its bottom, rather than having moved up.
  expect(after.y + after.height).toBeLessThanOrEqual(box.y + box.height + 1);
  expect(after.y + after.height).toBeGreaterThan(box.y + box.height - 60);
});

/**
 * The phone's bottom bar and what sticks to the bottom (OLDSUI-193).
 *
 * `AppShell` publishes the height of the `bottomBar` slot into `--bottombar-h`, and
 * `ContextualSaveBar` and `Toaster` offset from the window's edge by it. jsdom checks
 * this at the variable level; that the bar really stands ABOVE the panel, not under
 * it, is visible only through the layout.
 */
const SAVE_BAR_ABOVE_TABS =
  "/iframe.html?id=navigation-contextualsavebar--above-bottom-bar&globals=theme:dark;accent:blue";

test("ContextualSaveBar: on a phone the bar stands right above the tab bar, not under it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(SAVE_BAR_ABOVE_TABS);

  await page.getByRole("textbox").fill("Procurement team");
  const bar = page.getByRole("group", { name: "Unsaved changes" });
  const tabs = page.getByRole("navigation", { name: "Sections" });
  await expect(bar).toBeVisible();
  await expect(tabs).toBeVisible();

  // The height is published and equals the panel's real height (border and cutout included).
  const tabsBox = (await tabs.boundingBox())!;
  const published = await page.evaluate(() =>
    parseFloat(document.documentElement.style.getPropertyValue("--bottombar-h"))
  );
  expect(published).toBeGreaterThanOrEqual(Math.round(tabsBox.height));

  const area = page.locator(".overflow-auto").first();
  for (const top of [0, 200, 10_000]) {
    await area.evaluate((el, y) => el.scrollTo(0, y), top);
    await page.waitForTimeout(150);

    const barBox = (await bar.boundingBox())!;
    const tabsNow = (await tabs.boundingBox())!;
    // The bar is entirely above the panel, not a single pixel under it…
    expect(barBox.y + barBox.height).toBeLessThanOrEqual(tabsNow.y + 1);
    // …and flush against it, not left with a gap "by eye" (a tolerance for the
    // content's padding when the page is scrolled to the end).
    expect(tabsNow.y - (barBox.y + barBox.height)).toBeLessThan(24);
  }
});

test("ContextualSaveBar: on a wide screen there is no tab bar and the bar keeps the bottom edge", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(SAVE_BAR_ABOVE_TABS);

  await page.getByRole("textbox").fill("Procurement team");
  const bar = page.getByRole("group", { name: "Unsaved changes" });
  await expect(bar).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Sections" })).toBeHidden();

  // The panel is hidden at `md` and wider: the slot's height is zero, and there is no offset.
  const published = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue("--bottombar-h")
  );
  expect(published).toBe("0px");

  const area = page.locator(".overflow-auto").first();
  const box = (await area.boundingBox())!;
  await area.evaluate((el) => el.scrollTo(0, 0));
  await page.waitForTimeout(150);
  const barBox = (await bar.boundingBox())!;
  // Pinned to the very bottom of the scrollable area (the gap is only the outline).
  expect(box.y + box.height - (barBox.y + barBox.height)).toBeLessThan(4);
});

test("SplitButton: the toggle is a separate tab stop and returns focus after closing", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=actions-splitbutton--playground&globals=theme:dark;accent:blue");

  const action = page.getByRole("button", { name: "Export", exact: true });
  const toggle = page.getByRole("button", { name: "More actions: Export" });

  // Two tab stops, not one: the whole rationale of the component rests on this. A
  // single button with a zone would leave the second outcome unreachable from the
  // keyboard.
  //
  // Focus is set explicitly, not with the first Tab: in the showcase's iframe the
  // traversal does not start from the document body, and "how many presses to the
  // button" is a property of the Storybook wrapper, not of the component.
  await action.focus();
  await expect(action).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(toggle).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  // Focus returns to the toggle, not drifts to `<body>`: otherwise a keyboard user
  // ends up at the start of the document.
  await expect(toggle).toBeFocused();
});

test("SplitPanel: the handle resizes by dragging and by arrow keys", async ({ page }) => {
  await page.goto("/iframe.html?id=app-shell-splitpanel--side&globals=theme:dark;accent:blue");

  const panel = page.getByRole("region", { name: "Order details" });
  const handle = page.getByRole("slider", { name: "Resize: Order details" });

  const before = (await panel.boundingBox())!.width;

  // Dragging left enlarges the panel: it sits after the content, so movement toward
  // the start of the axis gives it room.
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();

  const dragged = (await panel.boundingBox())!.width;
  expect(dragged).toBeGreaterThan(before + 40);

  // The keyboard must be able to do the same: a handle reachable only by mouse is
  // exactly the case the real slider under the strip exists for.
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  expect((await panel.boundingBox())!.width).toBeGreaterThan(dragged);

  // `End` must take exactly `maxSize`, not "almost". While the slider's step was 16,
  // the upper bound was not reachable from the keyboard at all: the step base of
  // `range` is `min`, and the grid never reached `max`.
  //
  // The slider's value is checked against its own bounds, not the panel's width: the
  // container also limits the width, and then the test would guard the wrapper's size
  // in the showcase.
  await page.keyboard.press("End");
  expect(await handle.inputValue()).toBe(await handle.getAttribute("max"));

  await page.keyboard.press("Home");
  expect(await handle.inputValue()).toBe(await handle.getAttribute("min"));
});

test("SplitPanel: the bottom axis drags along its own axis", async ({ page }) => {
  await page.goto("/iframe.html?id=app-shell-splitpanel--bottom&globals=theme:dark;accent:blue");

  const panel = page.getByRole("region", { name: "Order details" });
  const handle = page.getByRole("slider");
  const before = (await panel.boundingBox())!.height;

  // The sign of the delta for the bottom axis is the component's own decision, and
  // until now it lived only in the snapshot: only the side axis was dragged.
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 40, { steps: 6 });
  await page.mouse.up();

  expect((await panel.boundingBox())!.height).toBeGreaterThan(before + 20);
});

test("SplitPanel: a pointer released away from the handle does not leave it dragging", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=app-shell-splitpanel--side&globals=theme:dark;accent:blue");

  const panel = page.getByRole("region", { name: "Order details" });
  const handle = page.getByRole("slider");
  const box = (await handle.boundingBox())!;

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 60, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();

  const settled = (await panel.boundingBox())!.width;

  // Hovering without a press must not move the edge: that is exactly how the drag
  // state's leak looked, with the panel following the cursor while the button was released.
  await page.mouse.move(box.x - 200, box.y + box.height / 2, { steps: 6 });
  await page.mouse.move(box.x + 200, box.y + box.height / 2, { steps: 6 });
  expect((await panel.boundingBox())!.width).toBe(settled);
});

test("SplitPanel: dragging does not select the text it passes over", async ({ page }) => {
  await page.goto("/iframe.html?id=app-shell-splitpanel--side&globals=theme:dark;accent:blue");

  const box = (await page.getByRole("slider").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 120, box.y + box.height / 2, { steps: 10 });

  // While the button is still held, there must be no selection: otherwise movement
  // past the strip would highlight half of the list.
  const selected = await page.evaluate(() => window.getSelection()?.toString() ?? "");
  await page.mouse.up();
  expect(selected).toBe("");
});

test("Transfer: focus follows the moved items into the receiving list", async ({ page }) => {
  await page.goto("/iframe.html?id=inputs-transfer--playground&globals=theme:dark;accent:blue");

  const available = page.getByRole("listbox", { name: /^Available/ });
  const selected = page.getByRole("listbox", { name: /^Selected/ });

  await available.getByRole("option", { name: "Export data" }).click();
  await page.getByRole("button", { name: "Move to selected" }).click();

  // The receiving column is NOT empty: "View reports" is already in it. This exact
  // case used to break: focus landed on the old element, because `focus()` was
  // called before the new selection was committed.
  const focused = selected.getByRole("option", { name: "Export data" });
  await expect(focused).toBeFocused();
});

test("Transfer: focus lands on the arriving item even when the column was empty", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=inputs-transfer--empty&globals=theme:dark;accent:blue");

  const available = page.getByRole("listbox", { name: /^Available/ });
  const selected = page.getByRole("listbox", { name: /^Selected/ });

  await available.getByRole("option", { name: "View reports" }).click();
  await page.getByRole("button", { name: "Move to selected" }).click();

  // The degenerate case: the receiving column was empty, react-aria had nothing to
  // delegate focus to, and it used to stay on the container. The rule requires the
  // arriving element.
  await expect(selected.getByRole("option", { name: "View reports" })).toBeFocused();
});

test("TreeSelect: Escape closes the popover and returns focus to the field", async ({ page }) => {
  await page.goto("/iframe.html?id=inputs-treeselect--playground&globals=theme:dark;accent:blue");

  const field = page.getByRole("button", { name: /^Division/ });
  await field.click();
  await expect(page.getByRole("treegrid", { name: "Division" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("treegrid")).toBeHidden();
  // Focus returns to the field, not drifts to `<body>`: otherwise after dismissing
  // the selection the user ends up at the start of the document.
  await expect(field).toBeFocused();
});

/**
 * Collapsing moves focus into the content instead of dropping it.
 *
 * The check lives HERE, not in jsdom, and that matters: there the `hidden` attribute
 * does not remove focus, so a test for "focus is not on body" would pass even on
 * unfixed code, relying on the mismatch between jsdom and the browser. Per ADR-0012
 * such a check must be a browser one.
 */
test("SplitPanel: collapsing moves focus into the content instead of dropping it", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=app-shell-splitpanel--collapse-from-outside&globals=theme:dark;accent:blue"
  );

  await page.getByTestId("note").focus();
  await expect(page.getByTestId("note")).toBeFocused();

  // Collapsing does NOT come from a click: a click itself moves focus to the button.
  await page.getByTestId("collapse-later").click();
  await page.getByTestId("note").focus();
  await expect(page.getByTestId("state")).toHaveText("collapsed");

  const active = await page.evaluate(() => document.activeElement?.tagName ?? "");
  expect(active).not.toBe("BODY");
});

test("SplitPanel: useMediaQuery collapses the panel on a narrow window and returns it on a wide one", async ({
  page,
}) => {
  await page.setViewportSize({ width: 700, height: 600 });
  await page.goto("/iframe.html?id=app-shell-splitpanel--adaptive&globals=theme:dark;accent:blue");

  // Narrow: the panel is mounted, but not visible and not in the accessibility tree.
  await expect(page.getByTestId("adaptive-panel")).toBeHidden();
  await expect(page.getByRole("slider")).toHaveCount(0);

  // The window was widened: the hook subscribes to the change, so no reload is needed.
  await page.setViewportSize({ width: 1200, height: 600 });
  await expect(page.getByRole("region", { name: "Order details" })).toBeVisible();
  await expect(page.getByTestId("adaptive-panel")).toBeVisible();
  await expect(page.getByRole("slider")).toBeVisible();

  await page.setViewportSize({ width: 700, height: 600 });
  await expect(page.getByRole("region", { name: "Order details" })).toHaveCount(0);
});

/*
 * Motion and `prefers-reduced-motion` (ADR-0043).
 *
 * This checks what the text gate in `tests/motion.test.ts` cannot see: the real
 * cascade. It reads `styles.css` and knows that the token is overridden; it does not
 * know whether the override reached the element. That is exactly where wave 27 found
 * a defect: `.skeleton` set its animation with a literal string, bypassing the token,
 * and the `reduce` block did not touch it.
 *
 * IMPORTANT about the setting: the whole file runs with `reducedMotion: "reduce"`.
 * That is set in `playwright.config.ts` for the sake of snapshot stability. Therefore
 * "switched off" is checked in a normal test, and "still works" in a block with its own `test.use`.
 */
test("Motion: the kit's own animation loses its movement under reduced motion", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=content-skeleton--matrix&globals=theme:dark;accent:blue");

  const skeleton = page.locator(".skeleton").first();
  await expect(skeleton).toBeVisible();
  expect(await skeleton.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
});

test("Motion: a busy indicator keeps moving — it is the named exception", async ({ page }) => {
  await page.goto("/iframe.html?id=actions-progress--matrix&globals=theme:dark;accent:blue");

  // Indeterminate progress: the fraction is unknown, and the bar's movement is the
  // whole message. A frozen third reads as "stuck", not as "calm".
  const running = page.locator(".animate-progress-indeterminate").first();
  await expect(running).toBeVisible();
  expect(await running.evaluate((el) => getComputedStyle(el).animationName)).toBe(
    "progressIndeterminate"
  );
});

test("Motion: an expander chevron does not rotate under reduced motion", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=navigation-accordion--accordion-single&globals=theme:dark;accent:blue"
  );

  // The transition is set by a Tailwind utility, not by a token: there is nothing to
  // override it with from `styles.css`, so the `motion-reduce:` variant switches it
  // off in place.
  const chevron = page.locator(".transition-transform").first();
  await expect(chevron).toBeVisible();
  expect(await chevron.evaluate((el) => getComputedStyle(el).transitionProperty)).toBe("none");
});

/*
 * OVERLAY EXIT is checked only here, and it cannot be checked any other way.
 *
 * The text gate sees the token, but not the main thing: whether the node survives
 * until the end of the animation. The exit exists exactly as long as the library
 * keeps the element in the DOM after its state has become "closed". That behavior
 * belongs to Radix and react-aria, not to our CSS.
 *
 * Snapshots won't catch this either: they run with `animations: "disabled"`, that is,
 * on the final frame, where the closed panel has already been removed.
 *
 * The measurement is built on an observer, not a pause: the exit lasts 100–150ms, and
 * a sleep "by eye" would give a test that is green on a slow machine and red on a fast
 * one. The observer is attached BEFORE the close and records the first frame in which
 * the state changed.
 */
const recordExit = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`nothing matches ${sel}`);
    const w = window as unknown as { __exit?: unknown };
    w.__exit = null;
    new MutationObserver(() => {
      if (w.__exit) return;
      const s = getComputedStyle(el);
      w.__exit = {
        state: el.getAttribute("data-state"),
        exiting: el.hasAttribute("data-exiting"),
        animation: s.animationName,
        duration: s.animationDuration,
        easing: s.animationTimingFunction,
        inDom: el.isConnected,
      };
    }).observe(el, { attributes: true, attributeFilter: ["data-state", "data-exiting"] });
  }, selector);

/*
 * The menu panel is not addressed by a selector: in RAC the exit class sits on the
 * popover that wraps the menu, and in Radix it sits on the panel itself. There is no
 * shared selector, so the observer climbs from `role="menu"` to the first ancestor
 * that has an animation. That way one and the same test watches both implementations.
 */
const recordMenuExit = (page: Page) =>
  page.evaluate(() => {
    let node: Element | null = document.querySelector('[role="menu"]');
    while (node && getComputedStyle(node).animationName === "none") node = node.parentElement;
    if (!node) throw new Error("the open menu has no animated panel above it");
    const target = node;
    const w = window as unknown as { __exit?: unknown };
    w.__exit = null;
    new MutationObserver(() => {
      if (w.__exit) return;
      const s = getComputedStyle(target);
      w.__exit = {
        state: target.getAttribute("data-state"),
        exiting: target.hasAttribute("data-exiting"),
        animation: s.animationName,
        duration: s.animationDuration,
        easing: s.animationTimingFunction,
        inDom: target.isConnected,
      };
    }).observe(target, { attributes: true, attributeFilter: ["data-state", "data-exiting"] });
  });

const exitRecord = async (page: Page) => {
  await page.waitForFunction(() => (window as unknown as { __exit?: unknown }).__exit !== null);
  return page.evaluate(
    () =>
      (window as unknown as { __exit: Record<string, unknown> }).__exit as {
        state: string | null;
        exiting: boolean;
        animation: string;
        duration: string;
        easing: string;
        inDom: boolean;
      }
  );
};

test.describe("without the system setting", () => {
  test.use({ reducedMotion: "no-preference" });

  test("Motion: the same animation and the same transition do run", async ({ page }) => {
    await page.goto("/iframe.html?id=content-skeleton--matrix&globals=theme:dark;accent:blue");
    const skeleton = page.locator(".skeleton").first();
    await expect(skeleton).toBeVisible();
    expect(await skeleton.evaluate((el) => getComputedStyle(el).animationName)).toBe("shimmer");

    await page.goto(
      "/iframe.html?id=navigation-accordion--accordion-single&globals=theme:dark;accent:blue"
    );
    const chevron = page.locator(".transition-transform").first();
    await expect(chevron).toBeVisible();
    expect(await chevron.evaluate((el) => getComputedStyle(el).transitionProperty)).toContain(
      "transform"
    );

    /*
     * The chevron's markup has NO duration class any more: previously `duration-150`
     * stood there, removed together with fifteen like it (ADR-0047). The tempo now
     * comes from the default, and this checks exactly that: removing the class did not
     * leave the transition without a time.
     */
    await expect(chevron).not.toHaveClass(/\bduration-/);
    expect(await chevron.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0.15s");
  });

  test("Motion: a transition with no duration class takes its tempo from the scale", async ({
    page,
  }) => {
    /*
     * The motion scale (ADR-0047). The text gate sees that
     * `--default-transition-duration` references a step; it does not see whether the
     * reference reaches the element. That is exactly where it can break: the whole
     * Tailwind build sits between the declaration and the transition, and it is enough
     * for the kit's `@theme` not to reach the showcase. The number would then silently
     * fall back to Tailwind's standard 150ms, which matches the step by coincidence.
     *
     * The reference, not the number, is checked by the second line: `--duration-base`
     * resolves on the element. Were there only `0.15s` here, the test would stay green
     * even on Tailwind's hard-coded default.
     */
    await page.goto(
      "/iframe.html?id=foundations-motion--default-tempo&globals=theme:dark;accent:blue"
    );

    const button = page.locator("button.transition-colors").first();
    await expect(button).toBeVisible();
    expect(await button.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0.15s");

    /*
     * The step EXISTS on the element, rather than matching by number. Without this
     * line the test would stay green even on Tailwind's hard-coded default, which is
     * 150ms by coincidence.
     *
     * The value is compared, not the notation: the browser normalizes `150ms` to `.15s`,
     * and a strict string equality would catch spelling instead of meaning.
     */
    const step = await button.evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--duration-base").trim()
    );
    expect(step, "--duration-base does not reach the element").not.toBe("");
    expect(step.endsWith("ms") ? parseFloat(step) : parseFloat(step) * 1000).toBe(150);
  });

  test("Motion: an overlay enters on the step its token names", async ({ page }) => {
    /*
     * The token is assembled from references to the scale (ADR-0047), and the text gate
     * sees only that. Whether the reference reaches the live animation is a question of
     * the cascade: the kit's `@theme` could fail to reach the showcase, and `animation`
     * would be left with an invalid duration, that is, with zero.
     *
     * The tooltip is chosen because the change is verified on it: it used to enter in
     * 0.14s, and the panel beside it in 0.16s. Both are now on `base`.
     */
    await page.goto("/iframe.html?id=overlays-tooltip--playground&globals=theme:dark;accent:blue");

    await page.getByRole("button").first().hover();
    const tooltip = page.locator("[data-radix-popper-content-wrapper] [role='tooltip']").first();
    await expect(tooltip).toBeVisible();

    expect(await tooltip.evaluate((el) => getComputedStyle(el).animationDuration)).toBe("0.15s");
  });

  test("Motion: every step of the scale reaches the element", async ({ page }) => {
    /*
     * The `duration-*` utilities are declared by hand via `@utility`, because Tailwind
     * has no `--duration-*` namespace (ADR-0047). A utility from an IMPORTED file is
     * exactly what could fail to reach the build: `@theme` and `@plugin` from there work,
     * and this was verified separately at the time too.
     *
     * All four steps are iterated, including `duration-slow`, which no component
     * writes today. An unchecked upper bound is not a bound.
     */
    await page.goto("/iframe.html?id=foundations-motion--durations&globals=theme:dark;accent:blue");

    for (const [step, expected] of [
      ["duration-fast", "0.1s"],
      ["duration-base", "0.15s"],
      ["duration-moderate", "0.25s"],
      ["duration-slow", "0.4s"],
    ] as const) {
      const marker = page.locator(`.${step}`).first();
      await expect(marker).toBeVisible();
      expect(
        await marker.evaluate((el) => getComputedStyle(el).transitionDuration),
        `${step} does not reach the element`
      ).toBe(expected);
    }
  });

  test("Motion: every curve of the scale reaches the element", async ({ page }) => {
    await page.goto("/iframe.html?id=foundations-motion--easings&globals=theme:dark;accent:blue");

    for (const [curve, expected] of [
      ["ease-standard", "cubic-bezier(0.2, 0, 0, 1)"],
      ["ease-enter", "cubic-bezier(0, 0, 0.2, 1)"],
      ["ease-exit", "cubic-bezier(0.4, 0, 1, 1)"],
    ] as const) {
      const marker = page.locator(`.${curve}`).first();
      await expect(marker).toBeVisible();
      expect(
        await marker.evaluate((el) => getComputedStyle(el).transitionTimingFunction),
        `${curve} does not reach the element`
      ).toBe(expected);
    }
  });

  test("Motion: a Radix overlay leaves instead of vanishing", async ({ page }) => {
    await page.goto("/iframe.html?id=overlays-tooltip--playground&globals=theme:dark;accent:blue");

    const trigger = page.getByRole("button").first();
    await trigger.hover();
    await expect(page.getByRole("tooltip").first()).toBeVisible();

    await recordExit(page, '[role="tooltip"]');
    /*
     * Escape rather than moving the pointer away. Moving away does not close the Radix
     * tooltip: it stays until the trigger's real `pointerleave`, and a `mouse.move`
     * past it leaves it open, so the test would silently hang on this until the timeout.
     */
    await page.keyboard.press("Escape");

    const exit = await exitRecord(page);
    expect(exit.state, "Radix must mark the closing overlay").toBe("closed");
    expect(exit.inDom, "the node must outlive the state change — otherwise there is no exit").toBe(
      true
    );
    expect(exit.animation).toBe("tooltipOut");
    expect(exit.duration, "exit is one step shorter than the entry").toBe("0.1s");
    expect(exit.easing).toBe("cubic-bezier(0.4, 0, 1, 1)");
  });

  test("Motion: a react-aria menu leaves on a token, not on a bare opacity", async ({ page }) => {
    await page.goto("/iframe.html?id=overlays-menu--playground&globals=theme:dark;accent:blue");

    await page.getByRole("button").first().click();
    await expect(page.getByRole("menu").first()).toBeVisible();

    await recordMenuExit(page);
    await page.keyboard.press("Escape");

    const exit = await exitRecord(page);
    expect(exit.exiting, "react-aria must mark the closing panel").toBe(true);
    expect(exit.inDom).toBe(true);
    expect(exit.animation).toBe("fadeout");
    expect(exit.duration).toBe("0.15s");
  });

  test("Motion: choosing an item leaves no panel behind", async ({ page }) => {
    /*
     * The panel's exit DEFERS its removal by 150ms, and this changes the conditions for
     * the consumer: a menu item often triggers a mutation and a re-render of the list,
     * while the panel is still leaving. If the exit and the re-render diverge, a stuck
     * node is left behind: a menu that should not be on screen.
     *
     * Checked on a story with real state: choosing an item here changes `useState` and
     * re-renders the content, rather than calling an empty callback.
     *
     * A task from a neighbouring session (NEX-88): the concern was raised before the
     * release and is checked here, so that the answer is measured rather than reasoned.
     */
    await page.goto(
      "/iframe.html?id=overlays-menu--sections-and-submenus&globals=theme:dark;accent:blue"
    );

    await page.getByRole("button").first().click();
    await expect(page.getByRole("menu").first()).toBeVisible();

    /*
     * An item of SINGLE selection: it both changes the story's `useState` and closes
     * the menu. A checkbox item is unsuitable for this check: multiple selection
     * deliberately does not close the panel, and the test would measure the wrong thing.
     */
    await page.getByRole("menuitemradio", { name: "By name" }).click();

    /*
     * It WAITS for the disappearance rather than pausing: Playwright polls until
     * success, so the test does not depend on how fast the machine is. A stuck node
     * is caught by the timeout, not by coincidence.
     */
    await expect(page.getByRole("menu")).toHaveCount(0);
    expect(
      await page.evaluate(
        () =>
          [...document.querySelectorAll("*")].filter((el) =>
            getComputedStyle(el).animationName.includes("fadeout")
          ).length
      ),
      "a panel is still leaving after the menu is gone"
    ).toBe(0);
  });

  test("Motion: both menus leave the same way, on both dialects", async ({ page }) => {
    /*
     * `Menu` is built on react-aria and `ContextMenu` on Radix, and their look is
     * shared: one line of classes for both implementations (`lib/menu.ts`). Until this
     * wave that line carried ONLY the RAC dialect, and `ContextMenu` did not animate at
     * all, despite a comment promising that both menus open the same way.
     *
     * So both are checked, and for an exact match: they can diverge only silently.
     */
    await page.goto(
      "/iframe.html?id=overlays-contextmenu--playground&globals=theme:dark;accent:blue"
    );
    await page
      .getByText(/right.?click/i)
      .first()
      .click({ button: "right" });
    await expect(page.getByRole("menu").first()).toBeVisible();

    await recordMenuExit(page);
    await page.keyboard.press("Escape");

    const exit = await exitRecord(page);
    expect(exit.state, "Radix marks the closing panel through data-state").toBe("closed");
    expect(exit.inDom).toBe(true);
    expect(exit.animation, "the Radix menu must leave exactly like the react-aria one").toBe(
      "fadeout"
    );
    expect(exit.duration).toBe("0.15s");
  });
});

test.describe("with reduced motion", () => {
  test("Motion: the exit survives reduce — only its movement is dropped", async ({ page }) => {
    /*
     * ADR-0043 switches off the movement, not the event. For the exit this matters
     * especially: `animation: none` would remove the disappearance altogether, and the
     * panel would vanish in a single frame, more abruptly than if the rule did not exist at all.
     */
    await page.goto("/iframe.html?id=overlays-tooltip--playground&globals=theme:dark;accent:blue");

    const trigger = page.getByRole("button").first();
    await trigger.hover();
    await expect(page.getByRole("tooltip").first()).toBeVisible();

    await recordExit(page, '[role="tooltip"]');
    await page.keyboard.press("Escape");

    const exit = await exitRecord(page);
    expect(exit.animation, "the exit must not be switched off, only flattened").toBe("fadeOutOnly");
    expect(exit.duration, "the step stays the same under reduce").toBe("0.1s");
  });
});

/*
  `EditableList` is checked here in full, and deliberately.

  jsdom would have silently missed all three defects found during assembly: there
  the react-aria collection mounts the row's content differently, and
  `document.activeElement` after unmounting does not behave as in the browser. The
  component was built for one thing, so that a field inside a row does not contest
  the list for keys, and this can only be checked here.
*/

const EDITABLE_LIST =
  "/iframe.html?id=content-editablelist--playground&globals=theme:dark;accent:blue";

test("EditableList: Enter on the handle starts the drag, not the edit", async ({ page }) => {
  await page.goto(EDITABLE_LIST);

  /*
    THIS CHECK DID NOT EXIST, AND THE 3.10.1 DEFECT SLIPPED THROUGH EXACTLY THIS HOLE.

    The key handler found the row via `closest("[data-key]")` and therefore fired on
    its handle: `Enter` was prevented here and opened the edit, and never reached
    react-aria, so the move from the keyboard never started.
    jsdom does not catch this: dragging there does not work at all (ADR-0028), and both
    tests, "the edit opened" and "the move started", would have been green.
  */
  const before = await page.getByTestId("order").textContent();

  await page.getByRole("row").first().click();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);

  // The edit did NOT open: this is the first half of the defect.
  await expect(page.getByRole("textbox", { name: /^Rename / })).toHaveCount(0);

  // And the move did start: the target is chosen with the arrows, Enter applies it.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);

  await expect(page.getByTestId("order")).not.toHaveText(before ?? "");
});

test("EditableList: Enter opens the edit with the text selected", async ({ page }) => {
  await page.goto(EDITABLE_LIST);

  const row = page.getByRole("row", { name: /Agree the estimate/ });
  await row.click();
  await page.keyboard.press("Enter");

  const field = page.getByRole("textbox", { name: /^Rename / });
  await expect(field).toBeFocused();

  // The whole text is selected: an inline edit is almost always a replacement of the
  // name, not an append to it.
  const selected = await field.evaluate(
    (node: HTMLInputElement) => node.selectionStart === 0 && node.selectionEnd === node.value.length
  );
  expect(selected).toBe(true);
});

test("EditableList: arrows from the open field do not walk the list", async ({ page }) => {
  await page.goto(EDITABLE_LIST);

  await page.getByRole("row", { name: /Agree the estimate/ }).click();
  await page.keyboard.press("Enter");

  const field = page.getByRole("textbox", { name: /^Rename / });
  await expect(field).toBeFocused();

  // THE COMPONENT WAS BUILT FOR THIS CHECK. The row is a `GridListItem`, and it
  // listens for arrows itself, before any handler on the field: without interception
  // in the capture phase, focus would jump to the next row right in the middle of typing.
  await page.keyboard.press("ArrowDown");
  await expect(field).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(field).toBeFocused();
});

test("EditableList: Escape restores the value and focus to the row", async ({ page }) => {
  await page.goto(EDITABLE_LIST);

  const row = page.getByRole("row", { name: /Agree the estimate/ });
  await row.click();
  await page.keyboard.press("Enter");

  await page.getByRole("textbox", { name: /^Rename / }).fill("Discarded draft");
  await page.keyboard.press("Escape");

  await expect(page.getByRole("row", { name: /Agree the estimate/ })).toBeFocused();
  await expect(page.getByText("Discarded draft")).toHaveCount(0);
});

test("EditableList: Enter confirms and returns focus to the row", async ({ page }) => {
  await page.goto(EDITABLE_LIST);

  await page.getByRole("row", { name: /Agree the estimate/ }).click();
  await page.keyboard.press("Enter");
  await page.getByRole("textbox", { name: /^Rename / }).fill("Renamed by keyboard");
  await page.keyboard.press("Enter");

  // The field disappears, and without a return, focus would have drifted to `<body>`.
  await expect(page.getByRole("row", { name: /Renamed by keyboard/ })).toBeFocused();
});

test("EditableList: clicking away confirms and does not steal focus", async ({ page }) => {
  await page.goto(EDITABLE_LIST);

  await page.getByRole("row", { name: /Agree the estimate/ }).click();
  await page.keyboard.press("Enter");
  await page.getByRole("textbox", { name: /^Rename / }).fill("Committed by clicking away");

  const add = page.getByRole("textbox", { name: "New task" });
  await add.click();

  await expect(page.getByRole("row", { name: /Committed by clicking away/ })).toBeVisible();
  // The user went where they wanted.
  await expect(add).toBeFocused();
});

test("EditableList: the add row takes a series and ignores an empty confirm", async ({ page }) => {
  await page.goto(EDITABLE_LIST);

  // Down from the last row goes into the add field: it is not a collection item, and
  // no one but the component would write this transition.
  await page.getByRole("row", { name: /Collect the quarterly budget/ }).click();
  await page.keyboard.press("ArrowDown");

  const add = page.getByRole("textbox", { name: "New task" });
  await expect(add).toBeFocused();

  await page.keyboard.type("Buy tickets");
  await page.keyboard.press("Enter");
  // The field stayed open and empty: that is the whole difference from `InlineEdit`.
  await expect(add).toBeFocused();
  await expect(add).toHaveValue("");

  await page.keyboard.type("Renew the domain");
  await page.keyboard.press("Enter");
  // An empty confirmation creates nothing.
  await page.keyboard.press("Enter");

  await expect(page.getByTestId("order")).toHaveText("1,2,3,4,5,6,7");
  await expect(page.getByRole("row", { name: /Buy tickets/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Renew the domain/ })).toBeVisible();

  // Up from the empty field goes back to the last row: otherwise there would be no
  // way out of the field by keyboard, since it is always on screen.
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("row", { name: /Renew the domain/ })).toBeFocused();
});

test("EditableList: the handle is disabled only on the row being edited", async ({ page }) => {
  await page.goto(EDITABLE_LIST);

  const row = page.getByRole("row", { name: /Agree the estimate/ });
  await row.click();
  await page.keyboard.press("Enter");

  // A row cannot be dragged while the cursor is in it: the arrows belong to the caret.
  await expect(row.getByRole("button", { name: "Drag" })).toBeDisabled();
  await expect(
    page.getByRole("row", { name: /Pay for hosting/ }).getByRole("button", { name: "Drag" })
  ).toBeEnabled();
});

test("Segmented: segments that do not fit move to a second row", async ({ page }) => {
  await page.goto("/iframe.html?id=actions-segmented--wrapping&globals=theme:dark;accent:blue");

  const frame = page.locator(".border-dashed");
  const group = frame.locator("div").first();
  const buttons = group.getByRole("button");
  await expect(buttons).toHaveCount(5);

  // Layout, not a class: the segments do not shrink, so what must be checked is where
  // they end up. A row is recognised by the top edge of the button.
  const tops = await buttons.evaluateAll((nodes) =>
    Array.from(new Set(nodes.map((n) => Math.round(n.getBoundingClientRect().top))))
  );
  expect(tops.length).toBe(2);

  // This is what the task was filed for: WCAG 1.4.10. The content fits the width, and
  // there is no horizontal scrolling on either the control or the page.
  const fits = await group.evaluate((el) => {
    const parent = el.parentElement as HTMLElement;
    const doc = document.documentElement;
    return {
      insideParent: el.getBoundingClientRect().right <= parent.getBoundingClientRect().right + 0.5,
      pageScrollsSideways: doc.scrollWidth > doc.clientWidth,
    };
  });
  expect(fits).toEqual({ insideParent: true, pageScrollsSideways: false });

  // The gap between rows is wider than between segments: 4 against 2. With one `gap`
  // on both axes the rows would stick together and read as a grid, not as one control.
  const gaps = await group.evaluate((el) => {
    const style = getComputedStyle(el);
    return { row: style.rowGap, column: style.columnGap };
  });
  expect(gaps).toEqual({ row: "4px", column: "2px" });
});

/**
 * The "icon only on a narrow screen" mode (OLDSUI-19).
 *
 * Measuring in the browser is mandatory for two reasons: the threshold lives in a
 * media query that jsdom does not know about at all, and what must be proven is the
 * HEIGHT, exactly the quantity the task was filed for.
 */
const SEGMENTED_MOBILE =
  "/iframe.html?id=actions-segmented--mobile-icon-only&globals=theme:dark;accent:blue";

test("Segmented: mobileIconOnly collapses the row on a phone and keeps every name", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(SEGMENTED_MOBILE);

  // The first switcher has no mode, the second has it. Five identical segments in
  // both, so they can be compared directly.
  const groups = page.locator("div.inline-flex.flex-wrap");
  await expect(groups).toHaveCount(2);
  const plain = groups.nth(0);
  const compact = groups.nth(1);

  const rows = async (group: Locator) =>
    (
      await group
        .getByRole("button")
        .evaluateAll((nodes: Element[]) =>
          Array.from(new Set(nodes.map((n) => Math.round(n.getBoundingClientRect().top))))
        )
    ).length;

  expect(await rows(plain)).toBeGreaterThan(1);
  expect(await rows(compact)).toBe(1);

  const height = async (group: Locator) => (await group.boundingBox())!.height;
  expect(await height(compact)).toBeLessThan(await height(plain));

  // THE KEY POINT: the label is hidden from the eyes but remains the button's name.
  // Hidden incorrectly (`hidden`, `display: none`, dropped children) would give a row
  // of nameless buttons, and that would be visible only through an audit.
  for (const name of ["Active", "Deferred", "Done", "Dropped", "Available now"]) {
    await expect(compact.getByRole("button", { name, exact: true })).toBeVisible();
  }
  /*
    The label is absent to the eye, and this is measured by the BOX, not by
    `toBeVisible`: `sr-only` does not remove the node, it compresses it into a pixel
    and clips it, so for Playwright it counts as "visible". The pixel is the proof:
    it left sight, and stayed in the tree.
  */
  const label = (await compact.getByText("Active").boundingBox())!;
  expect(label.width).toBeLessThanOrEqual(1);

  // The selected segment is marked by state, not only by colour: without labels,
  // this matters more than usual.
  await expect(compact.getByRole("button", { name: "Available now" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  // The padding is cut together with the label: around a lone icon, `px-3` would
  // make the button noticeably wider than its height.
  const box = (await compact.getByRole("button").first().boundingBox())!;
  expect(box.width).toBeLessThan(box.height + 8);
});

test("Segmented: on a wide screen the mode changes nothing", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(SEGMENTED_MOBILE);

  const groups = page.locator("div.inline-flex.flex-wrap");
  const plain = (await groups.nth(0).getByRole("button").first().boundingBox())!;
  const compact = (await groups.nth(1).getByRole("button").first().boundingBox())!;

  // The threshold is taken from the SCREEN width: above it, the mode must be invisible.
  expect(Math.round(compact.width)).toBe(Math.round(plain.width));
  await expect(groups.nth(1).getByText("Active")).toBeVisible();
});

test("EditableList: the add field lines up with the task names, not with the leading column", async ({
  page,
}) => {
  await page.goto(EDITABLE_LIST);

  // Measurement, not a class: the alignment holds by geometry and must converge on
  // the live layout. For the consumer, the border sat on the checkbox column, between
  // the row's edge and the names, matching neither.
  const firstRow = page.getByRole("row").first();
  await firstRow.waitFor();

  const edges = await firstRow.evaluate((row) => {
    const name = row.querySelector("span.min-w-0.flex-1") as HTMLElement;
    const field = document.querySelector('input[data-field="add"]') as HTMLElement;
    const shell = field.closest('div[class*="rounded-control"]') as HTMLElement;
    return {
      name: Math.round(name.getBoundingClientRect().left),
      fieldBorder: Math.round(shell.getBoundingClientRect().left),
    };
  });
  expect(edges.fieldBorder).toBe(edges.name);

  // The mirror in `add.leading` must not get into the accessibility tree or the tab
  // order: there is no checkbox to tick for a task that does not exist yet. There are
  // exactly as many checkboxes as rows; the sixth, from the add row, is not seen by
  // the screen reader.
  await expect(page.getByRole("row")).toHaveCount(5);
  await expect(page.getByRole("checkbox")).toHaveCount(5);
});

test("EditableList: a mouse drag moves the row and does not duplicate it", async ({ page }) => {
  await page.goto(EDITABLE_LIST);

  const rows = page.getByRole("row");
  // `allInnerTexts` does not wait by itself: without this, the "before" snapshot is
  // taken from an empty list, and the composition check compares zero rows with five.
  await rows.first().waitFor();
  const before = await rows.allInnerTexts();

  const handle = rows.first().getByRole("button", { name: "Drag" });
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 10; step++) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + step * 12, { steps: 3 });
  }
  await page.mouse.up();

  // The composition, not only the order. Exactly one operation is allowed, `move`, and
  // what is checked here is its consequence: after the drop there are as many rows as
  // there were. In WebKit the system draws a copy badge at the start of the drag (bug
  // 178058, analysed in the reference), but no copy happens there either, and this
  // check guards the operation itself.
  const after = await rows.allInnerTexts();
  expect(after).toHaveLength(before.length);
  expect(after).not.toEqual(before);
  expect([...after].sort()).toEqual([...before].sort());
});

test("Select: the width limit applies to the missing and count labels too", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=inputs-select--missing-and-count-labels&globals=theme:dark;accent:blue"
  );

  const triggers = page.getByRole("button");
  await triggers.first().waitFor();

  // Measurement, not a class: `truncate` was on these branches before too, and there
  // was nothing for it to cut. Without `max-width`, the label takes as much space as
  // it takes. What is checked is the consequence: the label is no wider than the
  // limit, and the ellipsis is real.
  const measured = await page.evaluate(() => {
    const labels = [...document.querySelectorAll("button span")].filter(
      (el) =>
        el.textContent === "This project has been deleted" ||
        el.textContent === "Topics chosen in this filter: 3"
    ) as HTMLElement[];
    return labels.map((el) => ({
      text: el.textContent,
      width: Math.round(el.getBoundingClientRect().width),
      clipped: el.scrollWidth > el.clientWidth,
    }));
  });

  expect(measured).toHaveLength(2);
  for (const label of measured) {
    expect(label.width).toBeLessThanOrEqual(110);
    expect(label.clipped).toBe(true);
  }
});

test("EditableList: row actions appear on hover AND when focus reaches them", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=content-editablelist--hover-actions&globals=theme:dark;accent:blue"
  );

  const row = page.getByRole("row").first();
  await row.waitFor();
  const actions = row.getByTestId("row-actions");

  // Measuring the computed style, not the presence of a class: an unknown Tailwind
  // variant generates no rule and disappears silently, while the class stays in the
  // markup. `toHaveCSS` waits by itself: the recipe has a 150 ms transition, and an
  // instant measurement would catch the middle of it.
  await expect(actions).toHaveCSS("opacity", "0");

  await row.hover();
  await expect(actions).toHaveCSS("opacity", "1");

  // And the main thing: the keyboard. The former recipe prescribed `group-focus-within:`
  // here, and that utility never fired: the row carries `data-rac`, while the react-aria
  // plugin marks such an element with a `data-focus-within` attribute, which the row
  // does not set. A button that Tab reached stayed invisible, so a person pressed blindly.
  await page.mouse.move(0, 0);
  await expect(actions).toHaveCSS("opacity", "0");

  await actions.getByRole("button").focus();
  await expect(actions).toHaveCSS("opacity", "1");
});

/**
 * The wheel over a `Select` panel opened from inside a modal layer.
 *
 * Radix's scroll lock (`react-remove-scroll`) is attached to the BACKDROP, while the
 * panel is portaled into `body`. That is, in the DOM it lies outside the lock and gets
 * into it only through the React tree. Hence two opposite breakages, and both have
 * already happened: the lock swallows the wheel always, and the list does not scroll
 * at all (OLDSUI-6, `Drawer`), or it never swallows, and the scroll leaks to the page
 * under the layer (suspected in OLDSUI-8, `Dialog`).
 *
 * So the measurement runs in both directions and in both layers. It cannot be done in
 * jsdom at all: `scrollHeight` there is always zero, and the check would pass under any layout.
 */
async function wheelOverPanel(page: Page) {
  return await page.evaluate(async () => {
    const list = document.querySelector("[role=listbox]") as HTMLElement;
    const before = list.scrollTop;
    // The listener sits at the very end of the chain: it sees not its own decision but
    // the final one, namely whether the lock cancelled the event.
    let prevented = false;
    const seen = (e: WheelEvent) => (prevented = e.defaultPrevented);
    window.addEventListener("wheel", seen, { passive: true });
    const box = list.getBoundingClientRect();
    list.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: 150,
        bubbles: true,
        cancelable: true,
        clientX: box.x + box.width / 2,
        clientY: box.y + box.height / 2,
      })
    );
    window.removeEventListener("wheel", seen);
    return {
      prevented,
      before: Math.round(before),
      max: Math.round(list.scrollHeight - list.clientHeight),
    };
  });
}

for (const layer of ["dialog", "drawer"] as const) {
  test(`Select inside ${layer === "dialog" ? "Dialog" : "Drawer"}: the wheel scrolls the panel and stops at its end`, async ({
    page,
  }) => {
    await page.goto(
      `/iframe.html?id=overlays-${layer}--select-inside&globals=theme:dark;accent:blue`
    );
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: /Pick a section/ }).click();

    const list = page.getByRole("listbox");
    await expect(list).toBeVisible();

    // The list has room to scroll, so the event must reach it alive.
    const atStart = await wheelOverPanel(page);
    expect(atStart.max).toBeGreaterThan(0);
    expect(atStart.prevented).toBe(false);

    // A real wheel, not an assignment: setting `scrollTop` moves the panel past the
    // lock, and such a measurement would say nothing about it.
    const box = (await list.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 200);
    await expect
      .poll(async () => await list.evaluate((el) => Math.round(el.scrollTop)))
      .toBeGreaterThan(0);

    // Scrolled to the end, and nothing goes further: neither the list nor the page
    // under the layer. The event is cancelled by the lock, not left without effect by chance.
    await list.evaluate((el) => (el.scrollTop = el.scrollHeight));
    const atEnd = await wheelOverPanel(page);
    // A one-pixel tolerance: `scrollTop` can be fractional with a fractional row
    // height, while the browser reports `scrollHeight` rounded.
    expect(Math.abs(atEnd.before - atEnd.max)).toBeLessThanOrEqual(1);
    expect(atEnd.prevented).toBe(true);

    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => Math.round(document.documentElement.scrollTop))).toBe(0);
    expect(await list.evaluate((el) => Math.round(el.scrollTop))).toBe(
      await list.evaluate((el) => Math.round(el.scrollHeight - el.clientHeight))
    );
  });
}

/**
 * The exit of an `EditableList` row (OLDSUI-14).
 *
 * This cannot be measured in jsdom: there are no animations there at all, and the
 * react-aria collection mounts rows differently. That is exactly where the first
 * approach went wrong, when the ghost was removed in the same frame in which it
 * appeared. So what is measured here is live behavior: that the exit runs, that the
 * space closes together with it, that several rows leave at once, and that `reduce`
 * removes the closing-up but not the exit itself.
 *
 * Time is never waited on: the animation is paused and rewound. Waiting for "about
 * the middle" at 150 ms is a flake, not a check.
 */
const EDITABLE_LIST_LEAVING =
  "/iframe.html?id=content-editablelist--leaving&globals=theme:dark;accent:blue";

test.describe("EditableList: a row leaves instead of vanishing", () => {
  // The showcase runs with `reducedMotion: "reduce"`; here the opposite setting is
  // needed, because the collapse is checked at full motion.
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  test("the row lives through its exit, and the space closes with the same motion", async ({
    page,
  }) => {
    await page.goto(EDITABLE_LIST_LEAVING);
    const rows = page.locator("[data-key]");
    await expect(rows).toHaveCount(5);
    const before = (await page.getByRole("grid").boundingBox())!;

    await page.getByRole("button", { name: "Done" }).nth(1).click();

    // The row did not vanish: it lives through its exit in its place.
    const leaving = page.locator("[data-key][inert]");
    await expect(leaving).toHaveCount(1);
    await expect(leaving).toContainText("Pay for hosting");

    const exit = await leaving.evaluate((row) => {
      const [animation] = row.getAnimations() as CSSAnimation[];
      const keyframes = (animation!.effect as KeyframeEffect).getKeyframes();
      animation!.pause();
      // Rewinding instead of waiting: the collapse is visible at any point, and waiting
      // for "about the middle" means measuring the speed of the machine, not the animation.
      animation!.currentTime = 0;
      const start = row.getBoundingClientRect().height;
      animation!.currentTime = 40;
      const early = row.getBoundingClientRect().height;
      animation!.currentTime = 120;
      const late = row.getBoundingClientRect().height;
      // There is nothing to measure at the very end: the animation has no fill, and on
      // the last frame the style is already removed. The collapse is proven by
      // monotonicity, and the zero at the end by the keyframes themselves.
      animation!.finish();
      return {
        name: animation!.animationName,
        height: getComputedStyle(row).getPropertyValue("--row-exit-h"),
        collapsesTo: String(keyframes[keyframes.length - 1]!.height),
        start,
        early,
        late,
      };
    });

    expect(exit.name).toBe("rowout");
    // The height comes in a variable: `height` does not interpolate from `auto`.
    expect(exit.height.trim()).toMatch(/^\d+px$/);
    expect(exit.collapsesTo).toBe("0px");
    expect(exit.early).toBeLessThan(exit.start);
    expect(exit.late).toBeLessThan(exit.early);

    await expect(leaving).toHaveCount(0);
    await expect(rows).toHaveCount(4);
    const after = (await page.getByRole("grid").boundingBox())!;
    expect(after.height).toBeLessThan(before.height);
  });

  test("three rows leave at once, without a wave of delays", async ({ page }) => {
    await page.goto(EDITABLE_LIST_LEAVING);
    await expect(page.locator("[data-key]")).toHaveCount(5);

    /*
      The start is recorded in `animationstart` itself, not by a query afterwards.

      Previously `currentTime` was compared with zero here, and it is zero only in the
      start frame: the document clock keeps running, and between the click and the next
      visit to the page under parallel load a frame or two passes. Three rows that
      started together then showed 16.7 or 83 ms: evenly, but not zero. The test failed
      on a working component. `startTime`, the start point on the document's timeline,
      does not age, however often it is read.

      The observer is attached BEFORE the click: the exit lasts 150 ms, and under load a
      ghost counter polled afterwards might no longer find them.
    */
    type Start = { key: string | null; name: string; startTime: number | null; delay: number };
    await page.evaluate(() => {
      const w = window as unknown as { __rowStarts: Start[] };
      w.__rowStarts = [];
      document.addEventListener("animationstart", (event) => {
        const row = event.target as HTMLElement;
        // Only the ghosts themselves: an animation from the consumer's slots bubbles up here too.
        if (!row.matches("[data-key][inert]")) return;
        const animation = (row.getAnimations() as CSSAnimation[]).find(
          (candidate) => candidate.animationName === event.animationName
        )!;
        // `startTime` is read via `ready`: until then the start is not assigned, and
        // `null` would mean "we did not get to ask", not "did not start".
        void animation.ready.then(() =>
          w.__rowStarts.push({
            key: row.getAttribute("data-key"),
            name: event.animationName,
            startTime: animation.startTime as number | null,
            delay: Number(animation.effect!.getComputedTiming().delay),
          })
        );
      });
    });

    await page.getByRole("button", { name: "Remove three" }).click();

    await page.waitForFunction(
      () => (window as unknown as { __rowStarts: Start[] }).__rowStarts.length >= 3
    );
    const starts = await page.evaluate(
      () => (window as unknown as { __rowStarts: Start[] }).__rowStarts
    );

    // Exactly three removed rows leave, each as a ghost (`inert`), and each with its
    // own exit, not someone else's animation.
    expect(starts.map((start) => start.key).sort()).toEqual(["1", "2", "3"]);
    expect(starts.map((start) => start.name)).toEqual(["rowout", "rowout", "rowout"]);
    // A wave across ten rows turns into waiting, and the order of the exit means
    // nothing: all three go from one point. A wave can be built in two ways, by
    // spreading the starts apart or by handing out delays, and both are closed off.
    const [first] = starts;
    expect(first!.startTime).not.toBeNull();
    expect(starts.map((start) => start.startTime)).toEqual([
      first!.startTime,
      first!.startTime,
      first!.startTime,
    ]);
    expect(starts.map((start) => start.delay)).toEqual([0, 0, 0]);

    await expect(page.locator("[data-key]")).toHaveCount(2);
  });
});

test("EditableList: focus goes forward from the row that left", async ({ page }) => {
  await page.goto(EDITABLE_LIST_LEAVING);

  // The button sits INSIDE the row: that is how the consumer's checkbox removes a task,
  // and at the moment of disappearance focus sits inside the leaving row.
  await page.getByRole("button", { name: "Done" }).nth(1).click();

  // Forward, to the row that took the place of the one that left. Focus cannot stay
  // on the ghost: it is `inert`, and focus would fall into `body`.
  await expect
    .poll(async () => await page.evaluate(() => document.activeElement?.getAttribute("data-key")))
    .toBe("3");
});

test("EditableList: the last row hands focus to the add field", async ({ page }) => {
  await page.goto(EDITABLE_LIST_LEAVING);

  for (let left = 5; left > 0; left--) {
    await page.getByRole("button", { name: "Done" }).first().click();
    await expect(page.locator("[data-key]:not([inert])")).toHaveCount(left - 1);
  }

  // No rows are left, so focus has nowhere to go except the add row.
  await expect(page.getByRole("textbox", { name: "New task" })).toBeFocused();
});

test("EditableList: under reduce the exit stays and the collapse goes", async ({ page }) => {
  // The showcase context IS `reduce`, so no separate setting is needed.
  await page.goto(EDITABLE_LIST_LEAVING);
  await expect(page.locator("[data-key]")).toHaveCount(5);

  await page.getByRole("button", { name: "Done" }).nth(1).click();

  const leaving = page.locator("[data-key][inert]");
  await expect(leaving).toHaveCount(1);
  const damped = await leaving.evaluate((row) => {
    const [animation] = row.getAnimations() as CSSAnimation[];
    animation!.pause();
    animation!.currentTime = 75;
    const half = row.getBoundingClientRect().height;
    animation!.finish();
    return { name: animation!.animationName, half };
  });

  // The exit stays: otherwise the row would vanish in a single frame, that is, more
  // abruptly than without the rule at all (ADR-0043). What goes is the collapse, the
  // movement of everything below it.
  expect(damped.name).toBe("fadeOutOnly");
  expect(damped.half).toBeGreaterThan(0);

  await expect(page.locator("[data-key]")).toHaveCount(4);
});

test("EditableList: with a ghost still on screen, focus lands on the live neighbour", async ({
  page,
}) => {
  await page.goto(EDITABLE_LIST_LEAVING);

  await page.getByRole("button", { name: "Done" }).first().click();
  const leaving = page.locator("[data-key][inert]");
  await expect(leaving).toHaveCount(1);
  // The ghost freezes so that the second disappearance happens WHILE it is still there,
  // not after: a race at 150 ms would measure the machine's speed, not the component.
  await leaving.evaluate((row) => row.getAnimations().forEach((animation) => animation.pause()));

  await page
    .locator("[data-key]:not([inert])")
    .first()
    .getByRole("button", { name: "Done" })
    .click();

  /*
    The neighbour is looked up in `items`, not on screen: the on-screen index counts
    the ghosts, and focus would drift a row past the one that left. With a live ghost
    higher up the list, it missed by one.
  */
  await expect
    .poll(async () => await page.evaluate(() => document.activeElement?.getAttribute("data-key")))
    .toBe("3");
});

/**
 * The swatch group (OLDSUI-17).
 *
 * Two things cannot be checked in jsdom: horizontal arrows (they are handled by the
 * react-aria radio group, and jsdom behaves differently there) and that selection is
 * visible not by colour alone, since the ring lives in CSS.
 */
const SWATCH_GROUP =
  "/iframe.html?id=inputs-swatchgroup--playground&globals=theme:dark;accent:blue";

test("SwatchGroup: Tab brings focus to the selected option, not to the first", async ({ page }) => {
  await page.goto(SWATCH_GROUP);
  await expect(page.getByRole("radiogroup")).toBeVisible();

  await page.keyboard.press("Tab");

  // The group is a single tab stop, and entering it must land on the answer.
  await expect(page.getByRole("radio", { name: "Teal" })).toBeFocused();
});

test("SwatchGroup: horizontal arrows walk the row, vertical ones walk the column", async ({
  page,
}) => {
  await page.goto(SWATCH_GROUP);
  await expect(page.getByRole("radiogroup")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("radio", { name: "Teal" })).toBeFocused();

  // Left goes to the previous option in the row; the radio group does this itself.
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("radio", { name: "Violet" })).toBeChecked();

  /*
    Down goes across the row, by a step of `columns` (six): under "Violet" in the grid
    sits "Steel". react-aria's linear navigation would move to "Teal", that is, to the
    adjacent column, so the component's handler must intercept the key before it does.
  */
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: "Steel" })).toBeChecked();

  // Up returns to the same column, not to the previous option.
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("radio", { name: "Violet" })).toBeChecked();

  // There is nothing below the second row, and the edge does not wrap: a swatch group
  // is not a carousel.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: "Steel" })).toBeChecked();
});

test("SwatchGroup: the selected swatch is marked by a ring, not by colour alone", async ({
  page,
}) => {
  await page.goto(SWATCH_GROUP);
  await expect(page.getByRole("radiogroup")).toBeVisible();

  const ring = async (name: string) =>
    await page
      .getByRole("radio", { name })
      .evaluate((radio) => getComputedStyle(radio.closest("label")!).boxShadow);

  /*
    The ring is drawn with a shadow and sits AROUND the swatch, on the backdrop: on the
    hue itself it falls short of 3:1 for teal and amber, and that is a state indicator
    (WCAG 1.4.11). An unselected option has no shadow at all.
  */
  expect(await ring("Teal")).not.toBe("none");
  expect(await ring("Blue")).toBe("none");
});

/**
 * The swatch name as a tooltip (OLDSUI-18).
 *
 * Measuring in the browser is mandatory: the tooltip hangs on the option's wrapper
 * precisely because `RadioButton` does not pass `onFocus` outward, and a focus event
 * from a real Tab differs from one fired by hand.
 */
const SWATCH_TOOLTIPS =
  "/iframe.html?id=inputs-swatchgroup--tooltips&globals=theme:dark;accent:blue";

/** The option itself: the radio button inside it is hidden and unreachable by mouse. */
const swatch = (set: Locator, name: string) =>
  set.getByRole("radio", { name }).locator("xpath=ancestor::label[1]");

test("SwatchGroup: the tooltip names the option under hover and under keyboard focus", async ({
  page,
}) => {
  await page.goto(SWATCH_TOOLTIPS);
  const set = page.getByRole("radiogroup", { name: "Hover or tab into it" });
  await expect(set).toBeVisible();

  /*
    Tooltips are looked up BY NAME, not by a single role: the outgoing one stays in
    the markup for a frame or two (the closing animation removes it), and a lookup by
    one role would catch two at once. The test would fail on the most ordinary focus move.
  */

  // Hover must be on the option itself, not on the hidden radio button inside it: the
  // button is in the markup, but lies under the swatch and is unreachable by mouse.
  await swatch(set, "Amber").hover();
  await expect(page.getByRole("tooltip", { name: "Amber" })).toBeVisible();

  // Focus from the keyboard: Tab brings it to the selected option, and the arrow moves
  // it to a neighbouring one. The tooltip must follow, not stay on the previous one.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("tooltip", { name: "Teal" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tooltip", { name: "Green" })).toBeVisible();

  // Escape dismisses the tooltip and does NOT take focus: the choice continues with the arrows.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(set.getByRole("radio", { name: "Green" })).toBeFocused();
});

test("SwatchGroup: the tooltip describes nothing — the name stays said once", async ({ page }) => {
  await page.goto(SWATCH_TOOLTIPS);
  const set = page.getByRole("radiogroup", { name: "Hover or tab into it" });
  await expect(set).toBeVisible();

  const radio = set.getByRole("radio", { name: "Amber" });
  await swatch(set, "Amber").hover();
  await expect(page.getByRole("tooltip", { name: "Amber" })).toBeVisible();

  /*
    Radix puts `aria-describedby` on the trigger. Here the trigger is the wrapper, not
    the option itself: on the option, the description would double the name, and the
    screen reader would read "Amber Amber".
  */
  expect(await radio.getAttribute("aria-describedby")).toBeNull();
  expect(
    await radio.evaluate((node) => node.closest("label")!.getAttribute("aria-describedby"))
  ).toBeNull();
  // The description lands on the wrapper, and that is the tooltip's own node, not someone else's.
  const describedBy = await radio.evaluate((node) =>
    node.closest("label")!.parentElement!.getAttribute("aria-describedby")
  );
  expect(describedBy).toBe(await page.getByRole("tooltip", { name: "Amber" }).getAttribute("id"));
});

test("SwatchGroup: a disabled option is named too", async ({ page }) => {
  await page.goto(SWATCH_TOOLTIPS);
  const set = page.getByRole("radiogroup", { name: "A disabled option is named too" });
  await expect(set).toBeVisible();

  // The tooltip does not explain why the option is unavailable, but "what colour is
  // this" is a legitimate question for an unavailable option too.
  await swatch(set, "Red").hover();
  await expect(page.getByRole("tooltip", { name: "Red" })).toBeVisible();
});

/**
 * The search spinner in the palette (OLDSUI-15).
 *
 * Measured in the browser, and it cannot be done otherwise: jsdom has no layout at
 * all, and the whole defect was two pixels of width.
 */
test("CommandPalette: the loading spinner does not move the typed text", async ({ page }) => {
  /*
    One story is opened twice, with `loading` and without, rather than switched by a
    button: the palette is modal, and the button behind it cannot be reached by mouse
    or keyboard. The argument comes through the address, so both frames are deterministic.
  */
  const at = async (loading: boolean) => {
    await page.goto(
      `/iframe.html?id=overlays-commandpalette--loading&globals=theme:dark;accent:blue&args=loading:!${loading}`
    );
    const field = page.getByRole("searchbox");
    await expect(field).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(loading ? 1 : 0);
    return (await field.boundingBox())!;
  };

  const idle = await at(false);
  const busy = await at(true);

  // The markup holds the icon box: the magnifier is 16, the spinner 14, and previously
  // the field shifted by the difference every time loading was switched on.
  expect(busy.x).toBe(idle.x);
  expect(busy.width).toBe(idle.width);
});

/**
 * The field height step (OLDSUI-16).
 *
 * Measured in the browser, and it cannot be done otherwise: the whole step is six
 * pixels of height, and jsdom has no layout at all. What is checked is not the number
 * itself, but its EQUALITY with the neighbours in the row: that is what the step was created for.
 */
test("TextControl: the sm step matches the row — button, field and select share one height", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=inputs-textcontrol--sizes&globals=theme:dark;accent:blue");

  const row = page.getByTestId("compact-row");
  await expect(row).toBeVisible();

  /*
    The SHELL is measured, not the `input` itself: the border lives on it, and the
    field's visible height is its box. The input inside it is two pixels shorter,
    which is exactly the border.
  */
  const heights = await row.evaluate((node) => {
    const round = (element: Element) => Math.round(element.getBoundingClientRect().height);
    return {
      button: round(node.querySelector("button")!),
      field: round(node.querySelector("input")!.parentElement!),
      // The `Select` pill is the trigger's outer box, not the button inside it.
      select: round(node.querySelector("[aria-haspopup='listbox']")!.parentElement!),
    };
  });

  expect(heights.field).toBe(36);
  expect(heights.field).toBe(heights.button);
  expect(heights.field).toBe(heights.select);

  // The default is untouched: in the form, the old 42 still holds.
  const form = page.getByRole("textbox", { name: "Form field" });
  expect(
    await form.evaluate((input) => Math.round(input.parentElement!.getBoundingClientRect().height))
  ).toBe(42);
});

/*
  The Editor's tables (OLDSUI-45). jsdom has no layout and no native caret: leaving a
  table with an arrow, scrolling a narrow table, and focus after an action from a menu
  are checked only here.
*/
test("RichTextEditor table: Alt+F10 reaches the Table menu and a Row action keeps focus in the document", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=inputs-richtexteditor--table-menu&globals=theme:dark;accent:blue"
  );

  const field = page.getByRole("textbox", { name: "Document" });
  const rows = field.locator("tr");
  await expect(rows).toHaveCount(4);

  // The story puts the caret into the "Billing" cell itself. Alt+F10 into the Toolbar,
  // arrows to "Table ▾".
  const button = await focusToolbarButton(page, "Table");
  await expect(button).toBeFocused();
  await expect(button).toHaveAttribute("aria-haspopup", "menu");

  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu", { name: "Table" })).toBeVisible();
  // Table › Insert table… › Cell › Row; → opens the submenu.
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("menu", { name: "Row" })).toBeVisible();
  await page.keyboard.press("Enter");

  // The first item, "Insert row above", applies to the "Billing" row.
  await expect(rows).toHaveCount(5);
  await expect(field).toBeFocused();
});

test("RichTextEditor table: Tab walks the cells, Tab in the last one adds a row, an arrow leaves the table", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=inputs-richtexteditor--insert-menu-slash&globals=theme:dark;accent:blue"
  );

  const field = page.getByRole("textbox", { name: "Document" });
  // "Table ▾" → "Table ›" → a 3×3 grid.
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await page.getByRole("menuitem", { name: "Table", exact: true }).hover();
  await page.getByRole("gridcell", { name: "3 columns, 3 rows" }).click();
  await expect(field.locator("tr")).toHaveCount(3);
  // Focus returns to the document once the menu is dismissed (after it disappears):
  // a Tab before that would land on the grid, not on the cell.
  await expect(field).toBeFocused();

  // Nine cells: eight Tabs from the first to the last, and the ninth adds a row.
  for (let i = 0; i < 9; i++) await page.keyboard.press("Tab");
  await expect(field.locator("tr")).toHaveCount(4);

  // Down arrow from the last row: the gap cursor under the table, and typing makes a paragraph.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.type("after");
  await expect(field.locator("p").last()).toHaveText("after");
  await expect(field.locator("table p", { hasText: "after" })).toHaveCount(0);
});

/*
  The table size grid (OLDSUI-45): focus on mount, growth by arrows, and keyboard
  selection are checked in a real browser.
*/
test("RichTextEditor table size grid: arrows grow the grid, Enter picks, Escape cancels", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=inputs-richtexteditor--table-size-grid&globals=theme:dark;accent:blue"
  );

  const grid = page.getByRole("grid", { name: "Table size" });
  await expect(grid).toBeFocused();
  await expect(grid.getByRole("gridcell")).toHaveCount(25);

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("status")).toHaveText("5 columns, 4 rows");
  await expect(grid.getByRole("gridcell")).toHaveCount(30);

  await page.keyboard.press("Enter");
  await expect(page.getByTestId("picked")).toHaveText("picked 5 x 4");

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("picked")).toHaveText("cancelled");
});

test("RichTextEditor table size grid: Tab leaves the grid for the fields and the Insert button", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=inputs-richtexteditor--table-size-grid-fields&globals=theme:dark;accent:blue"
  );

  await expect(page.getByRole("grid", { name: "Table size" })).toBeFocused();
  await page.keyboard.press("Tab");
  const columns = page.getByRole("textbox", { name: "Columns" });
  await expect(columns).toBeFocused();
  await columns.fill("12");
  await columns.press("Enter");
  await expect(page.getByRole("status")).toHaveText("12 columns, 3 rows");

  await page.getByRole("button", { name: "Insert" }).click();
  await expect(page.getByTestId("picked")).toHaveText("picked 12 x 3");
});

test("RichTextView table: a wide table scrolls inside itself on a phone and does not widen the page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(
    "/iframe.html?id=content-richtextview--table-narrow&globals=theme:dark;accent:blue"
  );

  // Only in the story canvas: in `iframe.html` the showcase also holds a hidden
  // argstable template (`.sb-argstableBlock`).
  const table = page.locator("#storybook-root table");
  await expect(table).toBeVisible();
  const metrics = await table.evaluate((node) => ({
    overflowX: getComputedStyle(node).overflowX,
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
    page: document.documentElement.scrollWidth,
    window: window.innerWidth,
  }));

  expect(metrics.overflowX).toBe("auto");
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
  // The page stayed within the window's width: only the table scrolls horizontally.
  expect(metrics.page).toBeLessThanOrEqual(metrics.window);
});

/*
  The error state of the code and time fields: the border is painted by the cascade
  (`has-[…aria-invalid]` and the Tailwind variant on `aria-invalid`), and jsdom does
  not compute the cascade. The reference colour is taken from the error text of
  `FormField`, which is `text-danger-strong`, that is, the same token, so that the
  test does not depend on the theme.
*/
test("PinInput: an error of FormField turns every cell border red", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=inputs-pininput--in-form-with-error&globals=theme:dark;accent:blue"
  );

  const danger = await page.getByRole("alert").evaluate((node) => getComputedStyle(node).color);
  const cells = page.getByRole("textbox");
  await expect(cells).toHaveCount(6);
  for (let i = 0; i < 6; i++) {
    const shell = cells.nth(i).locator("xpath=..");
    await expect(shell).toHaveCSS("border-top-color", danger);
  }
});

test("TimePicker: invalid turns the underline red, in focus too", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=date-and-time-timepicker--invalid&globals=theme:dark;accent:blue"
  );

  const danger = await page.getByRole("alert").evaluate((node) => getComputedStyle(node).color);
  const fields = page.getByRole("combobox");

  await expect(fields.nth(0)).toHaveCSS("border-bottom-color", danger);
  await expect(fields.nth(1)).toHaveCSS("border-bottom-color", danger);

  // Focus paints the line in the accent (`focus-visible:`); on a field with an error,
  // the red must win. jsdom does not check the order of variants in CSS.
  await fields.nth(0).focus();
  await expect(fields.nth(0)).toHaveCSS("border-bottom-color", danger);
});

test("Toggle: a click on the description flips the switch", async ({ page }) => {
  await page.goto("/iframe.html?id=actions-toggle--setting-row&globals=theme:dark;accent:blue");

  const guests = page.getByRole("switch", { name: "Members can invite guests" });
  await expect(guests).not.toBeChecked();

  // The description is part of the target: a click on it activates the switch by the
  // browser's own means (`<label for>`), and for a disabled one it does not fire.
  await page.getByText("Guests see only the projects they are added to.").click();
  await expect(guests).toBeChecked();

  const sso = page.getByRole("switch", { name: "Single sign-on" });
  await expect(sso).toBeDisabled();
  await page.getByText("Available on the Business plan.").click({ force: true });
  await expect(sso).not.toBeChecked();
});

test("ConfirmDialog typeToConfirm: the focus starts in the field, Enter confirms only on a match", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=overlays-confirmdialog--type-to-confirm&globals=theme:dark;accent:blue"
  );

  await page.getByRole("button", { name: "Delete the workspace" }).click();
  const dialog = page.getByRole("alertdialog");
  const field = dialog.getByRole("textbox", { name: "Type “Acme Labs” to confirm" });
  const confirm = dialog.getByRole("button", { name: "Delete the workspace" });

  // Focus is in the field, not on the button or the close cross, and the button is disabled.
  await expect(field).toBeFocused();
  await expect(confirm).toBeDisabled();

  // Enter without a match does not close the dialog; case matters.
  await page.keyboard.type("acme labs");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await expect(confirm).toBeDisabled();

  await field.fill("Acme Labs");
  await expect(confirm).toBeEnabled();
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
});

test("FilterBar: a number range and a date range are added through the popover and become tokens", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=table-filterbar--ranges-from-scratch&globals=theme:dark;accent:blue"
  );

  const add = page.getByRole("button", { name: "Add filter" });
  await add.click();
  await page.getByRole("button", { name: "Field" }).click();
  await page.getByRole("option", { name: "Amount" }).click();

  // Instead of a list of values there are two number fields; "Apply" waits for the bounds.
  const apply = page.getByRole("button", { name: "Apply" });
  await expect(apply).toBeDisabled();
  await page.getByRole("textbox", { name: "From" }).fill("50");
  await page.getByRole("textbox", { name: "To" }).fill("100");
  // A mouse click moves focus off the field and commits the input right up to the click.
  await apply.click();

  await expect(page.getByText("Amount: 50–100")).toBeVisible();
  await expect(add).toBeFocused();

  // Date: the calendar opens inside the add popover and does not close it.
  await add.click();
  await page.getByRole("button", { name: "Field" }).click();
  await page.getByRole("option", { name: "Created" }).click();
  await page.getByRole("group", { name: "From" }).getByRole("button").click();
  await page.getByRole("grid").getByRole("button").filter({ hasText: /^15$/ }).first().click();

  await expect(apply).toBeVisible();
  await expect(apply).toBeEnabled();
  await apply.click();

  await expect(page.getByText(/^Created: from /)).toBeVisible();

  // The range token is removed like any other.
  await page.getByRole("button", { name: "Remove filter" }).first().click();
  await expect(page.getByText("Amount: 50–100")).toHaveCount(0);
});

test.describe("VirtualGrid on a touch screen", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 800 } });

  test("a long press opens the cell menu and neither opens nor selects the cell", async ({
    page,
  }) => {
    await page.goto(
      "/iframe.html?id=content-virtualgrid--actions-and-menu&globals=theme:dark;accent:blue"
    );
    await page.waitForTimeout(500);
    const box = (await page.getByRole("row").first().boundingBox())!;
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    // A long press, with real touch events: Radix's menu opens it by timer, while the
    // cell's react-aria `usePress` could take the release for a press.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await page.waitForTimeout(1200);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(300);

    // On a cell with a menu, a long press brings up only the menu (OLDSUI-202):
    // react-aria would select it by its own rule, but the grid cancels its press earlier.
    await expect(page.getByRole("menu")).toHaveCount(1);
    await expect(page.getByTestId("opened")).toHaveText("Opened: none");
    await expect(page.getByTestId("selected")).toHaveText("Selected: none");
  });

  test("a long press on a cell without a menu starts selection, as react-aria does", async ({
    page,
  }) => {
    await page.goto(
      "/iframe.html?id=content-virtualgrid--actions-and-menu&globals=theme:dark;accent:blue"
    );
    await page.waitForTimeout(500);
    // On a narrow screen there is one column: cell "2" is below the edge, so the grid scrolls first.
    const grid = page.getByRole("grid", { name: "Frames" });
    await grid.evaluate((el) => el.scrollTo(0, 400));
    await page.waitForTimeout(300);
    const box = (await page.locator('[role="row"][data-key="2"]').boundingBox())!;
    const area = (await grid.boundingBox())!;
    // The touch lands in the visible part of the cell: its bottom may run past the grid's edge.
    const top = Math.max(box.y, area.y);
    const bottom = Math.min(box.y + box.height, area.y + area.height);
    const point = { x: box.x + box.width / 2, y: (top + bottom) / 2 };
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await page.waitForTimeout(1200);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(300);

    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(page.getByTestId("opened")).toHaveText("Opened: none");
    await expect(page.getByTestId("selected")).toHaveText("Selected: 2");
  });

  test("a finger that moves before the long press fires opens no menu", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=content-virtualgrid--actions-and-menu&globals=theme:dark;accent:blue"
    );
    await page.waitForTimeout(500);
    const box = (await page.getByRole("row").first().boundingBox())!;
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await page.waitForTimeout(150);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: point.x, y: point.y - 40 }],
    });
    await page.waitForTimeout(1000);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(300);

    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(page.getByTestId("selected")).toHaveText("Selected: none");
  });
});

/*
  VirtualGrid in the library (OLDSUI-199): window scrolling under the sticky bar,
  loading at the end, buttons and a checkbox in a cell, Shift only adds, and a finger
  drag. All of this is layout, the window and touch events, that is, exactly what
  jsdom does not have.
*/
const VIRTUAL_GRID_LIBRARY =
  "/iframe.html?id=content-virtualgrid--library&globals=theme:dark;accent:blue";
const LIBRARY_BAR = 56;

async function openLibrary(page: Page) {
  await page.goto(VIRTUAL_GRID_LIBRARY);
  await expect(page.getByTestId("loaded")).toHaveText("Loaded: 120");
  return page.getByRole("grid", { name: "Posters" });
}

test("VirtualGrid library: the window scrolls, the DOM keeps only cells near it", async ({
  page,
}) => {
  const grid = await openLibrary(page);
  const first = () => grid.getByRole("row").first().getAttribute("data-key");

  // The grid has no scrolling of its own: it spans the full height of the content.
  const own = await grid.evaluate((el) => ({ client: el.clientHeight, scroll: el.scrollHeight }));
  expect(own.scroll).toBeLessThanOrEqual(own.client + 1);
  expect(await grid.getByRole("row").count()).toBeLessThan(60);

  const before = await first();
  await page.mouse.move(400, 400);
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(300);
  expect(await first()).not.toBe(before);
  expect(await grid.getByRole("row").count()).toBeLessThan(60);
});

test("VirtualGrid library: a focused cell never hides under the sticky bar", async ({ page }) => {
  const grid = await openLibrary(page);
  await page.mouse.move(400, 400);
  await page.mouse.wheel(0, 2500);
  await page.waitForTimeout(300);

  // A cell at the top edge of the window, below the header; then further with the Up arrow.
  const target = grid.getByRole("row");
  let focusKey = "";
  for (const row of await target.all()) {
    const box = await row.boundingBox();
    if (box && box.y > LIBRARY_BAR + 20 && box.y < LIBRARY_BAR + 300) {
      focusKey = (await row.getAttribute("data-key")) ?? "";
      await row.focus();
      break;
    }
  }
  expect(focusKey).not.toBe("");

  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(150);
    const top = await page.evaluate(() => document.activeElement!.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(LIBRARY_BAR);
  }
});

test("VirtualGrid library: the next page loads at the end, once", async ({ page }) => {
  await openLibrary(page);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.mouse.move(400, 400);
  await page.mouse.wheel(0, 200);
  await expect(page.getByTestId("loaded")).toHaveText("Loaded: 240");
  // Loading does not chain on its own: without scrolling, the page stays a single page.
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("loaded")).toHaveText("Loaded: 240");
});

test("VirtualGrid library: buttons in a cell work and neither open nor select it", async ({
  page,
}) => {
  const grid = await openLibrary(page);
  // The `MediaCard` buttons catch the pointer on hover, so first the cursor goes onto
  // the tile, as it would for a real person.
  await grid.getByRole("row").nth(2).hover();
  const favourite = page.getByRole("button", { name: "Favourite poster-0002.jpg" });
  await favourite.click();
  await expect(favourite).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("opened")).toHaveText("Opened: none");
  await expect(page.getByTestId("selected-count")).toHaveText("Selected: 0");

  // The selection checkbox is on the same axis as the grid.
  await grid.getByRole("row").nth(3).hover();
  // The visible box covers the hidden `input`: a person presses the checkbox's label.
  await page
    .getByRole("checkbox", { name: "Select poster-0003.jpg" })
    .locator("xpath=ancestor::label[1]")
    .click();
  await expect(page.getByTestId("selected-count")).toHaveText("Selected: 1");
  await expect(page.getByTestId("opened")).toHaveText("Opened: none");
});

test("VirtualGrid library: onAction brings the cell's rectangle", async ({ page }) => {
  const grid = await openLibrary(page);
  const row = grid.getByRole("row").nth(1);
  const box = (await row.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + 30);
  await expect(page.getByTestId("opened")).toHaveText(`Opened: 1 at ${Math.round(box.y)}`);
});

test("VirtualGrid library: Shift extends the selection and keeps what was there", async ({
  page,
}) => {
  const grid = await openLibrary(page);
  await grid.getByRole("row").nth(0).hover();
  // The visible box covers the hidden `input`: a person presses the checkbox's label.
  await page
    .getByRole("checkbox", { name: "Select poster-0000.jpg" })
    .locator("xpath=ancestor::label[1]")
    .click();
  await expect(page.getByTestId("selected-count")).toHaveText("Selected: 1");

  await grid.getByRole("row").nth(6).focus();
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  // The earlier selection is still there: react-aria without the `add` mode would
  // have replaced the set with the range.
  await expect(page.getByRole("checkbox", { name: "Select poster-0000.jpg" })).toBeChecked();
  const count = Number((await page.getByTestId("selected-count").innerText()).replace(/\D/g, ""));
  expect(count).toBeGreaterThanOrEqual(3);
});

test("VirtualGrid library: edgeGap={false} puts the first column flush with the grid", async ({
  page,
}) => {
  const grid = await openLibrary(page);
  const gridBox = (await grid.boundingBox())!;
  const rowBox = (await grid.getByRole("row").first().boundingBox())!;
  expect(Math.round(rowBox.x)).toBe(Math.round(gridBox.x));
  expect(Math.round(rowBox.y)).toBe(Math.round(gridBox.y));
});

test("VirtualGrid library: edgeGap={false} keeps the requested gap between cells", async ({
  page,
}) => {
  const grid = await openLibrary(page);
  const rows = grid.getByRole("row");
  const first = (await rows.nth(0).boundingBox())!;
  const second = (await rows.nth(1).boundingBox())!;
  // Both cells are in the first row: the gap between them is the requested `gap` (12 by
  // default). react-aria's layout shrinks its own gap below `minSpace` when rounding,
  // and the flush mode inherited that (OLDSUI-203: 16 instead of 18).
  expect(Math.round(second.y)).toBe(Math.round(first.y));
  expect(Math.round(second.x - (first.x + first.width))).toBe(12);
});

test.describe("VirtualGrid library on a narrow screen", () => {
  test.use({ viewport: { width: 405, height: 800 } });

  test("edgeGap={false} counts columns without the outer gap, like a 1fr CSS grid", async ({
    page,
  }) => {
    const grid = await openLibrary(page);
    const width = (await grid.boundingBox())!.width;
    const rows = grid.getByRole("row");
    const top = Math.round((await rows.nth(0).boundingBox())!.y);
    let inFirstRow = 0;
    for (const box of await Promise.all((await rows.all()).map((row) => row.boundingBox()))) {
      if (box && Math.round(box.y) === top) inFirstRow += 1;
    }
    // The story: minItemWidth 180, gap 12. Columns as in `minmax(180px, 1fr)` without
    // edge margins. react-aria's layout reserved the outer gap and lost a column (OLDSUI-203).
    const expected = Math.max(1, Math.floor((width + 12) / (180 + 12)));
    // The window width is chosen so that react-aria would have counted one column fewer.
    expect(Math.floor(width / (180 + 12))).toBe(expected - 1);
    expect(inFirstRow).toBe(expected);
  });
});

test.describe("VirtualGrid library on a touch screen", () => {
  // 420, not 390: at 390 only one column fits, and the drag would run along a single column.
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 420, height: 800 } });

  async function centre(page: Page, key: string) {
    const box = (await page.locator(`[role="row"][data-key="${key}"]`).boundingBox())!;
    return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  }

  test("hold and drag select a range of cells and open nothing", async ({ page }) => {
    await openLibrary(page);
    const cdp = await page.context().newCDPSession(page);
    const a = await centre(page, "0");
    const b = await centre(page, "1");
    const c = await centre(page, "3");

    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [a] });
    await page.waitForTimeout(400);
    for (const point of [b, c]) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point] });
      await page.waitForTimeout(80);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(300);

    // Cells 0..3 in collection order, not the rectangle on screen.
    await expect(page.getByTestId("selected-count")).toHaveText("Selected: 4");
    await expect(page.getByTestId("opened")).toHaveText("Opened: none");
    // The finger's movement cancelled Radix's menu timer: the gesture is a selection, not a menu.
    await expect(page.getByRole("menu")).toHaveCount(0);
  });

  test("a long press without moving opens the cell menu, not the cell", async ({ page }) => {
    await openLibrary(page);
    const cdp = await page.context().newCDPSession(page);
    const a = await centre(page, "1");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [a] });
    await page.waitForTimeout(1200);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(300);

    // Holding only arms the drag: without movement, this long press opens the menu and
    // only the menu; the selection does not change (OLDSUI-202).
    await expect(page.getByRole("menu")).toHaveCount(1);
    await expect(page.getByTestId("selected-count")).toHaveText("Selected: 0");
    await expect(page.getByTestId("opened")).toHaveText("Opened: none");
  });

  async function drag(page: Page, keys: string[]) {
    const cdp = await page.context().newCDPSession(page);
    const points = [];
    for (const key of keys) points.push(await centre(page, key));
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [points[0]!] });
    await page.waitForTimeout(400);
    for (const point of points.slice(1)) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point] });
      await page.waitForTimeout(80);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(300);
  }

  test("the first tap after a drag reaches a button in a cell", async ({ page }) => {
    await openLibrary(page);
    await drag(page, ["0", "1"]);
    await expect(page.getByTestId("selected-count")).toHaveText("Selected: 2");

    // The click-suppression flag after a gesture must not swallow the next real tap.
    await page.waitForTimeout(500);
    const favourite = page.getByRole("button", { name: "Favourite poster-0003.jpg" });
    await favourite.tap();
    await expect(favourite).toHaveAttribute("aria-pressed", "true");
  });

  test("a drag after select-all keeps everything selected", async ({ page }) => {
    const grid = await openLibrary(page);
    await grid.getByRole("row").first().focus();
    await page.keyboard.press("Control+a");
    await expect(page.getByTestId("selected-count")).toHaveText("Selected: 120");
    await drag(page, ["0", "1"]);
    await expect(page.getByTestId("selected-count")).toHaveText("Selected: 120");
  });

  test("a quick swipe scrolls the page and selects nothing", async ({ page }) => {
    await openLibrary(page);
    const cdp = await page.context().newCDPSession(page);
    const a = await centre(page, "2");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [a] });
    for (let i = 1; i <= 5; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: a.x, y: a.y - i * 40 }],
      });
      await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(300);
    await expect(page.getByTestId("selected-count")).toHaveText("Selected: 0");
  });
});

/*
 * The Document's table of contents (`RichTextToc`, OLDSUI-264). Hover with a delay,
 * highlighting the current section on scroll, and the jump under the sticky header
 * depend on layout, scrolling and pointer events, and jsdom has none of these.
 */
test.describe("RichTextToc", () => {
  // The window is shorter than standard: the story must scroll beyond the last heading,
  // otherwise the page hits the end and the highlight and the jump are checked against the wrong thing.
  test.use({ viewport: { width: 1280, height: 480 } });
  const strip = (page: Page) => page.getByRole("button", { name: "Table of contents" });
  const list = (page: Page) => page.getByRole("navigation", { name: "Table of contents" });

  /** The pointer arrives at the strip from outside: that is how the browser sends `pointerenter`. */
  async function hoverStrip(page: Page) {
    const box = (await strip(page).boundingBox())!;
    await page.mouse.move(box.x + box.width + 400, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
  }

  test("hover opens the list after a delay and leaving closes it", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=content-richtexttoc--playground&globals=theme:dark;accent:blue"
    );
    await expect(strip(page)).toBeVisible();

    await hoverStrip(page);
    // Not right away: a stray pass of the cursor does not open the list.
    await expect(list(page)).toHaveCount(0);
    await expect(list(page)).toBeVisible();
    await expect(strip(page)).toHaveAttribute("aria-expanded", "true");

    await page.mouse.move(900, 700, { steps: 4 });
    await expect(list(page)).toHaveCount(0);
  });

  test("a jump keeps the list open, focuses the heading and moves the highlight", async ({
    page,
  }) => {
    await page.goto(
      "/iframe.html?id=content-richtexttoc--playground&globals=theme:dark;accent:blue"
    );
    await hoverStrip(page);
    await list(page).getByRole("button", { name: "Surfaces", exact: true }).click();

    const heading = page.getByRole("heading", { name: "Surfaces" });
    await expect(heading).toBeFocused();
    await expect(list(page)).toBeVisible();
    await expect(list(page).getByRole("button", { name: "Surfaces", exact: true })).toHaveAttribute(
      "aria-current",
      "location"
    );
    // The page address does not change: the jump uses no anchors.
    expect(new URL(page.url()).hash).toBe("");
  });

  test("scrolling moves the highlight in the strip", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=content-richtexttoc--playground&globals=theme:dark;accent:blue"
    );
    const current = () =>
      page.evaluate(() =>
        [...document.querySelectorAll("[data-toc-stroke]")].findIndex((stroke) =>
          stroke.hasAttribute("data-current")
        )
      );
    await expect.poll(current).toBe(0);

    const tones = page.getByRole("heading", { name: "Tones" });
    await tones.evaluate((node) =>
      window.scrollTo(0, node.getBoundingClientRect().top + window.scrollY)
    );
    // "Tones" is the fifth heading of the Document.
    await expect.poll(current).toBe(4);
  });

  test("a jump puts the heading under the sticky header, not behind it", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=content-richtexttoc--sticky-header&globals=theme:dark;accent:blue"
    );
    await expect(strip(page)).toBeVisible();
    await hoverStrip(page);
    await list(page).getByRole("button", { name: "Tones", exact: true }).click();

    const heading = page.getByRole("heading", { name: "Tones" });
    await expect(heading).toBeFocused();
    // The header is 56px (`--topbar-h` in the story): the heading sits exactly under it.
    await expect.poll(async () => Math.round((await heading.boundingBox())!.y)).toBe(56);
  });

  test("without a header a jump scrolls the area and leaves the page where it was", async ({
    page,
  }) => {
    await page.goto(
      "/iframe.html?id=content-richtexttoc--scrolling-area-without-header&globals=theme:dark;accent:blue"
    );
    await expect(strip(page)).toBeVisible();
    // The page was scrolled a little, so the shift from the jump is distinguishable from zero.
    await page.evaluate(() => window.scrollTo(0, 40));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(40);

    await hoverStrip(page);
    await list(page).getByRole("button", { name: "Tones", exact: true }).click();

    const heading = page.getByRole("heading", { name: "Tones" });
    const area = page.getByTestId("scroll-area");
    await expect(heading).toBeFocused();
    // The scroll is smooth, so we wait until it ends.
    await expect
      .poll(
        async () => {
          const top = (await heading.boundingBox())!.y - (await area.boundingBox())!.y;
          return Math.round(top);
        },
        { timeout: 5000 }
      )
      .toBe(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(40);
  });

  test.describe("on a narrow screen", () => {
    test.use({ viewport: { width: 360, height: 700 } });

    test("the strip hides itself when the margin has no room", async ({ page }) => {
      await page.goto("/iframe.html?id=content-richtexttoc--margin&globals=theme:dark;accent:blue");
      await expect(page.getByRole("heading", { name: "Palette" })).toBeVisible();
      await expect(strip(page)).toBeHidden();
    });
  });
});

/*
 * The Editor's `toc` Tool (OLDSUI-271, ADR-0068): the Table of contents in the left
 * margin of the field. Stickiness under the Toolbar, the caret after a jump, and
 * scrolling inside the field are checked only in a real browser.
 */
test.describe("RichTextEditor with the toc tool", () => {
  test.use({ viewport: { width: 1280, height: 560 } });
  const strip = (page: Page) => page.getByRole("button", { name: "Table of contents" });
  const list = (page: Page) => page.getByRole("navigation", { name: "Table of contents" });

  async function jump(page: Page, name: string) {
    const box = (await strip(page).boundingBox())!;
    await page.mouse.move(box.x + 600, box.y + 10);
    await page.mouse.move(box.x + box.width / 2, box.y + 10, { steps: 4 });
    await list(page).getByRole("button", { name, exact: true }).click();
  }

  test("a jump in an editable Editor puts the caret at the end of the heading", async ({
    page,
  }) => {
    await page.goto(
      "/iframe.html?id=inputs-richtexteditor--table-of-contents&globals=theme:dark;accent:blue"
    );
    await expect(strip(page)).toBeVisible();
    await jump(page, "Tones");
    await page.keyboard.type("!");
    await expect(page.getByRole("heading", { name: "Tones!" })).toBeVisible();
  });

  test("the strip sticks under the fixed toolbar", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=inputs-richtexteditor--table-of-contents&globals=theme:dark;accent:blue"
    );
    await expect(strip(page)).toBeVisible();
    // Scrolled twice: the strip stays in the same place under the Toolbar, so it sticks.
    await page.evaluate(() => window.scrollTo(0, 300));
    const toolbar = (await page.getByRole("toolbar").first().boundingBox())!;
    const first = (await strip(page).boundingBox())!.y;
    expect(first).toBeGreaterThanOrEqual(toolbar.y + toolbar.height);
    expect(first).toBeLessThan(toolbar.y + toolbar.height + 16);
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect.poll(async () => (await strip(page).boundingBox())!.y).toBe(first);
  });

  test("jumpTo from the screen stops the heading under the header and the fixed toolbar", async ({
    page,
  }) => {
    await page.goto(
      "/iframe.html?id=inputs-richtexteditor--tool-commands&globals=theme:dark;accent:blue"
    );
    await expect(strip(page)).toBeVisible();
    await page.getByRole("button", { name: "Go to “How to read”" }).click();
    const heading = page.getByRole("heading", { name: "How to read" });
    // The edge is the bottom of the Toolbar's shell, not of the `toolbar` itself: the
    // Editor measures the Toolbar's height for the jump and the sticky strip from the
    // shell (with its border).
    const shell = page.getByRole("toolbar").first().locator("xpath=..");
    const toolbar = (await shell.boundingBox())!;
    const edge = toolbar.y + toolbar.height;
    // The scroll is smooth: we wait until the heading lands flush under the Toolbar's bottom edge.
    await expect
      .poll(async () => Math.round((await heading.boundingBox())!.y - edge), { timeout: 5000 })
      .toBeLessThanOrEqual(2);
    // And not beneath it: the heading sits entirely below the Toolbar and the header.
    expect((await heading.boundingBox())!.y).toBeGreaterThanOrEqual(edge - 1);
    // The button is outside the field, and the caret is at the end of the heading,
    // as after a click on an item.
    await page.keyboard.type("!");
    await expect(page.getByRole("heading", { name: "How to read!" })).toBeVisible();
  });

  test("in a field with maxHeight the jump scrolls the field, not the page", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=inputs-richtexteditor--table-of-contents-scrolling-field&globals=theme:dark;accent:blue"
    );
    await expect(strip(page)).toBeVisible();
    await jump(page, "Tones");
    const heading = page.getByRole("heading", { name: "Tones" });
    const area = heading.locator("xpath=ancestor::div[contains(@class,'overflow-y-auto')][1]");
    await expect
      .poll(async () =>
        Math.round((await heading.boundingBox())!.y - (await area.boundingBox())!.y)
      )
      .toBe(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  /*
   * The Tool state of `toc` (OLDSUI-268): the current section in the snapshot follows
   * the scroll. jsdom nodes have no geometry, so this is checked only here.
   */
  test("the State follows the scroll: the current section reaches the external navigation", async ({
    page,
  }) => {
    await page.goto(
      "/iframe.html?id=inputs-richtexteditor--table-of-contents-external-navigation&globals=theme:dark;accent:blue"
    );
    const current = page
      .getByRole("navigation", { name: "Reading position" })
      .locator('[aria-current="location"]');
    await expect(current).toHaveText("Palette");

    // The heading has settled under the sticky Toolbar, so it is the current section.
    // The section is taken from the middle: the scroll does not reach the headings near
    // the end, where the current one is the last.
    await page.getByRole("heading", { name: "Layer 1 — primitives" }).evaluate((heading) => {
      window.scrollTo(0, window.scrollY + heading.getBoundingClientRect().top - 30);
    });
    await expect(current).toHaveText("Layer 1 — primitives");

    // The document is scrolled to the end: the current one is the last section,
    // even though it is short.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(current).toHaveText("What's next");

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(current).toHaveText("Palette");
  });
});
