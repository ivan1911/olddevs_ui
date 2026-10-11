// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { CopyButton } from "../src/components/actions/CopyButton.js";
import { SplitButton } from "../src/components/actions/SplitButton.js";
import { SelectionBar } from "../src/components/navigation/SelectionBar.js";

/**
 * The icon dictionary sets no size (that is the consumer's `LucideProvider`), so
 * an icon without `size` renders at lucide's default 24 pixels with stroke 2 —
 * half again as tall as a 30-pixel button with 13-pixel text. Icons that the kit
 * draws itself are the kit's business: they must carry an explicit size that
 * follows the size of the button they sit in.
 */
afterEach(cleanup);

const widthOf = (element: Element | null) => element?.querySelector("svg")?.getAttribute("width");

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx$/.test(entry.name) && !/\.(stories|test)\.tsx$/.test(entry.name) ? [path] : [];
  });
}

describe("icons the kit draws itself", () => {
  test("no icon inside src/components or src/editor is left without a size", () => {
    const root = join(import.meta.dirname, "../src");
    const bare: string[] = [];
    for (const file of [...sources(join(root, "components")), ...sources(join(root, "editor"))]) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/<([A-Z]\w*Icon)\b([^>]*?)\/?>/g)) {
        if (!/\bsize=/.test(match[2] ?? "") && !/className=/.test(match[2] ?? "")) {
          bare.push(
            `${file.slice(root.length + 1)}:${text.slice(0, match.index).split("\n").length} <${match[1]}>`
          );
        }
      }
    }
    expect(bare).toEqual([]);
  });

  test("the CopyButton icon follows the size of its button", () => {
    render(<CopyButton value="x" />);
    expect(widthOf(screen.getByRole("button"))).toBe("16");
    cleanup();
    render(<CopyButton value="x" size="sm" />);
    expect(widthOf(screen.getByRole("button"))).toBe("14");
  });

  test("the SplitButton chevron follows the size of the buttons", () => {
    render(<SplitButton label="Export" size="sm" />);
    expect(widthOf(screen.getByRole("button", { name: "More actions: Export" }))).toBe("14");
    cleanup();
    render(<SplitButton label="Export" />);
    expect(widthOf(screen.getByRole("button", { name: "More actions: Export" }))).toBe("16");
  });

  test("the SelectionBar close cross is sized for its compact bar", () => {
    render(
      <SelectionBar count={2} onClear={() => {}}>
        actions
      </SelectionBar>
    );
    expect(widthOf(screen.getByRole("button", { name: "Clear selection" }))).toBe("16");
  });
});
