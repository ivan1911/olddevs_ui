import { expect, test, type Page } from "@playwright/test";

/**
 * Меню выделения Редактора в браузере (`toolbar="bubble"`, OLDSUI-69): то, чего
 * jsdom не умеет, — раскладка floating-ui у краёв, настоящие слои `Dialog` и
 * `Drawer` и каскад инверсной поверхности.
 */

const STORY = (id: string, theme = "dark", args = "") =>
  `/iframe.html?id=inputs-richtexteditor--${id}&globals=theme:${theme};accent:blue${args}`;

const BUBBLE = { name: "Selection formatting" } as const;

/**
 * Выделить первое слово Документа двойным щелчком — одно действие, а не
 * череда `Shift+→`: под нагрузкой параллельного прогона ProseMirror успевал
 * перечитать выделение посреди череды нажатий, и слово выделялось не целиком.
 */
async function selectFirstWord(page: Page, word: string) {
  const field = page.getByRole("textbox", { name: "Document" });
  // Окно и ящик ставят фокус сами, когда доиграет появление, — после него и
  // начинаем, иначе их автофокус увёл бы выделение из Документа.
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running")
  );
  await field
    .locator("> *")
    .first()
    .dblclick({ position: { x: 4, y: 8 } });
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString().trim())).toBe(word);
  // ProseMirror читает выделение из `selectionchange` — дать ему кадр-другой.
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
  // Действие возвращает фокус в Документ кадром позже, а плашка пересчитывает
  // показ через 250 мс после правки — дождаться обоих, как человек.
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

  // Слой плашки выше слоя ящика: она не прячется под его панелью.
  const box = await bubble.boundingBox();
  const panel = await drawer.boundingBox();
  expect(box && panel && box.x >= panel.x && box.x + box.width <= panel.x + panel.width).toBe(true);
});

test("in a scroll container at the window edge the bubble flips and shifts instead of being cut", async ({
  page,
}) => {
  await page.goto(STORY("selection-bubble-in-scroll"));
  const container = page.getByTestId("scroll-container");
  // Первое слово заголовка — у верхнего и левого края контейнера и окна.
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

  // Прокрутка контейнера: плашка едет вместе с текстом, а не остаётся на месте.
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
 * Цвет как `[r, g, b, alpha]`. Полупрозрачную подложку из `color-mix` Chromium
 * отдаёт в `color(srgb r g b / a)` с долями единицы, сплошную — в `rgb()`.
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

/** Цвет подложки и значка — так, как его посчитал браузер. */
async function colours(page: Page) {
  const bubble = page.getByRole("toolbar", BUBBLE);
  await expect(bubble).toBeVisible();
  const { background, icon } = await bubble.evaluate((toolbar) => {
    // Плашка — узел `BubbleMenu`, родитель панели.
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
  Подложка — инверсный токен на стекле (OLDSUI-118): тот же цвет с альфой 0.82.
  Прежде здесь стояла сплошная `rgb()`, и смена подложки на полупрозрачную
  была бы видна только на снимке.
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
    // Меню — в портале, на обычной поверхности поповера, а не на плашке.
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
  Сплошная подложка при просьбе системы (OLDSUI-118): поднятый контраст и
  убранная прозрачность. `prefers-reduced-transparency` Playwright не
  эмулирует — признак ставится через CDP Chromium напрямую.
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
  `Alt+F10` сразу после выделения с клавиатуры: меню ещё спрятано — его покажет
  только таймер плагина через 250 мс после последней смены выделения. Клавиша
  показывает его сама, и уже в первом кадре оно обязано стоять над выделением,
  а не у статической точки под полем, куда плагин вставляет свой узел.
  Позиция снимается кадром после нажатия — задолго до таймера, который
  поставил бы меню на место и скрыл ошибку.
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
          // Выделение — до обработчика клавиши: фокус он уводит в меню.
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
    // ProseMirror читает выделение из `selectionchange`, а Chromium шлёт его
    // задачей позже нажатий — дать ему кадр-другой, как дал бы человек.
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    );
    await page.keyboard.press("Alt+F10");
    const frame = (await page.evaluate(
      () => (window as unknown as { firstFrame: Promise<unknown> }).firstFrame
    )) as { sinceSelection: number; top: number; bottom?: number; height?: number };

    // Нажатие застало меню спрятанным: таймер плагина ещё не сработал.
    expect(frame.sinceSelection).toBeLessThan(200);
    expect(frame.height).toBeGreaterThan(0);
    expect(frame.bottom).toBeLessThanOrEqual(frame.top);
  });
}
