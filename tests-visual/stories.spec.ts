import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Визуальный бейзлайн: снимок каждой истории витрины в каждой теме.
 *
 * Зачем именно так, а не скриншоты экранов приложения: экраны требуют бэкенда
 * и живых данных, поэтому их снимки менялись бы от прогона к прогону по причинам,
 * не связанным с кодом. Истории детерминированы.
 *
 * Тема задаётся через URL-параметр `globals` — до первого рендера. Менять её
 * после загрузки страницы нельзя: Chromium пропагирует наследуемые CSS-переменные
 * в поддерево на следующем пересчёте стилей, и снимок, сделанный сразу после
 * переключения, покажет старую тему.
 */

type Entry = { id: string; name: string; title: string; type: string; tags?: string[] };

const index = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../storybook-static/index.json"), "utf8")
) as { entries: Record<string, Entry> };

/**
 * Снимаются только истории ЯДРА.
 *
 * Метка `periphery` — механизм двухуровневой планки из
 * ADR-0014:
 * у компонентов волн 8–11 почти нет собственных решений, их вид целиком собран
 * из атомов словаря, и снимок сторожил бы атомы — а они уже посторожены
 * снимками ядра. Ставится в `meta.tags` файла историй.
 *
 * Аудит axe и покрытие классов метку НЕ смотрят: они обязательны на обоих
 * уровнях, потому что ловят молчаливые поломки.
 */
const stories = Object.values(index.entries).filter(
  (e) => e.type === "story" && !e.tags?.includes("periphery")
);

const THEMES = ["dark", "light", "dim"] as const;

/**
 * Вьюпорт истории — меткой, а не параметром.
 *
 * Спек знает об истории только то, что лежит в `storybook-static/index.json`:
 * id, имя и метки. Параметры истории (`parameters`) туда не попадают, а метка —
 * попадает, поэтому история, которой нужна узкая ширина, говорит об этом
 * меткой `viewport-phone` (`tags` у истории). Без метки снимок на 1280×900
 * проекта.
 *
 * Зачем вообще. Слот `bottomBar` у `AppShell` прячет полосу с `md`, и на 1280px
 * снимок `WithBottomBar` не показывал встраивания полосы вовсе. На телефоне
 * вдобавок эмулируется вырез экрана (`env(safe-area-inset-bottom)` = 34px, как у
 * iPhone с жестовой полосой): без него отступ слота под вырез и подложку полосы
 * под ним снимок тоже не увидел бы. Эмуляция — через CDP: у Playwright своей
 * нет, проект — Chromium.
 *
 * Имя файла снимка от метки не меняется: история снимается в одном размере.
 */
const PHONE = { width: 375, height: 812 } as const;
const PHONE_SAFE_AREA_BOTTOM = 34;

async function applyViewport(page: Page, story: Entry) {
  if (!story.tags?.includes("viewport-phone")) return;
  await page.setViewportSize(PHONE);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", {
    insets: { bottom: PHONE_SAFE_AREA_BOTTOM },
  });
}

/**
 * ПРАВИЛО ПОКРЫТИЯ СНИМКАМИ, записанное явно — иначе оно расползётся.
 *
 * Осей теперь три: тема (3) × акцент (2) × бренд (2) = 12 наборов на историю.
 * Снимать все двенадцать — значит держать бейзлайн вчетверо больше нынешнего и
 * перечитывать вчетверо больше диффов при каждой правке токена. Цена не
 * окупается: бренд и акцент меняют цвет, а не геометрию, а цвет полностью
 * перебирает `npm run contrast` — и делает это по токенам, а не по тому, что
 * какая-то история случайно показала.
 *
 * Поэтому снимается:
 *   — каждая история ядра в трёх темах на синем акценте (полный набор);
 *   — одна история на фиолетовом акценте (доказывает, что ось работает);
 *   — одна история на бренде `teal` (доказывает, что оверлей работает).
 *
 * Расширять покрытие имеет смысл там, где бренд или акцент меняют РАЗМЕТКУ.
 * Сегодня таких мест нет, и появление первого — повод пересмотреть правило,
 * а не добавить снимок молча.
 */

/**
 * Ленивые чанки — меткой `network-idle`, по той же причине, что и вьюпорт:
 * спек видит только метки. Часть истории может догружаться уже после показа:
 * Карточка у текста (OLDSUI-113) запрашивает свой чанк только после Готовности
 * движка (OLDSUI-111). Пока чанк в пути, экран стоит неподвижно, и сравнение
 * снимков, которое ждёт лишь двух одинаковых кадров подряд, принимает поле без
 * Карточки за готовую историю. Тишина в сети — честный признак, что догружать
 * больше нечего. Только по метке: полсекунды ожидания на каждой из тысяч
 * историй стоили бы минут прогона.
 */
async function waitForLazyChunks(page: Page, story: Entry) {
  if (story.tags?.includes("network-idle")) await page.waitForLoadState("networkidle");
}

test("the showcase contains stories", () => {
  expect(stories.length).toBeGreaterThan(0);
});

/**
 * Готовность истории — сигнал самой витрины (`sb-show-main` на body), как в
 * `a11y.spec.ts`. Одной видимости холста мало: история пустого состояния
 * (`RichTextView` с пустым HTML) законно рисует контейнер нулевой высоты, и
 * Playwright такой холст видимым не считает — тест ждал бы до таймаута.
 */
async function waitForStory(page: Page, story: Entry) {
  await page.locator("body.sb-show-main").waitFor({ state: "attached" });
  await waitForLazyChunks(page, story);
  const canvas = page.locator("#storybook-root");
  await expect
    .poll(
      async () =>
        (await canvas.isVisible()) ||
        (await canvas.evaluate((node) => node.getBoundingClientRect().height === 0))
    )
    .toBe(true);
}

for (const story of stories) {
  for (const theme of THEMES) {
    // Акцент фиксирован: он влияет только на `--accent*`, и матрицы тонов
    // покрывают его отдельной проверкой ниже. Снимать все 6 сочетаний для
    // каждой истории — вчетверо больше файлов почти без прироста покрытия.
    test(`${story.id} — theme ${theme}`, async ({ page }) => {
      await applyViewport(page, story);
      await page.goto(`/iframe.html?id=${story.id}&globals=theme:${theme};accent:blue`);
      await waitForStory(page, story);
      await expect(page).toHaveScreenshot(`${story.id}--${theme}.png`, { fullPage: true });
    });
  }
}

// Акцент и бренд проверяем только на матрицах: остальные истории их не
// показывают. Матрица показывает все тона разом — если оверлей что-то сдвинул,
// видно здесь и больше нигде.
for (const story of stories.filter((s) => s.name.toLowerCase().includes("matrix"))) {
  test(`${story.id} — accent violet`, async ({ page }) => {
    await applyViewport(page, story);
    await page.goto(`/iframe.html?id=${story.id}&globals=theme:dark;accent:violet`);
    await waitForStory(page, story);
    await expect(page).toHaveScreenshot(`${story.id}--violet.png`, { fullPage: true });
  });

  test(`${story.id} — brand teal`, async ({ page }) => {
    await applyViewport(page, story);
    await page.goto(`/iframe.html?id=${story.id}&globals=theme:dark;accent:blue;brand:teal`);
    await waitForStory(page, story);
    await expect(page).toHaveScreenshot(`${story.id}--teal.png`, { fullPage: true });
  });
}
