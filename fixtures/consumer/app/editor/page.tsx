import { RichTextView, type CustomTool } from "@olddevs/ui/editor";
import { highlightCodeBlocks } from "@olddevs/ui/editor/highlight";
import { sanitizeRichText } from "@olddevs/ui/editor/schema";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { FixtureBadge } from "../fixture-badge";

/**
 * A Server Component with the package's second promise: the `@olddevs/ui/editor` subpath.
 *
 * The rendering pipeline is exactly the one on the `RichTextView` page: sanitizing on the
 * server (`sanitizeRichText` with DOMPurify on jsdom), then highlighting
 * (`highlightCodeBlocks`), then `RichTextView` right here, without a wrapper with
 * "use client". A code Block in the Document is needed so that the View renders its own
 * client Island with a "Copy" button. The client boundary runs along the Island's file,
 * and the build checks that it reaches the consumer.
 *
 * A custom Block with an Island: the description lives in a server module, and the Island
 * component is in a module with the directive (`../fixture-badge.tsx`). It crosses the RSC
 * boundary as a reference. The Extensions here are empty: the View does not need them, and
 * Tiptap must not appear in the page's module graph.
 *
 * A Formula (OLDSUI-280, ADR-0070) is stored in the Document as an empty element with
 * `data-latex`. The server writes the source LaTeX into it, the Formula's Island marker
 * stands in the markup, and the client loads KaTeX and its CSS. The rendered formula is
 * not in the page's HTML.
 *
 * The fake markup in the Document is not there for looks: `scripts/check-consumer.mjs`
 * reads the rendered HTML and requires that it is absent, while the highlight tokens and
 * the Mount point of the button must be present.
 */
const DOMPurify = createDOMPurify(new JSDOM("").window);

const FIXTURE_TOOL: CustomTool = {
  name: "fixture_badge",
  engine: [],
  blocks: {
    fixture_badge: {
      kind: "block",
      attributes: { fixture_label: { kind: "pattern", pattern: "[A-Za-z ]+" } },
      island: FixtureBadge,
    },
  },
};

const SAVED =
  '<h2>Release notes</h2><p class="fixed inset-0" style="position:fixed">Text with ' +
  '<strong>bold</strong> and <a href="javascript:alert(1)">a fake link</a>.</p>' +
  '<pre><code class="language-python">def greet(name):\n    return f"hi {name}"</code></pre>' +
  '<figure><img src="data:image/png;base64,AAAA" alt=""></figure>' +
  '<div data-block="fixture_badge" data-fixture_label="Live badge">Server badge</div>' +
  '<p>Euler: <span data-type="inline-math" data-latex="e^{i\\pi}+1=0"></span></p>';

export default function EditorPage() {
  const html = highlightCodeBlocks(sanitizeRichText(SAVED, DOMPurify, [FIXTURE_TOOL]));
  return (
    <main className="p-6">
      <RichTextView html={html} tools={[FIXTURE_TOOL]} className="max-w-prose" />
    </main>
  );
}
