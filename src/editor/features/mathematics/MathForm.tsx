"use client";

import type { Editor } from "@tiptap/react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "../../../components/actions/Button.js";
import { FormField } from "../../../components/inputs/FormField.js";
import { TextControl } from "../../../components/inputs/TextControl.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { katex, mathErrorDetail } from "./katexEngine.js";
import { insertFormula } from "./mathCommands.js";
import { BLOCK_FORMULA_NODE, INLINE_FORMULA_NODE } from "./mathNames.js";

export interface MathFormProps {
  editor: Editor;
  /** Строчная формула или блочная: от вида зависят имя узла, поле и режим предпросмотра. */
  kind: "inline" | "block";
  /** Позиция правимой формулы; нет — форма вставляет новую на место каретки. */
  pos?: number;
  /** Закрыть Поповер тем же путём, что Escape. */
  close: () => void;
}

/**
 * Содержимое Поповера формулы (ADR-0070, п. 7): поле LaTeX, живой предпросмотр и
 * ошибка в самом поле. Рамку держит кит (`SelectionPopover`): `Popover` в стеке
 * слоёв, имя рамки — подпись пункта, возврат фокуса в Документ.
 *
 * ДВА РЕЖИМА ПО `pos`, как у Поповера картинки. С `pos` форма правит формулу
 * (щелчок или Enter на ней) — кнопки «Применить» и «Убрать формулу»; без него
 * вставляет новую (пункт Меню вставки) — кнопка «Вставить».
 *
 * НЕВЕРНЫЙ LaTeX ДОКУМЕНТ НЕ МЕНЯЕТ. Разбор идёт на каждое нажатие, и пока KaTeX
 * ругается, кнопка применения выключена, а в поле стоит его сообщение: в Документ
 * не попадёт формула, которой нет чем нарисовать. Предпросмотр и Документ рисует
 * один и тот же KaTeX с теми же опциями, что взял Редактор (`tool("mathematics")`),
 * поэтому «в предпросмотре правильно» значит «в Документе правильно».
 *
 * Поле формулы блочного вида — многострочное (`aligned`, матрицы удобнее писать
 * столбцом), `Enter` в нём — перенос строки, а применяет `Ctrl/⌘+Enter`. У
 * строчной — однострочное, `Enter` применяет. Enter, которым IME подтверждает
 * слово, не считается.
 */
export function MathForm({ editor, kind, pos, close }: MathFormProps) {
  const messages = useMessages().editor;
  const fieldId = useId();
  const block = kind === "block";
  const name = block ? BLOCK_FORMULA_NODE : INLINE_FORMULA_NODE;
  const [existing] = useState(() =>
    pos === undefined ? null : String(editor.state.doc.nodeAt(pos)?.attrs.latex ?? "")
  );
  const [draft, setDraft] = useState(existing ?? "");

  // Опции KaTeX берёт у расширения этого же вида: отдельной копии опций у формы нет.
  const katexOptions = useMemo(() => {
    const own = editor.extensionManager.extensions.find((extension) => extension.name === name);
    const options = own?.options.katexOptions as { macros?: object } | undefined;
    return { ...options, macros: { ...options?.macros } };
  }, [editor, name]);

  const latex = draft.trim();
  // Проверка — `renderToString`: разметка из него никуда не вставляется, а ошибка
  // KaTeX приходит тем же исключением, что при отрисовке.
  const error = useMemo(() => {
    if (!latex) return null;
    try {
      katex.renderToString(latex, katexOptions);
      return null;
    } catch (failure) {
      return mathErrorDetail(failure);
    }
  }, [latex, katexOptions]);
  // Предпросмотр рисует `katex.render` прямо в элемент: размеры KaTeX задаёт через
  // CSSOM, а не строкой `style="…"` в `innerHTML`, и строгий CSP потребителя их не режет.
  const previewRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const target = previewRef.current;
    if (!target) return;
    if (latex && error === null) katex.render(latex, target, katexOptions);
    else target.textContent = "";
  }, [latex, error, katexOptions]);

  const apply = () => {
    if (!latex || error !== null) return;
    if (pos === undefined) insertFormula(editor, kind, latex);
    else if (latex !== existing) {
      // Команда расширения: узел обновляется на месте, одна правка в истории.
      if (block) editor.chain().focus().updateBlockMath({ latex, pos }).run();
      else editor.chain().focus().updateInlineMath({ latex, pos }).run();
    }
    close();
  };

  const remove = () => {
    if (pos !== undefined) {
      if (block) editor.chain().focus().deleteBlockMath({ pos }).run();
      else editor.chain().focus().deleteInlineMath({ pos }).run();
    }
    close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    // Блочное поле — столбец: Enter переносит строку, применяет Mod+Enter.
    if (block && !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    apply();
  };

  return (
    <div className="flex w-80 max-w-full flex-col gap-3 p-1">
      {/* `layout="stack"` явно: Поповер рисуется вне раскладки формы, где стоит Редактор. */}
      <FormField
        label={messages.mathLatex}
        htmlFor={fieldId}
        error={error === null ? undefined : messages.mathInvalid({ detail: error })}
        layout="stack"
      >
        <TextControl
          id={fieldId}
          as={block ? "textarea" : "input"}
          {...(block ? { rows: 3, autosize: true, maxRows: 8 } : { size: "sm" as const })}
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="off"
          className="font-mono"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </FormField>
      <div
        role="group"
        aria-label={messages.mathPreview}
        className="border-line bg-bg-2 rounded-control flex min-h-12 items-center justify-center overflow-x-auto border px-3 py-2"
      >
        <span ref={previewRef} hidden={!latex || error !== null} />
        {(!latex || error !== null) && (
          <span className="text-fg-2 text-sm">{messages.mathEmpty}</span>
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
        {existing !== null && (
          <Button type="button" size="sm" variant="ghost" tone="danger" onClick={remove}>
            {messages.mathRemove}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="solid"
          tone="accent"
          disabled={!latex || error !== null}
          onClick={apply}
        >
          {existing === null ? messages.mathInsert : messages.mathApply}
        </Button>
      </div>
    </div>
  );
}
