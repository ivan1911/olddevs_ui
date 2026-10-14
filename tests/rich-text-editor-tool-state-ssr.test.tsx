import { useRef } from "react";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  useRichTextToolState,
  type RichTextEditorHandle,
} from "../src/editor/index.js";

// Окружение — node: на сервере нет ни `window`, ни DOM, и именно так проверяется
// безопасность хука Состояния Инструмента при SSR.

test("the tool State hook is null on the server and the selector is not called", () => {
  let calls = 0;
  const seen: unknown[] = [];

  function Screen() {
    const ref = useRef<RichTextEditorHandle>(null);
    seen.push(
      useRichTextToolState(ref, "search", (state) => {
        calls += 1;
        return state.total;
      }),
      useRichTextToolState(ref, "toc"),
      useRichTextToolState(ref, "acme_unknown")
    );
    return (
      <RichTextEditor
        ref={ref}
        aria-label="Body"
        tools={[...RICH_TEXT_PRESETS.full, "toc"]}
        defaultValue="<h2>One</h2><h2>Two</h2>"
      />
    );
  }

  expect(() => renderToString(<Screen />)).not.toThrow();
  expect(seen).toEqual([null, null, null]);
  expect(calls).toBe(0);
});
