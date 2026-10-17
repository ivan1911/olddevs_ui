import { createElement, type ReactNode } from "react";
import { normalizeCodeLanguage } from "./codeLanguages.js";
import { CODE_THEME_CLASS } from "../../styles/codeTheme.js";
import { highlightCode, type HighlightTree } from "./lowlight.js";

type HighlightNode = HighlightTree["children"][number];

/**
 * Converts a lowlight tree into React nodes: text stays text, and a token becomes a `span` with
 * its `hljs-…` classes and nothing else. Node properties other than the class are not carried
 * over, as in the `highlightCodeBlocks` serializer (`highlight.ts`).
 *
 * Children go to `createElement` as an argument list, not as an array: React then does not ask for
 * keys, and the order of tokens never changes.
 */
function toNodes(nodes: readonly HighlightNode[]): ReactNode[] {
  return nodes.map((node) => {
    if (node.type === "text") return node.value;
    if (node.type !== "element") return null;
    const className = node.properties.className;
    const classes = Array.isArray(className) ? className.join(" ") : undefined;
    return createElement("span", { className: classes }, ...toNodes(node.children));
  });
}

/**
 * Highlights code for `CodeView` (ADR-0052), with the same grammar and the same theme as the
 * Editor's code block and `RichTextView`.
 *
 * ```tsx
 * <CodeView code={source} title="main.py" copyable>
 *   {highlightCodeNodes(source, "python")}
 * </CodeView>
 * ```
 *
 * NODES, NOT AN HTML STRING. The code in `CodeView` is usually untrusted (an API response, a
 * webhook body), and a string would lead the consumer to `dangerouslySetInnerHTML`. Here the code
 * text becomes a React text node, and React escapes it.
 *
 * The language follows the Editor's rules (`codeLanguages.ts`): case, spaces and aliases do not
 * matter. An unknown language or empty code gives `null`, not the code as a string. Then the
 * `children` of `CodeView` is empty, and it draws the code as is, without the line numbering that
 * the markup would have given it.
 *
 * ROOT WITH A MARKER AND A THEME. The tokens are wrapped in one `span` with the
 * `data-code-highlight` attribute and the theme classes (`codeTheme.ts`). The theme sits on the
 * root, not on `CodeView`: it does not recolor the markup of a foreign highlighter, even one with
 * the same `hljs-…` classes. `CodeView` reads the marker to take the background of the highlight
 * theme: GitHub's colors do not keep contrast on the kit's code background.
 *
 * No hooks and no `"use client"`: the helper is called both in a server component and in a client
 * one.
 */
export function highlightCodeNodes(code: string, language: string): ReactNode {
  const id = normalizeCodeLanguage(language);
  if (!id || code === "") return null;
  return createElement(
    "span",
    {
      "data-code-highlight": "",
      className: `${CODE_THEME_CLASS.trim()} text-(--rte-code-block-foreground)`,
    },
    ...toNodes(highlightCode(id, code).children)
  );
}
