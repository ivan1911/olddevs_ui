/**
 * HTML Документа → читаемый текст для HTML-режима Редактора.
 *
 * ПРАВИЛО ОДНО И ПО СТРУКТУРЕ, А НЕ ПО СПИСКУ БЛОКОВ. Элемент, среди детей
 * которого есть не-строчный элемент и нет текста, раскладывается: открывающий
 * тег на своей строке, каждый ребёнок — на своей строке с отступом в два
 * пробела, закрывающий тег — на своей. Остальное (абзац, заголовок, подпись,
 * `pre`) остаётся одной строкой, как было в HTML. Так верхний уровень,
 * пункты списков, строки и ячейки таблиц, колонки Раскладки и части `figure`
 * раскладываются без перечня, и следующий контейнер Блоков (Обёртка,
 * `div data-block`) — тоже, без правки этого модуля.
 *
 * «Строчный» — содержимое фразы по HTML (`strong`, `a`, `img`, `br`…): этот
 * список задаёт язык разметки, а не Схема Редактора, и с новыми Блоками не
 * меняется.
 *
 * БЕЗ ПОТЕРЬ. Пробелы и переводы строк добавляются только между детьми
 * раскладываемого элемента — там, где текста нет и разбор Схемой пробелы
 * пропускает. Содержимое строки берётся из исходной строки как есть, `pre` не
 * трогается вовсе. Поэтому разбор результата Схемой даёт тот же Документ, что
 * исходный HTML. На разметке, которую разбор не понял (незакрытый тег —
 * не наш сериализатор), функция возвращает строку без изменений: лучше
 * неотформатированный текст, чем изменённый.
 *
 * Пустой Документ — пустая строка (его HTML уже `""`).
 *
 * Модуль серверно-безопасен: строки, без DOM, без React и без движка.
 */
export function formatSourceHtml(html: string): string {
  const root = parse(html);
  if (!root || !expands(html, root)) return html;
  return root.children
    .filter((child) => !isBlank(html, child))
    .map((child) => render(html, child, ""))
    .join("\n");
}

/** Элементы без закрывающего тега (HTML, «void elements»). Списки — строкой: в сборке короче. */
const VOID = new Set("area base br col embed hr img input link meta source track wbr".split(" "));

/** Содержимое фразы (HTML, «phrasing content»): такой ребёнок не делает родителя контейнером. */
const PHRASING = new Set(
  (
    "a abbr b bdi bdo br button cite code data del dfn em i img input ins kbd label mark q s " +
    "samp small span strong sub sup time u var wbr"
  ).split(" ")
);

/** Содержимое как есть: внутри пробелы — часть текста. */
const VERBATIM = new Set(["pre", "textarea", "script", "style"]);

interface Text {
  kind: "text";
  start: number;
  end: number;
}

interface Element {
  kind: "element";
  name: string;
  /** Начало открывающего тега и конец закрывающего (или открывающего у пустого). */
  start: number;
  end: number;
  /** Конец открывающего тега и начало закрывающего. */
  openEnd: number;
  closeStart: number;
  children: Child[];
}

type Child = Text | Element;

/**
 * Разбор в дерево позиций. Это не парсер HTML вообще, а разбор того, что
 * отдаёт сериализатор движка: теги закрыты, атрибуты в кавычках. Комментарии
 * и всё, что не тег, считаются текстом — их строка не раскладывается.
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
    // Внутри `pre` и подобных ищется только свой закрывающий тег.
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

/** Конец тега, начатого в `from`: первая `>` вне кавычек значения атрибута. */
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

/** Пробелы между детьми контейнера: разбор Схемой их пропускает, при раскладке они заменяются отступом. */
function isBlank(html: string, child: Child): boolean {
  return child.kind === "text" && html.slice(child.start, child.end).trim() === "";
}

/** Раскладывается ли элемент: есть не-строчный ребёнок и нет текста. */
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
