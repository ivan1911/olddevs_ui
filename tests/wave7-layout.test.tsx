// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { AspectRatio } from "../src/components/content/AspectRatio.js";
import { Kbd } from "../src/components/content/Kbd.js";
import { ScrollArea } from "../src/components/content/ScrollArea.js";
import { Separator } from "../src/components/content/Separator.js";
import { VisuallyHidden } from "../src/components/content/VisuallyHidden.js";

afterEach(cleanup);

test("the separator announces its role and orientation", () => {
  const { container } = render(<Separator orientation="vertical" />);

  // Ради роли компонент и взят у react-aria: рукописный `border-t` не
  // сообщает скринридеру ни границы группы, ни ориентации.
  const rule = container.firstElementChild!;
  expect(rule.getAttribute("role")).toBe("separator");
  expect(rule.getAttribute("aria-orientation")).toBe("vertical");
});

test("the scroll area is reachable from the keyboard", () => {
  const { container } = render(<ScrollArea label="List">content</ScrollArea>);

  // Прокручиваемый блок без фокуса недоступен тому, кто не пользуется мышью;
  // это же ловит axe правилом `scrollable-region-focusable`.
  const area = container.firstElementChild as HTMLElement;
  expect(area.tabIndex).toBe(0);
  expect(area.getAttribute("role")).toBe("region");
});

test("without a name the area does not pretend to be a region", () => {
  const { container } = render(<ScrollArea>content</ScrollArea>);

  // `role="region"` без имени скринридер объявляет пустым словом «регион».
  expect(container.firstElementChild!.getAttribute("role")).toBeNull();
});

test("a key is a kbd tag, not a span with a font", () => {
  const { container } = render(<Kbd>⌘</Kbd>);

  // Тег объявляет содержимое пользовательским вводом; span с моноширинным
  // шрифтом выглядит так же и не значит ничего.
  expect(container.firstElementChild!.tagName).toBe("KBD");
});

test("the aspect ratio goes into the style, not into a built class", () => {
  const { container } = render(<AspectRatio ratio={16 / 9} />);

  const box = container.firstElementChild as HTMLElement;
  // jsdom нормализует значение в пару «ширина / высота».
  expect(box.style.aspectRatio).toMatch(/^1\.777/);
});

test("hidden content stays in the accessibility tree", () => {
  render(
    <p>
      {/* `elementType="span"` обязателен внутри строки: по умолчанию
          react-aria рисует `<div>`, а `<div>` в `<p>` — невалидная
          вложенность. Тест был зелёным, а React писал об ошибке гидрации в
          stderr, и этого никто не видел. */}
      Drafts<VisuallyHidden elementType="span"> — eight of them</VisuallyHidden>
    </p>
  );

  // Не `display: none`: тот убирает узел из дерева вовсе, и подпись пропала бы
  // и для скринридера тоже.
  expect(screen.getByText("— eight of them")).toBeTruthy();
});
