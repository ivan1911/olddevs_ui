import type { Page } from "@playwright/test";

/**
 * Requests to YouTube and Twitch in the browser tests never reach the network (OLDSUI-287):
 * the player mounts right away, and without interception any story with a video would load
 * the real player, so the snapshot would depend on a third-party service and the run on the
 * internet. The response is an empty page.
 */
const SERVICES = /(youtube-nocookie\.com|youtube\.com|twitch\.tv)/;

/** Intercept requests to video services. Returns the list of addresses that would have gone out to the network. */
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
