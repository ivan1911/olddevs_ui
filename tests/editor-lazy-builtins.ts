import { render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { RichTextEditor } from "../src/editor/index.js";
import { TOOLS } from "../src/editor/core/tools.js";
import { loadPasteCleanup } from "../src/editor/features/pasteCleanup/pasteCleanupTool.js";

/**
 * Wait for the chunks of the lazy built-ins: `codeBlock`, `table` (OLDSUI-111,
 * ADR-0058, section 11.1), and with them the lazy ones outside the presets: `mathematics` (OLDSUI-280,
 * ADR-0070) and video (OLDSUI-281). Use the public API: an Editor with all
 * built-in Tools mounts, reaches Readiness (`onReady`) and unmounts.
 *
 * Why. With the lazy built-ins, `full` is not ready in `render` but after the chunks load.
 * The loader is cached on the module (`toolLoader.ts`), so after this
 * step every Editor in the file creates the engine right in `render` again, and tests
 * that take `ref.current.editor` right away check the same thing as before. The setup is
 * `beforeAll(loadLazyBuiltins)` in a file that needs synchronous Readiness;
 * the Skeleton path before loading is guarded by `rich-text-editor-lazy-builtins.test.tsx`.
 */
export async function loadLazyBuiltins(): Promise<void> {
  let ready = false;
  const view = render(
    createElement(RichTextEditor, {
      "aria-label": "Warm-up",
      // All built-ins, including the lazy ones outside the presets (`mathematics`,
      // `youtube`, `twitch`): tests take all of `TOOLS`.
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
  // The paste cleanup steps load in their own chunk once a view exists (`pasteCleanupTool.ts`); a test
  // that pastes right after `render` needs them already there.
  await loadPasteCleanup();
}
