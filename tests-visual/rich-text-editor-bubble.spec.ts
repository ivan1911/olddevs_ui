import { expect, test, type Page } from "@playwright/test";

/**
 * Editor Bubble menu in a browser (`toolbar="bubble"`, OLDSUI-69): what jsdom cannot
 * do, namely floating-ui placement at the edges, the real layers of `Dialog` and
 * `Drawer`, and the cascade of the inverse surface.
 */

const STORY = (id: string, theme = "dark", args = "") =>
  `/iframe.html?id=inputs-richtexteditor--${id}&globals=theme:${theme};accent:blue${args}`;

const BUBBLE = { name: "Selection formatting" } as const;

/**
 * Select the Document's first word with a double-click, as one action rather than a
 * run of `Shift+→` presses: under the load of a parallel run, ProseMirror re-read the
 * selection in the middle of the presses, and the word was not selected in full.
 */
async function selectFirstWord(page: Page, word: string) {
  const field = page.getByRole("textbox", { name: "Document" });
  // The dialog and the drawer move focus themselves once their entrance animation
  // ends, so start only after it; otherwise their autofocus would move the selection
  // out of the Document.
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running")
  );
  await field
    .locator("> *")
    .first()
    .dblclick({ position: { x: 4, y: 8 } });
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString().trim())).toBe(word);
  // ProseMirror reads the selection from `selectionchange`, so give it a frame or two.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  );
  return field;
}

test("inside a Dialog: the bubble formats, and Escape in its menu closes only the menu", async ({
  page,
}) => {
  await page.goto(STORY("inside-dialog", "dark", "&args=toolbar:bubble"));
  const dialog = page.getByRole("dialog", { name: "Edit the note" });
  const field = await selectFirstWord(page, "Press");
  const bubble = page.getByRole("toolbar", BUBBLE);
  await expect(bubble).toBeVisible();

  await bubble.getByRole("button", { name: "Bold" }).click();
  await expect(field.locator("strong")).toHaveText("Press");
  // The action returns focus to the Document one frame later, and the Bubble menu
  // recalculates its display 250 ms after an edit: wait for both, as a person would.
  await expect(field).toBeFocused();
  await page.waitForTimeout(300);
  await expect(bubble.getByRole("button", { name: "Bold" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  await bubble.getByRole("button", { name: /^Block type/ }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(bubble).toBeVisible();
});

test("inside a Drawer: the bubble shows over the selection and its buttons work", async ({
  page,
}) => {
  await page.goto(STORY("selection-bubble-in-drawer"));
  const drawer = page.getByRole("dialog", { name: "Edit the note" });
  const field = await selectFirstWord(page, "Meeting");
  const bubble = page.getByRole("toolbar", BUBBLE);
  await expect(bubble).toBeVisible();

  await bubble.getByRole("button", { name: "Italic" }).click();
  await expect(field.locator("em")).toHaveText("Meeting");
  await expect(drawer).toBeVisible();

  // The Bubble menu's layer is above the drawer's layer, so it does not hide behind
  // the drawer's panel.
  const box = await bubble.boundingBox();
  const panel = await drawer.boundingBox();
  expect(box && panel && box.x >= panel.x && box.x + box.width <= panel.x + panel.width).toBe(true);
});

test("in a scroll container at the window edge the bubble flips and shifts instead of being cut", async ({
  page,
}) => {
  await page.goto(STORY("selection-bubble-in-scroll"));
  const container = page.getByTestId("scroll-container");
  // The heading's first word sits at the top and left edges of the container and the window.
  await selectFirstWord(page, "Meeting");
  const bubble = page.getByRole("toolbar", BUBBLE);
  await expect(bubble).toBeVisible();

  const box = (await bubble.boundingBox())!;
  const frame = (await container.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.y).toBeGreaterThanOrEqual(frame.y);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height);

  // Scrolling the container: the Bubble menu moves with the text instead of staying in place.
  const heading = page.getByRole("heading", { name: "Meeting notes" });
  const before = { bubble: box.y, heading: (await heading.boundingBox())!.y };
  await container.evaluate((element) => element.scrollBy(0, 12));
  const after = {
    bubble: (await bubble.boundingBox())!.y,
    heading: (await heading.boundingBox())!.y,
  };
  expect(after.heading).toBeLessThan(before.heading);
  expect(Math.abs(after.bubble - before.bubble - (after.heading - before.heading))).toBeLessThan(2);
});

/**
 * Colour as `[r, g, b, alpha]`. Chromium reports a translucent background from
 * `color-mix` as `color(srgb r g b / a)` with fractions of one, and a solid one as `rgb()`.
 */
function rgba(colour: string): number[] {
  const srgb = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)$/.exec(colour);
  if (srgb) {
    const [r, g, b] = srgb.slice(1, 4).map((part) => Math.round(Number(part) * 255));
    return [r!, g!, b!, Number(srgb[4] ?? 1)];
  }
  const rgb = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/.exec(colour);
  if (!rgb) throw new Error(`unexpected colour: ${colour}`);
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), Number(rgb[4] ?? 1)];
}

/** The background and icon colours as the browser computed them. */
async function colours(page: Page) {
  const bubble = page.getByRole("toolbar", BUBBLE);
  await expect(bubble).toBeVisible();
  const { background, icon } = await bubble.evaluate((toolbar) => {
    // The Bubble menu is the `BubbleMenu` node, the parent of the panel.
    const surface = toolbar.parentElement!;
    const bold = toolbar.querySelector<HTMLElement>('button[aria-label="Bold"]')!;
    return {
      background: getComputedStyle(surface).backgroundColor,
      icon: getComputedStyle(bold).color,
    };
  });
  return { background: rgba(background), icon };
}

/*
  The background is the inverse token on glass (OLDSUI-118): the same colour with
  alpha 0.82. Previously a solid `rgb()` was used here, and a change to a translucent
  background would have shown up only in a snapshot.
*/
for (const [theme, background, icon] of [
  ["light", [31, 31, 31], "rgb(255, 255, 255)"],
  ["dark", [248, 250, 252], "rgb(23, 33, 43)"],
  ["dim", [248, 250, 252], "rgb(23, 33, 43)"],
] as const) {
  test(`the bubble is inverse in the ${theme} theme, and its menu is not`, async ({ page }) => {
    await page.goto(STORY("selection-bubble", theme));
    expect(await colours(page)).toEqual({ background: [...background, 0.82], icon });

    const bubble = page.getByRole("toolbar", BUBBLE);
    await bubble.getByRole("button", { name: /^Block type/ }).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    // The menu is in a portal, on the ordinary popover surface, not on the Bubble menu.
    const menuBackground = await menu.evaluate((element) => {
      let node: Element | null = element;
      while (node && getComputedStyle(node).backgroundColor === "rgba(0, 0, 0, 0)")
        node = node.parentElement;
      return node ? getComputedStyle(node).backgroundColor : null;
    });
    expect(rgba(menuBackground!).slice(0, 3)).not.toEqual(background);
  });
}

/*
  Solid background when the system asks for it (OLDSUI-118): raised contrast and
  reduced transparency. Playwright does not emulate `prefers-reduced-transparency`,
  so the flag is set directly through Chromium's CDP.
*/
test("the bubble turns solid when contrast is raised", async ({ page }) => {
  await page.emulateMedia({ contrast: "more" });
  await page.goto(STORY("selection-bubble", "light"));
  expect((await colours(page)).background).toEqual([31, 31, 31, 1]);
});

test("the bubble turns solid when transparency is reduced", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
  });
  await page.goto(STORY("selection-bubble", "light"));
  expect((await colours(page)).background).toEqual([31, 31, 31, 1]);
});

/*
  `Alt+F10` right after a keyboard selection: the menu is still hidden, and only the
  plugin's timer, 250 ms after the last selection change, will show it. The key shows
  it by itself, and in the very first frame the menu must already sit above the
  selection, not at the static point below the field where the plugin inserts its node.
  The position is read one frame after the key press, long before the timer, which
  would have put the menu in place and hidden the bug.
*/
for (const toolbar of ["floating", "bubble"] as const) {
  test(`toolbar="${toolbar}": Alt+F10 right after a keyboard selection shows the menu above it`, async ({
    page,
  }) => {
    await page.goto(STORY("floating-toolbar", "light", `&args=toolbar:${toolbar}`));
    const field = page.getByRole("textbox", { name: "Document" });
    await field
      .locator("> *")
      .first()
      .click({ position: { x: 2, y: 8 } });
    await page.evaluate(() => {
      const record = window as unknown as { firstFrame?: Promise<unknown> };
      let selected = 0;
      document.addEventListener("selectionchange", () => (selected = performance.now()));
      record.firstFrame = new Promise((resolve) => {
        const onKeyDown = (event: KeyboardEvent) => {
          if (event.key !== "F10") return;
          document.removeEventListener("keydown", onKeyDown, true);
          // Read the selection before the key handler runs: the handler moves focus into the menu.
          const selection = window.getSelection()!.getRangeAt(0).getBoundingClientRect();
          const sinceSelection = performance.now() - selected;
          requestAnimationFrame(() => {
            const menu = document.activeElement?.closest('[role="toolbar"]')?.parentElement;
            const box = menu?.getBoundingClientRect();
            resolve({
              sinceSelection,
              top: selection.top,
              bottom: box?.bottom,
              height: box?.height,
            });
          });
        };
        document.addEventListener("keydown", onKeyDown, true);
      });
    });
    for (let step = 0; step < 6; step++) await page.keyboard.press("Shift+ArrowRight");
    // ProseMirror reads the selection from `selectionchange`, and Chromium fires it
    // as a task after the key presses, so give it a frame or two, as a person would.
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    );
    await page.keyboard.press("Alt+F10");
    const frame = (await page.evaluate(
      () => (window as unknown as { firstFrame: Promise<unknown> }).firstFrame
    )) as { sinceSelection: number; top: number; bottom?: number; height?: number };

    // The key press found the menu hidden: the plugin's timer had not fired yet.
    expect(frame.sinceSelection).toBeLessThan(200);
    expect(frame.height).toBeGreaterThan(0);
    expect(frame.bottom).toBeLessThanOrEqual(frame.top);
  });
}
