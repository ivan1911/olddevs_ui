// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Image } from "../src/components/content/Image.js";

afterEach(() => {
  cleanup();
  // Without this, the spy on `complete` survives a failed assertion and leaks into the
  // next test: that test sees "the image is already ready" and fails for a reason
  // unrelated to what it checks.
  vi.restoreAllMocks();
});

test("a broken URL shows the fallback instead of the browser broken-image icon", () => {
  const { container } = render(<Image src="/none.png" alt="Night city" />);

  fireEvent.error(container.querySelector("img") as HTMLImageElement);

  // The image itself is gone from the markup; a fallback takes its place, and it is
  // named: a load failure keeps the object's label (the icon inside keeps its own
  // `aria-hidden`, since it is decorative).
  expect(container.querySelector("img")).toBeNull();
  expect(screen.getByRole("img", { name: "Night city" })).toBeTruthy();
});

test("changing the URL resets the failure", () => {
  const { container, rerender } = render(<Image src="/none.png" alt="Photo" />);
  fireEvent.error(container.querySelector("img") as HTMLImageElement);
  expect(container.querySelector("img")).toBeNull();

  // Without a reset, a node reused for another image (as a virtualized grid does)
  // would keep the fallback forever.
  rerender(<Image src="/other.png" alt="Photo" />);
  expect(container.querySelector("img")).toBeTruthy();
});

test("an empty URL goes straight to the fallback, without trying to load", () => {
  const { container } = render(<Image src={null} alt="No preview" />);
  expect(container.querySelector("img")).toBeNull();
  // There is no request, and the object still has a name.
  expect(screen.getByRole("img", { name: "No preview" })).toBeTruthy();
});

test("loading defaults are set and laziness can be turned off", () => {
  const { rerender } = render(<Image src="/a.png" alt="a" />);
  const img = screen.getByRole("img", { name: "a" });
  expect(img.getAttribute("loading")).toBe("lazy");
  expect(img.getAttribute("decoding")).toBe("async");

  // An above-the-fold image deferred by the browser hurts LCP.
  rerender(<Image src="/a.png" alt="a" eager />);
  expect(screen.getByRole("img", { name: "a" }).getAttribute("loading")).toBe("eager");
});

test("custom onLoad and onError are called alongside the internal ones", () => {
  const onError = vi.fn();
  const onLoad = vi.fn();
  const { rerender } = render(<Image src="/a.png" alt="a" onError={onError} onLoad={onLoad} />);

  fireEvent.load(screen.getByRole("img", { name: "a" }));
  expect(onLoad).toHaveBeenCalledTimes(1);

  rerender(<Image src="/b.png" alt="a" onError={onError} onLoad={onLoad} />);
  fireEvent.error(screen.getByRole("img", { name: "a" }));
  expect(onError).toHaveBeenCalledTimes(1);
});

test("a cached image leaves no dead skeleton", () => {
  // An image that is already loaded fires no `load` event at all, and without checking
  // `complete` the skeleton would stay in the markup forever. On the library screen this
  // happened to 33 of 58 tiles. It was not visible to the eye, because the skeleton sits
  // under an opaque preview.
  const complete = vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  const natural = vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(320);

  const { container } = render(<Image src="/cached.png" alt="a" />);
  expect(container.querySelector(".skeleton")).toBeNull();
  expect(screen.getByRole("img", { name: "a" })).toBeTruthy();

  complete.mockRestore();
  natural.mockRestore();
});

test("a complete but zero-sized image counts as a failure right away", () => {
  const complete = vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  const natural = vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);

  const { container } = render(<Image src="/none.png" alt="a" />);
  expect(container.querySelector("img")).toBeNull();

  complete.mockRestore();
  natural.mockRestore();
});

test("the skeleton goes away after loading", () => {
  const { container } = render(<Image src="/a.png" alt="a" />);
  expect(container.querySelector(".skeleton")).toBeTruthy();

  fireEvent.load(screen.getByRole("img", { name: "a" }));
  expect(container.querySelector(".skeleton")).toBeNull();
});

test("intrinsic does not impose the box size on the image", () => {
  // A defect found in review: in `fill` mode the image gets h-full/w-full, that is,
  // percentages of the box. A box without its own size resolves them to zero, so the
  // frame preview collapsed to 0×0, and lazy loading never started at all, because
  // there was nothing to show.
  const { container, rerender } = render(<Image src="/a.png" alt="Frame" sizing="intrinsic" />);
  const img = screen.getByRole("img", { name: "Frame" });
  expect(img.className).not.toContain("h-full");
  expect(img.className).not.toContain("w-full");
  expect((container.firstElementChild as HTMLElement).className).toContain("inline-block");

  rerender(<Image src="/a.png" alt="Frame" />);
  expect(screen.getByRole("img", { name: "Frame" }).className).toContain("h-full");
});

test("intrinsic draws no skeleton: there is nothing to stretch it to", () => {
  const { container } = render(<Image src="/a.png" alt="" sizing="intrinsic" />);
  expect(container.querySelector(".skeleton")).toBeNull();
});

test("a meaningful label survives a load failure", () => {
  const { container } = render(<Image src="/none.png" alt="Night city" />);
  fireEvent.error(container.querySelector("img") as HTMLImageElement);

  // The image is gone, but the object stays named: otherwise the failure turns it into
  // an empty spot that the screen reader does not announce.
  expect(screen.getByRole("img", { name: "Night city" })).toBeTruthy();
});

test("a decorative image stays decorative even in failure", () => {
  const { container } = render(<Image src="/none.png" alt="" />);
  fireEvent.error(container.querySelector("img") as HTMLImageElement);

  expect(screen.queryByRole("img")).toBeNull();
  expect(container.querySelector("[aria-hidden]")).toBeTruthy();
});

test("the default fallback carries its own backdrop, a custom one does not", () => {
  // The wrapper provides only the place and the centering; a custom fallback is painted
  // by the caller (the category letter, by its name), and the default backdrop would
  // cover it. Review found a mismatch between the implementation and the docs: there was
  // no backdrop at all, while the component's page promised "an icon on a muted backdrop".
  const { container, rerender } = render(<Image src={null} alt="" />);
  expect(container.querySelector(".bg-bg-2")).toBeTruthy();

  rerender(<Image src={null} alt="" fallback={<span data-testid="custom">No preview</span>} />);
  expect(container.querySelector(".bg-bg-2")).toBeNull();
  expect(screen.getByTestId("custom")).toBeTruthy();
});
