"use client";

import { useState, type KeyboardEvent } from "react";
import { Button as AriaButton, Label, Tag, TagGroup, TagList } from "react-aria-components";
import { CloseIcon } from "../../icons.js";
import { useFieldDescribedBy } from "../../hooks/useFieldDescription.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { FIELD_INPUT_CLASS, FIELD_SHELL_CLASS } from "../../lib/field.js";
import { TAG_CLASS, TAG_REMOVE_CLASS } from "../../lib/tag.js";

export interface TagInputProps {
  /** Текущие теги. */
  value: string[];
  /** Вызывается при добавлении и удалении тега и получает новый массив. */
  onChange: (value: string[]) => void;
  /** Видимая подпись над полем; служит и доступным именем, если нет `aria-label`. */
  label?: string;
  /** Плейсхолдер в пустом поле ввода. */
  placeholder?: string;
  /** Предел числа тегов. По достижении ввод выключается. */
  max?: number;
  /** Выключает поле ввода тега. */
  disabled?: boolean;
  /** Классы на корневой элемент. */
  className?: string;
  /** Доступное имя поля, когда видимой подписи `label` нет. */
  "aria-label"?: string;
  /**
   * Своё описание поля ввода. Сливается с описанием `FormField`, а не
   * заменяет его.
   */
  "aria-describedby"?: string;
}

/**
 * Ввод набора тегов: печатаешь — Enter превращает в тег.
 *
 * Три решения, которые компонент принимает за потребителя, потому что иначе
 * каждый экран решал бы их по-своему:
 *
 * 1. **Enter на пустом вводе не делает ничего.** Соблазн отправить форму велик,
 *    но поле тегов почти всегда стоит внутри формы, и «Enter в пустом поле
 *    отправляет» означает случайную отправку на полпути: набрал три тега,
 *    задумался, нажал Enter по привычке — форма ушла.
 * 2. **Дубли не добавляются.** Повторный тег ничего не значит, а на экране
 *    выглядит как ошибка ввода. Молча игнорируем: сообщать «такой уже есть»
 *    значит ругаться на действие, которое ничего не сломало.
 * 3. **Backspace на пустом вводе снимает последний тег.** Идиома, знакомая по
 *    почтовым клиентам; без неё удалять приходится мышью по крестикам.
 *
 * Пробел разделителем НЕ считается: теги бывают из двух слов («ночной город»),
 * и разделять по пробелу значит запретить их вовсе. Запятая считается — её ни
 * в одном теге не бывает, а вставка списка из буфера через неё и приходит.
 */
export function TagInput({
  value,
  onChange,
  label,
  placeholder,
  max,
  disabled,
  className,
  "aria-describedby": ariaDescribedBy,
  ...rest
}: TagInputProps) {
  const messages = useMessages();

  /**
   * Описание поля из `FormField` плюс своё, если потребитель его передал.
   *
   * Тот же приём, что у `TextControl` и `NumberInput`: значения СЛИВАЮТСЯ, а
   * не заменяют друг друга.
   *
   * Мишень — ПОЛЕ ВВОДА, а не `TagGroup`. Описание под полем объясняет, что
   * набирать; набор уже добавленных тегов оно не описывает. По той же причине
   * `aria-describedby` вынут из спреда: два носителя одного идентификатора
   * заставили бы скринридер прочитать подсказку дважды за один обход.
   */
  const fieldDescribedBy = useFieldDescribedBy();
  const describedBy = [ariaDescribedBy, fieldDescribedBy].filter(Boolean).join(" ") || undefined;

  const [draft, setDraft] = useState("");
  const full = max != null && value.length >= max;

  const add = (raw: string) => {
    /*
      Разбор по запятой живёт ЗДЕСЬ, а не в обработчике клавиш: список из
      буфера («небо,море,лес») приходит вставкой, минуя клавиатуру, и раньше
      становился одним тегом с запятыми внутри.
    */
    const parts = raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (!parts.length || full) return;

    const next = [...value];
    for (const tag of parts) {
      if (max != null && next.length >= max) break;
      // Дубли игнорируются молча: повторный тег ничего не значит, а ругаться
      // на действие, которое ничего не сломало, — лишний шум.
      if (!next.includes(tag)) next.push(tag);
    }
    setDraft("");
    if (next.length !== value.length) onChange(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      /*
        Событие гасится ВСЕГДА, включая пустой ввод, — и это то самое решение
        из докстроки. Пропускать пустой Enter дальше значит отправлять форму
        из поля тегов: набрал три тега, задумался, нажал Enter по привычке —
        форма ушла. Раньше здесь стояло обратное, и обещание докстроки
        расходилось с кодом.
      */
      e.preventDefault();
      if (draft.trim()) add(draft);
      return;
    }
    if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <TagGroup
      {...rest}
      aria-label={rest["aria-label"] ?? label}
      className={cn("flex flex-col gap-1.5", className)}
      onRemove={(keys) => onChange(value.filter((t) => !keys.has(t)))}
    >
      {label ? <Label className="text-fg-2 text-caption">{label}</Label> : null}

      <div className={cn(FIELD_SHELL_CLASS, "flex flex-wrap items-center gap-1.5 py-1.5")}>
        <TagList items={value.map((t) => ({ id: t }))} className="contents">
          {(item) => (
            <Tag id={item.id} textValue={item.id} className={TAG_CLASS}>
              {item.id}
              {/*
                Кнопка ОБЯЗАНА быть `Button` из react-aria, а не обычной
                `<button>`. Поведение снятия подключается через `ButtonContext`,
                и голая кнопка его не читает: `slot="remove"` на ней выглядит
                правильно, разметка выходит валидной, axe доволен — а нажатие
                не делает НИЧЕГО. Тег снимался только Backspace'ом, то есть с
                клавиатуры; мышью — никак.

                Та же ловушка, что у `FileTrigger` с выбором файла. Правило
                одно: если react-aria обещает потомку поведение, потомок берётся
                у react-aria.

                Имя кнопке нужно своё — подпись react-aria не придумывает, языка
                приложения он не знает. А вот имя тега вставлять НЕ нужно:
                react-aria дописывает подпись своего тега к имени кнопки сам, и
                «Убрать тег альфа» читалось как «Убрать тег альфа альфа».
                Найдено ревью волны 18 вычислением доступного имени — по
                разметке этого не видно.
              */}
              <AriaButton
                slot="remove"
                aria-label={messages.tagInput.remove}
                className={TAG_REMOVE_CLASS}
              >
                <CloseIcon size={12} />
              </AriaButton>
            </Tag>
          )}
        </TagList>

        <input
          type="text"
          value={draft}
          aria-describedby={describedBy}
          disabled={disabled}
          /*
            Набор добран — поле становится ТОЛЬКО ДЛЯ ЧТЕНИЯ, а не выключается.

            `disabled` на поле, в котором стоит каретка, снимает с него фокус:
            пользователь набирал последний тег, жал Enter — и фокус улетал на
            документ, а обход формы начинался заново. Заодно переставал работать
            Backspace для снятия последнего тега: события выключенного поля не
            приходят вовсе.
          */
          readOnly={full || undefined}
          placeholder={full ? undefined : placeholder}
          data-disable-focus-ring="true"
          /*
            Имя у поля СВОЁ, а не общее с группой. Ярлык «Теги» принадлежит
            набору тегов (`TagGroup`), и повесить его же на поле — значит
            выдать скринридеру две разные мишени с одним именем: «Теги, список»
            и «Теги, поле ввода». Тест на это и споткнулся.
          */
          aria-label={
            rest["aria-label"]
              ? messages.tagInput.addTo({ label: String(rest["aria-label"]) })
              : label
                ? messages.tagInput.addTo({ label: String(label) })
                : messages.tagInput.add
          }
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          // Ввод дописывается по остатку строки, а не занимает её целиком:
          // теги и поле стоят в одном потоке, и `w-full` вытолкнул бы поле на
          // новую строку даже при одном коротком теге.
          /*
            Уход фокуса ВНУТРИ поля тегов черновик не коммитит. Иначе клик по
            крестику соседнего тега сначала добавлял набранное новым тегом:
            пользователь просил удалить, а получал лишнее. Проверяем, куда
            ушёл фокус, — если в ту же оболочку, это не окончание ввода.
          */
          onBlur={(e) => {
            if (e.currentTarget.parentElement?.contains(e.relatedTarget)) return;
            add(draft);
          }}
          className={cn(FIELD_INPUT_CLASS, "min-w-[80px] flex-1 py-0.5")}
        />
      </div>
    </TagGroup>
  );
}
