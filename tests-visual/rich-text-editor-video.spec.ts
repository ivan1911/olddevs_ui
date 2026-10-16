import { expect, test, type Page } from "@playwright/test";
import { messages as ru } from "../src/locales/ru.js";
import { stubVideoServices } from "./video-services.js";

/**
 * Видео по ссылке в браузере (OLDSUI-281, OLDSUI-287, ADR-0071): то, чего jsdom не
 * видит, — настоящая раскладка рамки (16:9) и настоящий `iframe`. Запросы к YouTube
 * и Twitch перехватываются (`stubVideoServices`): сеть не ходит, тест сверяет адрес,
 * который кит загрузил бы. По умолчанию плеер встаёт сразу; с `autoload: false`
 * (истории `VideoClickToPlay`) до щелчка — заглушка и ноль запросов.
 */

const EDITOR = (id: string) => `/iframe.html?id=${id}&globals=theme:dark;accent:blue`;
const captureServices = stubVideoServices;

/** Дать ProseMirror прочитать каретку после щелчка. */
async function settle(page: Page) {
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  );
}

const YOUTUBE_PLAYER = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ";
const YOUTUBE_PLAYER_CLICKED = `${YOUTUBE_PLAYER}?autoplay=1`;
const TWITCH_PLAYER = "https://player.twitch.tv/?channel=aws&parent=127.0.0.1&autoplay=false";

// ── Редактор: плеер сразу ──────────────────────────────────────────────────

test("the editor shows the players at once, in the 16:9 frame, with no placeholder", async ({
  page,
}) => {
  const requested = await captureServices(page);
  await page.goto(EDITOR("inputs-richtexteditor--video"));
  const field = page.getByRole("textbox", { name: "Document" });

  const youtube = field.locator('iframe[title="YouTube video"]');
  const twitch = field.locator('iframe[title="Twitch video"]');
  await expect(youtube).toHaveAttribute("src", YOUTUBE_PLAYER);
  await expect(twitch).toHaveAttribute("src", TWITCH_PLAYER);
  for (const frame of [youtube, twitch]) {
    await expect(frame).toHaveAttribute("loading", "lazy");
    await expect(frame).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  }
  await expect(field.getByRole("button", { name: /^Play/ })).toHaveCount(0);

  // 16:9 по раскладке, а не по разметке; iframe заполняет рамку.
  const player = field.locator("[data-video-player]").first();
  const box = (await player.boundingBox())!;
  expect(box.width / box.height).toBeCloseTo(16 / 9, 1);
  const inner = (await youtube.boundingBox())!;
  expect(Math.abs(inner.width - box.width)).toBeLessThan(3);
  expect(Math.abs(inner.height - box.height)).toBeLessThan(3);

  // Сеть: `loading="lazy"` грузит плеер, когда рамка у экрана. Первый уже у экрана,
  // второй после прокрутки.
  await expect.poll(() => requested).toContain(YOUTUBE_PLAYER);
  await twitch.scrollIntoViewIfNeeded();
  await expect.poll(() => requested).toContain(TWITCH_PLAYER);
});

test("the insert menu takes a link of either service and the new block gets its player at once", async ({
  page,
}) => {
  await captureServices(page);
  await page.goto(EDITOR("inputs-richtexteditor--video"));
  const field = page.getByRole("textbox", { name: "Document" });

  // Виды узлов монтируются следом за полем: щелчок до них попал бы в сдвигающуюся раскладку.
  await expect(field.locator("iframe")).toHaveCount(2);
  // Фокус до щелчка: ProseMirror через 20 мс после фокуса возвращает в DOM своё выделение,
  // и щелчок, совпавший с этим окном, терялся (каретка оставалась в начале Документа).
  await field.focus();
  await page.waitForTimeout(100);
  await field.getByText("Add another", { exact: false }).click();
  await page.keyboard.press("End");
  await settle(page);
  await page.getByRole("button", { name: "Insert block" }).click();
  await page.getByRole("menuitem", { name: "Video" }).click();

  const input = page.getByRole("textbox", { name: "Video link" });
  await expect(input).toBeVisible();
  await input.fill("https://vimeo.com/12345");
  await input.press("Enter");
  await expect(page.getByText("Enter a link to a YouTube / Twitch video")).toBeVisible();

  await input.fill("https://youtu.be/9bZkp7q19f0");
  await input.press("Enter");
  await expect(input).toBeHidden();
  await expect(field.locator("iframe")).toHaveCount(3);
  await expect(
    field.locator('iframe[src="https://www.youtube-nocookie.com/embed/9bZkp7q19f0"]')
  ).toHaveCount(1);
});

test("the russian catalog names the player", async ({ page }) => {
  await captureServices(page);
  await page.goto(EDITOR("inputs-richtexteditor--video-russian"));
  const field = page.getByRole("textbox", { name: "Document" });
  await expect(
    field.locator(`iframe[title="${ru.editor.videoPlayer({ service: "YouTube" })}"]`)
  ).toHaveCount(1);
});

test("a disabled service: the block of the other one is only its link", async ({ page }) => {
  await captureServices(page);
  await page.goto(EDITOR("inputs-richtexteditor--video-youtube-only"));
  const field = page.getByRole("textbox", { name: "Document" });

  await expect(field.locator('iframe[title="YouTube video"]')).toHaveCount(1);
  await expect(field.locator('iframe[title="Twitch video"]')).toHaveCount(0);
  await expect(field.getByRole("link", { name: "https://www.twitch.tv/aws" })).toBeVisible();
});

// ── Редактор: iframe не мешает правке ───────────────────────────────────────

test("keyboard: arrows select the block around the player, Delete removes it, Tab leaves the player", async ({
  page,
}) => {
  await captureServices(page);
  await page.goto(EDITOR("inputs-richtexteditor--video"));
  const field = page.getByRole("textbox", { name: "Document" });
  await expect(field.locator("iframe")).toHaveCount(2);

  // Каретка в конце абзаца перед первым блоком; ↓ выделяет блок целиком (Атом).
  await field.focus();
  await page.waitForTimeout(100);
  await field.getByText("Two blocks follow", { exact: false }).click();
  await page.keyboard.press("End");
  await settle(page);
  await page.keyboard.press("ArrowDown");
  const selected = field.locator("[data-video-node].ProseMirror-selectednode, [data-video-node]");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const wrapper = document.querySelector("[data-video-node]")!;
        return getComputedStyle(wrapper).outlineStyle !== "none";
      })
    )
    .toBe(true);
  await expect(selected.first()).toBeVisible();
  // Ручка Блока следует за выделением, и поле хранит фокус.
  await expect(page.getByRole("button", { name: "Block actions" })).toBeVisible();
  await expect(field).toBeFocused();

  // ↑ возвращает каретку в абзац над блоком, ↓↓ — в абзац под вторым блоком.
  await page.keyboard.press("ArrowUp");
  await settle(page);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const wrapper = document.querySelector("[data-video-node]")!;
        return getComputedStyle(wrapper).outlineStyle;
      })
    )
    .toBe("none");

  // Delete на выделенном блоке убирает блок вместе с плеером.
  await page.keyboard.press("ArrowDown");
  await settle(page);
  await page.keyboard.press("Delete");
  await expect(field.locator("iframe")).toHaveCount(1);
  await expect(field.locator('iframe[title="Twitch video"]')).toHaveCount(1);
  await expect(field).toBeFocused();
});

test("a click inside the player goes to the player and keyboard focus can leave it", async ({
  page,
}) => {
  await captureServices(page);
  await page.goto(EDITOR("inputs-richtexteditor--video"));
  const field = page.getByRole("textbox", { name: "Document" });
  const frame = field.locator('iframe[title="YouTube video"]');
  await expect(frame).toBeVisible();

  await frame.click();
  // Фокус в iframe: активный элемент страницы — сам iframe, поле его отдало.
  await expect.poll(() => page.evaluate(() => document.activeElement?.localName)).toBe("iframe");
  await expect(field).not.toBeFocused();

  // Tab выводит из iframe вперёд — в следующий плеер, как из любого iframe, а Shift+Tab —
  // назад и дальше, из первого плеера, в само поле: фокус нигде не застревает.
  const active = () =>
    page.evaluate(() => {
      const element = document.activeElement;
      return element?.localName === "iframe"
        ? (element.getAttribute("title") ?? "iframe")
        : (element?.getAttribute("role") ?? element?.localName ?? "none");
    });
  await page.keyboard.press("Tab");
  await expect.poll(active).toBe("Twitch video");
  await page.keyboard.press("Shift+Tab");
  await expect.poll(active).toBe("YouTube video");
  await page.keyboard.press("Shift+Tab");
  await expect.poll(active).toBe("textbox");
  await expect(field).toBeFocused();
});

// ── Редактор: autoload: false — заглушка до щелчка ──────────────────────────

test("autoload: false shows a placeholder with the service name and Play; nothing is requested before a click", async ({
  page,
}) => {
  const requested = await captureServices(page);
  await page.goto(EDITOR("inputs-richtexteditor--video-click-to-play"));
  const field = page.getByRole("textbox", { name: "Document" });

  const youtube = field.getByRole("button", { name: "Play YouTube video" });
  const twitch = field.getByRole("button", { name: "Play Twitch video" });
  await expect(youtube).toBeVisible();
  await expect(twitch).toBeVisible();
  await expect(youtube).toHaveText("Play");
  await expect(field.locator("[data-video-player]").first()).toContainText("YouTube");
  await expect(field.locator("iframe")).toHaveCount(0);

  // 16:9 по раскладке, а не по разметке.
  const box = (await field.locator("[data-video-player]").first().boundingBox())!;
  expect(box.width / box.height).toBeCloseTo(16 / 9, 1);

  // Подождать запросов, которые могли бы уйти позже загрузки.
  await page.waitForTimeout(500);
  expect(requested).toEqual([]);
});

test("autoload: false, a click loads the nocookie YouTube player with a title, lazy loading and a referrer policy", async ({
  page,
}) => {
  const requested = await captureServices(page);
  await page.goto(EDITOR("inputs-richtexteditor--video-click-to-play"));
  const field = page.getByRole("textbox", { name: "Document" });

  await field.getByRole("button", { name: "Play YouTube video" }).click();
  const frame = field.locator("iframe");
  await expect(frame).toHaveCount(1);
  await expect(frame).toHaveAttribute("src", YOUTUBE_PLAYER_CLICKED);
  await expect(frame).toHaveAttribute("title", "YouTube video");
  await expect(frame).toHaveAttribute("loading", "lazy");
  await expect(frame).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  await expect(frame).toBeFocused();
  // Сеть: запрос ушёл ровно на адрес плеера, и только после щелчка.
  await expect.poll(() => requested).toContain(YOUTUBE_PLAYER_CLICKED);
  // Второй блок не тронут.
  await expect(field.getByRole("button", { name: "Play Twitch video" })).toBeVisible();
});

test("autoload: false, Twitch takes the host of the page as parent", async ({ page }) => {
  const requested = await captureServices(page);
  await page.goto(EDITOR("inputs-richtexteditor--video-click-to-play"));
  const field = page.getByRole("textbox", { name: "Document" });

  await field.getByRole("button", { name: "Play Twitch video" }).click();
  const frame = field.locator("iframe");
  await expect(frame).toHaveAttribute(
    "src",
    "https://player.twitch.tv/?channel=aws&parent=127.0.0.1&autoplay=true"
  );
  await expect(frame).toHaveAttribute("title", "Twitch video");
  await expect
    .poll(() => requested.some((url) => url.startsWith("https://player.twitch.tv/")))
    .toBe(true);
});

test("autoload: false, a bare link pasted into an empty paragraph becomes a placeholder", async ({
  page,
}) => {
  await captureServices(page);
  await page.goto(EDITOR("inputs-richtexteditor--video-click-to-play"));
  const field = page.getByRole("textbox", { name: "Document" });

  // Пустой абзац в конце: Enter за последним абзацем.
  // Виды узлов монтируются следом за полем: щелчок до них попал бы в сдвигающуюся раскладку.
  await expect(field.getByRole("button", { name: "Play Twitch video" })).toBeVisible();
  // Фокус до щелчка: ProseMirror через 20 мс после фокуса возвращает в DOM своё выделение,
  // и щелчок, совпавший с этим окном, терялся (каретка оставалась в начале Документа).
  await field.focus();
  await page.waitForTimeout(100);
  await field.getByText("Add another", { exact: false }).click();
  await page.keyboard.press("End");
  await settle(page);
  await page.keyboard.press("Enter");
  await expect(field.locator("p.is-empty")).toHaveCount(1);
  await settle(page);
  await page.evaluate(() => {
    const transfer = new DataTransfer();
    transfer.setData("text/plain", "https://www.twitch.tv/videos/987654321");
    document
      .querySelector(".ProseMirror")!
      .dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: transfer, bubbles: true, cancelable: true })
      );
  });
  await expect(field.getByRole("button", { name: "Play Twitch video" })).toHaveCount(2);
  await expect(
    field.locator("[data-video-player]", { hasText: "https://www.twitch.tv/videos/987654321" })
  ).toHaveCount(1);
});

// ── Просмотр ─────────────────────────────────────────────────────────────

test("the view puts the players in place of the links at once", async ({ page }) => {
  const requested = await captureServices(page);
  await page.goto(EDITOR("content-richtextview--video"));

  const frames = page.locator("iframe");
  await expect(frames).toHaveCount(2);
  await expect(frames.nth(0)).toHaveAttribute("src", YOUTUBE_PLAYER);
  await expect(frames.nth(1)).toHaveAttribute("src", TWITCH_PLAYER);
  await expect(frames.nth(0)).toHaveAttribute("loading", "lazy");
  await expect(page.getByRole("button", { name: /^Play/ })).toHaveCount(0);
  await expect.poll(() => requested).toContain(YOUTUBE_PLAYER);
});

test("the view with autoload: false shows the placeholder and loads the player only after a click", async ({
  page,
}) => {
  const requested = await captureServices(page);
  await page.goto(EDITOR("content-richtextview--video-click-to-play"));

  const youtube = page.getByRole("button", { name: "Play YouTube video" });
  await expect(youtube).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(requested).toEqual([]);

  await youtube.click();
  await expect(page.locator("iframe")).toHaveAttribute("src", YOUTUBE_PLAYER_CLICKED);
  await expect.poll(() => requested).toContain(YOUTUBE_PLAYER_CLICKED);

  await page.getByRole("button", { name: "Play Twitch video" }).click();
  await expect(page.locator("iframe").nth(1)).toHaveAttribute(
    "src",
    "https://player.twitch.tv/?channel=aws&parent=127.0.0.1&autoplay=true"
  );
});

// ── Высота: блок не прыгает с приходом чанка и острова ──────────────────────

/**
 * Придержать запрос модуля, пока тест не отпустит: до этого на странице виден
 * серверный блок (Скелет Редактора, HTML `RichTextView`), после — плеер.
 */
async function holdModule(page: Page, pattern: string) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(pattern, async (route) => {
    await gate;
    await route.continue();
  });
  return release;
}

/** Высоты и ширины блоков `selector` — по раскладке, как их видит человек. */
async function boxes(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((nodes) =>
    nodes.map((node) => {
      const { width, height } = node.getBoundingClientRect();
      return { width, height };
    })
  );
}

for (const mode of [
  { name: "the player at once", view: "video", editor: "video", ready: "iframe" },
  {
    name: "autoload: false",
    view: "video-click-to-play",
    editor: "video-click-to-play",
    ready: "button",
  },
] as const) {
  const arrived = (page: Page, scope: Page | ReturnType<Page["locator"]> = page) =>
    mode.ready === "iframe"
      ? scope.locator("iframe").first()
      : scope.getByRole("button", { name: "Play YouTube video" });

  test(`the view, ${mode.name}: mounting the island does not change the height of the block`, async ({
    page,
  }) => {
    await captureServices(page);
    const release = await holdModule(page, "**/VideoIslandSlots*");
    await page.goto(EDITOR(`content-richtextview--${mode.view}`));

    // Остров ещё не пришёл: на странице серверный блок со ссылкой — рамка 16:9.
    const blocks = page.locator('div[data-block="video"]');
    await expect(blocks).toHaveCount(2);
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Play/ })).toHaveCount(0);
    await expect(blocks.first().getByRole("link")).toBeVisible();
    const before = await boxes(page, 'div[data-block="video"]');
    for (const box of before) expect(box.width / box.height).toBeCloseTo(16 / 9, 1);

    release();
    await expect(arrived(page)).toBeVisible();
    const after = await boxes(page, 'div[data-block="video"]');
    expect(after).toEqual(before);

    // Плеер после щелчка занимает ту же рамку.
    if (mode.ready === "button") {
      await page.getByRole("button", { name: "Play YouTube video" }).click();
      await expect(page.locator("iframe")).toHaveCount(1);
      expect(await boxes(page, 'div[data-block="video"]')).toEqual(before);
    }
  });

  test(`the editor, ${mode.name}: the chunk arriving does not change the height of the video block`, async ({
    page,
  }) => {
    await captureServices(page);
    const release = await holdModule(page, "**/videoChunk*");
    await page.goto(EDITOR(`inputs-richtexteditor--${mode.editor}`));

    // Чанка нет: Скелет, блок видео — рамка 16:9 со ссылкой внутри.
    const skeleton = page.locator('div[data-block="video"]');
    await expect(skeleton).toHaveCount(2);
    await expect(page.getByRole("textbox", { name: "Document" })).toHaveCount(0);
    const before = await boxes(page, 'div[data-block="video"]');
    for (const box of before) expect(box.width / box.height).toBeCloseTo(16 / 9, 1);

    release();
    const field = page.getByRole("textbox", { name: "Document" });
    await expect(arrived(page, field)).toBeVisible();
    const after = await boxes(page, "[data-video-player]");
    expect(after.map((box) => Math.round(box.height))).toEqual(
      before.map((box) => Math.round(box.height))
    );
    expect(after.map((box) => Math.round(box.width))).toEqual(
      before.map((box) => Math.round(box.width))
    );
  });
}
