/**
 * The Document's HTML → readable text for the Editor's Source mode.
 *
 * ONE RULE FOR STRUCTURE, NOT FOR A LIST OF BLOCKS. An element that has a non-phrasing child and no
 * text among its children is laid out: the opening tag on its own line, each child on its own line
 * indented by two spaces, and the closing tag on its own line. Everything else (a paragraph, a
 * heading, a caption, a `pre`) stays on one line, as it was in the HTML. This way the top level,
 * list items, table rows and cells, the columns of a Column layout, and parts of a `figure` are
 * laid out without a list, and so is the next Block container (a Wrapper, a `div data-block`),
 * without changing this module.
 *
 * "Phrasing" means phrasing content in HTML (`strong`, `a`, `img`, `br`…). This list sets the
 * markup language, not the Editor's Schema, and it does not change with new Blocks.
 *
 * NO LOSS. Spaces and line breaks are added only between the children of the element being laid
 * out, where there is no text and the Schema parse skips spaces. A line's content is taken from
 * the source string as-is, and `pre` is not touched at all. So parsing the result with the Schema
 * gives the same Document as the source HTML. For markup the parse does not understand (an
 * unclosed tag, which is not our serializer's output), the function returns the string unchanged:
 * unformatted text is better than changed text.
 *
 * An empty Document gives an empty string (its HTML is already `""`).
 *
 * The module is safe on the server: strings only, no DOM, no React, and no engine.
 */
export function formatSourceHtml(html: string): string {
  const root = parse(html);
  if (!root || !expands(html, root)) return html;
  return root.children
    .filter((child) => !isBlank(html, child))
    .map((child) => render(html, child, ""))
    .join("\n");
}

/**
 * Elements without a closing tag (HTML "void elements"). The list is a string literal, which is
 * shorter in the build.
 */
const VOID = new Set("area base br col embed hr img input link meta source track wbr".split(" "));

/** Phrasing content in HTML: such a child does not make its parent a container. */
const PHRASING = new Set(
  (
    "a abbr b bdi bdo br button cite code data del dfn em i img input ins kbd label mark q s " +
    "samp small span strong sub sup time u var wbr"
  ).split(" ")
);

/** Content as-is: whitespace inside is part of the text. */
const VERBATIM = new Set(["pre", "textarea", "script", "style"]);

interface Text {
  kind: "text";
  start: number;
  end: number;
}

interface Element {
  kind: "element";
  name: string;
  /**
   * Start of the opening tag and end of the closing one (or of the opening one, for an empty
   * element).
   */
  start: number;
  end: number;
  /** End of the opening tag and start of the closing one. */
  openEnd: number;
  closeStart: number;
  children: Child[];
}

type Child = Text | Element;

/**
 * Parse into a tree of positions. This is not a general HTML parser, only a parse of what the
 * engine's serializer outputs: tags are closed, attributes are quoted. Comments and everything that
 * is not a tag count as text, and their line is not laid out.
 */
function parse(html: string): Element | null {
  const root: Element = {
    kind: "element",
    name: "#root",
    start: 0,
    end: html.length,
    openEnd: 0,
    closeStart: html.length,
    children: [],
  };
  const stack: Element[] = [root];
  const lower = html.toLowerCase();
  let index = 0;
  let textStart = -1;

  const closeText = (at: number) => {
    if (textStart < 0) return;
    stack[stack.length - 1]!.children.push({ kind: "text", start: textStart, end: at });
    textStart = -1;
  };

  while (index < html.length) {
    const top = stack[stack.length - 1]!;
    // Inside `pre` and similar elements, only their own closing tag is searched for.
    if (VERBATIM.has(top.name)) {
      const close = lower.indexOf(`</${top.name}`, index);
      if (close < 0) return null;
      const closeEnd = html.indexOf(">", close);
      if (closeEnd < 0) return null;
      top.closeStart = close;
      top.end = closeEnd + 1;
      stack.pop();
      index = closeEnd + 1;
      continue;
    }
    const tag = html[index] === "<" ? /^<(\/?)([a-zA-Z][^\s/>]*)/.exec(html.slice(index)) : null;
    if (!tag) {
      if (textStart < 0) textStart = index;
      index += 1;
      continue;
    }
    closeText(index);
    const tagEnd = endOfTag(html, index);
    if (tagEnd < 0) return null;
    const name = tag[2]!.toLowerCase();
    if (tag[1]) {
      if (top.name !== name) return null;
      top.closeStart = index;
      top.end = tagEnd;
      stack.pop();
    } else {
      const element: Element = {
        kind: "element",
        name,
        start: index,
        end: tagEnd,
        openEnd: tagEnd,
        closeStart: tagEnd,
        children: [],
      };
      top.children.push(element);
      if (!VOID.has(name) && html[tagEnd - 2] !== "/") stack.push(element);
    }
    index = tagEnd;
  }
  closeText(html.length);
  return stack.length === 1 ? root : null;
}

/** End of the tag started at `from`: the first `>` outside an attribute value's quotes. */
function endOfTag(html: string, from: number): number {
  let quote: string | null = null;
  for (let index = from + 1; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ">") {
      return index + 1;
    }
  }
  return -1;
}

/**
 * Spaces between a container's children. The Schema parse skips them, and during layout they are
 * replaced by indentation.
 */
function isBlank(html: string, child: Child): boolean {
  return child.kind === "text" && html.slice(child.start, child.end).trim() === "";
}

/** Whether an element is laid out: it has a non-phrasing child and no text. */
function expands(html: string, element: Element): boolean {
  if (VERBATIM.has(element.name)) return false;
  let block = false;
  for (const child of element.children) {
    if (child.kind === "text") {
      if (!isBlank(html, child)) return false;
    } else if (!PHRASING.has(child.name)) {
      block = true;
    }
  }
  return block;
}

function render(html: string, node: Child, indent: string): string {
  if (node.kind === "text" || !expands(html, node)) {
    return indent + html.slice(node.start, node.end);
  }
  const inner = indent + "  ";
  const children = node.children
    .filter((child) => !isBlank(html, child))
    .map((child) => render(html, child, inner));
  return [
    indent + html.slice(node.start, node.openEnd),
    ...children,
    indent + html.slice(node.closeStart, node.end),
  ].join("\n");
}
