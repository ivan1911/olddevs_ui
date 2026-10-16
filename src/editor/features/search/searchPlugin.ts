"use client";

import { Extension } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import type { EditorState, Selection, Transaction } from "@tiptap/pm/state";
import { NodeSelection, Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { findMatches, type SearchMatch, type SearchOptions } from "./searchMatch.js";

/**
 * Состояние поиска в движке: запрос, опции, совпадения и текущее.
 * Держит его плагин, а не React: совпадения пересчитываются в той же
 * транзакции, что меняет Документ, и подсветка не отстаёт от текста ни на
 * кадр. Панель только читает его (`searchState`) и шлёт команды.
 */
interface SearchPluginState {
  query: string;
  options: SearchOptions;
  matches: SearchMatch[];
  /** Индекс текущего совпадения; −1 — совпадений нет. */
  current: number;
  error?: string;
  decorations: DecorationSet;
}

type SearchMeta =
  | { type: "set"; query: string; options?: Partial<SearchOptions> }
  | { type: "select"; index: number }
  /** «Заменить» заменило не текущее совпадение (текущая — формула): искать дальше от каретки. */
  | { type: "replaced" }
  | { type: "clear" };

const SEARCH_KEY = new PluginKey<SearchPluginState>("search");

const EMPTY_OPTIONS: SearchOptions = { matchCase: false, wholeWord: false, regex: false };

/** Что панели нужно знать о поиске; `undefined` — инструмента `search` в наборе нет. */
export function searchState(state: EditorState):
  | {
      query: string;
      options: SearchOptions;
      current: number;
      total: number;
      error?: string;
      matches: readonly SearchMatch[];
    }
  | undefined {
  const plugin = SEARCH_KEY.getState(state);
  if (!plugin) return undefined;
  const { query, options, current, matches, error } = plugin;
  return { query, options, current, total: matches.length, error, matches };
}

/**
 * Выделение совпадения: текст — отрезок, формула — узел целиком. Отрезок через
 * блочную формулу был бы выделением вне текста, а на строчной — не отличался бы
 * от выделения узла только в Chromium.
 */
export function matchSelection(doc: PmNode, { from, to, formula }: SearchMatch): Selection {
  return formula ? NodeSelection.create(doc, from) : TextSelection.create(doc, from, to);
}

function decorate(state: EditorState, matches: SearchMatch[], current: number): DecorationSet {
  if (matches.length === 0) return DecorationSet.empty;
  return DecorationSet.create(
    state.doc,
    matches.map(({ from, to, formula }, index) => {
      const attributes = {
        class: index === current ? "rte-search-match rte-search-current" : "rte-search-match",
      };
      // Формула — атом с видом узла: подсветка узла целиком, а не отрезок текста в нём.
      return formula
        ? Decoration.node(from, to, attributes)
        : Decoration.inline(from, to, attributes);
    })
  );
}

/** Индекс первого совпадения не раньше позиции; нет такого — первое по кругу. */
function indexFrom(matches: SearchMatch[], pos: number): number {
  if (matches.length === 0) return -1;
  const found = matches.findIndex((match) => match.from >= pos);
  return found === -1 ? 0 : found;
}

function build(
  state: EditorState,
  query: string,
  options: SearchOptions,
  current: (matches: SearchMatch[]) => number
): SearchPluginState {
  const { matches, error } = findMatches(state.doc, query, options);
  const index = current(matches);
  return {
    query,
    options,
    matches,
    current: index,
    error,
    decorations: decorate(state, matches, index),
  };
}

/**
 * Флажки после `setSearch`: названные в `named` заменяют прежние, остальные
 * остаются. Ключ со значением `undefined` — не названный: обычное слияние
 * `{ ...a, ...b }` стёрло бы им флажок, а вызов `setQuery(q, { matchCase: value })`
 * с необязательным значением экрана не просит ничего менять.
 */
function withNamedFlags(current: SearchOptions, named: Partial<SearchOptions> = {}): SearchOptions {
  const next = { ...current };
  for (const key of Object.keys(named) as (keyof SearchOptions)[]) {
    const value = named[key];
    if (value !== undefined) next[key] = value;
  }
  return next;
}

/**
 * @param flags флажки без запроса: до первого `setSearch` и после `clearSearch`
 * (Опции Инструмента). Поиск, который идёт, держит свои.
 */
function searchPlugin(flags: SearchOptions) {
  return new Plugin<SearchPluginState>({
    key: SEARCH_KEY,
    state: {
      init: (_, state) => build(state, "", flags, () => -1),
      apply(tr: Transaction, previous, _old, state) {
        const meta = tr.getMeta(SEARCH_KEY) as SearchMeta | undefined;
        if (meta?.type === "clear") return build(state, "", flags, () => -1);
        if (meta?.type === "set") {
          return build(
            state,
            meta.query,
            withNamedFlags(previous.options, meta.options),
            (matches) => indexFrom(matches, state.selection.from)
          );
        }
        if (meta?.type === "select") {
          return {
            ...previous,
            current: meta.index,
            decorations: decorate(state, previous.matches, meta.index),
          };
        }
        if (!tr.docChanged || previous.query === "") return previous;
        /*
          Правка Документа: совпадения пересчитываются целиком — запрос мог
          найтись в новом тексте или исчезнуть в старом. Текущим остаётся то,
          что стоит на месте прежнего текущего (или первое после него).
        */
        const anchor = previous.matches[previous.current];
        const pos =
          anchor && meta?.type !== "replaced"
            ? tr.mapping.map(anchor.from, -1)
            : state.selection.from;
        return build(state, previous.query, previous.options, (matches) => indexFrom(matches, pos));
      },
    },
    props: {
      decorations: (state) => SEARCH_KEY.getState(state)?.decorations,
    },
  });
}

/**
 * Текст замены для совпадения. С регулярным выражением работают `$1…$9`,
 * `$&` (совпадение целиком) и `$$` (знак доллара) — по группам, которые поиск
 * сохранил у совпадения (`SearchMatch.captures`). Без выражения замена —
 * текст как есть, и «$1» остаётся «$1».
 */
function replacementFor(match: SearchMatch, replacement: string, options: SearchOptions) {
  if (!options.regex) return replacement;
  return replacement.replace(/\$(\$|&|[1-9])/g, (token, key: string) => {
    if (key === "$") return "$";
    if (key === "&") return match.captures[0] ?? "";
    const index = Number(key);
    return index < match.captures.length ? (match.captures[index] ?? "") : token;
  });
}

/** Заменить отрезок текстом с Метками начала совпадения; пустая замена — удалить. */
function replaceRange(tr: Transaction, { from, to }: SearchMatch, text: string) {
  if (text === "") {
    tr.delete(from, to);
    return;
  }
  const marks = tr.doc.nodeAt(from)?.marks ?? [];
  tr.replaceWith(from, to, tr.doc.type.schema.text(text, marks));
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    search: {
      /**
       * Новый запрос или флажки: совпадения пересчитываются, текущее — первое после
       * каретки. Не названные флажки остаются как были.
       */
      setSearch: (query: string, options?: Partial<SearchOptions>) => ReturnType;
      /**
       * Следующее (`1`) или предыдущее (`-1`) совпадение по кругу; выделяет его.
       * Прокрутка ProseMirror срабатывает, только когда фокус в Документе; из
       * поля поиска к совпадению прокручивает панель (`revealMatch.ts`).
       */
      searchStep: (step: 1 | -1) => ReturnType;
      /**
       * Заменить текущее совпадение — одна правка, одна отмена. Формулы пропускаются:
       * если текущая — формула, заменяется следующее за ней совпадение с текстом;
       * заменять нечего — `false`.
       */
      replaceMatch: (replacement: string) => ReturnType;
      /**
       * Заменить все совпадения с текстом — одна транзакция, одна отмена. Формулы не
       * трогаются и остаются совпадениями: счётчик после замены показывает их.
       */
      replaceAllMatches: (replacement: string) => ReturnType;
      /** Убрать запрос и подсветку; флажки вернутся к Опциям Инструмента. */
      clearSearch: () => ReturnType;
    };
  }
}

export interface SearchExtensionOptions {
  /** Флажки, с которых стартует поиск и к которым он возвращается: Опции Инструмента. */
  flags: SearchOptions;
  /**
   * Открыть панель поиска (`replace` — с фокусом в поле замены). Панель держит
   * `RichTextEditor`; `false` — панели нет, и `Mod+F` уходит браузеру.
   */
  open: (replace: boolean) => boolean;
}

/**
 * Поиск и замена по Документу: состояние и подсветка в плагине,
 * команды для панели и сочетания. Своей Схемы нет, как у `clearFormatting`.
 *
 * `Mod+F` берётся, только когда фокус в Документе: вне поля браузер ищет по
 * странице как обычно — так у Google Docs и Notion.
 */
export const SearchExtension = Extension.create<SearchExtensionOptions>({
  name: "search",
  addOptions: () => ({ open: () => false, flags: EMPTY_OPTIONS }),
  addProseMirrorPlugins() {
    return [searchPlugin(this.options.flags)];
  },
  addKeyboardShortcuts() {
    return {
      "Mod-f": () => this.options.open(false),
      "Mod-Alt-f": () => this.options.open(true),
    };
  },
  addCommands() {
    return {
      setSearch:
        (query, options) =>
        ({ tr, dispatch }) => {
          if (dispatch)
            tr.setMeta(SEARCH_KEY, { type: "set", query, options } satisfies SearchMeta);
          return true;
        },
      searchStep:
        (step) =>
        ({ state, tr, dispatch }) => {
          const search = SEARCH_KEY.getState(state);
          if (!search || search.matches.length === 0) return false;
          const total = search.matches.length;
          const index = search.current === -1 ? 0 : (search.current + step + total) % total;
          const match = search.matches[index]!;
          if (dispatch) {
            tr.setMeta(SEARCH_KEY, { type: "select", index } satisfies SearchMeta);
            tr.setSelection(matchSelection(tr.doc, match)).scrollIntoView();
          }
          return true;
        },
      replaceMatch:
        (replacement) =>
        ({ state, tr, dispatch, editor }) => {
          const search = SEARCH_KEY.getState(state);
          const current = search?.matches[search.current];
          if (!search || !current || !editor.isEditable) return false;
          // Формулы Заменить не трогает: берётся ближайшее совпадение с текстом по кругу.
          const total = search.matches.length;
          const match = [...search.matches.keys()]
            .map((offset) => search.matches[(search.current + offset) % total]!)
            .find((candidate) => !candidate.formula);
          if (!match) return false;
          if (dispatch) {
            if (match !== current)
              tr.setMeta(SEARCH_KEY, { type: "replaced" } satisfies SearchMeta);
            replaceRange(tr, match, replacementFor(match, replacement, search.options));
            // Каретка — за заменой: текущим станет следующее совпадение.
            tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(match.to)));
          }
          return true;
        },
      replaceAllMatches:
        (replacement) =>
        ({ state, tr, dispatch, editor }) => {
          const search = SEARCH_KEY.getState(state);
          const texts = search?.matches.filter((match) => !match.formula) ?? [];
          if (!search || texts.length === 0 || !editor.isEditable) return false;
          if (dispatch) {
            // С конца: замена не сдвигает ещё не заменённые отрезки.
            for (const match of texts.reverse()) {
              replaceRange(tr, match, replacementFor(match, replacement, search.options));
            }
          }
          return true;
        },
      clearSearch:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(SEARCH_KEY, { type: "clear" } satisfies SearchMeta);
          return true;
        },
    };
  },
});
