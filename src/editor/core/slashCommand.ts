"use client";

import { Extension, type Editor, type Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { exitSuggestion, Suggestion } from "@tiptap/suggestion";

/** Ключ плагина: по нему меню закрывает сессию снаружи (`closeSlashMenu`). */
const SLASH_KEY = new PluginKey("olddevsSlashMenu");

/**
 * Ключ плагина своего триггера — свой на каждый символ (ADR-0064): плагинам
 * `@tiptap/suggestion` в одном состоянии нужны разные ключи, а сессию
 * закрывают снаружи по тому же ключу. Один ключ на символ на весь модуль:
 * ключ — идентификатор, а не состояние, и разные Редакторы делят его без вреда.
 */
const TRIGGER_KEYS = new Map<string, PluginKey>([["/", SLASH_KEY]]);

function triggerKey(char: string): PluginKey {
  let key = TRIGGER_KEYS.get(char);
  if (!key) {
    key = new PluginKey(`olddevsTrigger:${char}`);
    TRIGGER_KEYS.set(char, key);
  }
  return key;
}

/** Сессия символа-триггера: что набрано, где и как найти курсор на экране. */
export interface SlashSession {
  /** Набранное после символа, без него самого. */
  query: string;
  /** Диапазон `символ+запрос` в документе — его заменяет выбранный пункт. */
  range: Range;
  /** Прямоугольник набранного на экране — якорь списка. */
  rect: () => DOMRect | null;
}

/**
 * Мост между плагином и React. Расширение живёт столько же, сколько движок,
 * а меню — компонент, поэтому мост — объект с подменяемыми полями, а не
 * колбэки в опциях: пересоздавать движок ради нового обработчика нельзя.
 */
export interface SlashBridge {
  open: (session: SlashSession) => void;
  close: () => void;
  /** Клавиша при открытом меню; `true` — меню её съело, движку она не нужна. */
  keyDown: (event: KeyboardEvent) => boolean;
}

/** Закрыть сессию `/`, оставив набранное в тексте (Escape, щелчок мимо). */
export function closeSlashMenu(view: Parameters<typeof exitSuggestion>[0]): void {
  exitSuggestion(view, SLASH_KEY);
}

/** Закрыть сессию своего триггера `char`, оставив набранное в тексте. */
export function closeTrigger(view: Parameters<typeof exitSuggestion>[0], char: string): void {
  exitSuggestion(view, triggerKey(char));
}

/**
 * Плагин символа-триггера: общая механика «/» и своих символов. Сопоставление
 * — `@tiptap/suggestion`: символ в начале Блока или после пробела, запрос — до
 * пробела. Внутри слова (`и/или`, `a@b.com`) список молчит: перед символом нет
 * разрешённого префикса. Неразрывный пробел — тоже пробел: браузер ставит его
 * в `contenteditable` на месте конечного.
 *
 * В блоке кода и в строчном коде список не открывается: там символ — это пути,
 * комментарии и деление, а не команда.
 *
 * Escape до плагина обычно не доходит: открытый список — слой Radix, и стек
 * слоёв забирает Escape раньше движка (`SlashMenu`). Ветка плагина остаётся
 * на случай, когда списка на экране нет, — сессия тогда закрывается так же.
 */
function triggerPlugin(editor: Editor, char: string, bridge: SlashBridge) {
  const open = (props: {
    query: string;
    range: Range;
    clientRect?: (() => DOMRect | null) | null;
  }) =>
    bridge.open({
      query: props.query,
      range: props.range,
      rect: () => props.clientRect?.() ?? null,
    });
  return Suggestion({
    editor,
    pluginKey: triggerKey(char),
    char,
    allowedPrefixes: [" ", "\u00a0"],
    allow: ({ state, range }) => {
      const $from = state.doc.resolve(range.from);
      if ($from.parent.type.spec.code) return false;
      return !$from.marks().some((mark) => mark.type.spec.code);
    },
    render: () => ({
      onStart: open,
      onUpdate: open,
      onExit: () => bridge.close(),
      onKeyDown: ({ event }) => (event.key === "Escape" ? false : bridge.keyDown(event)),
    }),
  });
}

/**
 * Открытие Меню вставки по `/`: правила символа-триггера (`triggerPlugin`).
 */
export const SlashCommand = Extension.create<{ bridge: SlashBridge | null }>({
  name: "slashCommand",

  addOptions() {
    return { bridge: null };
  },

  addProseMirrorPlugins() {
    const bridge = this.options.bridge;
    if (!bridge) return [];
    return [triggerPlugin(this.editor, "/", bridge)];
  },
});

/** Символ своего триггера и мост его списка. */
export interface TriggerBinding {
  char: string;
  bridge: SlashBridge;
}

/**
 * Свои символы-триггеры Инструментов (ADR-0064): по плагину на символ, у
 * каждого свой ключ. Символ проверяет набор Инструментов (`customToolsError`),
 * здесь он уже годный и уникальный.
 */
export const TriggerCommand = Extension.create<{ triggers: readonly TriggerBinding[] }>({
  name: "triggerCommand",

  addOptions() {
    return { triggers: [] };
  },

  addProseMirrorPlugins() {
    return this.options.triggers.map(({ char, bridge }) =>
      triggerPlugin(this.editor, char, bridge)
    );
  },
});
