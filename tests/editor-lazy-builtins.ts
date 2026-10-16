import { render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { RichTextEditor } from "../src/editor/index.js";
import { TOOLS } from "../src/editor/core/tools.js";

/**
 * Дождаться чанков ленивых встроенных — `codeBlock` и `table` (OLDSUI-111,
 * ADR-0058, п. 11.1), а с ними и ленивых вне пресетов (видео, OLDSUI-281) — через
 * публичный API: Редактор со всеми встроенными Инструментами монтируется,
 * доходит до Готовности (`onReady`) и снимается.
 *
 * Зачем. С ленивыми встроенными `full` готов не в `render`, а после загрузки
 * чанков. Загрузчик кэширован на модуле (`toolLoader.ts`), поэтому после этого
 * шага каждый Редактор файла снова создаёт движок прямо в `render`, и тесты,
 * которые берут `ref.current.editor` сразу, проверяют то же, что раньше. Ставится
 * `beforeAll(loadLazyBuiltins)` в файле, которому нужна синхронная Готовность;
 * сам путь Скелета до загрузки сторожит `rich-text-editor-lazy-builtins.test.tsx`.
 */
export async function loadLazyBuiltins(): Promise<void> {
  let ready = false;
  const view = render(
    createElement(RichTextEditor, {
      "aria-label": "Warm-up",
      // Все встроенные: и ленивые вне пресетов (`youtube`, `twitch`) — тесты берут `TOOLS` целиком.
      tools: [...TOOLS],
      onReady: () => (ready = true),
    })
  );
  await waitFor(
    () => {
      if (!ready) throw new Error("the full editor did not reach Readiness");
    },
    { timeout: 10_000 }
  );
  view.unmount();
}
