import type { Page } from "@playwright/test";

/**
 * Запросы к YouTube и Twitch в браузерных тестах никогда не доходят до сети
 * (OLDSUI-287): плеер встаёт сразу, и без перехвата любая история с видео
 * тянула бы настоящий плеер — снимок зависел бы от чужого сервиса, а прогон от
 * интернета. Ответ — пустая страница.
 */
const SERVICES = /(youtube-nocookie\.com|youtube\.com|twitch\.tv)/;

/** Перехватить запросы к сервисам видео. Возвращает список адресов, которые ушли бы в сеть. */
export async function stubVideoServices(page: Page): Promise<string[]> {
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
