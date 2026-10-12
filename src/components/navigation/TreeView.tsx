"use client";

import type { ReactNode } from "react";
import {
  Button,
  Collection,
  Tree,
  TreeItem,
  TreeItemContent,
  type Key,
  type Selection,
} from "react-aria-components";
import { ChevronRightIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { Checkbox } from "../inputs/Checkbox.js";

/**
 * Ставит или снимает `aria-current` на строке дерева, в которой лежит `inside`.
 *
 * Руками, потому что `TreeItem` фильтрует свои пропсы: до разметки доходят
 * только `data-*` и пара `aria-*` с именем, а `aria-current` отбрасывается молча
 * — запись `aria-current="page"` в JSX выглядела бы рабочей и ничего не делала.
 * Атрибут вне набора, которым владеет React на этой строке, так что перерисовка
 * его не стирает.
 *
 * Зовётся из ref содержимого строки, а не из ref самой строки: строкой
 * react-aria владеет сама, и ref на `TreeItem` вызывается один раз на
 * монтировании — смена текущего узла его не дёргала бы. Содержимое же
 * перерисовывается вместе с `activeKey`, а inline-ref вызывается на каждой
 * перерисовке.
 */
function markCurrent(inside: HTMLElement | null, current: boolean) {
  const row = inside?.closest('[role="row"]');
  if (!row) return;
  if (current) row.setAttribute("aria-current", "page");
  else row.removeAttribute("aria-current");
}

export interface TreeNode {
  /** Уникальный ключ узла: по нему работают раскрытие, выбор и `onAction`. */
  id: Key;
  /** Подпись узла. Может быть вёрсткой — тогда задайте `textValue`. */
  label: ReactNode;
  /**
   * Строковое представление узла: по нему работает поиск набором с клавиатуры.
   * Обязателен, когда `label` — не строка.
   */
  textValue?: string;
  /** Иконка слева от подписи. */
  icon?: ReactNode;
  /** Дочерние узлы. Есть они — у узла появляется кнопка раскрытия. */
  children?: TreeNode[];
  /** Блокирует узел: его нельзя выбрать и активировать. */
  disabled?: boolean;
}

export interface TreeViewProps {
  /** Узлы верхнего уровня; вложенность задаётся полем `children`. */
  items: TreeNode[];
  /** Доступное имя дерева. Обязательно: безымянное дерево скринридер называет только по роли. */
  "aria-label": string;
  /** Раскрытые узлы. Дерево их не хранит — как сортировку и выделение таблица. */
  expandedKeys?: Iterable<Key>;
  /** Вызывается с новым множеством раскрытых узлов после раскрытия или сворачивания. */
  onExpandedChange?: (keys: Set<Key>) => void;
  /** Раскрытые при первом показе. Дальше состояние ведёт react-aria. */
  defaultExpandedKeys?: Iterable<Key>;
  /**
   * Выбор узлов. Режим включается наличием пропа: без него ни флажков, ни
   * `aria-selected` в разметке нет — то же правило, что у `Table`.
   */
  selectionMode?: "single" | "multiple";
  /** Выбранные узлы (управляемое значение). Работает при заданном `selectionMode`. */
  selectedKeys?: Selection;
  /** Вызывается с новым набором выбранных узлов. */
  onSelectionChange?: (keys: Selection) => void;
  /** Ключи заблокированных узлов; действует вместе с полем `disabled` самих узлов. */
  disabledKeys?: Iterable<Key>;
  /**
   * Текущий узел навигации: ключ узла, чья страница открыта. Узел получает
   * `aria-current="page"` и заметную подложку.
   *
   * Это не выбор: ни флажков, ни `aria-selected`, режим `selectionMode`
   * включать не нужно. Имя — по словарю кита: `active` занято текущим пунктом
   * навигации, а здесь пунктов нет, есть ключи, как у `selectedKeys` и
   * `expandedKeys`. Дерево «текущее» само не переставляет — это делает
   * маршрут потребителя.
   */
  activeKey?: Key;
  /**
   * Действие по узлу: переход, открытие карточки. Выбором не является.
   *
   * По строке-папке действие НЕ раскрывает её: раскрывают шеврон и стрелка
   * вправо. Раскрывать по клику — дело `onAction` потребителя.
   */
  onAction?: (id: Key) => void;
  /** Что показать, когда узлов нет. Не задан — дерево остаётся пустым. */
  emptyText?: ReactNode;
  /** Дополнительные классы на корень дерева. */
  className?: string;
}

/**
 * Дерево: иерархия с раскрытием, выбором и клавиатурой.
 *
 * ПОВЕДЕНИЕ ЦЕЛИКОМ ОТ `Tree` ИЗ react-aria (ADR-0005), и это причина, по
 * которой дерево вообще можно писать без экрана-заказчика. Роли,
 * `aria-expanded`, `aria-level`, `aria-posinset`, стрелки, Home и End, поиск
 * набором — всё оттуда. Своими руками здесь только разметка узла и токены. В
 * 1.21 компонент вышел из `UNSTABLE_`, так что префикса нет.
 *
 * РОЛЬ — `treegrid`, А НЕ `tree`, и узлы объявлены `row`. Это решение
 * react-aria, и оно обоснованное: в строке живут кнопка раскрытия и флажок, а
 * `treeitem` второго интерактивного элемента внутри себя не предполагает.
 * Переопределять роли руками мы не станем — тогда клавиатура из слоя поведения
 * перестала бы соответствовать объявленной разметке.
 *
 * СОСТОЯНИЙ ДЕРЕВО НЕ ХРАНИТ — правило то же, что у `Table`: раскрытые и
 * выбранные узлы приходят множествами, а `defaultExpandedKeys` ведёт
 * react-aria, а не мы. `useTreeData` наружу НЕ реэкспортируется: это
 * хранилище, а кит состоянием не владеет (ADR-0023). Кому нужно готовое —
 * берёт его из `react-aria-components` напрямую, и тогда это его выбор, а не
 * навязанный китом.
 *
 * Режим выбора включается `selectionMode`. Без него флажков нет вовсе: дерево
 * категорий, по которому просто ходят, не должно тащить колонку выбора.
 *
 * ТЕКУЩИЙ УЗЕЛ — ОТДЕЛЬНАЯ ОСЬ ОТ ВЫБОРА. `activeKey` ставит строке
 * `aria-current="page"` и подложку, а флажков не рисует: дерево статей, по
 * которому ходят, показывает «вы здесь», а не набор отмеченного. `dependencies`
 * на корне нужны затем, что react-aria кеширует строки по `items`: сменился
 * только ключ — без них отметка осталась бы на прежней строке.
 *
 * Имена кнопок раскрытия НЕ повторяют подпись узла: react-aria дописывает её
 * сам, и «Раскрыть Природа» читалось бы как «Раскрыть Природа Природа» — тот
 * же дефект, что нашло ревью волны 18 у `TagInput` и `FilterBar`.
 */
export function TreeView({
  items,
  expandedKeys,
  onExpandedChange,
  defaultExpandedKeys,
  selectionMode,
  selectedKeys,
  onSelectionChange,
  disabledKeys,
  activeKey,
  onAction,
  emptyText,
  className,
  ...rest
}: TreeViewProps) {
  const messages = useMessages();

  const renderNode = (node: TreeNode) => {
    const current = activeKey != null && node.id === activeKey;
    return (
      <TreeItem
        id={node.id}
        textValue={
          node.textValue ?? (typeof node.label === "string" ? node.label : String(node.id))
        }
        isDisabled={node.disabled}
        className="outline-none [--tree-indent:1.25rem]"
      >
        <TreeItemContent>
          {({ isExpanded, hasChildItems, isSelected, isDisabled }) => {
            // Гасятся шеврон, иконка и подпись по отдельности, а не весь `div`:
            // флажок выбора получает блокировку от строки сам и гасится собственным
            // `disabled:opacity-50`, так что приглушение всего ряда дало бы ему
            // двойное — 25% вместо 50%.
            const dim = isDisabled && "opacity-50";
            return (
              <div
                ref={(content) => markCurrent(content, current)}
                className={cn(
                  "text-fg-1 flex items-center gap-2 rounded-xs py-1.5 pr-2 text-[13px] leading-5",
                  // Выбор и блокировка берутся из рендер-пропа, а не вариантами
                  // `selected:` и `disabled:`: `data-selected` и `data-disabled`
                  // react-aria ставит на строку (`row`), а красится её содержимое —
                  // вариант на нём не срабатывал, и ни выбранный узел не
                  // подсвечивался, ни заблокированный не гас. Тот же случай, что
                  // шеврон в `Accordion`.
                  //
                  // Приглушение — не на всём `div`, а на частях (см. `dim` ниже).
                  isSelected ? "bg-accent-soft text-fg-0" : "hover:bg-bg-2",
                  // Текущий узел — подложка и вес шрифта, как у `NavItem` с `active`.
                  current && "bg-bg-3 text-fg-0 font-semibold",
                  "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:-outline-offset-2"
                )}
                // Уровень вложенности берётся у react-aria: она кладёт его в
                // `--tree-item-level` на строке, и считать глубину самим не нужно
                // — иначе у нас была бы вторая копия того же числа.
                style={{
                  paddingLeft: "calc((var(--tree-item-level) - 1) * var(--tree-indent) + 0.25rem)",
                }}
              >
                {hasChildItems ? (
                  <Button
                    slot="chevron"
                    aria-label={isExpanded ? messages.treeView.collapse : messages.treeView.expand}
                    className={cn(
                      "text-fg-3 hover:text-fg-0 flex cursor-pointer items-center rounded-xs",
                      "transition-colors",
                      dim,
                      "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2"
                    )}
                  >
                    <ChevronRightIcon
                      size={14}
                      aria-hidden
                      className={cn(
                        "transition-transform motion-reduce:transition-none",
                        isExpanded && "rotate-90"
                      )}
                    />
                  </Button>
                ) : (
                  // Место раскрывателя занято всегда: без него подписи листьев
                  // разъезжаются с подписями узлов на том же уровне.
                  <span aria-hidden className="w-[14px] shrink-0" />
                )}
                {selectionMode ? (
                  <Checkbox slot="selection" label={messages.treeView.select} />
                ) : null}
                {node.icon != null && (
                  <span className={cn("text-fg-3 flex shrink-0 items-center", dim)}>
                    {node.icon}
                  </span>
                )}
                <span className={cn("min-w-0 truncate", dim)}>{node.label}</span>
              </div>
            );
          }}
        </TreeItemContent>
        {node.children != null && node.children.length > 0 ? (
          <Collection items={node.children}>{renderNode}</Collection>
        ) : null}
      </TreeItem>
    );
  };

  return (
    <Tree
      aria-label={rest["aria-label"]}
      items={items}
      dependencies={[activeKey]}
      expandedKeys={expandedKeys}
      onExpandedChange={onExpandedChange}
      defaultExpandedKeys={defaultExpandedKeys}
      selectionMode={selectionMode}
      selectedKeys={selectedKeys}
      onSelectionChange={onSelectionChange}
      disabledKeys={disabledKeys}
      onAction={onAction}
      renderEmptyState={emptyText != null ? () => emptyText : undefined}
      className={cn("flex flex-col gap-0.5 outline-none", className)}
    >
      {renderNode}
    </Tree>
  );
}
