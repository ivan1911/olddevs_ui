// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Link } from "../src/components/content/Link.js";

afterEach(cleanup);

/*
 * Русская локаль подключается ЯВНО: с 2.0.0 фолбэк кита английский, и тест,
 * ожидающий русскую подпись без провайдера, проверял бы не поведение, а язык
 * дефолта. Ожидания при этом не тронуты — строки те же, что были зашиты в
 * компонентах до переезда в каталог, и это здесь и доказывается.
 */
test("an external link without a new tab gets no rel", () => {
  render(
    <Link external href="https://example.org">
      documentation
    </Link>
  );

  const link = screen.getByRole("link", { name: /documentation/ });
  // `noopener` защищает от доступа открытой вкладки к `window.opener`. Вкладка
  // здесь не открывается, и оберег от несуществующей дыры только приучает
  // не вчитываться в `rel`.
  expect(link.hasAttribute("rel")).toBe(false);
});

test("a new tab gets rel even without the external flag", () => {
  render(
    <Link target="_blank" href="/report">
      report
    </Link>
  );

  // Дыру открывает тег, а не проп: `rel` выводится из `target`.
  expect(screen.getByRole("link", { name: /report/ })).toHaveProperty("rel", "noopener noreferrer");
});

test("a custom rel is not overwritten", () => {
  render(
    <Link target="_blank" rel="me" href="https://example.org">
      profile
    </Link>
  );

  expect(screen.getByRole("link", { name: /profile/ })).toHaveProperty("rel", "me");
});

test("a new tab is announced aloud", () => {
  render(
    <Link target="_blank" href="/report">
      report
    </Link>
  );

  // Значок внешней ссылки скрыт от скринридера — он рисует стрелку, а не
  // сообщает факт. Факт сообщает подпись.
  expect(screen.getByRole("link", { name: /opens in a new tab/ })).toBeTruthy();
});

test("inline is underlined always, not only on hover", () => {
  const { container } = render(<Link href="#">inside a paragraph</Link>);

  const link = container.firstElementChild!;
  expect(link.className).toContain("underline");
  expect(link.className).not.toContain("hover:underline");
});

test("as substitutes the routing component", () => {
  render(
    <Link as="button" type="button">
      not a link at all
    </Link>
  );

  expect(screen.getByRole("button", { name: "not a link at all" })).toBeTruthy();
});

test("an inline link does not become an atomic flex box", () => {
  const { container } = render(<Link href="#">a long label inside a paragraph</Link>);

  // `inline-flex` не разрывается между строками: ссылка в несколько слов
  // уезжала бы целиком на следующую строку или вылезала за край — то есть
  // вариант `inline` не работал бы ровно там, ради чего заведён.
  expect(container.firstElementChild!.className).not.toContain("inline-flex");
});

/**
 * Исполняемые схемы не доходят до разметки.
 *
 * Компонент уже взял на себя безопасность ссылки — выводит `rel` из `target`, —
 * а схему не смотрел: `href` уходил на `<a>` как есть. Поле «сайт» в профиле,
 * нарисованное как `<Link href={profile.website}>`, со значением
 * `javascript:…` давало работающую ссылку, исполняющую код в origin приложения
 * с сессионной кукой.
 */
test.each([
  "javascript:fetch('/api/keys')",
  "JavaScript:alert(1)",
  "java\tscript:alert(1)",
  " javascript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "data:image/svg+xml,<svg onload=alert(1)>",
  "DATA:TEXT/HTML,<script>alert(1)</script>",
  "vbscript:msgbox(1)",
])("an executable href %o does not reach the markup", (href) => {
  render(<Link href={href}>Site</Link>);

  expect(screen.getByText("Site").getAttribute("href")).toBeNull();
});

test.each([
  "https://example.com",
  "http://example.com",
  "/catalogue",
  "#section",
  "mailto:hi@example.com",
  "tel:+79161234567",
  "slack://channel?id=1",
  // Картинка и CSV кодом не являются: блокировать их значит молча ломать
  // законную ссылку на скачивание.
  "data:image/png;base64,iVBORw0KGgo=",
  "data:text/csv,a,b,c",
])("an ordinary href %o passes through untouched", (href) => {
  render(<Link href={href}>Site</Link>);

  // Чёрный список, а не белый: собственные схемы приложений проходят.
  expect(screen.getByText("Site").getAttribute("href")).toBe(href);
});

/**
 * Объектный `href` не роняет рендер.
 *
 * `LinkProps` полиморфны по `as`, и докстрока пропа прямо обещает, что с
 * `next/link` компилятор примет `{ pathname, query }`. Проверка схемы,
 * добавленная без сужения типа, звала на нём `.replace` — `TypeError` на том
 * самом способе вызова, ради которого полиморфность и заведена.
 */
test("an object href goes through untouched", () => {
  function FakeNextLink({ href, children, ...rest }: { href: unknown; children?: unknown }) {
    return (
      <a href={typeof href === "string" ? href : "/orders?id=7"} {...rest}>
        {children as never}
      </a>
    );
  }

  expect(() =>
    render(
      <Link as={FakeNextLink} href={{ pathname: "/orders", query: { id: 7 } }}>
        Orders
      </Link>
    )
  ).not.toThrow();

  expect(screen.getByText("Orders").getAttribute("href")).toBe("/orders?id=7");
});
