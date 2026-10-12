"use client";

import { NodeViewContent, NodeViewWrapper, type Editor, type NodeViewProps } from "@tiptap/react";
import { useEffect, useRef, useSyncExternalStore, type Key, type KeyboardEvent } from "react";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuSection,
  MenuTrigger,
} from "../../../components/overlays/Menu.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { ChevronDownIcon } from "../../../icons.js";
import type { RichCodeBlockOptions } from "./codeBlock.js";
import { CodeCopyButton } from "./CodeCopyButton.js";
import { CODE_BLOCK_CLASS, CODE_HEADER_CLASS, CODE_LABEL_CLASS } from "./codeHeader.js";
import {
  CODE_LANGUAGES,
  codeLanguage,
  normalizeCodeLanguage,
  type CodeLanguageId,
} from "./codeLanguages.js";
import { GLASS_MENU_CLASS } from "../../styles/glass.js";

/** Атрибут кнопки языка у блока: по нему `Alt+F10` находит её в DOM блока. */
export const CODE_LANGUAGE_TRIGGER = "data-code-language-trigger";

/** Атрибут кнопки «Копировать»: по нему стрелки и `Alt+F10` ходят между кнопками шапки. */
export const CODE_COPY_TRIGGER = "data-code-copy-trigger";

/**
 * Сменить язык блока на позиции `pos` — одной транзакцией, то есть одним шагом
 * отмены. Шаг меняет только атрибут (`AttrStep`) и не задевает текст, поэтому
 * история не склеивает его с набором перед ним: `Mod+Z` возвращает язык, а код
 * остаётся (сторожит `tests/rich-text-editor-code-block.test.tsx`).
 */
function setCodeLanguage(editor: Editor, pos: number, language: CodeLanguageId | null) {
  editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, "language", language));
}

/** Ключ пункта «Обычный текст» в меню: у блока без языка имени нет. */
const PLAIN_KEY = "plain";

/*
  RAC ставит триггеру меню `aria-haspopup="true"`; явное `menu` — как у меню
  «Таблица» на Панели.
*/
const HAS_POPUP_MENU = { "aria-haspopup": "menu" } as object;

/**
 * Можно ли править Документ — по атрибуту `contenteditable` корня.
 *
 * ПОЧЕМУ НЕ `editor.isEditable` ОДИН РАЗ. `readOnly` и `disabled` меняются на
 * лету через `setEditable` без транзакции, а представление узла перерисовывается
 * только при смене самого узла: кнопка осталась бы у поля, которое уже нельзя
 * править. ProseMirror отражает режим в `contenteditable` корня — за ним и следим.
 */
function useEditable(editor: Editor): boolean {
  return useSyncExternalStore(
    (notify) => {
      const observer = new MutationObserver(notify);
      observer.observe(editor.view.dom, {
        attributes: true,
        attributeFilter: ["contenteditable"],
      });
      return () => observer.disconnect();
    },
    () => editor.isEditable,
    () => false
  );
}

/**
 * Блок кода в Редакторе: шапка с языком слева и «Копировать» справа, под ней код.
 *
 * ШАПКА — ХРОМ БЛОКА (`contentEditable={false}`): ProseMirror не ставит в неё
 * каретку и не принимает её текст за содержимое блока; выделение и копия
 * Документа её не захватывают (`select-none`). Полоса в потоке, а не поверх
 * кода: первая строка не уходит под кнопки, как бы длинна ни была.
 *
 * Язык — `Menu` кита: стек оверлеев ADR-0041, стрелки, `Escape` и радиогруппа с
 * отмеченным языком достаются от него. Имя — «Language: Python»: язык слышен на
 * самой кнопке, не открывая меню. Выбор меняет язык одним шагом отмены и
 * возвращает фокус в код.
 *
 * «КОПИРОВАТЬ» ЕСТЬ В ЛЮБОМ РЕЖИМЕ — и при `readOnly`, и при `disabled`: править
 * нельзя, а скопировать код можно. Копируется `node.textContent`, то есть текст
 * блока как набран, без токенов подсветки (они — декорации) и без хвостового
 * перевода строки, которого в узле нет (ADR-0039: копируется текст, а не DOM).
 *
 * КЛАВИАТУРА. Обе кнопки вне обхода Tab (`tabindex="-1"`): иначе каждый блок
 * кода добавлял бы две остановки между полем и следующим элементом формы. Вход —
 * `Alt+F10` из блока (`codeBlock.ts`) на язык; `Alt+F10` или стрелка вправо —
 * дальше, на «Копировать»; стрелка влево — назад; `Alt+F10` с «Копировать» — в
 * Панель. `Escape` с любой из двух возвращает фокус в код, каретка там же, где
 * была. Редактор только для чтения не принимает фокус в текст, и `Alt+F10` из
 * блока недостижим, — там «Копировать» остаётся в обычном порядке Tab.
 *
 * Только чтение и выключенное поле — вместо кнопки языка подпись: менять нечего,
 * а сказать, на каком языке код, по-прежнему стоит. У блока без языка подписи
 * нет: «Обычный текст» — строка каталога, и нужна она кнопке меню, а не метке.
 * Так же ведёт себя `RichTextView`, где каталога нет вовсе.
 */
export function CodeBlockView({ editor, node, getPos, extension }: NodeViewProps) {
  const messages = useMessages().editor;
  const editable = useEditable(editor);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const language = codeLanguage(normalizeCodeLanguage(node.attrs.language));
  const label = language?.label ?? messages.codeLanguagePlain;
  const options = extension.options as RichCodeBlockOptions;

  // `tabIndex` и `aria-keyshortcuts` RAC-кнопка пропами не принимает — ставим
  // атрибутами, как `ImageToolbar` убирает лишнюю остановку у узла плагина.
  useEffect(() => {
    triggerRef.current?.setAttribute("tabindex", "-1");
    triggerRef.current?.setAttribute("aria-keyshortcuts", "Alt+F10");
  }, [editable]);

  /*
    Escape шапки — «обратно в код», и окно кита под Редактором его не получает.
    Radix слушает Escape на документе в фазе перехвата, то есть раньше
    `onKeyDown` шапки: внутри `Dialog` или `Drawer` уход из шапки закрывал окно,
    стоило меню языка исчезнуть. Перехват на `window` идёт раньше документа;
    `preventDefault` слой Radix читает как «закрывать не нужно», а всплытие не
    останавливается — фокус в код вернёт `onKeyDown` ниже. Только у правки: без
    неё каретки нет, и Escape с «Копировать» остаётся окну.
  */
  useEffect(() => {
    const header = headerRef.current;
    const view = header?.ownerDocument.defaultView;
    if (!header || !view) return;
    const keepLayer = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || !editor.isEditable) return;
      if (event.target instanceof Node && header.contains(event.target)) event.preventDefault();
    };
    view.addEventListener("keydown", keepLayer, true);
    return () => view.removeEventListener("keydown", keepLayer, true);
  }, [editor]);

  const choose = (key: Key) => {
    const pos = getPos();
    if (pos === undefined || !editor.isEditable) return;
    const id = key === PLAIN_KEY ? null : normalizeCodeLanguage(String(key));
    if (id !== normalizeCodeLanguage(node.attrs.language)) setCodeLanguage(editor, pos, id);
    /*
      Фокус — в код таймером: react-aria после выбора возвращает фокус кнопке,
      и поставленный сразу он ушёл бы обратно к ней. `view.focus()` вернёт
      каретку туда, где она была до кнопки.
    */
    setTimeout(() => {
      if (!editor.isDestroyed) editor.view.focus();
    }, 0);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Меню — в портале, но события React всплывают и из него: клавиши самого
    // меню (его `Escape`) сюда не относятся. Подсказка — тоже в портале.
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const onLanguage = target === triggerRef.current;
    const onCopy = target.hasAttribute(CODE_COPY_TRIGGER);
    if (!onLanguage && !onCopy) return;
    const copy = headerRef.current?.querySelector<HTMLElement>(`[${CODE_COPY_TRIGGER}]`);
    if (event.key === "Escape") {
      event.preventDefault();
      editor.view.focus();
    } else if (event.key === "F10" && event.altKey) {
      event.preventDefault();
      if (onLanguage && copy) copy.focus();
      else options.focusToolbar();
    } else if (event.key === "ArrowRight" && onLanguage && copy) {
      event.preventDefault();
      copy.focus();
    } else if (event.key === "ArrowLeft" && onCopy && triggerRef.current) {
      event.preventDefault();
      triggerRef.current.focus();
    }
  };

  return (
    <NodeViewWrapper className={CODE_BLOCK_CLASS}>
      <div
        ref={headerRef}
        contentEditable={false}
        className={CODE_HEADER_CLASS}
        data-code-header=""
        onKeyDown={onKeyDown}
      >
        {editable ? (
          <MenuTrigger>
            <MenuButton
              ref={triggerRef}
              variant="ghost"
              size="sm"
              aria-label={messages.codeLanguage({ current: label })}
              className="h-6 px-1.5 font-sans text-xs"
              {...{ [CODE_LANGUAGE_TRIGGER]: "" }}
              {...HAS_POPUP_MENU}
            >
              {/* Подпись и шевроном в строку: `MenuButton` кладёт детей в один `span`. */}
              <span className="inline-flex items-center gap-1">
                {label}
                <ChevronDownIcon size={12} aria-hidden />
              </span>
            </MenuButton>
            {/* Имя меню react-aria берёт у кнопки (`aria-labelledby`): «Language: Python». */}
            <Menu className={GLASS_MENU_CLASS} placement="bottom start" onAction={choose}>
              <MenuSection selectionMode="single" selectedKeys={[language?.id ?? PLAIN_KEY]}>
                <MenuItem id={PLAIN_KEY} textValue={messages.codeLanguagePlain}>
                  {messages.codeLanguagePlain}
                </MenuItem>
                {CODE_LANGUAGES.map(({ id, label: name }) => (
                  <MenuItem key={id} id={id} textValue={name}>
                    {name}
                  </MenuItem>
                ))}
              </MenuSection>
            </Menu>
          </MenuTrigger>
        ) : (
          <span className={CODE_LABEL_CLASS}>{label}</span>
        )}
        <CodeCopyButton
          code={node.textContent}
          // Вне обхода Tab, пока Редактор правится: туда ведёт `Alt+F10`. Без
          // каретки (только чтение, выключено) другого пути к кнопке нет.
          tabIndex={editable ? -1 : undefined}
          {...{ [CODE_COPY_TRIGGER]: "" }}
        />
      </div>
      <pre>
        <NodeViewContent<"code">
          as="code"
          className={language ? `language-${language.id}` : undefined}
        />
      </pre>
    </NodeViewWrapper>
  );
}
