// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { FileDropzone } from "../src/components/inputs/FileDropzone.js";
import { DEFAULT_MESSAGES } from "../src/i18n/defaults.js";
import { messages as ru } from "../src/locales/ru.js";

afterEach(cleanup);

function file(name: string, type: string, size: number): File {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

test("a rejected file is shown with a reason instead of vanishing", async () => {
  const user = userEvent.setup();
  const onFiles = vi.fn();

  render(<FileDropzone accept="image/*" maxSize={1024} onFiles={onFiles} />);

  const field = document.querySelector('input[type="file"]') as HTMLInputElement;
  // Неподходящий ТИП через диалог выбора не проверить: `accept` у поля отсекает
  // такие файлы ещё в диалоге, и до компонента они не доходят — так же ведёт
  // себя браузер. Фильтр типа работает на пути перетаскивания, где ОС ничего
  // не отсекает; здесь остаётся предел размера.
  await user.upload(field, [
    file("small.png", "image/png", 100),
    file("huge.png", "image/png", 5000),
  ]);

  // Принятое уехало вызывающему...
  expect(onFiles).toHaveBeenCalledTimes(1);
  expect(onFiles.mock.calls[0]![0].map((f: File) => f.name)).toEqual(["small.png"]);

  // ...а про отклонённое сказано на экране, с причиной.
  expect(screen.getByText(/huge\.png — too large, 5 kB/)).toBeTruthy();
});

test("the rejection is announced aloud", async () => {
  const user = userEvent.setup();
  render(<FileDropzone accept="image/*" maxSize={1024} onFiles={() => {}} />);

  const field = document.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(field, [file("huge.png", "image/png", 99999)]);

  // Иначе пользователь узнает об отказе, только добравшись до этого места табом.
  expect(screen.getByRole("alert")).toBeTruthy();
});

test("the choose button really opens the dialog", async () => {
  const user = userEvent.setup();
  render(<FileDropzone onFiles={() => {}} />);

  const field = document.querySelector('input[type="file"]') as HTMLInputElement;
  const click = vi.spyOn(field, "click");

  await user.click(screen.getByRole("button", { name: "Choose files" }));

  // Проверять существование кнопки недостаточно: с обычной `<button>` она
  // выглядела рабочей и не открывала диалог ни разу — `FileTrigger` подключает
  // потомка через контекст react-aria, которого та не читает.
  expect(click).toHaveBeenCalledTimes(1);
});

test("a single-file zone does not accept a batch", async () => {
  const user = userEvent.setup();
  const onFiles = vi.fn();

  render(<FileDropzone multiple={false} onFiles={onFiles} />);

  const field = document.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(field, [file("a.png", "image/png", 10), file("b.png", "image/png", 10)]);

  // Через диалог выбора второй файл и не дойдёт: поле без `multiple` его
  // отсекает, как и браузер. Предел компонента виден на пути перетаскивания —
  // там ОС ничего не отсекает, и раньше все пять брошенных файлов уезжали
  // вызывающему вопреки пропу.
  expect(onFiles.mock.calls[0]![0].map((f: File) => f.name)).toEqual(["a.png"]);
  expect(field.multiple).toBe(false);
});

/**
 * ЧЕГО ЗДЕСЬ НЕТ — и почему.
 *
 * Обе правки волны 26 лежат на пути ПЕРЕТАСКИВАНИЯ: отказ `getFile()` и фильтр
 * типа (на пути диалога `accept` отсекает файл раньше компонента — об этом
 * говорит комментарий в первом тесте). Путь перетаскивания в jsdom не
 * воспроизводится: `DropZone` из react-aria ждёт настоящих событий переноса с
 * `DataTransfer`, которого в jsdom по сути нет.
 *
 * Поэтому ниже проверяется то, что проверяемо без переноса: обе причины отказа
 * есть в каталоге и в обеих локалях — то есть русская строка на месте больше не
 * появится. Сам разбор дропа сторожит `tests-visual/`, где область уже есть.
 */
test("both drag-path rejection reasons come from the catalogue", () => {
  // `wrongType` заменил русскую строку, зашитую в компоненте; `unreadable` —
  // новая причина для файла, который не прочитался.
  expect(DEFAULT_MESSAGES.fileDropzone.wrongType).toBeTruthy();
  expect(DEFAULT_MESSAGES.fileDropzone.unreadable).toBeTruthy();
  expect(ru.fileDropzone.wrongType).toBeTruthy();
  expect(ru.fileDropzone.unreadable).toBeTruthy();
});
