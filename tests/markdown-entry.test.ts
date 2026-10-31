import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import * as markdown from "../src/markdown.js";
import * as main from "../src/index.js";

test("MarkdownView is exported only through the declared Markdown entry", () => {
  expect(Object.keys(markdown)).toEqual(["MarkdownView"]);
  expect(Object.keys(main)).not.toContain("MarkdownView");
  const manifest = JSON.parse(
    readFileSync(resolve(import.meta.dirname, "../package.json"), "utf8")
  );
  expect(manifest.exports["./markdown"]).toEqual({
    types: "./dist/markdown.d.ts",
    default: "./dist/markdown.js",
  });
  expect(manifest.dependencies["react-markdown"]).toBe("10.1.0");
  expect(manifest.dependencies["remark-gfm"]).toBe("4.0.1");
});
