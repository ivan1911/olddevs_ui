import { createRef, useRef } from "react";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";
import {
  RichTextEditor,
  useRichTextEditorState,
  type RichTextEditorHandle,
} from "../src/editor/index.js";
import { testLazyTool } from "./editor-test-tools.js";

// Окружение — node: на сервере нет ни `window`, ни DOM, и именно так проверяется
// безопасность Хэндла и хука при SSR.

test("the hook is safe on the server: it returns null and the selector is not called", () => {
  let calls = 0;
  let seen: unknown = "unset";

  function Screen() {
    const ref = useRef<RichTextEditorHandle>(null);
    seen = useRichTextEditorState(ref, (editor) => {
      calls += 1;
      return editor.isActive("bold");
    });
    return <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>Text</p>" />;
  }

  expect(() => renderToString(<Screen />)).not.toThrow();
  expect(seen).toBeNull();
  expect(calls).toBe(0);
});

test("on the server there is no Handle to call: the ref stays empty", () => {
  const ref = createRef<RichTextEditorHandle>();

  expect(() =>
    renderToString(<RichTextEditor ref={ref} aria-label="Body" value="<p>Known</p>" />)
  ).not.toThrow();

  // Хэндл появляется при монтаже: экран, звавший метод слишком рано, получает
  // `null` из `ref.current?.…`, а не исключение.
  expect(ref.current).toBeNull();
});

test("on the server a loader is not called: the Skeleton is the frame without the Document", () => {
  const lazy = testLazyTool();

  const html = renderToString(
    <RichTextEditor aria-label="Body" value="<p>Known</p>" tools={[lazy.tool]} />
  );

  // Загрузка стартует с первого рендера в браузере, а не на сервере.
  expect(lazy.loader.calls).toBe(0);
  // Документ Скелета — только в браузере: на сервере его не разобрать Схемой.
  expect(html).not.toContain("Known");
});

test("on the server an envelope in defaultValue renders the frame, and the form field is empty", () => {
  const html = renderToString(
    <RichTextEditor
      aria-label="Body"
      name="body"
      defaultValue={{
        format: "olddevs-rich-text",
        version: 1,
        doc: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Known" }] }],
        },
      }}
    />
  );

  // HTML конверта знает только движок по своей Схеме — на сервере его нет.
  expect(html).not.toContain("Known");
  expect(html).toMatch(/<input type="hidden" name="body" value=""/);
});
