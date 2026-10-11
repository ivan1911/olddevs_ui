"use client";

import type { Node as PmNode, NodeType, ResolvedPos } from "@tiptap/pm/model";
import { TextSelection, type Transaction } from "@tiptap/pm/state";

/**
 * Общее у контейнерных Блоков — Раскладки (`layout.ts`, ADR-0056) и Обёртки
 * (`wrapper.ts`, ADR-0057): где их нет и куда встаёт новый.
 *
 * Оба не входят в группу `block`: их принимают только узлы, назвавшие их
 * поимённо, — Документ, а Обёртку ещё и колонка Раскладки. Поэтому правила
 * разбора и вставки у них одни и те же, и живут здесь, чтобы списки и
 * арифметика позиций не разъезжались молча.
 */

/**
 * Имя узла Обёртки в Схеме движка. Живёт здесь, а не в `wrapper.ts`: оно же
 * входит в общий список ниже, а `wrapper.ts` импортирует этот модуль —
 * определение там дало бы цикл импортов. `wrapper.ts` его реэкспортирует.
 */
export const WRAPPER_NODE = "wrapper";

/**
 * Узлы, внутри которых контейнерного Блока нет ни одного: Обёртка, цитата,
 * пункты списков и ячейки таблицы. Колонки здесь нет — Обёртку она принимает;
 * Раскладка добавляет её своим аргументом.
 */
const CONTAINER_FREE_NODES = [
  WRAPPER_NODE,
  "blockquote",
  "listItem",
  "taskItem",
  "tableCell",
  "tableHeader",
];

/**
 * Контекст правила разбора (`context` в `parseHTML`), где контейнерный Блок
 * снимается: правило с `skip` отдаёт его Блоки подряд, а не режет контейнер
 * вставки надвое. `more` — узлы, где нет именно этого Блока (колонка — для
 * Раскладки). Имена выключенных инструментов безвредны: контекст сверяется по
 * имени узла.
 */
export function containerFreeContext(...more: string[]): string {
  return [...more, ...CONTAINER_FREE_NODES].map((name) => `${name}//`).join(" | ");
}

/**
 * Лежит ли позиция в узле, где контейнерного Блока нет (`CONTAINER_FREE_NODES`):
 * то же правило, что `containerFreeContext` для разбора HTML, — для путей, где
 * Блоки строятся не разбором HTML (вставка Markdown, `markdown.ts`).
 */
export function inContainerFreeNode($pos: ResolvedPos): boolean {
  for (let depth = $pos.depth; depth > 0; depth--) {
    if (CONTAINER_FREE_NODES.includes($pos.node(depth).type.name)) return true;
  }
  return false;
}

/** Может ли узел держать узел типа `type` ребёнком. */
function holds(node: PmNode, type: NodeType): boolean {
  return node.type.contentMatch.matchType(type) !== null;
}

/**
 * Поставить контейнерный Блок `container` под текущим Блоком — в ближайший
 * вверх узел, который его принимает (Документ; для Обёртки — и колонку).
 *
 * Пустой абзац прямо в нём (его готовит Меню вставки) заменяется. Из Обёртки,
 * колонки, списка, цитаты или ячейки Блок встаёт под их Блоком в этом узле;
 * пустой абзац контейнера Блоков (Обёртки или колонки), в котором набрали `/`,
 * при этом убирается, если там есть что-то ещё, — иначе от вставки оставался
 * бы пустой хвост. Каретка — в первый текстовый Блок нового контейнера.
 */
export function placeContainerBlock(tr: Transaction, container: PmNode): void {
  const { selection } = tr;
  const { $from } = selection;
  let depth = $from.depth;
  while (depth > 0 && !holds($from.node(depth), container.type)) depth--;
  const emptyBlock = $from.parent.isTextblock && $from.parent.content.size === 0;
  let pos: number;
  if (emptyBlock && $from.depth === depth + 1) {
    pos = $from.before();
    tr.replaceWith(pos, $from.after(), container);
  } else {
    pos = $from.depth === depth ? selection.to : $from.after(depth + 1);
    const parent = $from.depth > depth + 1 ? $from.node(-1) : null;
    if (emptyBlock && parent?.type.spec.blockContainer === true && parent.childCount > 1) {
      const steps = tr.mapping.maps.length;
      tr.delete($from.before(), $from.after());
      pos = tr.mapping.slice(steps).map(pos);
    }
    tr.insert(pos, container);
  }
  // По шагу внутрь на каждый уровень до текстового Блока: Обёртка › абзац —
  // два, Раскладка › колонка › абзац — три.
  let inner = pos + 1;
  for (let node = container; !node.isTextblock && node.firstChild; node = node.firstChild) inner++;
  tr.setSelection(TextSelection.create(tr.doc, inner)).scrollIntoView();
}
