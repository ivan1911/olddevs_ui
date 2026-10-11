"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { Key, Selection } from "react-aria-components";
import { useMessages } from "../../i18n/useMessages.js";
import { ChevronDownIcon, CloseIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { FIELD_CLEAR_CLASS, FIELD_SHELL_CLASS } from "../../lib/field.js";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "../overlays/Popover.js";
import { TreeView, type TreeNode } from "../navigation/TreeView.js";
import { VisuallyHidden } from "../content/VisuallyHidden.js";

export interface TreeSelectProps {
  /** Узлы дерева. Формат тот же, что у `TreeView`, — это он и есть. */
  items: TreeNode[];
  /**
   * Выбранные узлы. Всегда массив, даже при `single`: одна форма значения
   * избавляет потребителя от развилки в каждом обработчике.
   */
  value: Key[];
  /** Вызывается при выборе узла и получает массив выбранных ключей. */
  onChange: (value: Key[]) => void;
  /** Несколько узлов вместо одного. Меняет и вид закрытого поля: чипы вместо подписи. */
  multiple?: boolean;
  /** Подпись поля, когда ничего не выбрано. */
  placeholder?: string;
  /** Доступное имя поля. Обязательно: безымянное поле скринридер называет только по роли. */
  "aria-label": string;
  /** Раскрытые при первом показе узлы. */
  defaultExpandedKeys?: Iterable<Key>;
  /**
   * Раскрытые узлы, когда раскрытием управляют снаружи; обновлять в
   * `onExpandedChange`.
   *
   * Управляемое раскрытие. Нужно тому, кто раскрывает дерево до текущего
   * значения или подгружает ветки лениво: без него глубоко лежащий выбранный
   * узел открывается на свёрнутом дереве, где на него ничто не указывает.
   */
  expandedKeys?: Iterable<Key>;
  /** Вызывается при раскрытии и сворачивании узлов и получает все раскрытые ключи. */
  onExpandedChange?: (keys: Set<Key>) => void;
  /** Выключает поле: список не открывается. */
  disabled?: boolean;
  /** Показать кнопку очистки, когда что-то выбрано. */
  clearable?: boolean;
  /** Имя кнопки очистки. Без него берётся `common.clear` — как у `Select`. */
  clearLabel?: string;
  /** Классы на оболочку поля. */
  className?: string;
}

/** Сколько чипов показывать до того, как остальные свернутся в «ещё N». */
const CHIP_LIMIT = 3;

/** Плоская карта узлов: подпись выбранного нужна закрытому полю, а лежит она в глубине. */
function flatten(nodes: TreeNode[], into = new Map<Key, TreeNode>()): Map<Key, TreeNode> {
  for (const node of nodes) {
    // Узел, встреченный второй раз, дальше не разворачивается: цикл в `items`
    // это испорченные данные потребителя, но переполнение стека — плохой способ
    // ему об этом сказать.
    if (into.has(node.id)) continue;
    into.set(node.id, node);
    if (node.children) flatten(node.children, into);
  }
  return into;
}

/**
 * Строковая подпись выбранного ключа для закрытого поля.
 *
 * Ключ, которого нет в `items`, показывается САМИМ КЛЮЧОМ, а не прячется.
 * Спрятать его значило бы дать поле, которое говорит «ничего не выбрано» и при
 * этом отдаёт непустое значение наружу; выбросить — молча править значение
 * потребителя. Показанный ключ хотя бы виден и снимается очисткой.
 */
function captionOf(id: Key, node: TreeNode | undefined): string {
  if (!node) return String(id);
  if (typeof node.label === "string") return node.label;
  return node.textValue ?? String(id);
}

/**
 * Поле, выбирающее узел иерархии: `TreeView` внутри `Popover`.
 *
 * КОМПОЗИЦИЯ, А НЕ ВТОРОЕ ДЕРЕВО, и это прямое исполнение
 * ADR-0024, который
 * отложил `TreeSelect` до заказчика именно с такой формулировкой. Своего обхода
 * узлов, своей клавиатуры и своих ролей компонент не заводит: всё это уже есть
 * у `TreeView`, а расхождение двух деревьев было бы заметно только тому, кто
 * поставит их рядом.
 *
 * ИМЯ ПОЛЯ СОБИРАЕТСЯ ИЗ ПОДПИСИ И СОДЕРЖИМОГО, а не берётся из `aria-label` на
 * кнопке. `aria-label` побеждает содержимое при вычислении имени, и поле
 * объявлялось бы «Подразделение, кнопка» — без единого слова о том, что
 * выбрано. Для поля выбора это отказ основной функции, и аудит axe его не
 * ловит: имя у кнопки есть. Раскладка повторяет `Select`: скрытая подпись плюс
 * узел со значением, оба через `aria-labelledby`.
 *
 * КНОПКА ОЧИСТКИ — СОСЕД ТРИГГЕРА, А НЕ ЕГО ПОТОМОК. Тот же приём, что у
 * `Select`. Кнопка внутри кнопки это `nested-interactive`, а `aria-hidden`-крестик
 * внутри выпадает из дерева доступности целиком — пользователь AT не узнаёт,
 * что очистка вообще есть.
 *
 * ЗНАЧЕНИЕ ВСЕГДА МАССИВ, даже при `single`. Союзный тип `Key | Key[]` заставил
 * бы потребителя разбирать форму в каждом обработчике, а выигрыш дал бы ровно
 * один — короче выглядит в примере.
 *
 * ОТМЕТКА ВЕТКИ НЕ ОТМЕЧАЕТ ПОТОМКОВ, и это не упущение. Такое поведение
 * означало бы, что кит решает за потребителя, значит ли «отдел» всех его
 * сотрудников; в правах доступа это ровно противоположные политики. `TreeView`
 * ведёт выбор ключами, и потребитель волен раскрыть ветку в потомков сам.
 */
export function TreeSelect({
  items,
  value,
  onChange,
  multiple = false,
  placeholder,
  "aria-label": ariaLabel,
  defaultExpandedKeys,
  expandedKeys,
  onExpandedChange,
  disabled = false,
  clearable = false,
  clearLabel,
  className,
}: TreeSelectProps) {
  const messages = useMessages();
  const [open, setOpen] = useState(false);

  /*
    Выключение поля ЗАКРЫВАЕТ панель, а не прячет её.

    `Popover open={open && !disabled}` гасил показ, но управляемая смена `open`
    у Radix не зовёт `onOpenChange`, и внутреннее состояние оставалось `true`:
    форма ушла в отправку — панель исчезла, отправка кончилась — панель
    вернулась сама, хотя пользователь ничего не нажимал. Тот же приём и по той
    же причине, что в `SplitButton`.
  */
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  const byId = useMemo(() => flatten(items), [items]);
  const fieldId = useId();
  const labelId = `${fieldId}-label`;
  const valueId = `${fieldId}-value`;

  const selected = useMemo(() => new Set<Key>(value), [value]);

  // Пустота считается по `value`, а не по найденным узлам: иначе поле с
  // незнакомым ключом показывало бы подсказку пустого состояния и при этом
  // отказывалось очищаться.
  const empty = value.length === 0;
  const captions = value.map((id) => ({ id, caption: captionOf(id, byId.get(id)) }));
  const shownChips = captions.slice(0, CHIP_LIMIT);
  const hidden = captions.length - shownChips.length;

  function onSelectionChange(keys: Selection) {
    // `all` у дерева не встречается: `Ctrl+A` живёт в списках, не в `Tree`.
    const next = keys === "all" ? value : [...keys];
    onChange(next);
    // Одиночный выбор закрывает поповер: цель достигнута, и держать его
    // открытым значит требовать второго жеста там, где всё уже сказано.
    // Множественный оставляет открытым по обратной причине — выбор не закончен.
    if (!multiple) setOpen(false);
  }

  return (
    // `open && !disabled`, а не условный `onOpenChange`: выключение при открытом
    // поповере иначе заклинивало бы его — и Escape, и клик снаружи идут через
    // обработчик, а открыться заново мешает атрибут `disabled` на кнопке.
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      {/*
        Якорь на ОБОЛОЧКЕ, а не на кнопке: `--radix-popover-trigger-width` меряет
        триггер, а при видимой кнопке очистки триггер уже поля — панель
        оказывалась короче того, под чем висит.
      */}
      <PopoverAnchor asChild>
        <span
          className={cn(
            FIELD_SHELL_CLASS,
            "flex w-full items-center gap-2 px-3 py-2",
            disabled && "cursor-not-allowed opacity-50",
            className
          )}
        >
          <VisuallyHidden id={labelId}>{ariaLabel}</VisuallyHidden>

          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              // `grid`, а не `tree`: `TreeView` объявляет `treegrid` с узлами-`row`
              // (в строке живут раскрыватель и флажок), и объявленный тип
              // всплывающего обязан совпадать с тем, что там на самом деле.
              aria-haspopup="grid"
              aria-expanded={open && !disabled}
              aria-labelledby={`${labelId} ${valueId}`}
              onKeyDown={(event) => {
                // Клавиатурный путь к очистке. Кнопка очистки рядом — тоже
                // табстоп, но пара Delete/Backspace короче и привычнее полю.
                if (!clearable || empty || disabled) return;
                if (event.key !== "Delete" && event.key !== "Backspace") return;
                event.preventDefault();
                onChange([]);
              }}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 bg-transparent text-left outline-none disabled:cursor-not-allowed"
            >
              <span id={valueId} className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {empty ? (
                  <span className="text-fg-2 truncate text-[13px]">
                    {placeholder ?? messages.treeSelect.placeholder}
                  </span>
                ) : multiple ? (
                  <>
                    {shownChips.map((chip) => (
                      <span
                        key={String(chip.id)}
                        className="bg-bg-3 text-fg-1 text-caption inline-flex max-w-[150px] items-center rounded-full px-2 py-0.5"
                      >
                        <span className="truncate">{chip.caption}</span>
                      </span>
                    ))}
                    {/*
                    Свёрнутый хвост, а не все чипы подряд: поле, вырастающее на
                    пять строк, перестаёт быть полем. Порог низкий намеренно —
                    точный состав смотрят в раскрытом дереве.
                  */}
                    {hidden > 0 && (
                      <span className="text-fg-2 text-caption">
                        {messages.treeSelect.more({ count: hidden })}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-fg-0 truncate text-[13px]">{captions[0]?.caption}</span>
                )}
              </span>
              <ChevronDownIcon size={16} aria-hidden className="text-fg-2 shrink-0" />
            </button>
          </PopoverTrigger>

          {clearable && !empty && !disabled ? (
            <button
              type="button"
              aria-label={clearLabel ?? messages.common.clear}
              onClick={() => onChange([])}
              className={FIELD_CLEAR_CLASS}
            >
              <CloseIcon size={10} aria-hidden />
            </button>
          ) : null}
        </span>
      </PopoverAnchor>

      <PopoverContent className="max-h-[320px] w-[var(--radix-popover-trigger-width)] overflow-auto p-1">
        <TreeView
          items={items}
          aria-label={ariaLabel}
          selectionMode={multiple ? "multiple" : "single"}
          selectedKeys={selected}
          onSelectionChange={onSelectionChange}
          defaultExpandedKeys={defaultExpandedKeys}
          expandedKeys={expandedKeys}
          onExpandedChange={onExpandedChange}
          // `empty`, а не `notFound`: своего поиска у поля нет, и запроса, по
          // которому «ничего не найдено», пользователь не делал. Словарь кита
          // разводит эти две строки прямо: `notFound` — есть запрос, `empty` —
          // данных нет вовсе.
          emptyText={messages.common.empty}
        />
      </PopoverContent>
    </Popover>
  );
}
