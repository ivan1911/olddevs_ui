import { expect, test, type Locator, type Page } from "@playwright/test";
import { focusToolbarButton } from "./editor-toolbar.js";

/**
 * Поведение, которое обязано проверяться в настоящем браузере.
 *
 * Уровень 0 (`npm test`, jsdom) закрывает почти всё, но не то, что зависит от
 * родной механики браузера: активацию `<label>` кликом в его потомка,
 * перемещение фокуса по Tab, pointer-события. Тест на такое в jsdom либо
 * проходит всегда, либо падает на исправном компоненте — и то и другое хуже
 * его отсутствия. Разделение зафиксировано в ADR-0012.
 *
 * Здесь не снимки: файл лежит рядом с ними только потому, что оба набора
 * гоняются одним Playwright'ом против статической сборки витрины.
 */
/*
 * Имена здесь АНГЛИЙСКИЕ, и это не оплошность: с 2.0.0 фолбэк кита английский,
 * а витрина рендерится без `UiProvider` — она показывает кит как он есть из
 * коробки. Русские подписи проверяются в `tests/`, где локаль подключается
 * явно через `tests/ru.tsx`.
 */

test("Checkbox: clicking the label toggles the box", async ({ page }) => {
  await page.goto("/iframe.html?id=inputs-checkbox--playground&globals=theme:dark;accent:blue");

  const box = page.getByRole("checkbox");
  await expect(box).not.toBeChecked();

  // Кликаем именно по тексту: подпись обязана быть частью мишени, а не просто
  // лежать рядом с коробкой.
  await page.getByText("Show in the feed").click();
  await expect(box).toBeChecked();
});

test("Checkbox: a click does not clear the third state", async ({ page }) => {
  await page.goto("/iframe.html?id=inputs-checkbox--matrix&globals=theme:dark;accent:blue");

  const mixed = page.getByRole("checkbox", { name: "accent, indeterminate" });
  await expect(mixed).toHaveJSProperty("indeterminate", true);

  // Кликаем по `<label>`, а не по самому input: он лежит в `VisuallyHidden`, и
  // кликать невидимое Playwright отказывается — справедливо, пользователь тоже
  // не может. Мишень флажка без подписи — коробка внутри метки.
  await page.locator('label:has(input[aria-label="accent, indeterminate"])').click();

  // «Частично» ставит вызывающий, пересчитав набор; клик его не снимает.
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

  // Предел: поле с `maxRows={4}` не выше четырёх строк, сколько бы в нём ни
  // было текста, и прокручивается внутри себя.
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
  // Поповеры переезжают за полем не в момент смены ширины, а на следующем
  // кадре: floating-ui пересчитывает позицию асинхронно. Разовый замер под
  // нагрузкой ловил старую раскладку в две колонки, где панели стоят в одном
  // ряду, — поэтому зазор опрашивается, пока раскладка не устоится.
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

  // Эта точка лежала внутри Popover до переноса, но уже вне видимой панели.
  // Клик должен считаться внешним и закрыть клавиатуру.
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
  Стык двух библиотек: меню react-aria внутри диалога Radix.

  Единственное место в пакете, где два независимых менеджера фокуса встречаются
  на одном экране. Проверка живёт здесь, а не в jsdom, потому что jsdom не
  двигает фокус по Tab так, как браузер: тест на ловушку фокуса прошёл бы там в
  любом случае, то есть не проверял бы ничего (ADR-0012).
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
  // Меню закрылось, окно осталось: иначе один Escape уносил бы всю форму
  // вместе с несохранённым.
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

/*
  Тот же стык в Редакторе: меню «¶» (тип Блока, OLDSUI-64) — меню react-aria,
  окно — Radix. В jsdom это сочетание не раскрывается
  (`tests/rich-text-editor-block-menu.test.tsx` проверяет стек слоёв на
  `ModalOverlay`), поэтому `Dialog` — здесь. Путь — клавиатурный, как у
  пользователя без мыши: `Alt+F10` в Панель, стрелками на «¶», `Enter` открывает.
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

  // Alt+F10 — в Панель, стрелками до «¶».
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

  // Выбор пункта меняет Блок и возвращает фокус в Документ; окно на месте.
  // `↓` открывает меню на первом пункте; «Heading 2» — третий.
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
  Меню «Выравнивание» и «Списки» (OLDSUI-66) — те же меню react-aria внутри
  окна Radix: Escape закрывает меню, а не окно, выбор с клавиатуры меняет Блок
  и возвращает фокус в Документ.
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

  // «Нумерованный» — второй пункт; выбор оборачивает Блок и называет его на кнопке.
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
  Меню вставки по `/` (OLDSUI-43). В jsdom раскладки нет, и «список у курсора»
  там не проверить: координаты у всех узлов нулевые. Здесь — настоящая.
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
  // Фокус остаётся в поле: список — часть комбобокса, а не новая остановка.
  await expect(field).toBeFocused();

  // Список стоит под набранным `/`: левый край — у черты, верх — ниже её.
  const command = field.locator(".suggestion");
  const caret = (await command.boundingBox())!;
  const panel = (await listbox.boundingBox())!;
  expect(Math.abs(panel.x - caret.x)).toBeLessThan(24);
  expect(panel.y).toBeGreaterThanOrEqual(caret.y + caret.height - 1);

  const first = await field.getAttribute("aria-activedescendant");
  await page.keyboard.press("ArrowDown");
  await expect(field).not.toHaveAttribute("aria-activedescendant", first!);

  // Вторая строка раздела «Insert» — разделитель.
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

  // Последний абзац пуст: `/` в начале Блока открывает меню.
  await page.locator('[contenteditable="true"] p').last().click();
  await page.keyboard.type("/");
  const listbox = page.getByRole("listbox", { name: "Insert block" });
  await expect(listbox).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(listbox).toBeHidden();
  await expect(dialog).toBeVisible();
  // Набранное остаётся текстом.
  await expect(page.locator('[contenteditable="true"] p').last()).toHaveText("/");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

/*
  Команды над Блоками (OLDSUI-63). В jsdom событие собирается руками, а здесь
  его собирает браузер: `key` под Shift и Alt, `⌘` на Mac и `Ctrl` у остальных
  (`ControlOrMeta` — та же развилка, что у ProseMirror). Так проверяется, что
  сочетания движка совпадают с тем, что приходит от настоящей клавиатуры.
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
  // ProseMirror читает выделение браузера по `selectionchange`, не мгновенно.
  await page.waitForTimeout(300);

  await page.keyboard.press("Alt+Shift+ArrowDown");
  await expect(steps).toHaveText(["Step two", "Step one"]);
  await page.keyboard.press("Alt+Shift+ArrowUp");
  await expect(steps).toHaveText(["Step one", "Step two"]);

  // Каретка ушла вместе с пунктом — она в «Step one»; дальше — во второй пункт.
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
  // Каретка — в копии: набранное попадает в третий пункт.
  await page.keyboard.type("!");
  await expect(steps).toHaveText(["Step one", "Step two", "Step two!"]);
});

/*
  Тема подсветки — переменные на элементе с `data-theme`, и блок кода берёт их у
  БЛИЖАЙШЕГО предка с темой (OLDSUI-50, ADR-0051). Так работает будущая
  «бумага»: Документ в `data-theme="light"` внутри тёмного приложения. Правила
  «тема → токен под ней» при вложенных темах спорили бы порядком в файле, и
  светлая бумага показала бы тёмные токены — поэтому каскад проверяется вживую.
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

  // Светлая бумага внутри тёмного приложения — GitHub Light.
  await page
    .locator("#storybook-root")
    .evaluate((root) => root.setAttribute("data-theme", "light"));
  expect(await colours()).toEqual({ keyword: "rgb(215, 58, 73)", pre: "rgb(255, 255, 255)" });

  // И наоборот: тёмный остров внутри светлой страницы — GitHub Dark.
  await page.goto(
    "/iframe.html?id=content-richtextview--code-blocks&globals=theme:light;accent:blue"
  );
  await page.locator(".hljs-keyword").first().waitFor();
  expect((await colours()).keyword).toBe("rgb(215, 58, 73)");
  await page.locator("#storybook-root").evaluate((root) => root.setAttribute("data-theme", "dim"));
  expect(await colours()).toEqual({ keyword: "rgb(255, 123, 114)", pre: "rgb(13, 17, 23)" });
});

/*
  Лист `surface="paper"` (OLDSUI-52) в живом браузере: документ светлый в
  тёмном, сумрачном и брендовом приложении, а Панель Редактора — в теме
  приложения. jsdom-тест (`tests/rich-text-paper-css.test.tsx`) проверяет то же
  на развёрнутых слоях; здесь — настоящий каскад со слоями Tailwind.
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
    // Панель — на подложке поля ТЕМЫ ПРИЛОЖЕНИЯ, тёмной.
    expect(colours.toolbar).not.toBe("rgb(255, 255, 255)");
    expect(colours.toolbar).toMatch(/^rgb\((\d{1,2}), (\d{1,2}), (\d{1,2})\)$/);
  });
}

/*
  Яркий маркер (OLDSUI-61) в живом браузере: три цвета одинаковы во всех темах,
  текст на них тёмный, а прежние имена красятся прежними значениями с текстом темы.
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
    // Прежнее имя читается своим значением и не берёт тёмный текст маркера.
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

  // Ограда с языком в пустом абзаце — блок кода Python (OLDSUI-50).
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
  // Меню доживает уход (ADR-0043), и пока оно в DOM, окно не берёт Escape само
  // (`hasOpenAriaOverlay`, тот же селектор). Ждём, пока уйдёт совсем: иначе
  // проверка ниже проходила бы за счёт анимации, а не шапки — как и было до починки.
  await expect(page.locator("[data-rac][data-placement]")).toHaveCount(0);
  // Escape на самой кнопке — обратно в код, окно остаётся. Видимость окна
  // этого не докажет: закрытое окно тоже доживает уход и ещё видно. Radix
  // снимает `data-state="open"` сразу, в тот же кадр.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("textbox", { name: "Document" })).toBeFocused();
  await expect(dialog).toHaveAttribute("data-state", "open");
  await page.keyboard.press("Alt+F10");
  await expect(trigger).toBeFocused();

  // Выбор с клавиатуры: язык сменился, фокус вернулся в код.
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

  // Кнопки вставляет клиентский остров после монтирования; блок подсвечен на
  // «сервере», и токены в буфер не идут.
  // Шесть: по три блока в Редакторе и в Просмотре.
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
  // Обе кнопки вне Tab; вход — каретка в блоке и `Alt+F10`.
  await expect(first.getByRole("button", { name: "Copy" })).toHaveAttribute("tabindex", "-1");
  const document = page.getByRole("textbox", { name: "Document" });
  // Подсветка — декорации: пока токенов нет, редактор ещё не осел, и щелчок
  // мог бы попасть в блок, который сейчас перерисуется.
  await expect(document.locator("pre code .hljs-keyword").first()).toBeVisible();
  await document.locator("pre code").first().click();
  // ProseMirror читает выделение браузера по `selectionchange`, не мгновенно:
  // сочетание, нажатое сразу за щелчком, видит ещё прежнее выделение.
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

  // Выделение слова — двойным щелчком, как его делает человек; поповер
  // открывается с клавиатуры, мимо Панели.
  await page.getByRole("textbox", { name: "Document" }).getByText("Escape").dblclick();
  await page.keyboard.press("ControlOrMeta+k");
  const address = page.getByRole("textbox", { name: "Address" });
  await expect(address).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(address).toBeHidden();
  await expect(dialog).toBeVisible();
  // Escape отменяет и возвращает фокус в документ, а не на `<body>`.
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

  // Щелчок снаружи: пустое место окна закрывает справочник и возвращает фокус на кнопку.
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

  // Обычное слово, а не «Escape»: тот — строчный код, и цвет на нём недоступен.
  await dblclickWord(page, "inside");
  // «Цвет» › «Свой цвет…» сетки текста (OLDSUI-153). «Цвет» — кнопка меню
  // выделения (OLDSUI-154): на Панели только «Маркер».
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

  // Каждый Escape закрывает ровно один слой (ADR-0041).
  await page.keyboard.press("Escape");
  await expect(hex).toBeHidden();
  await expect(popover).toBeVisible();
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
  await expect(dialog).toBeVisible();
  // Фокус вернулся в документ, а не на `<body>`.
  await expect(page.getByRole("textbox", { name: "Document" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

/*
  Поповер «Маркер» и меню «…» внутри окна и ящика (OLDSUI-65, OLDSUI-153).
  jsdom проверяет стек слоёв на `ModalOverlay`; настоящие `Dialog` и `Drawer` —
  здесь: мышью и с клавиатуры.
*/
/** Двойной щелчок ровно по слову: середина его прямоугольника, а не абзаца. */
async function dblclickWord(page: Page, word: string) {
  // До Готовности на месте поля стоит Скелет (OLDSUI-110): тот же текст, но
  // без `role="textbox"` — поиск слова ниже нашёл бы пустоту. Ждём движок.
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
  // Выделение Документа ProseMirror читает из DOM асинхронно: клавиша,
  // нажатая раньше, увела бы фокус с кареткой вместо слова. Плашка меню
  // выделения появляется только при непустом выделении в состоянии Редактора —
  // это и есть честная точка синхронизации.
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
    // Кнопки Панели: над выделением стоит ещё и плашка со своими.
    const toolbar = page.getByRole("toolbar", { name: "Formatting", exact: true });
    await toolbar.getByRole("button", { name: "Highlight: None" }).click();
    await page.getByRole("menuitemradio", { name: "Pink" }).click();

    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(field.locator('mark[data-color="pink"]')).toHaveText(word);
    await expect(field).toBeFocused();
    await expect(layer).toBeVisible();

    // Метка из меню «…» — тоже мышью.
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

    // Alt+F10 — в Панель, стрелками до «Маркера».
    const button = await focusToolbarButton(page, "Highlight: None");
    await expect(button).toBeFocused();

    // Enter открывает ряд, фокус — на первом кружке (маркера на слове нет).
    await page.keyboard.press("Enter");
    const grid = page.getByRole("menu", { name: "Highlight" });
    await expect(grid).toBeVisible();
    await expect(page.getByRole("menuitemradio", { name: "Gray" })).toBeFocused();

    // Escape закрывает только поповер и возвращает фокус на кнопку.
    await page.keyboard.press("Escape");
    await expect(grid).toBeHidden();
    await expect(button).toBeFocused();
    await expect(layer).toBeVisible();

    // Выбор с клавиатуры: Gray → Brown → Orange → Yellow → Green, Enter.
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

  // Фокус обязан вернуться триггеру, а не уехать на `<body>`: иначе
  // клавиатурный пользователь теряет место в форме.
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

  // Десяти табов заведомо больше, чем элементов в окне: если ловушка течёт,
  // фокус к этому моменту уже уедет на страницу под оверлеем.
  for (let i = 0; i < 10; i++) await page.keyboard.press("Tab");

  // Проверяется НЕ «фокус внутри диалога»: при открытом меню он законно лежит
  // в портале меню, а тот диалогу не потомок. Проверяется то, что важно
  // пользователю, — фокус не ушёл на страницу позади оверлея.
  const escaped = await page.evaluate(() => {
    const active = document.activeElement;
    if (active == null || active === document.body) return false;
    const opener = document.querySelector("button");
    return active === opener;
  });
  expect(escaped).toBe(false);

  // И положительная половина: фокус там, где ему место, — в окне или в меню.
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
  Щелчок мышью по оверлею react-aria внутри модального слоя Radix (OLDSUI-51).

  Модальный Radix ставит `<body>` инлайновое `pointer-events: none` и
  возвращает указатель только СВОИМ слоям. Панель меню и список подсказок
  react-aria живут в портале прямо под `<body>`, наследовали `none`, и щелчок
  проваливался на подложку: пункт выбирался только с клавиатуры. Проверки выше
  жали Escape и мышью пункт не выбирали ни разу — поэтому дефект прожил до
  эпика редактора.

  Клик здесь — БЕЗ `force`: проверка «элемент принимает указатель» у Playwright
  и есть то, что сломано. Вторая половина каждого теста — окно осталось
  открытым: Radix не должен счесть щелчок по порталу «щелчком снаружи».
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
  Тосты проверяются только в браузере.

  В jsdom нет ни анимаций, ни раскладки портала, ни таймеров, по которым тост
  живёт и уходит: проверка там свелась бы к «функция вызвалась», то есть к
  тесту на sonner, а не на пакет.
*/
test("toast: the tones are called and show text with a description", async ({ page }) => {
  await page.goto("/iframe.html?id=actions-toaster--tones&globals=theme:dark;accent:blue");

  await page.getByRole("button", { name: "Success" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();

  await page.getByRole("button", { name: "Error with a description" }).click();
  await expect(page.getByText("Could not save")).toBeVisible();
  // Описание — вторая строка: сюда потребитель кладёт текст с сервера.
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
  // Тот же тост меняет содержимое, а не появляется второй рядом.
  await expect(page.getByText("Saved")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Saving…")).toBeHidden();
});

/**
 * Высота контрола объявлена (`leading-5` в `lib/field.ts`), а не выведена из
 * множителя строки, и держится она только проверкой в браузере.
 *
 * Снимок такого не ловит: на нём равенство высот надо мерить глазом, а
 * разошедшийся на полпикселя триггер выглядит как антиалиасинг. Так и уехал
 * `DateRangePicker` — правку получили поля и `Select`, а он остался на прежних
 * 41.5 и стал единственным несовпадающим в форме; нашлось это ревью, не
 * бейзлайном, хотя бейзлайн был перегенерирован вместе с расхождением внутри.
 */
test("form: fields and triggers share one height", async ({ page }) => {
  await page.goto("/iframe.html?id=inputs-formfield--matrix&globals=theme:dark;accent:blue");

  // Меряется видимая коробка контрола, а она у всех — родитель мишени: у поля
  // это оболочка с рамкой (`lib/field.ts`), у триггера — пилюля, несущая
  // отступы потребителя. Само поле внутри оболочки на 2px ниже, и сравнивать
  // его с пилюлей было бы сравнением разных вещей.
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

  // `DatePicker` в эту проверку не входит намеренно: его триггер — подчёркнутая
  // строка с одной рамкой снизу, а не коробка поля, и в форме он даёт 40.5.
  // Привести его к 42 значит завести ему коробочный вид — отдельное решение,
  // а не следствие правки строчного бокса.
});

/**
 * Выбор пункта в `Combobox`. Уровень 0 этого не видит: список react-aria живёт
 * в портале, и в jsdom до его пунктов не дотянуться — аннонсер говорит «2
 * options available», а узлов в документе нет. Ровно тот случай, ради которого
 * ADR-0012 разводит уровни.
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
  // Клик мимо закрывает список; значение вне набора обязано выжить — этим
  // `Combobox` и отличается от `Select`.
  await page.keyboard.press("Escape");

  await expect(field).toHaveValue("Custom category");
});

/**
 * Командная палитра. Уровень 0 её не видит целиком: окно живёт в портале
 * Radix, а список — в коллекции react-aria, и в jsdom до пунктов не добраться.
 */
test("CommandPalette: a synonym from keywords finds the action", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=overlays-commandpalette--playground&globals=theme:dark;accent:blue"
  );

  await page.getByRole("button", { name: "Open the palette" }).click();

  const field = page.getByRole("searchbox", { name: "Search actions" });
  await field.fill("similar");

  // Слово по-английски в подписи не встречается — оно лежит в `keywords`.
  await expect(page.getByRole("option")).toHaveCount(1);
  await expect(page.getByRole("option")).toHaveText(/Find similar/);
});

test("CommandPalette: picking an item yields it and closes the window", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=overlays-commandpalette--playground&globals=theme:dark;accent:blue"
  );

  await page.getByRole("button", { name: "Open the palette" }).click();
  await page.getByRole("option", { name: /New campaign/ }).click();

  // Оставлять палитру открытой поверх результата — значит требовать второго
  // жеста там, где пользователь уже всё сказал.
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await expect(page.getByText("Picked: new")).toBeVisible();
});

test("CommandPalette: an empty query shows the whole list in sections", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=overlays-commandpalette--playground&globals=theme:dark;accent:blue"
  );

  await page.getByRole("button", { name: "Open the palette" }).click();

  // Палитра работает оглавлением: её открывают и чтобы вспомнить, что есть.
  await expect(page.getByRole("option")).toHaveCount(5);
});

/**
 * Ключи колонок таблицы разведены префиксом внутри компонента: у react-aria
 * колонки и строки живут в одном пространстве имён, и совпадение
 * идентификаторов схлопывало одну из них. Наружу при этом обязан уходить
 * исходный идентификатор — иначе сортировка уедет на сервер с чужим именем
 * поля. В jsdom клик по заголовку недоступен: react-aria зовёт `CSS.escape`,
 * которого там нет.
 */
test("Table: sorting yields the original column id outwards", async ({ page }) => {
  await page.goto("/iframe.html?id=content-table--basic-table&globals=theme:dark;accent:blue");

  const heading = page.getByRole("columnheader", { name: /Size/ });
  await heading.click();

  // Если бы наружу уходил внутренний ключ, направление бы не применилось:
  // история сравнивает `sort.column` со своим `id`.
  await expect(heading).toHaveAttribute("aria-sort", "ascending");
});

/**
 * `onRowAction`: действие по строке рядом с выделением (OLDSUI-193). Клик по
 * строке открывает запись и не отмечает флажок, Enter на сфокусированной строке
 * делает то же, а выделяет только флажок. Настоящие pointer-события и фокус
 * строки в jsdom не проверить.
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

  // Выделяет флажок, и действие при этом не вызывается.
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

  // Слой читается вычисленным стилем, а не классом: класс может присутствовать
  // в разметке и не доехать до CSS, и тогда ящик молча уедет под чужое окно.
  const layer = async (l: ReturnType<typeof page.locator>) =>
    l.evaluate((el) => getComputedStyle(el).zIndex);

  const underlay = page
    .locator("[data-radix-popper-content-wrapper], .animate-fadein.fixed")
    .first();

  expect(await layer(panel)).toBe("100");
  expect(await layer(underlay)).toBe("100");

  // Чужой оверлей приложения остаётся ниже — ради этого проп и заведён.
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

  // Без явного возврата Radix оставляет фокус на `body`: открытием управляют
  // снаружи, и штатной мишени для возврата у него нет.
  await expect(open).toBeFocused();
});

test("TagInput: the cross on a tag removes it", async ({ page }) => {
  await page.goto("/iframe.html?id=inputs-taginput--playground&globals=theme:dark;accent:blue");

  const group = page.getByRole("grid");
  await expect(group.getByRole("row")).toHaveCount(2);

  /*
    Проверка живёт здесь, а не в jsdom, и это не выбор удобства: react-aria
    рисует содержимое `Tag` вторым проходом, и в jsdom потомки коллекции не
    появляются вовсе — кнопки там физически нет. Тест уровня 0 на неё либо
    падал бы всегда, либо проверял пустоту. Граница зафиксирована в ADR-0012.

    Мышь — основной способ снять тег, и до этого теста он не проверялся ни разу:
    покрыт был только Backspace, то есть путь с клавиатуры.
  */
  await page.getByRole("button", { name: "Remove tag sunset" }).click();
  await expect(group.getByRole("row")).toHaveCount(1);
  await expect(group.getByRole("row")).toHaveText("night city");
});

/**
 * Липкость `SelectionBar` — то, что в jsdom проверить нечем вовсе: там нет ни
 * прокрутки, ни `position: sticky`, ни работающего `IntersectionObserver`.
 * Юнит-тесты хука проверяют только вычисление `rootMargin` из переменной.
 *
 * Здесь проверяется весь контракт целиком (ADR-0016): полоса отсчитывает
 * НАСТОЯЩУЮ высоту панели из `--topbar-h`, встаёт ровно под неё и, коснувшись,
 * теряет верхние скругления — иначе они приоткрывают фон страницы уголками
 * на стыке.
 */
test("SelectionBar: the bar lands under the panel and loses its top rounding", async ({ page }) => {
  await page.goto("/iframe.html?id=navigation-selectionbar--sticky&globals=theme:dark;accent:blue");

  const bar = page.getByRole("group", { name: "Actions on selection" });
  await expect(bar).toBeVisible();

  // До прокрутки полоса лежит в потоке: скругления круговые со всех сторон.
  await expect(bar).toHaveCSS("border-top-left-radius", "14px");
  const beforeTop = (await bar.boundingBox())?.y ?? 0;
  expect(beforeTop).toBeGreaterThan(56);

  await page.mouse.wheel(0, 600);

  // Прижавшись, полоса стоит РОВНО под панелью — 56px, взятые из переменной,
  // а не из зашитого числа.
  await expect.poll(async () => Math.round((await bar.boundingBox())?.y ?? -1)).toBe(56);

  await expect(bar).toHaveCSS("border-top-left-radius", "0px");
  await expect(bar).toHaveCSS("border-bottom-left-radius", "14px");

  // Обратно вверх — скругления возвращаются: состояние не залипает.
  await page.mouse.wheel(0, -600);
  await expect(bar).toHaveCSS("border-top-left-radius", "14px");
});

test("SelectionBar: without the panel variable the bar sticks to the top of the window", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=navigation-selectionbar--sticky&globals=theme:dark;accent:blue");
  const bar = page.getByRole("group", { name: "Actions on selection" });
  await expect(bar).toBeVisible();

  // Отсутствие переменной — законное состояние, а не ошибка: у потребителя
  // может не быть шапки вовсе.
  await page.evaluate(() => document.documentElement.style.removeProperty("--topbar-h"));
  await page.mouse.wheel(0, 600);

  await expect.poll(async () => Math.round((await bar.boundingBox())?.y ?? -1)).toBe(0);
});

/**
 * Раскладка полосы на средней ширине (OLDSUI-200) — тоже только в браузере:
 * jsdom не считает размеры. В колонке 830 px шесть действий не влезают в
 * строку со счётчиком. Прежде flex ужимал кнопки: подписи ломались на две
 * строки, а иконки сплющивались по ширине. Теперь действия переносятся
 * целыми кнопками.
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
    // Подпись в одну строку: высота кнопки `sm` — ровно 30 px.
    const box = await button.boundingBox();
    expect(Math.round(box?.height ?? 0), await button.innerText()).toBe(30);
    // Иконка — квадрат своего размера, а не сплющенная flex-элементом полоска.
    const svg = button.locator("svg").first();
    if ((await svg.count()) === 0) continue;
    const icon = await svg.boundingBox();
    expect(Math.round(icon?.width ?? 0), await button.innerText()).toBe(
      Math.round(icon?.height ?? -1)
    );
  }

  // Действия не умещаются в одну строку и уходят на следующую.
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
 * Та же липкость, но издатель переменной теперь свой — `TopBar` кита
 * (ADR-0019). Проверка отдельной историей, а не заменой прежней: контракт с
 * ВНЕШНЕЙ шапкой продолжает действовать, и сломать его новой шапкой нельзя.
 *
 * Здесь же косвенно проверяется `ResizeObserver`: высота не зашита в историю,
 * а измерена шапкой в живом браузере.
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

  // Переменную публикует шапка, а не история: значение обязано совпасть с её
  // измеренной высотой.
  const published = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--topbar-h").trim()
  );
  expect(published).toBe(`${headerHeight}px`);

  await page.mouse.wheel(0, 600);

  // Полоса стоит ровно под шапкой — просвета нет.
  await expect.poll(async () => Math.round((await bar.boundingBox())?.y ?? -1)).toBe(headerHeight);
  await expect(bar).toHaveCSS("border-top-left-radius", "0px");
});

test("PinInput: pasting the code into the first field fills them all", async ({ page }) => {
  await page.goto("/iframe.html?id=inputs-pininput--playground&globals=theme:dark;accent:blue");

  // Буфер обмена в headless закрыт по умолчанию: без разрешения `writeText`
  // бросает, и проверять было бы нечего.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

  const fields = page.getByRole("textbox");
  await fields.first().click();

  // Ровно то, что нельзя проверить в jsdom: при `maxLength=1` браузер сам
  // обрезает вставленное до первого символа, и без перехвата события код из
  // СМС превратился бы в одну цифру.
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

  // При `maxLength=1` набор поверх занятого поля не проходит вовсе, если
  // содержимое не выделено на фокусе, — и проверить это можно только в браузере.
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

  // Возврат фокуса виден только в настоящем браузере: в jsdom `document
  // .activeElement` после размонтирования ведёт себя иначе, и тест проходил бы
  // на сломанном компоненте.
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
  // Пользователь ушёл туда, куда хотел: правка соседа открылась, а фокус не
  // уехал обратно.
  await expect(page.getByRole("textbox", { name: "Author" })).toBeFocused();
});

test("TreeView: the keyboard expands and collapses a node with arrows", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=navigation-treeview--without-selection&globals=theme:dark;accent:blue"
  );

  // «Природа» здесь свёрнута: раскрыт только «Город».
  const nature = page.getByRole("row", { name: /Nature/ });
  await nature.click();
  await expect(nature).toHaveAttribute("aria-expanded", "true");

  // Клавиатура целиком от react-aria, и проверяется она там, где работает, —
  // в браузере: в jsdom стрелочная навигация коллекции не воспроизводится.
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

  // Лист: действие меняет текущий узел, прежний теряет отметку.
  await page.getByRole("row", { name: /Storm/ }).click();
  await expect(page.getByRole("row", { name: /Storm/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("row", { name: /Sunset/ })).not.toHaveAttribute("aria-current");

  // Папка: клик по строке зовёт `onAction`, а раскрывает её уже история.
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
  // Ставим каретку сразу за третьей цифрой и правим середину.
  await field.evaluate((el: HTMLInputElement) => el.setSelectionRange(7, 7));
  await page.keyboard.press("Backspace");

  await expect(field).toHaveValue("+7 (911) 234-56-7");
  // Родная механика браузера: форматирование перерисовывает строку целиком, и
  // без возврата позиции каретка ушла бы в конец. В jsdom этого не видно.
  expect(await field.evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(6);
});

test("MaskedInput: clicking the skeleton lands in the field, not in the underlay", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=inputs-maskedinput--playground&globals=theme:dark;accent:blue");

  const field = page.getByRole("textbox", { name: "Phone" });
  const skeleton = page.getByText("+7 (___) ___-__-__");

  // Щёлкаем ПО КООРДИНАТАМ скелета, а не по локатору: `locator.click()` ждёт,
  // пока элемент начнёт принимать события, и на `pointer-events: none` просто
  // истекает по таймауту. Здесь же событие уходит в точку, а мишень выбирает
  // сам браузер — то есть проверяется ровно то, что делает пользователь.
  //
  // Скелет лежит в той же ячейке сетки, что и поле, и занимает его ширину.
  // Перехватывай он указатель — поле перестало бы фокусироваться щелчком по
  // собственному тексту. В jsdom это недоказуемо: там нет ни раскладки, ни
  // загруженного CSS, и `pointer-events` ни на что не влияет.
  const box = (await skeleton.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(field).toBeFocused();

  await page.keyboard.type("916");
  // Скелет съедается слева направо: видимый остаток начинается ровно там, где
  // кончился ввод, и это видно только с настоящей раскладкой.
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
  // Отбрасывание было молчаливым: пользователь видел, что нажатие «не
  // сработало», и оставался без объяснения.
  await expect(page.getByRole("status")).toHaveText("A digit is expected here");
});

test("SortableList: keyboard dragging is announced in the provider locale", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=content-sortablelist--russian-locale&globals=theme:dark;accent:blue"
  );

  // Наблюдатель ставится ПОСЛЕ гидратации: повешенный на ещё не построенное
  // дерево, он не увидит ни одного объявления.
  await page.waitForTimeout(300);

  // Объявления живут доли секунды — ловим наблюдателем, а не опросом.
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
  // Стрелка вправо переводит фокус со строки на её ручку — навигация внутри
  // строки принадлежит слою поведения.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  // Между целями ходят СТРЕЛКАМИ, хотя объявление предлагает Tab: в списке из
  // пяти строк Tab уводит фокус из кольца целей и отменяет перетаскивание —
  // проверено. Объявление описывает общий случай, замер — наш.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);

  const announcements = await page.evaluate(() =>
    (window as { __live?: string[] }).__live!.join(" | ")
  );
  // Своей живой области у списка нет: эти строки — react-aria, и они
  // локализованы из коробки.
  expect(announcements).toContain("Начато перетаскивание");
  expect(announcements).toContain("Перетаскивание завершено");

  // Порядок ушёл наружу и вернулся пропом.
  await expect(page.getByTestId("order")).toHaveText("2,1,3,4,5");
});

test("SortableList: a row moves to another list of its group with the mouse", async ({ page }) => {
  await page.goto("/iframe.html?id=content-sortablelist--board&globals=theme:dark;accent:blue");
  await page.waitForTimeout(300);

  const board = page.getByTestId("board");
  await expect(board).toHaveText("todo:a,b doing:c done:");

  // Строка «Write the brief» — на верх строки «Book the speakers» соседней колонки.
  const column = (name: string) => page.getByRole("grid", { name });
  await column("To do")
    .getByRole("row")
    .first()
    .dragTo(column("In progress").getByRole("row").first(), { targetPosition: { x: 60, y: 3 } });
  await expect(board).toHaveText("todo:b doing:a,c done:");

  // Внутри списка группы по-прежнему работает перестановка — `onReorder`, а не `onMove`.
  await column("In progress")
    .getByRole("row")
    .first()
    .dragTo(column("In progress").getByRole("row").last(), { targetPosition: { x: 60, y: 30 } });
  await expect(board).toHaveText("todo:b doing:c,a done:");

  // Пустой список принимает строку броском на сам список.
  await column("In progress").getByRole("row").last().dragTo(column("Done"));
  await expect(board).toHaveText("todo:b doing:c done:a");
});

test("SortableList: a row moves to another list of its group from the keyboard", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=content-sortablelist--board&globals=theme:dark;accent:blue");
  await page.waitForTimeout(300);

  // Фокус на первой строке «To do», стрелка вправо — на её ручку, Enter — взять.
  await page.getByRole("grid", { name: "To do" }).getByRole("row").first().focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  // Tab ведёт к следующему списку группы — тот же слой поведения, что и цели внутри списка.
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
  // Шестьсот ячеек — десятки узлов. В jsdom это не проверяется вовсе: там нет
  // раскладки, и виртуализатор не отрисовывает ничего.
  expect(before.inDOM).toBeGreaterThan(0);
  expect(before.inDOM).toBeLessThan(120);
  // Прокрутка СВОЯ: содержимое многократно выше контейнера.
  expect(before.contentHeight).toBeGreaterThan(before.containerHeight * 5);

  await grid.evaluate((el) => el.scrollTo(0, 4000));
  await page.waitForTimeout(250);
  const after = await snapshot();

  // Окно виртуализации переехало: отрисованы уже другие ячейки.
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

  // Ни клик, ни Enter не выбирают: выбор остался за Space.
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
  // Фокус вернулся на ячейку, а не пропал в начало страницы.
  await expect(cell).toBeFocused();
});

test("VirtualGrid: a menu item neither selects the cell nor opens it", async ({ page }) => {
  await page.goto(VIRTUAL_GRID_ACTIONS);
  const cells = page.getByRole("grid", { name: "Frames" }).getByRole("row");

  // Выбранная ячейка — чтобы заметить, если пункт меню сдвинет выбор.
  await cells.nth(4).focus();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("selected")).toHaveText("Selected: 4");

  // Правая кнопка и клик по пункту мышью.
  await cells.nth(0).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await expect(page.getByTestId("picked")).toHaveText("Menu: rename 0");

  // С клавиатуры: Shift+F10, стрелка вниз, Enter.
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

  // Полосы нет, пока форма не тронута: она появляется с первой правкой.
  await expect(page.getByRole("group", { name: "Unsaved changes" })).toHaveCount(0);

  await page.getByRole("textbox").fill("Procurement team");
  const bar = page.getByRole("group", { name: "Unsaved changes" });
  await expect(bar).toBeVisible();

  // Липкость в jsdom не проверяется вовсе: там нет ни раскладки, ни прокрутки.
  const area = page.locator(".overflow-auto").first();
  const box = (await area.boundingBox())!;
  const before = (await bar.boundingBox())!;
  expect(before.y + before.height).toBeLessThanOrEqual(box.y + box.height + 1);

  await area.evaluate((el) => el.scrollTo(0, 600));
  await page.waitForTimeout(150);

  expect(await area.evaluate((el) => el.scrollTop)).toBeGreaterThan(300);

  const after = (await bar.boundingBox())!;
  // Полоса всё ещё внутри области и прижата к её низу, а не уехала вверх.
  expect(after.y + after.height).toBeLessThanOrEqual(box.y + box.height + 1);
  expect(after.y + after.height).toBeGreaterThan(box.y + box.height - 60);
});

/**
 * Нижняя панель телефона и то, что липнет к низу (OLDSUI-193).
 *
 * `AppShell` публикует высоту слота `bottomBar` в `--bottombar-h`, а
 * `ContextualSaveBar` и `Toaster` отсчитывают от неё отступ от края окна. В
 * jsdom это проверено на уровне переменной; что полоса и вправду встала НАД
 * панелью, а не под неё, видно только по раскладке.
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

  // Высота опубликована и равна настоящей высоте панели (с рамкой и вырезом).
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
    // Полоса целиком над панелью — ни пикселя под ней…
    expect(barBox.y + barBox.height).toBeLessThanOrEqual(tabsNow.y + 1);
    // …и вплотную к ней, а не оставила просвет «на глаз» (допуск на отступ
    // содержимого, когда страница прокручена до конца).
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

  // Панель скрыта на `md` и шире: высота слота равна нулю, отступа нет.
  const published = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue("--bottombar-h")
  );
  expect(published).toBe("0px");

  const area = page.locator(".overflow-auto").first();
  const box = (await area.boundingBox())!;
  await area.evaluate((el) => el.scrollTo(0, 0));
  await page.waitForTimeout(150);
  const barBox = (await bar.boundingBox())!;
  // Прижата к самому низу прокручиваемой области (зазор — только обводка).
  expect(box.y + box.height - (barBox.y + barBox.height)).toBeLessThan(4);
});

test("SplitButton: the toggle is a separate tab stop and returns focus after closing", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=actions-splitbutton--playground&globals=theme:dark;accent:blue");

  const action = page.getByRole("button", { name: "Export", exact: true });
  const toggle = page.getByRole("button", { name: "More actions: Export" });

  // Два табстопа, а не один: на этом держится всё обоснование компонента —
  // одна кнопка с зоной оставила бы второй исход недостижимым с клавиатуры.
  //
  // Фокус ставится явно, а не первым Tab: в iframe витрины обход начинается не
  // с тела документа, и «сколько нажатий до кнопки» — свойство обёртки
  // Storybook, а не компонента.
  await action.focus();
  await expect(action).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(toggle).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  // Фокус возвращается раскрывателю, а не уезжает на `<body>`: иначе
  // клавиатурный пользователь оказывается в начале документа.
  await expect(toggle).toBeFocused();
});

test("SplitPanel: the handle resizes by dragging and by arrow keys", async ({ page }) => {
  await page.goto("/iframe.html?id=app-shell-splitpanel--side&globals=theme:dark;accent:blue");

  const panel = page.getByRole("region", { name: "Order details" });
  const handle = page.getByRole("slider", { name: "Resize: Order details" });

  const before = (await panel.boundingBox())!.width;

  // Тяга влево увеличивает панель: она стоит после содержимого, поэтому
  // движение к началу оси отдаёт ей место.
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();

  const dragged = (await panel.boundingBox())!.width;
  expect(dragged).toBeGreaterThan(before + 40);

  // Клавиатура обязана уметь то же самое: ручка, доступная только мышью, —
  // ровно тот случай, ради которого под полосой лежит настоящий ползунок.
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  expect((await panel.boundingBox())!.width).toBeGreaterThan(dragged);

  // `End` обязан брать ровно `maxSize`, а не «почти». Пока шаг ползунка был 16,
  // верхняя граница с клавиатуры не бралась вовсе: шаговая база у `range` — это
  // `min`, и до `max` сетка не доходила.
  //
  // Сверяется значение ползунка со своими же границами, а не ширина панели:
  // ширину ограничивает ещё и контейнер, и тогда тест сторожил бы размер
  // обёртки в витрине.
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

  // Знак дельты для нижней оси — собственное решение компонента, и до сих пор
  // он жил только в снимке: тянули лишь боковую ось.
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

  // Наведение без нажатия не должно двигать границу: именно так выглядела
  // утечка состояния тяги — панель ездила за курсором с отпущенной кнопкой.
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

  // Пока кнопка не отпущена, выделения быть не должно: иначе движение мимо
  // полосы подсвечивает половину списка.
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

  // Принимающая колонка НЕ пуста — в ней уже лежит «View reports». Именно этот
  // случай раньше ломался: фокус вставал на старый элемент, потому что
  // `focus()` звали до коммита нового выделения.
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

  // Вырожденный случай: принимающая колонка была пуста, делегировать фокус
  // react-aria некуда, и раньше он оставался на контейнере. Правило требует
  // приехавший элемент.
  await expect(selected.getByRole("option", { name: "View reports" })).toBeFocused();
});

test("TreeSelect: Escape closes the popover and returns focus to the field", async ({ page }) => {
  await page.goto("/iframe.html?id=inputs-treeselect--playground&globals=theme:dark;accent:blue");

  const field = page.getByRole("button", { name: /^Division/ });
  await field.click();
  await expect(page.getByRole("treegrid", { name: "Division" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("treegrid")).toBeHidden();
  // Фокус возвращается полю, а не уезжает на `<body>`: иначе после отказа от
  // выбора пользователь оказывается в начале документа.
  await expect(field).toBeFocused();
});

/**
 * Сворачивание переводит фокус в содержимое, а не роняет его.
 *
 * Проверка живёт ЗДЕСЬ, а не в jsdom, и это существенно: там атрибут `hidden`
 * фокус не снимает, и тест на «фокус не на body» проходил бы и на
 * неисправленном коде — опираясь на расхождение jsdom с браузером. По ADR-0012
 * такая проверка обязана быть браузерной.
 */
test("SplitPanel: collapsing moves focus into the content instead of dropping it", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=app-shell-splitpanel--collapse-from-outside&globals=theme:dark;accent:blue"
  );

  await page.getByTestId("note").focus();
  await expect(page.getByTestId("note")).toBeFocused();

  // Сворачивание приходит НЕ от щелчка: щелчок сам уводит фокус на кнопку.
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

  // Узко: панель смонтирована, но не видна и не в дереве доступности.
  await expect(page.getByTestId("adaptive-panel")).toBeHidden();
  await expect(page.getByRole("slider")).toHaveCount(0);

  // Окно расширили: хук подписан на изменение, перезагрузка не нужна.
  await page.setViewportSize({ width: 1200, height: 600 });
  await expect(page.getByRole("region", { name: "Order details" })).toBeVisible();
  await expect(page.getByTestId("adaptive-panel")).toBeVisible();
  await expect(page.getByRole("slider")).toBeVisible();

  await page.setViewportSize({ width: 700, height: 600 });
  await expect(page.getByRole("region", { name: "Order details" })).toHaveCount(0);
});

/*
 * Движение и `prefers-reduced-motion` — ADR-0043.
 *
 * Здесь проверяется то, чего текстовый `tests/motion.test.ts` не видит:
 * настоящий каскад. Он читает `styles.css` и знает, что токен переопределён; он
 * не знает, дошло ли переопределение до элемента — а именно там волна 27 нашла
 * дефект: `.skeleton` задавала анимацию строкой мимо токена, и блок `reduce` её
 * не касался.
 *
 * ВАЖНО про настройку: весь файл идёт с `reducedMotion: "reduce"` — так задано
 * в `playwright.config.ts` ради устойчивости снимков. Поэтому «погашено»
 * проверяется в обычном тесте, а «работает» — в блоке со своим `test.use`.
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

  // Неопределённый прогресс: доля неизвестна, и движение полосы и есть всё
  // сообщение. Застывшая треть читается как «зависло», а не как «спокойно».
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

  // Переход задан утилитой Tailwind, а не токеном: переопределить его из
  // `styles.css` нечем, гасит вариант `motion-reduce:` по месту.
  const chevron = page.locator(".transition-transform").first();
  await expect(chevron).toBeVisible();
  expect(await chevron.evaluate((el) => getComputedStyle(el).transitionProperty)).toBe("none");
});

/*
 * ВЫХОД ОВЕРЛЕЕВ проверяется только здесь, и иначе не может.
 *
 * Текстовый гейт видит токен, но не видит главного: дожил ли узел до конца
 * анимации. Выход существует ровно постольку, поскольку библиотека держит
 * элемент в DOM после того, как состояние стало «закрыто», — а это поведение
 * Radix и react-aria, не наше CSS.
 *
 * Снимки этого тоже не поймают: они идут с `animations: "disabled"`, то есть
 * в конечном кадре, где закрытая панель уже удалена.
 *
 * Замер устроен наблюдателем, а не паузой: выход длится 100–150мс, и sleep
 * на глазок дал бы тест, зелёный на медленной машине и красный на быстрой.
 * Наблюдатель ставится ДО закрытия и записывает первый же кадр, в котором
 * состояние сменилось.
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
 * Панель меню не адресуется селектором: у RAC класс выхода лежит на попоувере,
 * внутри которого сидит меню, у Radix — на самой панели. Общего селектора нет,
 * поэтому наблюдатель поднимается от `role="menu"` до первого предка, у которого
 * есть анимация. Так один и тот же тест смотрит на обе реализации.
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
     * Класса длительности в разметке шеврона больше НЕТ: прежде там стояло
     * `duration-150`, снятое вместе с пятнадцатью такими же (ADR-0047). Темп
     * приходит из умолчания, и проверяется здесь именно это — что снятие класса
     * не оставило переход без времени.
     */
    await expect(chevron).not.toHaveClass(/\bduration-/);
    expect(await chevron.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0.15s");
  });

  test("Motion: a transition with no duration class takes its tempo from the scale", async ({
    page,
  }) => {
    /*
     * Шкала движения — ADR-0047. Текстовый гейт видит, что
     * `--default-transition-duration` ссылается на ступень; он не видит, дошла
     * ли ссылка до элемента. А именно там она и может оборваться: между
     * объявлением и переходом стоит вся сборка Tailwind, и достаточно, чтобы
     * `@theme` кита не доехал до витрины, — число молча вернётся к штатным
     * 150ms, совпадающим со ступенью случайно.
     *
     * Ссылка, а не число, проверяется второй строкой: у элемента резолвится
     * `--duration-base`. Будь здесь только `0.15s`, тест остался бы зелёным и
     * на зашитом умолчании Tailwind.
     */
    await page.goto(
      "/iframe.html?id=foundations-motion--default-tempo&globals=theme:dark;accent:blue"
    );

    const button = page.locator("button.transition-colors").first();
    await expect(button).toBeVisible();
    expect(await button.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0.15s");

    /*
     * Ступень СУЩЕСТВУЕТ у элемента, а не совпала числом: без этой строки тест
     * остался бы зелёным и на зашитом умолчании Tailwind, которое равно 150ms
     * по совпадению.
     *
     * Сравнивается величина, а не запись: браузер нормализует `150ms` в `.15s`,
     * и строгое равенство строк ловило бы орфографию вместо смысла.
     */
    const step = await button.evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--duration-base").trim()
    );
    expect(step, "--duration-base does not reach the element").not.toBe("");
    expect(step.endsWith("ms") ? parseFloat(step) : parseFloat(step) * 1000).toBe(150);
  });

  test("Motion: an overlay enters on the step its token names", async ({ page }) => {
    /*
     * Токен собран из ссылок на шкалу (ADR-0047), и текстовый гейт видит только
     * это. Дошла ли ссылка до живой анимации — вопрос каскада: `@theme` кита
     * мог бы не доехать до витрины, и `animation` осталась бы с невалидной
     * длительностью, то есть с нулём.
     *
     * Подсказка выбрана потому, что на ней изменение и проверяется: прежде она
     * входила за 0.14s, панель рядом — за 0.16s, и обе теперь на `base`.
     */
    await page.goto("/iframe.html?id=overlays-tooltip--playground&globals=theme:dark;accent:blue");

    await page.getByRole("button").first().hover();
    const tooltip = page.locator("[data-radix-popper-content-wrapper] [role='tooltip']").first();
    await expect(tooltip).toBeVisible();

    expect(await tooltip.evaluate((el) => getComputedStyle(el).animationDuration)).toBe("0.15s");
  });

  test("Motion: every step of the scale reaches the element", async ({ page }) => {
    /*
     * `duration-*` объявлены руками через `@utility`, потому что пространства
     * имён `--duration-*` у Tailwind нет (ADR-0047). Утилита из ИМПОРТИРОВАННОГО
     * файла — ровно то, что могло бы не доехать до сборки: `@theme` и `@plugin`
     * оттуда работают, и это в своё время тоже проверялось отдельно.
     *
     * Ступени перебираются все четыре, включая `duration-slow`, которого сегодня
     * не пишет ни один компонент. Непроверенная верхняя граница — не граница.
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
     * Escape, а не увод указателя. Увод Radix-подсказку не закрывает: она живёт
     * до настоящего `pointerleave` триггера, и `mouse.move` мимо него оставляет
     * её открытой — тест на этом молча висел бы до таймаута.
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
     * Уход панели ОТЛОЖИЛ её удаление на 150мс, и это меняет условия для
     * потребителя: пункт меню часто запускает мутацию и перерисовку списка, а
     * панель в этот момент ещё уходит. Если уход и перерисовка разойдутся,
     * останется подвисший узел — меню, которого на экране быть не должно.
     *
     * Проверяется на истории с настоящим состоянием: выбор пункта здесь меняет
     * `useState` и перерисовывает содержимое, а не вызывает пустой колбэк.
     *
     * Заявка соседней сессии (NEX-88): опасение высказано до выпуска, проверено
     * здесь, чтобы ответ не был рассуждением.
     */
    await page.goto(
      "/iframe.html?id=overlays-menu--sections-and-submenus&globals=theme:dark;accent:blue"
    );

    await page.getByRole("button").first().click();
    await expect(page.getByRole("menu").first()).toBeVisible();

    /*
     * Пункт ОДИНОЧНОГО выбора: он и меняет `useState` истории, и закрывает
     * меню. Пункт-флажок для этой проверки не годится — множественный выбор
     * панель намеренно не закрывает, и тест мерил бы не то.
     */
    await page.getByRole("menuitemradio", { name: "By name" }).click();

    /*
     * Ждётся ИСЧЕЗНОВЕНИЕ, а не пауза: Playwright опрашивает до успеха, поэтому
     * тест не зависит от того, насколько быстра машина. Подвисший узел он
     * поймает таймаутом, а не совпадением.
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
     * `Menu` собран на react-aria, `ContextMenu` — на Radix, а вид у них общий:
     * одна строка классов на две реализации (`lib/menu.ts`). До этой волны она
     * несла ТОЛЬКО диалект RAC, и `ContextMenu` не анимировался вовсе — при
     * комментарии, обещавшем, что оба меню открываются одинаково.
     *
     * Поэтому проверяются оба, и именно на совпадение: разойтись они могут
     * только молча.
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
     * ADR-0043 гасит движение, а не событие. У выхода это особенно важно:
     * `animation: none` убрал бы исчезновение вовсе, и панель пропадала бы в
     * кадр — резче, чем если бы правила не было совсем.
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
  `EditableList` проверяется здесь целиком и намеренно.

  Все три дефекта, найденные при сборке, jsdom пропустил бы молча: коллекция
  react-aria там монтирует содержимое строки иначе, а `document.activeElement`
  после размонтирования ведёт себя не как в браузере. Компонент заводился ради
  одного — чтобы поле внутри строки не спорило со списком за клавиши, — и
  проверить это можно только тут.
*/

const EDITABLE_LIST =
  "/iframe.html?id=content-editablelist--playground&globals=theme:dark;accent:blue";

test("EditableList: Enter on the handle starts the drag, not the edit", async ({ page }) => {
  await page.goto(EDITABLE_LIST);

  /*
    ЭТОЙ ПРОВЕРКИ НЕ БЫЛО, И РОВНО ЧЕРЕЗ ЭТУ ДЫРУ УЕХАЛ ДЕФЕКТ 3.10.1.

    Перехват клавиш искал строку через `closest("[data-key]")` и потому
    срабатывал на её ручке: `Enter` гасился здесь и открывал правку, а до
    react-aria не доходил — перенос с клавиатуры не начинался никогда.
    В jsdom это не ловится: перетаскивание там не работает вовсе (ADR-0028),
    и оба теста — «правка открылась» и «перенос пошёл» — были бы зелёными.
  */
  const before = await page.getByTestId("order").textContent();

  await page.getByRole("row").first().click();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);

  // Правка НЕ открылась — это первая половина дефекта.
  await expect(page.getByRole("textbox", { name: /^Rename / })).toHaveCount(0);

  // И перенос действительно пошёл: цель выбирается стрелками, Enter применяет.
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

  // Выделение целиком: правка по месту почти всегда — замена названия, а не
  // дописывание к нему.
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

  // РАДИ ЭТОЙ ПРОВЕРКИ КОМПОНЕНТ И ЗАВОДИЛСЯ. Строка — `GridListItem`, и она
  // слушает стрелки сама, причём раньше любого обработчика на поле: без
  // перехвата в фазе погружения фокус уезжал на следующую строку прямо посреди
  // набора.
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

  // Поле исчезает, и без возврата фокус уехал бы на `<body>`.
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
  // Пользователь ушёл туда, куда хотел.
  await expect(add).toBeFocused();
});

test("EditableList: the add row takes a series and ignores an empty confirm", async ({ page }) => {
  await page.goto(EDITABLE_LIST);

  // Вниз с последней строки — в поле добавления: оно не элемент коллекции, и
  // этот переход никто, кроме компонента, не напишет.
  await page.getByRole("row", { name: /Collect the quarterly budget/ }).click();
  await page.keyboard.press("ArrowDown");

  const add = page.getByRole("textbox", { name: "New task" });
  await expect(add).toBeFocused();

  await page.keyboard.type("Buy tickets");
  await page.keyboard.press("Enter");
  // Поле осталось открытым и пустым — в этом вся разница с `InlineEdit`.
  await expect(add).toBeFocused();
  await expect(add).toHaveValue("");

  await page.keyboard.type("Renew the domain");
  await page.keyboard.press("Enter");
  // Пустое подтверждение не создаёт ничего.
  await page.keyboard.press("Enter");

  await expect(page.getByTestId("order")).toHaveText("1,2,3,4,5,6,7");
  await expect(page.getByRole("row", { name: /Buy tickets/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Renew the domain/ })).toBeVisible();

  // Вверх из пустого поля — обратно на последнюю строку: иначе из поля, которое
  // всегда на экране, некуда выйти с клавиатуры.
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("row", { name: /Renew the domain/ })).toBeFocused();
});

test("EditableList: the handle is disabled only on the row being edited", async ({ page }) => {
  await page.goto(EDITABLE_LIST);

  const row = page.getByRole("row", { name: /Agree the estimate/ });
  await row.click();
  await page.keyboard.press("Enter");

  // Тащить строку, пока в ней курсор, нельзя: стрелки принадлежат каретке.
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

  // Раскладка, а не класс: сегменты не сжимаются, поэтому проверять надо, куда
  // они в итоге встали. Ряд опознаётся по верхней кромке кнопки.
  const tops = await buttons.evaluateAll((nodes) =>
    Array.from(new Set(nodes.map((n) => Math.round(n.getBoundingClientRect().top))))
  );
  expect(tops.length).toBe(2);

  // То, ради чего заявка и подана: WCAG 1.4.10 — содержимое умещается по
  // ширине, горизонтальной прокрутки нет ни у контрола, ни у страницы.
  const fits = await group.evaluate((el) => {
    const parent = el.parentElement as HTMLElement;
    const doc = document.documentElement;
    return {
      insideParent: el.getBoundingClientRect().right <= parent.getBoundingClientRect().right + 0.5,
      pageScrollsSideways: doc.scrollWidth > doc.clientWidth,
    };
  });
  expect(fits).toEqual({ insideParent: true, pageScrollsSideways: false });

  // Зазор между рядами шире, чем между сегментами: 4 против 2. С одним `gap`
  // на обе оси ряды слиплись бы и прочитались сеткой, а не одним контролом.
  const gaps = await group.evaluate((el) => {
    const style = getComputedStyle(el);
    return { row: style.rowGap, column: style.columnGap };
  });
  expect(gaps).toEqual({ row: "4px", column: "2px" });
});

/**
 * Режим «только значок на узком экране» — OLDSUI-19.
 *
 * Замер в браузере обязателен по двум причинам: порог живёт в медиазапросе, о
 * котором jsdom не знает вовсе, и доказывать надо ВЫСОТУ — ровно ту величину,
 * ради которой заявка подана.
 */
const SEGMENTED_MOBILE =
  "/iframe.html?id=actions-segmented--mobile-icon-only&globals=theme:dark;accent:blue";

test("Segmented: mobileIconOnly collapses the row on a phone and keeps every name", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(SEGMENTED_MOBILE);

  // Первый переключатель — без режима, второй — с ним. Пять одинаковых
  // сегментов в обоих, сравнивать можно напрямую.
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

  // ГЛАВНОЕ: подпись спрятана глазам, но осталась именем кнопки. Спрятанная
  // неправильно — `hidden`, `display: none`, выброшенные дети — дала бы ряд
  // безымянных кнопок, и видно это было бы только аудитом.
  for (const name of ["Active", "Deferred", "Done", "Dropped", "Available now"]) {
    await expect(compact.getByRole("button", { name, exact: true })).toBeVisible();
  }
  /*
    Глазам подписи нет — и меряется это КОРОБКОЙ, а не `toBeVisible`: `sr-only`
    не гасит узел, а сжимает его в пиксель и обрезает, поэтому для Playwright
    он «видим». Пиксель — и есть доказательство: ушёл из виду, остался в дереве.
  */
  const label = (await compact.getByText("Active").boundingBox())!;
  expect(label.width).toBeLessThanOrEqual(1);

  // Выбранный сегмент помечен состоянием, а не только цветом: без подписей это
  // важнее обычного.
  await expect(compact.getByRole("button", { name: "Available now" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  // Отступ режется вместе с подписью: вокруг одного значка `px-3` дал бы
  // кнопку заметно шире своей высоты.
  const box = (await compact.getByRole("button").first().boundingBox())!;
  expect(box.width).toBeLessThan(box.height + 8);
});

test("Segmented: on a wide screen the mode changes nothing", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(SEGMENTED_MOBILE);

  const groups = page.locator("div.inline-flex.flex-wrap");
  const plain = (await groups.nth(0).getByRole("button").first().boundingBox())!;
  const compact = (await groups.nth(1).getByRole("button").first().boundingBox())!;

  // Порог берётся от ширины ЭКРАНА: выше него режим обязан быть незаметен.
  expect(Math.round(compact.width)).toBe(Math.round(plain.width));
  await expect(groups.nth(1).getByText("Active")).toBeVisible();
});

test("EditableList: the add field lines up with the task names, not with the leading column", async ({
  page,
}) => {
  await page.goto(EDITABLE_LIST);

  // Замер, а не класс: выравнивание держится геометрией, и сойтись оно должно
  // на живой раскладке. У потребителя рамка стояла на колонке флажка — между
  // краем строки и названиями, не совпадая ни с тем, ни с другим.
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

  // Зеркало в `add.leading` не должно попадать ни в дерево доступности, ни в
  // порядок обхода: флажок у задачи, которой ещё нет, отмечать нечего.
  // Флажков ровно столько, сколько строк, — шестого, из строки добавления,
  // скринридер не видит.
  await expect(page.getByRole("row")).toHaveCount(5);
  await expect(page.getByRole("checkbox")).toHaveCount(5);
});

test("EditableList: a mouse drag moves the row and does not duplicate it", async ({ page }) => {
  await page.goto(EDITABLE_LIST);

  const rows = page.getByRole("row");
  // `allInnerTexts` не ждёт сама: без этого замер «до» снимается с пустого
  // списка и проверка состава сравнивает ноль строк с пятью.
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

  // Состав, а не только порядок. Разрешена ровно одна операция — `move`, и
  // проверяется здесь именно её следствие: строк после броска столько же,
  // сколько было. В WebKit система в начале перетаскивания рисует значок
  // копирования (баг 178058, разобран в справочнике) — но копирования не
  // происходит и там, и эта проверка сторожит саму операцию.
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

  // Замер, а не класс: `truncate` стоял в этих ветках и раньше, обрезать ему
  // было нечего — без `max-width` подпись занимает столько, сколько занимает.
  // Проверяется следствие: подпись не шире предела, и многоточие настоящее.
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

  // Замер вычисленного стиля, а не наличия класса: неизвестный вариант Tailwind
  // правила не порождает и пропадает молча, а класс в разметке остаётся.
  // `toHaveCSS` ждёт сам — у рецепта переход в 150 мс, и мгновенный замер
  // поймал бы середину.
  await expect(actions).toHaveCSS("opacity", "0");

  await row.hover();
  await expect(actions).toHaveCSS("opacity", "1");

  // И главное — клавиатура. Прежний рецепт предписывал здесь
  // `group-focus-within:`, и та утилита не срабатывала никогда: строка несёт
  // `data-rac`, а плагин react-aria метит такой элемент атрибутом
  // `data-focus-within`, которого строка не выставляет. Кнопка, до которой
  // дошёл таб, оставалась невидимой — то есть человек нажимал вслепую.
  await page.mouse.move(0, 0);
  await expect(actions).toHaveCSS("opacity", "0");

  await actions.getByRole("button").focus();
  await expect(actions).toHaveCSS("opacity", "1");
});

/**
 * Колесо над панелью `Select`, открытой изнутри модального слоя.
 *
 * Замок прокрутки (`react-remove-scroll`) Radix вешает на ПОДЛОЖКУ, а панель
 * портируется в `body` — то есть в DOM лежит вне замка и попадает в него
 * только через дерево React. Отсюда две противоположные поломки, и обе уже
 * случались: замок гасит колесо всегда, и список не крутится вовсе (OLDSUI-6,
 * `Drawer`), либо не гасит никогда, и прокрутка уходит на страницу под слоем
 * (подозрение OLDSUI-8, `Dialog`).
 *
 * Поэтому замер идёт в обе стороны и в обоих слоях. В jsdom его не сделать
 * вовсе: `scrollHeight` там всегда ноль, и проверка проходила бы при любой
 * раскладке.
 */
async function wheelOverPanel(page: Page) {
  return await page.evaluate(async () => {
    const list = document.querySelector("[role=listbox]") as HTMLElement;
    const before = list.scrollTop;
    // Слушатель в самом хвосте цепочки: он видит не своё решение, а итоговое —
    // отменил ли событие замок.
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

    // Списку есть куда крутиться — событие обязано дойти до него живым.
    const atStart = await wheelOverPanel(page);
    expect(atStart.max).toBeGreaterThan(0);
    expect(atStart.prevented).toBe(false);

    // Настоящим колесом, а не присвоением: `scrollTop` крутит панель мимо
    // замка, и такой замер ничего не сказал бы о нём.
    const box = (await list.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 200);
    await expect
      .poll(async () => await list.evaluate((el) => Math.round(el.scrollTop)))
      .toBeGreaterThan(0);

    // Докручено до конца — дальше не идёт ничего: ни список, ни страница под
    // слоем. Событие гасится замком, а не остаётся без последствий случайно.
    await list.evaluate((el) => (el.scrollTop = el.scrollHeight));
    const atEnd = await wheelOverPanel(page);
    // Допуск в пиксель: `scrollTop` бывает дробным при дробной высоте строки,
    // а `scrollHeight` браузер отдаёт округлённым.
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
 * Уход строки `EditableList` — OLDSUI-14.
 *
 * В jsdom этого не измерить: анимаций там нет вовсе, а коллекция react-aria
 * монтирует строки иначе — именно на этом ушёл первый подход, где призрак
 * снимался в том же кадре, в котором появлялся. Поэтому здесь меряется живое:
 * что уход идёт, что вместе с ним смыкается место, что несколько строк уходят
 * разом и что `reduce` снимает смыкание, а не сам уход.
 *
 * Время нигде не ждут: анимация ставится на паузу и перематывается. Ожидание
 * «примерно середины» на 150 мс — это флейк, а не проверка.
 */
const EDITABLE_LIST_LEAVING =
  "/iframe.html?id=content-editablelist--leaving&globals=theme:dark;accent:blue";

test.describe("EditableList: a row leaves instead of vanishing", () => {
  // Витрина гоняется с `reducedMotion: "reduce"` — здесь нужна обратная
  // настройка: смыкание проверяется именно в полном движении.
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  test("the row lives through its exit, and the space closes with the same motion", async ({
    page,
  }) => {
    await page.goto(EDITABLE_LIST_LEAVING);
    const rows = page.locator("[data-key]");
    await expect(rows).toHaveCount(5);
    const before = (await page.getByRole("grid").boundingBox())!;

    await page.getByRole("button", { name: "Done" }).nth(1).click();

    // Строка не пропала: она доживает уход на своём месте.
    const leaving = page.locator("[data-key][inert]");
    await expect(leaving).toHaveCount(1);
    await expect(leaving).toContainText("Pay for hosting");

    const exit = await leaving.evaluate((row) => {
      const [animation] = row.getAnimations() as CSSAnimation[];
      const keyframes = (animation!.effect as KeyframeEffect).getKeyframes();
      animation!.pause();
      // Перемотка вместо ожидания: смыкание видно в любой точке, а ждать
      // «примерно середины» значит мерить скорость машины, а не анимацию.
      animation!.currentTime = 0;
      const start = row.getBoundingClientRect().height;
      animation!.currentTime = 40;
      const early = row.getBoundingClientRect().height;
      animation!.currentTime = 120;
      const late = row.getBoundingClientRect().height;
      // Ровно на конце мерить нечего: заливки у анимации нет, и на последнем
      // кадре стиль уже снят. Смыкание доказывает монотонность, а ноль в
      // конце — сами кейфреймы.
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
    // Высота приходит переменной: `height` не интерполируется от `auto`.
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
      Старт записывается в самом `animationstart`, а не запросом вдогонку.

      Прежде здесь сравнивался `currentTime` с нулём — и он ноль только в кадре
      старта: часы документа идут, а между кликом и следующим походом в
      страницу под параллельной нагрузкой проходит кадр-другой. Три строки,
      стартовавшие вместе, показывали тогда 16,7 или 83 мс — поровну, но не
      ноль, и тест падал на исправном компоненте. `startTime` — точка старта на
      шкале документа — не стареет, сколько её ни читай.

      Наблюдатель ставится ДО клика: уход длится 150 мс, и под нагрузкой
      счётчик призраков, опрошенный после, мог бы их уже не застать.
    */
    type Start = { key: string | null; name: string; startTime: number | null; delay: number };
    await page.evaluate(() => {
      const w = window as unknown as { __rowStarts: Start[] };
      w.__rowStarts = [];
      document.addEventListener("animationstart", (event) => {
        const row = event.target as HTMLElement;
        // Только сами призраки: анимация из слотов потребителя всплывает сюда же.
        if (!row.matches("[data-key][inert]")) return;
        const animation = (row.getAnimations() as CSSAnimation[]).find(
          (candidate) => candidate.animationName === event.animationName
        )!;
        // `startTime` читается по `ready`: до него старт ещё не назначен, и
        // `null` означал бы «не успели спросить», а не «не стартовала».
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

    // Уходят ровно три снятые строки, каждая — призраком (`inert`), и каждая
    // своим уходом, а не чужой анимацией.
    expect(starts.map((start) => start.key).sort()).toEqual(["1", "2", "3"]);
    expect(starts.map((start) => start.name)).toEqual(["rowout", "rowout", "rowout"]);
    // Волна на десятке строк превращается в ожидание, а порядок ухода ничего
    // не значит: все три идут с одной точки. Волну можно устроить двумя
    // способами — разнести старты или раздать задержки, — и закрыты оба.
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

  // Кнопка лежит ВНУТРИ строки — так снимает задачу флажок у потребителя,
  // и фокус в момент пропажи стоит внутри уходящей строки.
  await page.getByRole("button", { name: "Done" }).nth(1).click();

  // Вперёд — на строку, занявшую место ушедшей. Оставить фокус на призраке
  // нельзя: он `inert`, и фокус провалился бы в `body`.
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

  // Списка не осталось — фокусу некуда идти, кроме строки добавления.
  await expect(page.getByRole("textbox", { name: "New task" })).toBeFocused();
});

test("EditableList: under reduce the exit stays and the collapse goes", async ({ page }) => {
  // Контекст витрины и есть `reduce` — отдельной настройки не нужно.
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

  // Уход остаётся — иначе строка пропадала бы в кадр, то есть резче, чем без
  // правила вовсе (ADR-0043). Уходит смыкание: это движение всего, что ниже.
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
  // Призрак замирает, чтобы вторая пропажа случилась ПРИ нём, а не после:
  // гонка на 150 мс проверяла бы скорость машины, а не компонент.
  await leaving.evaluate((row) => row.getAnimations().forEach((animation) => animation.pause()));

  await page
    .locator("[data-key]:not([inert])")
    .first()
    .getByRole("button", { name: "Done" })
    .click();

  /*
    Сосед ищется в `items`, а не на экране: экранный индекс считает призраков, и
    фокус уезжал бы через строку от ушедшей — при живом призраке выше по списку
    он промахивался на одну.
  */
  await expect
    .poll(async () => await page.evaluate(() => document.activeElement?.getAttribute("data-key")))
    .toBe("3");
});

/**
 * Набор образцов — OLDSUI-17.
 *
 * В jsdom не проверить двух вещей: горизонтальных стрелок (их разбирает
 * радиогруппа react-aria, и в jsdom это ведёт себя иначе) и того, что
 * выбранность видна не одним цветом — кольцо живёт в CSS.
 */
const SWATCH_GROUP =
  "/iframe.html?id=inputs-swatchgroup--playground&globals=theme:dark;accent:blue";

test("SwatchGroup: Tab brings focus to the selected option, not to the first", async ({ page }) => {
  await page.goto(SWATCH_GROUP);
  await expect(page.getByRole("radiogroup")).toBeVisible();

  await page.keyboard.press("Tab");

  // Набор — один табстоп, и входить в него надо туда, где стоит ответ.
  await expect(page.getByRole("radio", { name: "Teal" })).toBeFocused();
});

test("SwatchGroup: horizontal arrows walk the row, vertical ones walk the column", async ({
  page,
}) => {
  await page.goto(SWATCH_GROUP);
  await expect(page.getByRole("radiogroup")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("radio", { name: "Teal" })).toBeFocused();

  // Влево — предыдущий вариант в ряду; это делает сама радиогруппа.
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("radio", { name: "Violet" })).toBeChecked();

  /*
    Вниз — через ряд, шагом в `columns` (шесть): под «Violet» в сетке стоит
    «Steel». Линейная навигация react-aria увела бы на «Teal», то есть на
    соседний столбец, — обработчик компонента обязан перехватить клавишу
    раньше неё.
  */
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: "Steel" })).toBeChecked();

  // Вверх возвращает в тот же столбец, а не на предыдущий вариант.
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("radio", { name: "Violet" })).toBeChecked();

  // Под второй строкой ничего нет, и край не зацикливается: набор не карусель.
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
    Кольцо рисуется тенью и лежит ВОКРУГ образца, на подложке: на самом оттенке
    оно не добирает 3:1 у бирюзы и янтаря, а это признак состояния (WCAG
    1.4.11). У невыбранного варианта тени нет вовсе.
  */
  expect(await ring("Teal")).not.toBe("none");
  expect(await ring("Blue")).toBe("none");
});

/**
 * Имя оттенка подсказкой — OLDSUI-18.
 *
 * Замер в браузере обязателен: подсказка висит на обёртке варианта именно
 * потому, что `RadioButton` не пропускает наружу `onFocus`, — а событие фокуса
 * от настоящего Tab отличается от вызванного руками.
 */
const SWATCH_TOOLTIPS =
  "/iframe.html?id=inputs-swatchgroup--tooltips&globals=theme:dark;accent:blue";

/** Сам вариант: радиокнопка внутри него скрыта и мышью недостижима. */
const swatch = (set: Locator, name: string) =>
  set.getByRole("radio", { name }).locator("xpath=ancestor::label[1]");

test("SwatchGroup: the tooltip names the option under hover and under keyboard focus", async ({
  page,
}) => {
  await page.goto(SWATCH_TOOLTIPS);
  const set = page.getByRole("radiogroup", { name: "Hover or tab into it" });
  await expect(set).toBeVisible();

  /*
    Подсказки ищутся ПО ИМЕНИ, а не одной ролью: уходящая держится в разметке
    ещё кадр-другой (её убирает анимация закрытия), и поиск одной ролью ловил
    бы две сразу — тест падал бы на самом обычном переезде фокуса.
  */

  // Наводиться нужно на сам вариант, а не на скрытую радиокнопку внутри него:
  // кнопка в разметке есть, но лежит под образцом и мышью недостижима.
  await swatch(set, "Amber").hover();
  await expect(page.getByRole("tooltip", { name: "Amber" })).toBeVisible();

  // Фокус с клавиатуры: Tab приводит его на выбранный вариант, стрелка уводит
  // на соседний — подсказка обязана переехать следом, а не остаться на прежнем.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("tooltip", { name: "Teal" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tooltip", { name: "Green" })).toBeVisible();

  // Escape убирает подсказку и НЕ забирает фокус: выбор продолжается стрелками.
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
    Radix вешает `aria-describedby` на триггер. Триггер здесь — обёртка, а не
    сам вариант: на варианте описание удвоило бы имя, и скринридер прочитал бы
    «Янтарный Янтарный».
  */
  expect(await radio.getAttribute("aria-describedby")).toBeNull();
  expect(
    await radio.evaluate((node) => node.closest("label")!.getAttribute("aria-describedby"))
  ).toBeNull();
  // Описание оседает на обёртке — и это тот самый узел подсказки, а не чужой.
  const describedBy = await radio.evaluate((node) =>
    node.closest("label")!.parentElement!.getAttribute("aria-describedby")
  );
  expect(describedBy).toBe(await page.getByRole("tooltip", { name: "Amber" }).getAttribute("id"));
});

test("SwatchGroup: a disabled option is named too", async ({ page }) => {
  await page.goto(SWATCH_TOOLTIPS);
  const set = page.getByRole("radiogroup", { name: "A disabled option is named too" });
  await expect(set).toBeVisible();

  // «Почему нельзя» подсказка не объясняет, но «что это за цвет» — вопрос
  // законный и к недоступному варианту.
  await swatch(set, "Red").hover();
  await expect(page.getByRole("tooltip", { name: "Red" })).toBeVisible();
});

/**
 * Крутилка поиска в палитре — OLDSUI-15.
 *
 * Замер в браузере, и иначе нельзя: в jsdom раскладки нет вовсе, а весь дефект
 * был в двух пикселях ширины.
 */
test("CommandPalette: the loading spinner does not move the typed text", async ({ page }) => {
  /*
    Одна история открывается дважды — с `loading` и без, — а не переключается
    кнопкой: палитра модальна, и до кнопки за ней не дотянуться ни мышью, ни
    клавиатурой. Аргумент приходит адресом, то есть оба кадра детерминированы.
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

  // Коробку под значок держит разметка: лупа 16, крутилка 14, и раньше поле
  // уезжало на разницу при каждом включении загрузки.
  expect(busy.x).toBe(idle.x);
  expect(busy.width).toBe(idle.width);
});

/**
 * Ступень высоты поля — OLDSUI-16.
 *
 * Замер в браузере, и иначе нельзя: вся ступень — это шесть пикселей высоты, а
 * в jsdom раскладки нет вовсе. Проверяется не число само по себе, а РАВЕНСТВО
 * соседям по строке: ради него ступень и заводилась.
 */
test("TextControl: the sm step matches the row — button, field and select share one height", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=inputs-textcontrol--sizes&globals=theme:dark;accent:blue");

  const row = page.getByTestId("compact-row");
  await expect(row).toBeVisible();

  /*
    Меряется ОБОЛОЧКА, а не сам `input`: рамка живёт на ней, и видимая высота
    поля — это её коробка. У поля внутри она на два пикселя меньше — ровно на
    рамку.
  */
  const heights = await row.evaluate((node) => {
    const round = (element: Element) => Math.round(element.getBoundingClientRect().height);
    return {
      button: round(node.querySelector("button")!),
      field: round(node.querySelector("input")!.parentElement!),
      // Пилюля `Select` — внешний бокс триггера, а не кнопка внутри неё.
      select: round(node.querySelector("[aria-haspopup='listbox']")!.parentElement!),
    };
  });

  expect(heights.field).toBe(36);
  expect(heights.field).toBe(heights.button);
  expect(heights.field).toBe(heights.select);

  // Умолчание не тронуто: в форме верны прежние 42.
  const form = page.getByRole("textbox", { name: "Form field" });
  expect(
    await form.evaluate((input) => Math.round(input.parentElement!.getBoundingClientRect().height))
  ).toBe(42);
});

/*
  Таблицы Редактора (OLDSUI-45). В jsdom нет раскладки и нативной каретки:
  выход стрелкой из таблицы, прокрутка узкой таблицы и фокус после действия из
  меню проверяются только здесь.
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

  // История ставит каретку в ячейку «Billing» сама. Alt+F10 — в Панель,
  // стрелками до «Таблица ▾».
  const button = await focusToolbarButton(page, "Table");
  await expect(button).toBeFocused();
  await expect(button).toHaveAttribute("aria-haspopup", "menu");

  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu", { name: "Table" })).toBeVisible();
  // Таблица › — Вставить таблицу… — Ячейка — Строка; → открывает подменю.
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("menu", { name: "Row" })).toBeVisible();
  await page.keyboard.press("Enter");

  // Первый пункт — «Insert row above» к строке «Billing».
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
  // «Таблица ▾» → «Таблица ›» → сетка 3×3.
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await page.getByRole("menuitem", { name: "Table", exact: true }).hover();
  await page.getByRole("gridcell", { name: "3 columns, 3 rows" }).click();
  await expect(field.locator("tr")).toHaveCount(3);
  // Фокус возвращается в документ, когда меню снято (после его исчезновения):
  // Tab до этого достался бы сетке, а не ячейке.
  await expect(field).toBeFocused();

  // Девять ячеек: восемь Tab — из первой в последнюю, девятый добавляет строку.
  for (let i = 0; i < 9; i++) await page.keyboard.press("Tab");
  await expect(field.locator("tr")).toHaveCount(4);

  // Стрелка вниз из последней строки: курсор-щель под таблицей, набор — абзац.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.type("after");
  await expect(field.locator("p").last()).toHaveText("after");
  await expect(field.locator("table p", { hasText: "after" })).toHaveCount(0);
});

/*
  Сетка размера таблицы (OLDSUI-45): фокус при монтировании, рост от стрелок и
  клавиатурный выбор проверяются в настоящем браузере.
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

  // Только в холсте истории: в `iframe.html` витрина держит ещё и скрытую
  // заготовку таблицы аргументов (`.sb-argstableBlock`).
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
  // Страница осталась в ширине окна: горизонтально едет только таблица.
  expect(metrics.page).toBeLessThanOrEqual(metrics.window);
});

/*
  Ошибка полей кода и времени: красит рамку каскад (`has-[…aria-invalid]` и
  вариант Tailwind по `aria-invalid`), а jsdom каскад не считает. Эталон цвета берётся с
  текста ошибки `FormField` — он `text-danger-strong`, то есть тот же токен, —
  чтобы тест не зависел от темы.
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

  // Фокус красит линию в акцент (`focus-visible:`); у поля с ошибкой должен
  // побеждать красный — порядок вариантов в CSS jsdom не проверит.
  await fields.nth(0).focus();
  await expect(fields.nth(0)).toHaveCSS("border-bottom-color", danger);
});

test("Toggle: a click on the description flips the switch", async ({ page }) => {
  await page.goto("/iframe.html?id=actions-toggle--setting-row&globals=theme:dark;accent:blue");

  const guests = page.getByRole("switch", { name: "Members can invite guests" });
  await expect(guests).not.toBeChecked();

  // Описание — часть мишени: нажатие по нему активирует переключатель средствами
  // браузера (`<label for>`), а у выключенного не срабатывает.
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

  // Фокус в поле — не на кнопке и не на крестике — и кнопка выключена.
  await expect(field).toBeFocused();
  await expect(confirm).toBeDisabled();

  // Enter без совпадения окно не закрывает; регистр важен.
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

  // Вместо списка значений — два числовых поля; «Применить» ждёт границу.
  const apply = page.getByRole("button", { name: "Apply" });
  await expect(apply).toBeDisabled();
  await page.getByRole("textbox", { name: "From" }).fill("50");
  await page.getByRole("textbox", { name: "To" }).fill("100");
  // Нажатие мышью уводит фокус с поля и фиксирует ввод до самого клика.
  await apply.click();

  await expect(page.getByText("Amount: 50–100")).toBeVisible();
  await expect(add).toBeFocused();

  // Дата: календарь открывается внутри поповера добавления и не закрывает его.
  await add.click();
  await page.getByRole("button", { name: "Field" }).click();
  await page.getByRole("option", { name: "Created" }).click();
  await page.getByRole("group", { name: "From" }).getByRole("button").click();
  await page.getByRole("grid").getByRole("button").filter({ hasText: /^15$/ }).first().click();

  await expect(apply).toBeVisible();
  await expect(apply).toBeEnabled();
  await apply.click();

  await expect(page.getByText(/^Created: from /)).toBeVisible();

  // Токен диапазона снимается как любой другой.
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

    // Долгое нажатие — настоящими событиями касания: меню Radix открывает его
    // по таймеру, а `usePress` ячейки react-aria мог бы принять отпускание за нажатие.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await page.waitForTimeout(1200);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(300);

    // У ячейки с меню долгое нажатие — только меню (OLDSUI-202): react-aria
    // по своему правилу выделил бы её, но сетка отменяет его нажатие раньше.
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
    // На узком экране одна колонка: ячейка «2» ниже края — сначала прокрутка сетки.
    const grid = page.getByRole("grid", { name: "Frames" });
    await grid.evaluate((el) => el.scrollTo(0, 400));
    await page.waitForTimeout(300);
    const box = (await page.locator('[role="row"][data-key="2"]').boundingBox())!;
    const area = (await grid.boundingBox())!;
    // Касание — в видимую часть ячейки: её низ может уходить за край сетки.
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
  VirtualGrid в библиотеке (OLDSUI-199): прокрутка окна под липкой шапкой,
  подгрузка у конца, кнопки и флажок в ячейке, Shift только добавляет,
  протяжка пальцем. Всё это — раскладка, окно и события касания, то есть
  ровно то, чего в jsdom нет.
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

  // Своей прокрутки у сетки нет: она во всю высоту содержимого.
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

  // Ячейка у верхнего края окна, ниже шапки; дальше — стрелкой вверх.
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
  // Подгрузка не идёт подряд сама: без прокрутки страница одна.
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("loaded")).toHaveText("Loaded: 240");
});

test("VirtualGrid library: buttons in a cell work and neither open nor select it", async ({
  page,
}) => {
  const grid = await openLibrary(page);
  // Кнопки `MediaCard` ловят указатель при наведении — сначала курсор на плитку,
  // как у живого человека.
  await grid.getByRole("row").nth(2).hover();
  const favourite = page.getByRole("button", { name: "Favourite poster-0002.jpg" });
  await favourite.click();
  await expect(favourite).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("opened")).toHaveText("Opened: none");
  await expect(page.getByTestId("selected-count")).toHaveText("Selected: 0");

  // Флажок выбора — та же ось, что у сетки.
  await grid.getByRole("row").nth(3).hover();
  // Видимая коробка перекрывает скрытый `input`: человек жмёт по метке флажка.
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
  // Видимая коробка перекрывает скрытый `input`: человек жмёт по метке флажка.
  await page
    .getByRole("checkbox", { name: "Select poster-0000.jpg" })
    .locator("xpath=ancestor::label[1]")
    .click();
  await expect(page.getByTestId("selected-count")).toHaveText("Selected: 1");

  await grid.getByRole("row").nth(6).focus();
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  // «Ноль» на месте: react-aria без режима `add` заменил бы набор диапазоном.
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
  // Обе ячейки в первой строке: зазор между ними — заказанный `gap` (12 по
  // умолчанию). Раскладка react-aria урезает свой зазор ниже `minSpace` при
  // округлении, и «вплотную» его наследовал (OLDSUI-203: 16 вместо 18).
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
    // История: minItemWidth 180, gap 12. Колонок — как у `minmax(180px, 1fr)`
    // без полей по краям. Раскладка react-aria резервировала внешний зазор и
    // теряла колонку (OLDSUI-203).
    const expected = Math.max(1, Math.floor((width + 12) / (180 + 12)));
    // Ширина окна подобрана так, что react-aria насчитала бы на колонку меньше.
    expect(Math.floor(width / (180 + 12))).toBe(expected - 1);
    expect(inFirstRow).toBe(expected);
  });
});

test.describe("VirtualGrid library on a touch screen", () => {
  // 420, а не 390: при 390 влезает одна колонка, и протяжка шла бы по столбцу.
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

    // Ячейки 0..3 по порядку коллекции, а не прямоугольник на экране.
    await expect(page.getByTestId("selected-count")).toHaveText("Selected: 4");
    await expect(page.getByTestId("opened")).toHaveText("Opened: none");
    // Движение пальца сняло таймер меню Radix: жест — выделение, а не меню.
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

    // Удержание лишь взводит протяжку: без движения это долгое нажатие меню,
    // и только меню — выбор не меняется (OLDSUI-202).
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

    // Флаг гашения щелчка после жеста не должен съесть следующий настоящий тап.
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
 * Оглавление Документа (`RichTextToc`, OLDSUI-264). Наведение с задержкой,
 * подсветка текущего раздела при прокрутке и переход под липкую шапку держатся
 * на раскладке, прокрутке и pointer-событиях — в jsdom их нет.
 */
test.describe("RichTextToc", () => {
  // Окно ниже штатного: история должна прокручиваться дальше последнего заголовка,
  // иначе страница упирается в конец и подсветка с переходом проверяют не то.
  test.use({ viewport: { width: 1280, height: 480 } });
  const strip = (page: Page) => page.getByRole("button", { name: "Table of contents" });
  const list = (page: Page) => page.getByRole("navigation", { name: "Table of contents" });

  /** Курсор приходит на полосу снаружи: так браузер шлёт `pointerenter`. */
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
    // Сразу — ещё нет: случайный пролёт курсора список не открывает.
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
    // Адрес страницы не меняется: переход без якорей.
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
    // «Tones» — пятый заголовок Документа.
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
    // Шапка — 56px (`--topbar-h` в истории): заголовок встаёт ровно под неё.
    await expect.poll(async () => Math.round((await heading.boundingBox())!.y)).toBe(56);
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
 * Инструмент `toc` Редактора (OLDSUI-271, ADR-0068): Оглавление в левом поле.
 * Липкость под Панелью, каретка после перехода и прокрутка внутри поля — только
 * в настоящем браузере.
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
    // Дважды прокрутили — полоса стоит на том же месте под Панелью: липнет.
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
    // Край — низ оболочки Панели, а не самой `toolbar`: от оболочки (с её рамкой)
    // Редактор меряет высоту Панели для перехода и липкой полосы.
    const shell = page.getByRole("toolbar").first().locator("xpath=..");
    const toolbar = (await shell.boundingBox())!;
    const edge = toolbar.y + toolbar.height;
    // Прокрутка плавная: ждём, пока заголовок встанет вплотную под нижний край Панели.
    await expect
      .poll(async () => Math.round((await heading.boundingBox())!.y - edge), { timeout: 5000 })
      .toBeLessThanOrEqual(2);
    // И не под ней: заголовок целиком ниже Панели и шапки.
    expect((await heading.boundingBox())!.y).toBeGreaterThanOrEqual(edge - 1);
    // Кнопка вне поля, а каретка в конце заголовка: как после клика по пункту.
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
   * Состояние Инструмента `toc` (OLDSUI-268): текущий раздел в снимке следует за
   * прокруткой. В jsdom у узлов нет геометрии, поэтому только здесь.
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

    // Заголовок встал под липкую Панель — он и есть текущий раздел. Берётся раздел
    // из середины: до заголовков у конца прокрутка не доезжает, там текущий — последний.
    await page.getByRole("heading", { name: "Layer 1 — primitives" }).evaluate((heading) => {
      window.scrollTo(0, window.scrollY + heading.getBoundingClientRect().top - 30);
    });
    await expect(current).toHaveText("Layer 1 — primitives");

    // Документ докручен до конца: текущий — последний раздел, хотя он короткий.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(current).toHaveText("What's next");

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(current).toHaveText("Palette");
  });
});
