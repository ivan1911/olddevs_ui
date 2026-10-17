// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { Node } from "@tiptap/core";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { RICH_TEXT_PRESETS, RichTextEditor, type CustomTool } from "../src/editor/index.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { testBoxTool, testLazyTool } from "./editor-test-tools.js";

/**
 * Editor errors for the developer (`devError`, `docs/conventions.md`, section
 * 'Warnings in development mode'): the field shows the author a line
 * from the catalog, and the cause goes to the console: in development, once per text, with
 * the component name and the exception as a separate argument.
 *
 * Through the public `RichTextEditor`: a set whose Schema the engine did not build, and
 * an Extensions loader that failed.
 */

let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetDevWarnings();
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const broken: CustomTool = {
  ...testBoxTool,
  engine: [Node.create({ name: "test_box", content: "test_missing+" })],
};

const renderBroken = () =>
  render(<RichTextEditor aria-label="Body" tools={[...RICH_TEXT_PRESETS.basic, broken]} />);

/** The loaders' promises and the Editor's effects have settled. */
const settle = () =>
  act(async () => void (await new Promise((resolve) => setTimeout(resolve, 10))));

test("in development the error names the component and passes the exception apart", () => {
  renderBroken();

  expect(screen.getByRole("alert").textContent).toMatch(/couldn't start/);
  expect(error).toHaveBeenCalledWith(
    "RichTextEditor: custom tools: the schema failed to build",
    expect.any(Error)
  );
});

test("the same error is shown once, however many fields hit it", () => {
  renderBroken();
  renderBroken();

  expect(error).toHaveBeenCalledTimes(1);
});

test("a failed loader is reported with its exception, not with its text", async () => {
  const lazy = testLazyTool();
  render(<RichTextEditor aria-label="Body" tools={[lazy.tool]} />);
  lazy.reject();
  await settle();

  expect(error).toHaveBeenCalledWith(
    "RichTextEditor: a tool loader failed",
    expect.objectContaining({ message: "chunk failed" })
  );
});

test("production stays silent: the field still shows its error", () => {
  vi.stubEnv("NODE_ENV", "production");
  renderBroken();

  expect(screen.getByRole("alert").textContent).toMatch(/couldn't start/);
  expect(error).not.toHaveBeenCalled();
});

test("a correct set says nothing", () => {
  render(<RichTextEditor aria-label="Body" tools={[...RICH_TEXT_PRESETS.basic, testBoxTool]} />);

  expect(screen.getByRole("textbox", { name: "Body" })).toBeTruthy();
  expect(error).not.toHaveBeenCalled();
});
