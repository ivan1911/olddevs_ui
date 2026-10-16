import { expect, test, type Page } from "@playwright/test";
import { messages as ru } from "../src/locales/ru.js";

/**
 * Видео по ссылке в браузере (OLDSUI-281, ADR-0071): то, чего jsdom не видит, —
 * настоящая раскладка заглушки (16:9) и настоящий `iframe`. Запросы к YouTube и
 * Twitch перехватываются: сеть не ходит, тест сверяет адрес, который кит
 * загрузил бы, и считает запросы до щелчка (их должно быть ноль).
 */

const EDITOR = (id: string) => `/iframe.html?id=${id}&globals=theme:dark;accent:blue`;
const SERVICES = /(youtube-nocookie\.com|youtube\.com|twitch\.tv)/;

/** Перехватить запросы к сервисам видео: вернуть список адресов, ответ — пустая страница. */
async function captureServices(page: Page) {
  const urls: string[] = [];
  await page.route(SERVICES, (route) => {
    urls.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>v</title>",
    });
  });
  return urls;
}

/** Дать ProseMirror прочитать каретку после щелчка. */
async function settle(page: Page) {
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  );
}

const YOUTUBE_PLAYER = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1";

// ── Редактор ─────────────────────────────────────────────────────────────

test("the editor shows a placeholder with the service name and Play; nothing is requested before a click", async ({
  page,
}) => {
  const requested = await captureServices(page);
  await page.goto(EDITOR("inputs-richtexteditor--video"));
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

test("a click loads the nocookie YouTube player with a title, lazy loading and a referrer policy", async ({
  page,
}) => {
  const requested = await captureServices(page);
  await page.goto(EDITOR("inputs-richtexteditor--video"));
  const field = page.getByRole("textbox", { name: "Document" });

  await field.getByRole("button", { name: "Play YouTube video" }).click();
  const frame = field.locator("iframe");
  await expect(frame).toHaveCount(1);
  await expect(frame).toHaveAttribute("src", YOUTUBE_PLAYER);
  await expect(frame).toHaveAttribute("title", "YouTube video");
  await expect(frame).toHaveAttribute("loading", "lazy");
  await expect(frame).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  await expect(frame).toBeFocused();
  // Сеть: запрос ушёл ровно на адрес плеера, и только после щелчка.
  await expect.poll(() => requested).toContain(YOUTUBE_PLAYER);
  // Второй блок не тронут.
  await expect(field.getByRole("button", { name: "Play Twitch video" })).toBeVisible();
});

test("Twitch takes the host of the page as parent", async ({ page }) => {
  const requested = await captureServices(page);
  await page.goto(EDITOR("inputs-richtexteditor--video"));
  const field = page.getByRole("textbox", { name: "Document" });

  await field.getByRole("button", { name: "Play Twitch video" }).click();
  const frame = field.locator("iframe");
  await expect(frame).toHaveAttribute(
    "src",
    "https://player.twitch.tv/?video=1234567890&parent=127.0.0.1&autoplay=true"
  );
  await expect(frame).toHaveAttribute("title", "Twitch video");
  await expect
    .poll(() => requested.some((url) => url.startsWith("https://player.twitch.tv/")))
    .toBe(true);
});

test("the insert menu takes a link of either service; a foreign link is an error in the field", async ({
  page,
}) => {
  await captureServices(page);
  await page.goto(EDITOR("inputs-richtexteditor--video"));
  const field = page.getByRole("textbox", { name: "Document" });

  // Виды узлов монтируются следом за полем: щелчок до них попал бы в сдвигающуюся раскладку.
  await expect(field.getByRole("button", { name: "Play Twitch video" })).toBeVisible();
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
  await expect(field.getByRole("button", { name: "Play YouTube video" })).toHaveCount(2);
  // Вид узла не пишет `data-*`: блок виден по ссылке в заглушке (канонический вид).
  await expect(
    field.locator("[data-video-player]", { hasText: "https://www.youtube.com/watch?v=9bZkp7q19f0" })
  ).toHaveCount(1);
});

test("a bare link pasted into an empty paragraph becomes a placeholder", async ({ page }) => {
  await captureServices(page);
  await page.goto(EDITOR("inputs-richtexteditor--video"));
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

test("the russian catalog names the placeholder and the player", async ({ page }) => {
  await captureServices(page);
  await page.goto(EDITOR("inputs-richtexteditor--video-russian"));
  const field = page.getByRole("textbox", { name: "Document" });

  await field
    .getByRole("button", { name: ru.editor.videoPlayLabel({ service: "YouTube" }) })
    .click();
  await expect(field.locator("iframe")).toHaveAttribute(
    "title",
    ru.editor.videoPlayer({ service: "YouTube" })
  );
});

test("a disabled service: the block of the other one is only its link", async ({ page }) => {
  await captureServices(page);
  await page.goto(EDITOR("inputs-richtexteditor--video-youtube-only"));
  const field = page.getByRole("textbox", { name: "Document" });

  await expect(field.getByRole("button", { name: "Play YouTube video" })).toBeVisible();
  await expect(field.getByRole("button", { name: "Play Twitch video" })).toHaveCount(0);
  await expect(
    field.getByRole("link", { name: "https://www.twitch.tv/videos/1234567890" })
  ).toBeVisible();
});

// ── Просмотр ─────────────────────────────────────────────────────────────

test("the view shows the placeholder in place of the link and loads the player only after a click", async ({
  page,
}) => {
  const requested = await captureServices(page);
  await page.goto(EDITOR("content-richtextview--video"));

  const youtube = page.getByRole("button", { name: "Play YouTube video" });
  await expect(youtube).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(requested).toEqual([]);

  await youtube.click();
  await expect(page.locator("iframe")).toHaveAttribute("src", YOUTUBE_PLAYER);
  await expect.poll(() => requested).toContain(YOUTUBE_PLAYER);

  await page.getByRole("button", { name: "Play Twitch video" }).click();
  await expect(page.locator("iframe").nth(1)).toHaveAttribute(
    "src",
    "https://player.twitch.tv/?video=1234567890&parent=127.0.0.1&autoplay=true"
  );
});
