// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Link } from "../src/components/content/Link.js";

afterEach(cleanup);

/*
 * No locale is connected here: since 2.0.0 the kit's fallback is English, so without a
 * provider the tests read the catalog's English label (`opensInNewTab` in
 * `src/i18n/defaults.ts`).
 */
test("an external link without a new tab gets no rel", () => {
  render(
    <Link external href="https://example.org">
      documentation
    </Link>
  );

  const link = screen.getByRole("link", { name: /documentation/ });
  // `noopener` protects against the opened tab's access to `window.opener`. No tab is
  // opened here, and a safeguard against a hole that does not exist only teaches one not
  // to read `rel` closely.
  expect(link.hasAttribute("rel")).toBe(false);
});

test("a new tab gets rel even without the external flag", () => {
  render(
    <Link target="_blank" href="/report">
      report
    </Link>
  );

  // The tag opens the hole, not the prop: `rel` is derived from `target`.
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

  // The external-link icon is hidden from the screen reader: it draws an arrow and does
  // not state a fact. The label states the fact.
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

  // `inline-flex` does not break between lines: a link of several words would move
  // whole to the next line or overflow the edge. That is, the `inline` variant would not
  // work exactly where it exists for.
  expect(container.firstElementChild!.className).not.toContain("inline-flex");
});

/**
 * Executable schemes do not reach the markup.
 *
 * The component already took on the link's safety (it derives `rel` from `target`), but
 * it did not look at the scheme: `href` went to `<a>` as is. A "website" field in a
 * profile, rendered as `<Link href={profile.website}>`, with the value `javascript:…`
 * gave a working link that runs code in the application's origin with the session cookie.
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
  // An image and a CSV are not code: blocking them would silently break a legitimate
  // download link.
  "data:image/png;base64,iVBORw0KGgo=",
  "data:text/csv,a,b,c",
])("an ordinary href %o passes through untouched", (href) => {
  render(<Link href={href}>Site</Link>);

  // A blocklist, not an allowlist: the application's own schemes pass through.
  expect(screen.getByText("Site").getAttribute("href")).toBe(href);
});

/**
 * An object `href` does not break rendering.
 *
 * `LinkProps` is polymorphic over `as`, and the prop's docstring explicitly promises that
 * with `next/link` the compiler accepts `{ pathname, query }`. A scheme check added without
 * narrowing the type called `.replace` on it: a `TypeError` on the very call style that the
 * polymorphism exists for.
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
