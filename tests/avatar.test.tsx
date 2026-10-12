// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Avatar } from "../src/components/content/Avatar.js";
import { AvatarGroup } from "../src/components/content/AvatarGroup.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const MD =
  "text-text-on-accent inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight h-7 w-7 text-[11px]";
const LG =
  "text-text-on-accent inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight h-16 w-16 text-[26px]";

test("without src the markup is exactly what it was before the photo axis", () => {
  // Контракт «ровно как раньше» закреплён побуквенно: разметка снята с
  // версии до оси `src`. Любое расхождение — это уже не добавочное изменение.
  const { container } = render(<Avatar name="Ada Lovelace" />);
  expect(container.innerHTML).toBe(
    `<span class="${MD}" style="background: linear-gradient(135deg, oklch(0.55 0.13 95), oklch(0.4 0.13 155));">AD</span>`
  );

  cleanup();
  const lg = render(<Avatar name="Ada Lovelace" size="lg" />);
  expect(lg.container.innerHTML).toBe(
    `<span class="${LG}" style="background: linear-gradient(135deg, oklch(0.55 0.13 95), oklch(0.4 0.13 155));">AD</span>`
  );
});

test("an empty or missing src is the same as no src", () => {
  const plain = render(<Avatar name="Ada Lovelace" />).container.innerHTML;
  cleanup();
  expect(render(<Avatar name="Ada Lovelace" src="" />).container.innerHTML).toBe(plain);
  cleanup();
  expect(render(<Avatar name="Ada Lovelace" src={undefined} />).container.innerHTML).toBe(plain);
});

test("without src the avatar exposes no role and its text is the initials", () => {
  const { container } = render(<Avatar name="Ada Lovelace" />);
  expect(screen.queryByRole("img")).toBeNull();
  expect(container.textContent).toBe("AD");
});

test("with src a photo is drawn and named by the person's name", () => {
  const { container } = render(<Avatar name="Ada Lovelace" src="/ada.png" />);

  const photo = screen.getByRole("img", { name: "Ada Lovelace" });
  expect(photo.tagName).toBe("IMG");
  expect(photo.getAttribute("src")).toBe("/ada.png");
  // Фото лежит в том же корне, что несёт подложку с оттенком имени: круг один,
  // меняется только его содержимое. Размер и форму круга стерегут снимки
  // `Photo` и `PhotoMatrix` — jsdom раскладки не считает.
  const root = container.firstElementChild as HTMLElement;
  expect(root.contains(photo)).toBe(true);
  expect(root.style.background).toContain("linear-gradient");
});

test("alt overrides the name, and an empty alt makes the photo decorative", () => {
  const { rerender } = render(<Avatar name="Ada Lovelace" src="/ada.png" alt="Ada at the desk" />);
  expect(screen.getByRole("img", { name: "Ada at the desk" })).toBeTruthy();

  // Имя человека написано рядом — фото не должно читаться вторым разом.
  rerender(<Avatar name="Ada Lovelace" src="/ada.png" alt="" />);
  expect(screen.queryByRole("img")).toBeNull();
});

test("without a name the photo is decorative: the placeholder initials are not a name", () => {
  render(<Avatar src="/anon.png" />);
  expect(screen.queryByRole("img")).toBeNull();
});

test("a broken URL falls back to the initials, still named, in the same circle", () => {
  const { container } = render(<Avatar name="Ada Lovelace" src="/none.png" size="lg" />);
  fireEvent.error(container.querySelector("img") as HTMLImageElement);

  expect(container.querySelector("img")).toBeNull();
  const fallback = screen.getByRole("img", { name: "Ada Lovelace" });
  expect(fallback.textContent).toBe("AD");
  // Подложка с оттенком из имени остаётся на корне: между загрузкой и
  // отказом круг не мигает другим цветом.
  const root = container.firstElementChild as HTMLElement;
  expect(root.contains(fallback)).toBe(true);
  expect(root.style.background).toContain("linear-gradient");
});

test("changing src after a failure tries the new photo", () => {
  const { container, rerender } = render(<Avatar name="Ada Lovelace" src="/none.png" />);
  fireEvent.error(container.querySelector("img") as HTMLImageElement);
  expect(container.querySelector("img")).toBeNull();

  rerender(<Avatar name="Ada Lovelace" src="/ada.png" />);
  expect(container.querySelector("img")).toBeTruthy();
});

test("while the photo loads there is no loading skeleton and no layout jump", () => {
  // Пока фото грузится, виден круг с оттенком имени (корень), а не мерцающий
  // скелетон поверх него.
  const { container } = render(<Avatar name="Ada Lovelace" src="/ada.png" />);
  expect(container.querySelector(".skeleton")).toBeNull();
  const root = container.firstElementChild as HTMLElement;
  expect(root.style.background).toContain("linear-gradient");
});

test("className, style and span attributes still reach the root with a photo", () => {
  const { container } = render(
    <Avatar name="Ada" src="/ada.png" className="extra" data-testid="av" style={{ opacity: 0.5 }} />
  );
  const root = screen.getByTestId("av");
  expect(root).toBe(container.firstElementChild);
  expect(root.className).toContain("extra");
  expect(root.style.opacity).toBe("0.5");
  expect(root.style.background).toContain("linear-gradient");
});

test("AvatarGroup keeps accepting plain strings", () => {
  render(<AvatarGroup names={["Ada Lovelace", "Grace Hopper", "Alan Turing"]} max={2} />);
  const group = screen.getByRole("img");
  expect(group.getAttribute("aria-label")).toBe("Ada Lovelace, Grace Hopper, Alan Turing");
  expect(group.textContent).toContain("+1");
});

test("AvatarGroup accepts members with photos and announces names only", () => {
  const { container } = render(
    <AvatarGroup
      names={[
        { name: "Ada Lovelace", src: "/ada.png" },
        "Grace Hopper",
        { name: "Alan Turing" },
        { name: "Barbara Liskov", src: "/barbara.png" },
      ]}
      max={3}
    />
  );

  const group = screen.getByRole("img");
  expect(group.getAttribute("aria-label")).toBe(
    "Ada Lovelace, Grace Hopper, Alan Turing, Barbara Liskov"
  );
  // Круги скрыты и с фото: список объявляет группа, а не каждое лицо.
  const photos = container.querySelectorAll("img");
  expect(photos.length).toBe(1);
  expect(photos[0]?.getAttribute("src")).toBe("/ada.png");
  expect(photos[0]?.closest("[aria-hidden='true']")).toBeTruthy();
  expect(screen.getAllByRole("img")).toHaveLength(1);
  expect(group.textContent).toContain("+1");
});

test("a photo in a group takes the same member slot as initials", () => {
  const group = render(
    <AvatarGroup names={[{ name: "Ada Lovelace", src: "/ada.png" }, "Grace Hopper"]} size="lg" />
  ).getByRole("img");
  // Каждый участник — свой скрытый узел группы с кругом внутри, фото или
  // инициалы. Размер и кольцо jsdom не видит: группа — периферия без снимков,
  // её вид смотрят руками в истории `Data → AvatarsWithPhotos`, а классы в CSS
  // стережёт покрытие классов.
  const members = [...group.children];
  expect(members).toHaveLength(2);
  expect(members[0]!.querySelector("img")?.getAttribute("src")).toBe("/ada.png");
  expect(members[1]!.textContent).toBe("GR");
  for (const member of members) expect(member.getAttribute("aria-hidden")).toBe("true");
});

test("the overlap in a group scales with the circle: md overlaps less than lg", () => {
  // Круг md — 28px: перекрытие в 8px плюс кольцо срезали инициалы и плюс у «+N».
  // Сколько срезано на экране, jsdom не видит — смотреть глазами: Content/AvatarGroup →
  // Avatars и AvatarsWithPhotos.
  const overlap = (size: "md" | "lg") => {
    const group = render(
      <AvatarGroup names={["Ada Lovelace", "Grace Hopper", "Al Turing"]} max={2} size={size} />
    ).getByRole("img");
    const circles = [...group.children].slice(1);
    cleanup();
    return circles.map((c) => [...c.classList].find((cls) => /^-ml-/.test(cls)));
  };
  expect(overlap("md")).toEqual(["-ml-1", "-ml-1"]);
  expect(overlap("lg")).toEqual(["-ml-2", "-ml-2"]);
});

test("a broken photo in a group falls back to initials", () => {
  const { container } = render(
    <AvatarGroup names={[{ name: "Ada Lovelace", src: "/none.png" }, "Grace Hopper"]} />
  );
  fireEvent.error(container.querySelector("img") as HTMLImageElement);
  expect(container.querySelector("img")).toBeNull();
  expect(container.textContent).toContain("AD");
  expect(screen.getByRole("img").getAttribute("aria-label")).toBe("Ada Lovelace, Grace Hopper");
});

test("an explicit aria-label still wins over the member names", () => {
  render(
    <AvatarGroup names={[{ name: "Ada Lovelace", src: "/ada.png" }]} aria-label="Reviewers" />
  );
  expect(screen.getByRole("img", { name: "Reviewers" })).toBeTruthy();
});

test("an empty aria-label is no name: the group keeps the member names", () => {
  render(<AvatarGroup names={["Ada Lovelace", "Grace Hopper"]} aria-label="" />);
  expect(screen.getByRole("img", { name: "Ada Lovelace, Grace Hopper" })).toBeTruthy();
});

test("initials are not duplicated in the text when the photo fails", () => {
  const { container } = render(<Avatar name="Ada Lovelace" src="/none.png" />);
  fireEvent.error(container.querySelector("img") as HTMLImageElement);
  // Невидимая распорка держит базовую линию, но не копирует инициалы.
  expect(screen.getAllByText("AD")).toHaveLength(1);
  expect(container.textContent?.replace("​", "")).toBe("AD");
});

test("the name-hue backdrop is removed under a loaded photo so transparency does not tint it", () => {
  const { container, rerender } = render(<Avatar name="Ada Lovelace" src="/ada.png" />);
  const root = container.firstElementChild as HTMLElement;
  expect(root.style.background).toContain("linear-gradient");

  fireEvent.load(container.querySelector("img") as HTMLImageElement);
  expect(root.style.background).toBe("");

  // Новый адрес — снова загрузка, и подложка возвращается.
  rerender(<Avatar name="Ada Lovelace" src="/grace.png" />);
  expect(root.style.background).toContain("linear-gradient");
});
