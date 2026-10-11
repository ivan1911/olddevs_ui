// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { MediaCard } from "../src/components/content/MediaCard.js";

afterEach(cleanup);

const preview = <div data-testid="preview">image</div>;

test("without selection props the selection axis is absent from the markup", () => {
  render(<MediaCard preview={preview} title="Frame" />);

  // Плитка, умеющая всё сразу, тащит в разметку нерабочее.
  expect(screen.queryByRole("button")).toBeNull();
});

test("selection is announced by state, not by a border", async () => {
  const user = userEvent.setup();
  const onSelectedChange = vi.fn();
  const { rerender } = render(
    <MediaCard preview={preview} selected={false} onSelectedChange={onSelectedChange} />
  );

  const button = screen.getByRole("button", { name: "Select" });
  // Рамка — сигнал для глаз; человек, который её не видит, иначе о выборе не
  // узнает вовсе.
  expect(button.getAttribute("aria-pressed")).toBe("false");

  await user.click(button);
  expect(onSelectedChange).toHaveBeenCalledWith(true);

  rerender(<MediaCard preview={preview} selected onSelectedChange={onSelectedChange} />);
  expect(screen.getByRole("button", { name: "Select" }).getAttribute("aria-pressed")).toBe("true");
});

test("the button label does not repeat the state", () => {
  render(<MediaCard preview={preview} selected onSelectedChange={() => {}} />);

  // `aria-pressed` уже объявлен: «Выбрано, снять выбор» прозвучало бы дважды.
  const button = screen.getByRole("button");
  expect(button.getAttribute("aria-label")).toBe("Select");
});

test("a custom select label overrides the catalog", () => {
  render(<MediaCard preview={preview} onSelectedChange={() => {}} selectLabel="Mark the frame" />);
  expect(screen.getByRole("button", { name: "Mark the frame" })).toBeTruthy();
});

test("overlay actions are reachable from the keyboard, not only on hover", async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();
  render(
    <MediaCard
      preview={preview}
      actions={
        <button type="button" onClick={onClick}>
          Download
        </button>
      }
    />
  );

  // Оверлей на `display: none` под `:hover` для клавиатуры недостижим вовсе —
  // это не «менее удобно», а «нельзя пользоваться». Здесь прячется прозрачность.
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Download" }));
  await user.keyboard("{Enter}");
  expect(onClick).toHaveBeenCalledTimes(1);
});

test("the preview keeps the given ratio", () => {
  const { container } = render(<MediaCard preview={preview} ratio={16 / 9} />);

  // Пропорцию держит существующий `AspectRatio`; своей плитка не пишет.
  const box = container.querySelector('[style*="aspect-ratio"]') as HTMLElement;
  expect(box).toBeTruthy();
  expect(screen.getByTestId("preview")).toBeTruthy();
});

test("badges sit above the preview and do not intercept the pointer", () => {
  render(<MediaCard preview={preview} badges={<span>Duplicate</span>} />);

  const badge = screen.getByText("Duplicate").parentElement!;
  // Иначе бейдж закрывал бы клик по самой плитке.
  expect(badge.className).toContain("pointer-events-none");
  expect(badge.className).toContain("absolute");
});

test("the title and the second line are optional", () => {
  const { container } = render(<MediaCard preview={preview} />);
  // Пустая полоска под превью выглядела бы обрезанной подписью.
  expect(container.textContent).toBe("image");
});

/**
 * Невидимый оверлей не ловит касания.
 *
 * Панель действий всегда в разметке и прячется прозрачностью — а `opacity` на
 * попадание указателя не влияет. Соседний блок бейджей `pointer-events-none`
 * получил, оверлей нет: на телефоне `:hover` не срабатывает, кнопки навсегда
 * прозрачны, но касание правого верхнего угла плитки попадало в невидимую
 * кнопку выбора вместо перехода по плитке. Пользователь выбирал элемент, не
 * поняв, что нажал.
 */
test("the hidden action overlay does not swallow a tap", () => {
  const onSelectedChange = vi.fn();
  const { container } = render(
    <MediaCard
      title="Sunset"
      preview={<span>preview</span>}
      selected={false}
      onSelectedChange={onSelectedChange}
    />
  );

  const overlay = container.querySelector(".opacity-0");
  expect(overlay).not.toBeNull();
  expect(overlay?.className).toContain("pointer-events-none");
});

test("the overlay accepts pointers once it is shown", () => {
  const { container } = render(
    <MediaCard title="Sunset" preview={<span>preview</span>} selected onSelectedChange={() => {}} />
  );

  // Выбранная плитка держит оверлей открытым — значит и указатель ему возвращён.
  const overlay = container.querySelector("[class*='opacity-100']");
  expect(overlay?.className).toContain("pointer-events-auto");
});

test("inside a grid `selected` alone draws the state and keeps the overlay open", () => {
  // Выбор у сетки (`VirtualGrid`), карточка — показ: `selected` без
  // `onSelectedChange`. Рамка и открытый оверлей с флажком сетки обязаны быть —
  // иначе выбранную плитку видно только под курсором (OLDSUI-199).
  const { container } = render(
    <MediaCard preview={preview} selected actions={<span>flag</span>} />
  );
  const card = container.firstElementChild!;
  expect(card.className).toContain("border-accent-strong");
  expect(screen.getByText("flag").parentElement!.className).toContain("opacity-100");
  // Кнопки выбора самой карточки нет: оси у неё нет.
  expect(screen.queryByRole("button", { name: "Select" })).toBeNull();
});

test("without `selected` there is no selection frame", () => {
  const { container } = render(<MediaCard preview={preview} actions={<span>flag</span>} />);
  expect(container.firstElementChild!.className).not.toContain("border-accent-strong");
});
