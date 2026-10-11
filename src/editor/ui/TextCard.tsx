"use client";

import { posToDOMRect, type Editor } from "@tiptap/react";
import { useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "../../components/overlays/Popover.js";
import { useMessages, useUiLocale } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { devError } from "../../lib/dev-warn.js";
import { FOCUS_TARGET } from "./focusWithin.js";
import { GLASS_PANEL_CLASS } from "../styles/glass.js";
import { ariaShortcut, isApple } from "../core/shortcuts.js";
import type { TextCardRecord as TextCardEntry } from "../core/toolDescriptor.js";

/*
  Карточка у текста (ADR-0058, п. 7.6–7.11): четвёртый вид UI-записи
  своего Инструмента, например карточка комментария под Меткой. Описание —
  диапазон `rangeAt` и тело `render`; всё остальное держит кит.

  ЧТО ОТКРЫТО, РЕШАЕТ ОДНА ФУНКЦИЯ `evaluate`, и зовётся она на каждой
  транзакции, фокусе, потере фокуса и щелчке по Документу — не на наведении.
  Каретка — свёрнутое выделение; развёрнутое выделение закрывает Карточку (там
  работает Меню выделения). Открыта не больше одной: самый узкий диапазон под
  кареткой, при равной ширине — запись раньше в списке, то есть Инструмент
  раньше в `tools`.

  ВЫШЕ ДОКУМЕНТА, НО НЕ МОДАЛЬНО. Рамка — `Popover` кита: слой, стек Escape
  (ADR-0041), переворот у края. Фокус при открытии остаётся в Документе —
  печать не прерывается; `Alt+F10` переводит его в Карточку, Escape возвращает
  каретку и прячет Карточку. «Спрятана» — состояние `dismissed`: оно снимается,
  когда каретка покинет диапазон этой записи, или щелчком по диапазону.

  READONLY. Каретки у такого поля нет (Документ не принимает фокус в текст),
  поэтому открывает щелчок: место щелчка запоминается и едет за правкой.
  Фокус не требуется; закрывает щелчок мимо поля, Escape или выделение мышью.
*/

/** Открытая Карточка: номер записи и её диапазон на текущем состоянии. */
interface Shown {
  index: number;
  from: number;
  to: number;
}

/** Что `RichTextEditor` просит у Карточки извне: `Alt+F10` ведёт в неё. */
export interface TextCardControl {
  /** Перевести фокус в открытую Карточку; `false` — Карточки нет или она спрятана. */
  focus: () => boolean;
}

/**
 * Записи, у которых есть диапазон под `pos`. Ответ, которому нельзя верить
 * (вне Документа, `from > to`, не числа), отбрасывается; исключение в `rangeAt`
 * — тоже: чужая функция не роняет поле.
 */
function rangesAt(editor: Editor, entries: readonly TextCardEntry[], pos: number): Shown[] {
  const { state } = editor;
  const size = state.doc.content.size;
  const found: Shown[] = [];
  entries.forEach((entry, index) => {
    try {
      const range = entry.rangeAt(state, pos);
      if (
        range &&
        Number.isInteger(range.from) &&
        Number.isInteger(range.to) &&
        range.from >= 0 &&
        range.from <= range.to &&
        range.to <= size
      ) {
        found.push({ index, from: range.from, to: range.to });
      }
    } catch (error) {
      devError(`RichTextEditor: text card "${entry.id}" threw in rangeAt`, error);
    }
  });
  return found;
}

/** Самый узкий диапазон; при равной ширине — запись раньше (`found` идёт по порядку). */
const narrowest = (found: readonly Shown[]): Shown | null =>
  found.reduce<Shown | null>(
    (best, item) => (best && best.to - best.from <= item.to - item.from ? best : item),
    null
  );

export interface TextCardProps {
  editor: Editor;
  entries: readonly TextCardEntry[];
  /** Выключено поле или HTML-режим: Карточек нет. */
  enabled: boolean;
  readOnly: boolean;
  /** Корень поля: щелчок внутри него Карточку не закрывает сам по себе. */
  rootRef: RefObject<HTMLElement | null>;
  controlRef: MutableRefObject<TextCardControl | null>;
}

export function TextCard({
  editor,
  entries,
  enabled,
  readOnly,
  rootRef,
  controlRef,
}: TextCardProps) {
  const messages = useMessages().editor;
  const locale = useUiLocale();
  const [shown, setShown] = useState<Shown | null>(null);
  const shownRef = useRef<Shown | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  /** Запись, чью Карточку спрятали; нет — не прятали. */
  const dismissed = useRef<number | null>(null);
  /** `readOnly`: место последнего щелчка, едет за правкой. */
  const pinned = useRef<number | null>(null);
  const latest = useRef({ entries, enabled, readOnly });
  latest.current = { entries, enabled, readOnly };

  const evaluateRef = useRef<(settled?: boolean) => void>(() => {});
  /** Пересчёт на такт позже: к тому времени фокус уже встал на новое место. */
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const later = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => evaluateRef.current(true), 0);
  };
  evaluateRef.current = (settled = false) => {
    const { entries: list, enabled: on, readOnly: reading } = latest.current;
    let next: Shown | null = null;
    if (on && !editor.isDestroyed) {
      const { selection } = editor.state;
      const pos = reading ? pinned.current : selection.empty ? selection.head : null;
      const card = cardRef.current;
      // Каретка живёт там, где фокус: в Документе или в самой Карточке.
      const focused =
        reading ||
        editor.view.hasFocus() ||
        (card != null && card.contains(card.ownerDocument.activeElement));
      // Фокус «ушёл» посреди перехода — в самом `blur` активного элемента ещё
      // нет: решает пересчёт на такт позже, а пока Карточка стоит как стояла.
      if (!focused && !settled && shownRef.current !== null) return later();
      if (pos !== null && focused) {
        let found = rangesAt(editor, list, pos);
        if (dismissed.current !== null) {
          // Спрятана, пока каретка в диапазоне этой записи: ни она, ни соседи не всплывают.
          if (found.some((item) => item.index === dismissed.current)) found = [];
          else dismissed.current = null;
        }
        next = narrowest(found);
      }
    }
    const previous = shownRef.current;
    if (
      previous?.index === next?.index &&
      previous?.from === next?.from &&
      previous?.to === next?.to
    ) {
      return;
    }
    shownRef.current = next;
    setShown(next);
  };

  /** Спрятать до выхода каретки; фокус из Карточки — в Документ, каретка на месте. */
  const dismiss = () => {
    const card = cardRef.current;
    if (card?.contains(card.ownerDocument.activeElement)) editor.view.focus();
    dismissed.current = shownRef.current?.index ?? null;
    shownRef.current = null;
    setShown(null);
  };

  useEffect(() => {
    const evaluate = () => evaluateRef.current();
    const onTransaction = ({
      transaction,
    }: {
      transaction: { docChanged: boolean; mapping: { map: (pos: number) => number } };
    }) => {
      if (pinned.current !== null && transaction.docChanged) {
        pinned.current = transaction.mapping.map(pinned.current);
      }
      evaluate();
    };
    const onClick = (event: MouseEvent) => {
      const { enabled: on, readOnly: reading, entries: list } = latest.current;
      if (!on || editor.isDestroyed) return;
      const { view } = editor;
      // Место щелчка: по координатам; без раскладки (jsdom) — начало узла под ним.
      let pos: number | undefined;
      try {
        pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
      } catch {
        // Координатам нечем мерить — запасной путь ниже.
      }
      try {
        if (pos === undefined && event.target instanceof Node) pos = view.posAtDOM(event.target, 0);
      } catch {
        // Узел вне Документа: щелчок места не назвал.
      }
      if (pos === undefined) return;
      if (reading) {
        // Выделение мышью (двойной щелчок по слову) — не открытие.
        const selection = view.dom.ownerDocument.getSelection();
        if (selection && !selection.isCollapsed) {
          pinned.current = null;
          return evaluate();
        }
        pinned.current = pos;
      }
      // Щелчок по диапазону спрятанной Карточки открывает её снова.
      if (dismissed.current !== null) {
        const entry = list[dismissed.current];
        if (entry && rangesAt(editor, [entry], pos).length > 0) dismissed.current = null;
      }
      evaluate();
    };
    editor.on("transaction", onTransaction);
    editor.on("focus", evaluate);
    editor.on("blur", later);
    editor.view.dom.addEventListener("click", onClick);
    // Другая запись, режим или поле — свой пересчёт.
    evaluate();
    return () => {
      clearTimeout(timer.current);
      editor.off("transaction", onTransaction);
      editor.off("focus", evaluate);
      editor.off("blur", later);
      editor.view.dom.removeEventListener("click", onClick);
    };
  }, [editor]);

  useEffect(() => {
    if (!enabled) pinned.current = null;
    evaluateRef.current();
  }, [entries, enabled, readOnly]);

  useEffect(() => {
    controlRef.current = {
      focus: () => {
        const card = cardRef.current;
        if (!card || shownRef.current === null) return false;
        (card.querySelector<HTMLElement>(FOCUS_TARGET) ?? card).focus();
        return true;
      },
    };
    return () => {
      controlRef.current = null;
    };
  }, [controlRef]);

  const entry = shown ? entries[shown.index] : undefined;
  const label = entry?.label(messages, locale) ?? "";
  // Якорь меряется при каждом пересчёте позиции: Карточка едет за диапазоном.
  const anchor = useMemo(
    () => ({
      current: {
        getBoundingClientRect: () => {
          try {
            return posToDOMRect(editor.view, shown?.from ?? 0, shown?.to ?? 0);
          } catch {
            return editor.view.dom.getBoundingClientRect();
          }
        },
        contextElement: editor.view.dom,
      },
    }),
    [editor, shown?.from, shown?.to]
  );

  return (
    <>
      {/* Живой регион смонтирован всегда: скринридер объявляет изменение, а не появление. */}
      <div role="status" className="sr-only">
        {entry
          ? messages.textCardShown({ label, shortcut: ariaShortcut(["alt", "F10"], isApple()) })
          : ""}
      </div>
      {shown && entry && (
        <Popover key={shown.index} open onOpenChange={(open) => !open && dismiss()}>
          <PopoverAnchor virtualRef={anchor} />
          <PopoverContent
            ref={cardRef}
            aria-label={label}
            side="bottom"
            align="start"
            collisionPadding={8}
            // Стекло поповеров Редактора: Карточка лежит над Документом.
            className={cn(
              GLASS_PANEL_CLASS,
              "max-h-[var(--radix-popover-content-available-height)] w-auto max-w-[min(24rem,calc(100vw-1rem))] overflow-y-auto p-2"
            )}
            // Фокус остаётся в Документе: Карточка немодальна, печать продолжается.
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            // Закрывает не Radix, а правила выше: Escape, `close`, выход каретки,
            // щелчок мимо поля. Щелчок и фокус в самом поле — дело пересчёта.
            onFocusOutside={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => {
              event.preventDefault();
              const target = event.target;
              if (target instanceof Node && rootRef.current?.contains(target)) return;
              pinned.current = null;
              shownRef.current = null;
              setShown(null);
            }}
            onBlur={later}
          >
            {entry.render({ editor, range: shown, close: dismiss })}
          </PopoverContent>
        </Popover>
      )}
    </>
  );
}
