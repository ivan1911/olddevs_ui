// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { UploadQueue, type UploadItem } from "../src/components/inputs/UploadQueue.js";
import { TONE_TOKENS } from "../src/lib/variants.js";

afterEach(cleanup);

const items: UploadItem[] = [
  { id: "1", name: "first.pdf", state: "success" },
  { id: "2", name: "second.docx", state: "running", progress: 40 },
  { id: "3", name: "third.jpg", state: "failed", meta: "The server rejected the file" },
];

test("the queue is a real named list", () => {
  render(<UploadQueue items={items} />);

  // Набор `div` не сообщает скринридеру ни того, что это очередь, ни того,
  // сколько в ней элементов.
  expect(screen.getByRole("list", { name: "Upload queue" })).toBeTruthy();
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
});

test("the summary is announced by a live region and counts partial success", () => {
  // Очередь ОТСТОЯВШАЯСЯ: с волны 26 объявляется итог, а не ход. Прежний
  // набор содержал `running`, и текст менялся на каждом переходе файла —
  // двенадцать файлов давали двенадцать сообщений подряд, а `polite` их не
  // схлопывает.
  render(
    <UploadQueue
      items={[
        { id: "1", name: "first.pdf", state: "success" },
        { id: "2", name: "second.docx", state: "success" },
        { id: "3", name: "third.jpg", state: "failed", meta: "The server rejected the file" },
      ]}
    />
  );

  // Частичный успех иначе виден только тому, кто просматривает список глазами.
  expect(screen.getByRole("status").textContent).toBe("2 of 3 uploaded, 1 failed");
});

test("without errors the summary says nothing about them", () => {
  render(<UploadQueue items={[{ id: "1", name: "a.pdf", state: "success" }]} />);
  expect(screen.getByRole("status").textContent).toBe("1 of 1 uploaded");
});

test("an empty queue yields no summary, but the region is mounted", () => {
  render(<UploadQueue items={[]} empty={<p>The queue is empty</p>} />);

  // «Ноль из нуля» — не сообщение. А область, вставленная вместе с текстом,
  // объявляется ненадёжно, поэтому она смонтирована всегда.
  expect(screen.getByRole("status").textContent).toBe("");
  expect(screen.getByText("The queue is empty")).toBeTruthy();
});

test("unknown progress differs from zero", () => {
  render(
    <UploadQueue
      items={[
        { id: "1", name: "a", state: "running", progress: null },
        { id: "2", name: "b", state: "running", progress: 0 },
      ]}
    />
  );

  const bars = screen.getAllByRole("progressbar");
  // `null` означает «сколько всего работы, неизвестно», и ARIA отличает это от
  // полосы на нуле отсутствием `aria-valuenow`.
  expect(bars[0]!.hasAttribute("aria-valuenow")).toBe(false);
  expect(bars[1]!.getAttribute("aria-valuenow")).toBe("0");
});

test("without progress there is no bar at all", () => {
  render(<UploadQueue items={[{ id: "1", name: "a", state: "pending" }]} />);
  expect(screen.queryByRole("progressbar")).toBeNull();
});

test("the bar name names the file, not a faceless upload", () => {
  render(
    <UploadQueue items={[{ id: "1", name: "estimate.xlsx", state: "running", progress: 10 }]} />
  );
  expect(screen.getByRole("progressbar", { name: "Uploading estimate.xlsx" })).toBeTruthy();
});

test("the kit invents neither a domain label nor domain actions", () => {
  render(
    <UploadQueue
      items={[
        {
          id: "1",
          name: "a",
          state: "failed",
          statusLabel: "Duplicate",
          actions: <button type="button">Retry</button>,
        },
      ]}
    />
  );

  // «Дубль» — знание приложения; кит хранит только механику состояния.
  expect(screen.getByText("Duplicate")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
});

test("the queue does not store itself", () => {
  const { rerender } = render(<UploadQueue items={items} />);
  expect(screen.getAllByRole("listitem")).toHaveLength(3);

  // Элементы приходят пропами: убрал снаружи — исчезли внутри.
  rerender(<UploadQueue items={items.slice(0, 1)} />);
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
});

test("each of the four states yields its own tone", () => {
  // Словарь общий с `Timeline` начиная с 3.0.0 (ADR-0031). До сведения у обоих
  // типов не было покрывающих тестов вовсе — ветка терялась бы молча.
  render(
    <UploadQueue
      items={[
        { id: "1", name: "pending", state: "pending", statusLabel: "queued" },
        { id: "2", name: "running", state: "running", statusLabel: "in progress" },
        { id: "3", name: "success", state: "success", statusLabel: "finished" },
        { id: "4", name: "failed", state: "failed", statusLabel: "broken" },
      ]}
    />
  );

  // Тона названы литерально — см. тот же тест у `Timeline`: ожидание, взятое
  // из проверяемой таблицы, делает гейт вечнозелёным.
  for (const [label, tone] of [
    ["queued", "neutral"],
    ["in progress", "accent"],
    ["finished", "success"],
    ["broken", "danger"],
  ] as const) {
    expect(screen.getByText(label).className).toContain(TONE_TOKENS[tone].fg);
  }
});

test("an unknown state does not break the queue", () => {
  // Та же защита, что у `Timeline`: потребитель на JS, состояния приходят с
  // бэкенда, и пятый их вид не должен стоить экрана. При сведении словарей
  // страховка обязана была уцелеть у обоих, а не только у ленты.
  render(
    <UploadQueue
      items={[
        { id: "1", name: "scan.pdf", state: "quarantined" as never, statusLabel: "quarantine" },
        { id: "2", name: "estimate.xlsx", state: "success" },
      ]}
      aria-label="Queue"
    />
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getByText("quarantine").className).toContain(TONE_TOKENS.neutral.fg);
});

/**
 * Объявляется устоявшийся итог, а не каждый промежуточный переход.
 *
 * Текст живой области менялся при каждом переходе файла в `success`/`failed`:
 * отправка двенадцати файлов давала двенадцать сообщений подряд. Очередь
 * `polite` их не схлопывает, и пользователь скринридера получал минуту
 * непрерывной речи вместо одного сообщения о результате.
 */
test("a queue still running announces nothing", () => {
  render(
    <UploadQueue
      items={[
        { id: "1", name: "a.png", state: "success", progress: 100 },
        { id: "2", name: "b.png", state: "running", progress: 40 },
      ]}
    />
  );

  expect(screen.getByRole("status").textContent).toBe("");
});

test("the summary appears once the queue has settled", () => {
  render(
    <UploadQueue
      items={[
        { id: "1", name: "a.png", state: "success", progress: 100 },
        { id: "2", name: "b.png", state: "failed", progress: 100 },
      ]}
    />
  );

  expect(screen.getByRole("status").textContent).toContain("1");
});

/**
 * Тон статуса отдельно от подписи: «Дубль» при технически успешной загрузке —
 * предупреждение, а не успех. Заказчик намеренно не заполнял `statusLabel`,
 * потому что бейдж горел зелёным.
 */
test("a domain tone overrides the badge tone derived from the state", () => {
  render(
    <UploadQueue
      items={[
        { id: "1", name: "a.png", state: "success", statusLabel: "Duplicate", tone: "warning" },
      ]}
    />
  );

  const badge = screen.getByText("Duplicate");
  expect(badge.className).toContain(TONE_TOKENS.warning.fg);
  expect(badge.className).not.toContain(TONE_TOKENS.success.fg);
});

test("without a tone the badge follows the state, as before", () => {
  render(
    <UploadQueue items={[{ id: "1", name: "a.png", state: "success", statusLabel: "Done" }]} />
  );

  expect(screen.getByText("Done").className).toContain(TONE_TOKENS.success.fg);
});

test("an unknown state with a tone takes the tone; without it, stays neutral", () => {
  render(
    <UploadQueue
      items={[
        {
          id: "1",
          name: "scan.pdf",
          state: "quarantined" as never,
          statusLabel: "Flagged",
          tone: "danger",
        },
        { id: "2", name: "doc.pdf", state: "quarantined" as never, statusLabel: "Unknown" },
      ]}
    />
  );

  expect(screen.getByText("Flagged").className).toContain(TONE_TOKENS.danger.fg);
  expect(screen.getByText("Unknown").className).toContain(TONE_TOKENS.neutral.fg);
});

test("an unknown tone is ignored instead of breaking the queue", () => {
  // Потребитель на JS собирает тон из своего словаря статусов: опечатка или
  // пятый вид тона не должны стоить экрана (та же страховка, что у `state`).
  render(
    <UploadQueue
      items={[
        { id: "1", name: "a.png", state: "success", statusLabel: "Odd", tone: "info" as never },
      ]}
    />
  );

  expect(screen.getByText("Odd").className).toContain(TONE_TOKENS.success.fg);
});

test("the failed meta text follows the state, not the tone", () => {
  render(
    <UploadQueue
      items={[
        {
          id: "1",
          name: "a.png",
          state: "failed",
          tone: "neutral",
          statusLabel: "Skipped",
          meta: "The server rejected the file",
        },
        {
          id: "2",
          name: "b.png",
          state: "success",
          tone: "danger",
          statusLabel: "Suspicious",
          meta: "Looks fine to the server",
        },
      ]}
    />
  );

  // Текст ошибки — механика отправки: упало — значит упало, что бы ни говорил
  // домен. И наоборот: красный бейдж не превращает успешный элемент в сбой.
  expect(screen.getByText("The server rejected the file").className).toContain(
    TONE_TOKENS.danger.fg
  );
  expect(screen.getByText("Looks fine to the server").className).not.toContain(
    TONE_TOKENS.danger.fg
  );
});

test("the progress bar shares the tone of the badge in the same row", () => {
  render(
    <UploadQueue
      items={[
        {
          id: "1",
          name: "a.png",
          state: "success",
          progress: 100,
          statusLabel: "Duplicate",
          tone: "warning",
        },
      ]}
    />
  );

  // Строка одного цвета: зелёная полоса рядом с жёлтым бейджем говорит два
  // разных слова об одном и том же элементе.
  const bar = screen.getByRole("progressbar");
  expect(bar.querySelector(`.${TONE_TOKENS.warning.dotBg}`)).not.toBeNull();
  expect(bar.querySelector(`.${TONE_TOKENS.success.dotBg}`)).toBeNull();
});

test("a state named after an inherited object key stays neutral", () => {
  // Состояние приходит с бэкенда: `"constructor"` нашлось бы в обычном объекте
  // унаследованной функцией, и бейдж упал бы на несуществующем токене.
  render(
    <UploadQueue
      items={[
        {
          id: "1",
          name: "a.png",
          state: "constructor" as never,
          statusLabel: "Weird",
          progress: 5,
        },
      ]}
    />
  );

  expect(screen.getByText("Weird").className).toContain(TONE_TOKENS.neutral.fg);
});
