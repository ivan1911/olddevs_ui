"use client";

import type { JSONContent } from "@tiptap/core";
import { DATE_NODE } from "./dateValue.js";

/*
  A DATE MENTION WITHOUT THE `date` TOOL IS ITS WORDS (ADR-0079). In HTML nothing needs doing:
  the Schema has no `time`, and the parse keeps the text of an unknown inline element. A JSON tree
  is different: its Atom has the words in an attribute and no children, so a node the Schema does not
  know would vanish with them. This is the JSON twin of `formulaJsonAsText`.
*/

/**
 * A mention in the JSON tree as text, or `null` if the node is not a mention. It is called by
 * `conformToSchema` when the node is not in the Schema.
 */
export function dateJsonAsText(node: JSONContent): JSONContent[] | null {
  if (node.type !== DATE_NODE) return null;
  const text = node.attrs?.text;
  return typeof text === "string" && text !== "" ? [{ type: "text", text }] : [];
}
