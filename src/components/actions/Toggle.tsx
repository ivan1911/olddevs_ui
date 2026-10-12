"use client";

import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { useDescribedBy } from "../../hooks/useFieldDescription.js";
import { cn } from "../../lib/cn.js";
import { devWarn } from "../../lib/dev-warn.js";
import { hasContent } from "../../lib/empty.js";
import { STATE_BORDER } from "../../lib/variants.js";

interface ToggleBaseProps extends Omit<
  ComponentPropsWithoutRef<"button">,
  "onChange" | "value" | "children" | "aria-label"
> {
  /** Включён ли переключатель. Управляемое значение: своего состояния компонент не держит. */
  checked: boolean;
  /** Вызывается с новым значением при нажатии, если чужой `onClick` не отменил его через `preventDefault`. */
  onCheckedChange: (checked: boolean) => void;
}

/**
 * Имя переключателя: либо `label` без видимого текста, либо видимая подпись
 * в `children` с необязательным `description`. Ровно один источник имени —
 * как у `TagGroup`: два при правке расходятся молча, а на слух переключатель
 * назывался бы иначе, чем на экране.
 *
 * ПРАВИЛО «РОВНО ОДИН» ПРОВЕРЯЕТСЯ В РАЗРАБОТКЕ, А НЕ ТИПОМ. Объединение
 * `label | children` сломало бы потребителя: `interface X extends ToggleProps`
 * не компилируется от объединения, а `Omit<ToggleProps, …>` над ним склеивает
 * ветки в тип, который не подходит ни одной. Это был бы мажор ради minor-оси.
 */
export interface ToggleProps extends ToggleBaseProps {
  /**
   * Доступное имя, когда подписи на экране нет.
   *
   * Переключатель — `<button role="switch">` без текста внутри. Обёртка в
   * `<label>` имени ему не даёт: `<label>` связывается с полями формы, а не с
   * кнопкой. Без имени скринридер объявит безымянный переключатель, и глазами
   * этот дефект не виден.
   *
   * Сделано отдельным пропом, а не обязательным `aria-label`: союзный тип из
   * `aria-label | aria-labelledby` ломает вывод типов в Storybook и в любой
   * обёртке через `ComponentProps`. Если нужен именно `aria-labelledby` —
   * он проходит насквозь через `...rest`.
   *
   * Когда подпись нужна и на экране, передайте её в `children` вместо `label`:
   * имя тогда берётся из неё.
   */
  label?: string;
  /**
   * Видимая подпись. Рисуется слева от дорожки, нажатие по ней переключает, и
   * она же становится доступным именем — отдельный `label` тогда не нужен.
   *
   * Так же устроен `Checkbox`: подпись в `children`, `label` — имя на случай,
   * когда подписи на экране нет.
   */
  children?: ReactNode;
  /**
   * Пояснение под подписью: что именно включается и к чему это приведёт. Связано
   * с переключателем через `aria-describedby` и сливается с описанием
   * `FormField` и своим `aria-describedby`, а не заменяет их. Нажатие по нему
   * тоже переключает. Без видимой подписи не рисуется.
   */
  description?: ReactNode;
}

/**
 * Переключатель.
 *
 * Здесь `checked`, а не `selected` из общего словаря: у переключателя есть
 * родное ARIA-понятие (`role="switch"` + `aria-checked`), и подменять его
 * своим термином — значит расходиться со стандартом. `selected` остаётся
 * за элементами выбора: чипами, вкладками, пунктами списка.
 *
 * ПОДПИСЬ НА ЭКРАНЕ — ЧЕРЕЗ `children`. Строка настройки «заголовок и описание
 * слева, переключатель справа» повторяется в каждом кабинете, и собирать её
 * приходилось руками (`SettingRow` на экране «Аккаунт SaaS»), а вместе с ней —
 * связь описания с переключателем и нажатие по тексту. Теперь это штатный путь:
 * тот же компонент, новая семантика (видимое имя и описание), а не новый
 * примитив ради раскладки. С подписью `className` относится к строке целиком,
 * без неё — к самой дорожке, как и раньше.
 *
 * Прежняя версия во фронте была `<button>` без роли и без `aria-checked` —
 * скринридер объявлял её просто кнопкой без состояния. Плюс не поддерживала
 * `disabled`. Смещение бегунка и тень фокуса задавались инлайн-стилями.
 */
export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  {
    checked,
    onCheckedChange,
    label,
    children,
    description,
    className,
    disabled,
    type = "button",
    onClick,
    ...rest
  },
  ref
) {
  const ownId = useId();
  const switchId = rest.id ?? `${ownId}-switch`;
  const labelId = `${ownId}-label`;
  const descriptionId = `${ownId}-description`;
  // Пустая строка и `false` — не подпись: без этой проверки получилась бы
  // строка с пустым узлом и безымянный переключатель (docs/conventions.md,
  // «Пустое значение»).
  const visible = hasContent(children);
  const showDescription = visible && hasContent(description);
  const labelledBy = (rest as { "aria-labelledby"?: string })["aria-labelledby"];
  if (!visible && !label && !labelledBy)
    devWarn(
      "Toggle: the switch has no accessible name. Pass `label`, or a visible label in `children`."
    );
  if (visible && label)
    devWarn(
      "Toggle: both `label` and visible `children` are set. The visible label names the switch; drop `label`."
    );
  if (!visible && hasContent(description))
    devWarn(
      "Toggle: `description` needs a visible label in `children`; without it, it is not shown."
    );
  const describedBy = useDescribedBy(
    [
      (rest as { "aria-describedby"?: string })["aria-describedby"],
      showDescription && descriptionId,
    ]
      .filter(Boolean)
      .join(" ") || undefined
  );

  const control = (
    <button
      /*
        СПРЕД ИДЁТ ПЕРВЫМ, а `onClick` вынут из него отдельно.

        Раньше `{...rest}` стоял последним и перекрывал `onClick`, `role` и
        `aria-checked`. Вызов `<Toggle … onClick={track} />` компилировался,
        переключатель рисовался, аналитика срабатывала — а `onCheckedChange` не
        вызывался никогда. Хуже того, хватало и `onClick={undefined}`: ключ
        всё равно попадал в `rest` и затирал собственный обработчик.

        Чужой обработчик не выбрасывается, а вызывается ПЕРВЫМ и может отменить
        переключение через `preventDefault` — тот же приём и по той же причине,
        что в `MaskedInput`. Роль и состояние спредом больше не перебиваются:
        переключатель, потерявший `role="switch"`, перестаёт быть переключателем.
      */
      {...rest}
      ref={ref}
      id={visible ? switchId : rest.id}
      type={type}
      role="switch"
      aria-checked={checked}
      {...(visible ? { "aria-labelledby": labelId } : { "aria-label": label })}
      {...(describedBy ? { "aria-describedby": describedBy } : {})}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        onCheckedChange(!checked);
      }}
      className={cn(
        "relative h-[22px] w-[38px] shrink-0 cursor-pointer rounded-full border",
        "transition-colors",
        "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        // Рамка включённой дорожки — `STATE_BORDER`: заливка `bg-accent` против
        // подложки не дотягивает до 3:1, и границу даёт рамка (WCAG 1.4.11).
        checked ? cn(STATE_BORDER.accent, "bg-accent") : "border-line bg-bg-3",
        !visible && className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "bg-text-on-accent absolute top-[2px] h-4 w-4 rounded-full transition-[left]",
          checked ? "left-[17px]" : "left-[2px]"
        )}
      />
    </button>
  );

  if (!visible) return control;

  /*
    Подпись — настоящий `<label for>` на кнопку: `button` относится к
    «labelable»-элементам, поэтому нажатие по тексту активирует переключатель
    средствами браузера, без своего обработчика, и у выключенного не
    срабатывает. Имя при этом задано `aria-labelledby` явно — не полагаясь на то,
    как скринридер соберёт имя из `<label for>`.

    Описание — отдельный узел вне `<label>`: иначе оно вошло бы в имя
    переключателя, а нужно в описание. Нажатие по нему переключает тоже, поэтому
    оно обёрнуто в свой `<label for>`.
  */
  return (
    <div className={cn("group/toggle flex items-center justify-between gap-4", className)}>
      {/* Приглушается только текст: дорожка приглушает себя сама (`disabled:opacity-50`),
          и общая прозрачность строки дала бы ей 25 % вместо 50 % — иначе, чем без подписи.
          `group-has-disabled/toggle:` — для кнопки, выключенной предком-`fieldset`:
          свойство `disabled` у неё при этом ложно, и одно оно текст не погасило бы. */}
      <div
        className={cn(
          "flex min-w-0 flex-col group-has-disabled/toggle:opacity-50",
          disabled && "opacity-50"
        )}
      >
        <label
          id={labelId}
          htmlFor={switchId}
          className={cn(
            "text-fg-0 text-[13px] font-medium",
            disabled ? "cursor-not-allowed" : "cursor-pointer"
          )}
        >
          {children}
        </label>
        {showDescription && (
          <label
            id={descriptionId}
            htmlFor={switchId}
            className={cn("text-fg-2 text-xs", disabled ? "cursor-not-allowed" : "cursor-pointer")}
          >
            {description}
          </label>
        )}
      </div>
      {control}
    </div>
  );
});
