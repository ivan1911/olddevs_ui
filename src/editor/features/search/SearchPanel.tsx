"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "../../../components/actions/Button.js";
import { Toggle } from "../../../components/actions/Toggle.js";
import { Checkbox } from "../../../components/inputs/Checkbox.js";
import { TextControl } from "../../../components/inputs/TextControl.js";
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from "../../../icons.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { cn } from "../../../lib/cn.js";
import { GLASS_PANEL_CLASS } from "../../styles/glass.js";
import type { SearchOptions } from "./searchMatch.js";
import { revealCurrentMatch } from "./revealMatch.js";
import { searchState } from "./searchPlugin.js";

export interface SearchPanelProps {
  editor: Editor;
  /**
   * Запрос на фокус: каждое открытие (кнопка, `Mod+F`, `Mod+Alt+F`, Хэндл)
   * приносит новый `token`, и панель ставит фокус заново — повторный `Mod+F`
   * при открытой панели выделяет текст поля поиска.
   */
  focus: { token: number; replace: boolean; query: string };
  /**
   * Стартовые флажки (Опции Инструмента `search`). Читаются при открытии
   * панели; закрытая панель размонтируется, и следующее открытие снова
   * начинает с них, а не с того, что автор переключил в прошлый раз.
   */
  initialOptions?: SearchOptions;
  onClose: () => void;
  className?: string;
}

const NO_OPTIONS: SearchOptions = { matchCase: false, wholeWord: false, regex: false };

/**
 * Панель «Поиск и замена»: немодальная, в углу поля. Состояние
 * поиска — в плагине движка (`searchPlugin.ts`); панель держит только то, что
 * набрал автор, и шлёт команды.
 *
 * НЕМОДАЛЬНАЯ, БЕЗ ЛОВУШКИ ФОКУСА: автор ищет, правит найденное в Документе и
 * возвращается в поле поиска — как в Google Docs. Escape из любого её поля
 * закрывает панель и ставит каретку на текущее совпадение.
 *
 * Грузится лениво, при первом открытии (`RichTextEditor.tsx`): поля, флажки и
 * переключатель не ложатся на «старт» Редактора, а плагин подсветки маленький и
 * стоит в нём.
 */
export function SearchPanel({
  editor,
  focus,
  initialOptions = NO_OPTIONS,
  onClose,
  className,
}: SearchPanelProps) {
  const messages = useMessages().editor;
  const [query, setQuery] = useState(focus.query);
  const [replacement, setReplacement] = useState("");
  const [options, setOptions] = useState(initialOptions);
  const searchRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const errorId = useId();

  const search = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const state = searchState(current.state);
      return {
        current: state?.current ?? -1,
        total: state?.total ?? 0,
        error: state?.error,
        editable: current.isEditable,
      };
    },
  });

  // Новое открытие: выделенный в Документе текст — в поле.
  useEffect(() => {
    if (focus.query) setQuery(focus.query);
  }, [focus.token, focus.query]);
  /*
    Фокус и выделение текста поля — один раз на открытие и когда новый запрос
    уже встал в поле: иначе `select()` выделил бы прежний текст, а смена
    значения тут же сняла бы выделение. Правка поля автором сюда не попадает:
    её открытие уже обработано.
  */
  const handled = useRef(-1);
  useLayoutEffect(() => {
    if (handled.current === focus.token) return;
    if (focus.query && query !== focus.query) return;
    handled.current = focus.token;
    const field = focus.replace && replaceRef.current ? replaceRef.current : searchRef.current;
    field?.focus();
    field?.select();
  }, [focus.token, focus.query, focus.replace, query]);

  /*
    Текущее совпадение — в видимую область (`revealMatch.ts`): ProseMirror сам
    не прокручивает, пока фокус в поле поиска. Кадр спустя — когда панель уже
    разложена и её край можно учесть. Панель и её липкий родитель (Панель
    Редактора) лежат поверх Документа: совпадение под ними не считается видимым.
  */
  const revealFrame = useRef(0);
  const reveal = () => {
    cancelAnimationFrame(revealFrame.current);
    revealFrame.current = requestAnimationFrame(() => {
      const panel = panelRef.current;
      revealCurrentMatch(editor.view.dom, [panel, panel?.parentElement]);
    });
  };
  useEffect(() => () => cancelAnimationFrame(revealFrame.current), []);

  useEffect(() => {
    editor.commands.setSearch(query, options);
    // Уже при наборе, а не только по Enter. Выделение Документа не трогаем:
    // фокус в поле поиска, и набор не должен его уводить.
    reveal();
    // `reveal` — новая на каждый рендер, но читает только рефы и `editor`.
  }, [editor, query, options]);

  const step = (direction: 1 | -1) => {
    editor.commands.searchStep(direction);
    reveal();
  };
  // Заменённое уходит, текущим становится следующее — его и показать.
  const replaceOne = () => {
    editor.commands.replaceMatch(replacement);
    reveal();
  };

  // Каретку на совпадение и фокус в Документ ставит `RichTextEditor` (`closeSearch`).
  const close = onClose;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };

  const toggle = (key: keyof SearchOptions) => (checked: boolean) =>
    setOptions((previous) => ({ ...previous, [key]: checked }));

  const hasMatches = search.total > 0;
  const counter = hasMatches ? `${search.current + 1} / ${search.total}` : "0 / 0";
  const status =
    query === "" || search.error
      ? ""
      : hasMatches
        ? messages.searchCount({ current: search.current + 1, total: search.total })
        : messages.searchNoMatches;

  return (
    <section
      ref={panelRef}
      role="search"
      aria-label={messages.searchPanel}
      onKeyDown={onKeyDown}
      className={cn(
        GLASS_PANEL_CLASS,
        "border-line flex flex-col gap-2 rounded-md border p-3 shadow-[var(--shadow-2)]",
        className
      )}
    >
      <div className="flex items-center gap-1">
        <span aria-hidden="true" className="text-fg-2 mr-auto text-xs tabular-nums">
          {counter}
        </span>
        <div role="status" className="sr-only">
          {status}
        </div>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label={messages.searchPrevious}
          icon={<ChevronUpIcon size={16} aria-hidden />}
          disabled={!hasMatches}
          onClick={() => step(-1)}
        />
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label={messages.searchNext}
          icon={<ChevronDownIcon size={16} aria-hidden />}
          disabled={!hasMatches}
          onClick={() => step(1)}
        />
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label={messages.searchClose}
          icon={<CloseIcon size={16} aria-hidden />}
          onClick={close}
        />
      </div>

      <TextControl
        ref={searchRef}
        size="sm"
        aria-label={messages.searchField}
        placeholder={messages.searchField}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-invalid={search.error ? true : undefined}
        aria-describedby={search.error ? errorId : undefined}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          step(event.shiftKey ? -1 : 1);
        }}
      />
      {search.error && (
        <p id={errorId} className="text-danger text-xs">
          {messages.searchInvalid}
        </p>
      )}

      {search.editable && (
        <TextControl
          ref={replaceRef}
          size="sm"
          aria-label={messages.replaceField}
          placeholder={messages.replaceField}
          value={replacement}
          onChange={(event) => setReplacement(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            replaceOne();
          }}
        />
      )}

      <div className="flex flex-col gap-1.5 py-1">
        <Checkbox size="sm" checked={options.matchCase} onCheckedChange={toggle("matchCase")}>
          {messages.searchMatchCase}
        </Checkbox>
        <Checkbox size="sm" checked={options.wholeWord} onCheckedChange={toggle("wholeWord")}>
          {messages.searchWholeWord}
        </Checkbox>
        <div className="flex items-center justify-between gap-2">
          <span aria-hidden="true" className="text-fg-1 text-xs">
            {messages.searchRegex}
          </span>
          <Toggle
            label={messages.searchRegex}
            checked={options.regex}
            onCheckedChange={toggle("regex")}
          />
        </div>
      </div>

      {search.editable && (
        <div className="flex justify-end gap-2">
          <Button variant="soft" size="sm" disabled={!hasMatches} onClick={replaceOne}>
            {messages.replaceOne}
          </Button>
          <Button
            variant="soft"
            size="sm"
            disabled={!hasMatches}
            onClick={() => editor.commands.replaceAllMatches(replacement)}
          >
            {messages.replaceAll}
          </Button>
        </div>
      )}
    </section>
  );
}
