import type { ComponentType } from "react";
import type { CustomIslandProps, ToolEntry } from "./customTool.js";
import { customToolOf } from "./toolDefinition.js";

/*
  Islands of custom Blocks in the View (ADR-0058, item 3.3).

  The module runs on the server: `RichTextView` picks from `tools` only what an island needs
  and hands the client component references to the Islands. The full description (Extensions,
  functions) cannot cross the RSC boundary. The choice is made by the Document, as
  `hasCodeBlocks` is for "Copy": an Island of a Block that is not in the Document stays out of
  the client graph, so its code is not loaded either.
*/

/** Island of one custom Block: the Block's name, its component and its declared attributes. */
export interface ViewIsland {
  block: string;
  island: ComponentType<CustomIslandProps>;
  /** The Block's declared attributes (each name maps to a kind of value, as data): the component gets their names. */
  attributes: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Islands this Document needs. A Block in the sanitized HTML is always written as
 * `data-block="<name>"` in double quotes (the DOM serializer writes it this way), so the check
 * is a substring test, without parsing the markup. No `tools`, no Island for the Block, or the
 * Block is absent from the Document: an empty list, and no client Island at all.
 */
export function islandsFor(tools: readonly ToolEntry[] | undefined, html: string): ViewIsland[] {
  // A string in `tools` is the name of a kit Tool, and a Configured built-in is its options: neither has Blocks.
  return (tools ?? []).flatMap((entry) =>
    Object.entries(customToolOf(entry)?.blocks ?? {}).flatMap(([block, { island, attributes }]) =>
      island && html.includes(`data-block="${block}"`) ? [{ block, island, attributes }] : []
    )
  );
}
