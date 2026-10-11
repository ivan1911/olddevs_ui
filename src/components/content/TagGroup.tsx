"use client";

import { forwardRef, type ReactNode } from "react";
import {
  Button as AriaButton,
  Label,
  Tag as AriaTag,
  TagGroup as AriaTagGroup,
  TagList,
} from "react-aria-components";
import { CloseIcon } from "../../icons.js";
import type { AccessibleName } from "../../lib/accessible-name.js";
import { cn } from "../../lib/cn.js";
import { hasContent } from "../../lib/empty.js";
import { TAG_CLASS, TAG_REMOVE_CLASS } from "../../lib/tag.js";
import { LABEL_BG_CLASS, type LabelHue } from "../../lib/variants.js";
import { useMessages } from "../../i18n/useMessages.js";

/** Ключ метки: тот же `id`, что задан у `Tag`. */
export type TagKey = string | number;

interface TagGroupBaseProps {
  /**
   * Удаление меток. Задан — у каждой метки появляется кнопка удаления, а
   * Delete и Backspace на метке вызывают его с ключом этой метки.
   *
   * Сам набор компонент не меняет: метку убирает потребитель, перерисовав
   * группу. Не задан — меток не убрать ни мышью, ни клавиатурой.
   */
  onRemove?: (keys: Set<TagKey>) => void;
  /**
   * Что показать, когда меток нет.
   *
   * Пустая группа без текста выглядит сбоем — пропавшим содержимым, а не
   * отсутствием категорий.
   */
  empty?: ReactNode;
  /** Метки — `Tag`. Не заданы — группа пуста и показывает `empty`. */
  children?: ReactNode;
  /** Классы корневого элемента. */
  className?: string;
}

/**
 * Видимая подпись, которая годится в имя: `ReactNode` без пустых значений.
 *
 * Голый `ReactNode` пропускал `undefined`, `null` и `false` — ветка «есть
 * подпись» совпадала с группой вовсе без имени, и обязательность становилась
 * видимостью. Пустую строку тип отсечь не может (`""` — тоже `string`); её
 * ловит `hasContent` в разметке.
 */
type TagGroupLabel = Exclude<ReactNode, null | undefined | boolean>;

/**
 * Имя группы обязательно: либо видимая подпись `label`, либо ровно одно из
 * `aria-label` и `aria-labelledby` (`AccessibleName`) — но не подпись вместе с
 * атрибутом.
 *
 * Группа меток — это `grid`, а у `grid` без имени скринридер называет только
 * роль, и три группы подряд на странице («Категории», «Авторы», «Ярлыки»)
 * неразличимы. Тот же довод, что у `Toolbar` и `Carousel`. Подпись вместе с
 * `aria-label` — два источника одного имени: атрибут перекрыл бы видимый
 * текст, и на слух группа называлась бы не так, как на экране.
 */
export type TagGroupProps = TagGroupBaseProps &
  (
    | {
        /** Видимая подпись группы; она же служит её доступным именем. */
        label: TagGroupLabel;
        /** Доступное имя строкой, когда видимой подписи нет. Не задаётся вместе с `aria-labelledby`: два источника одного имени. */
        "aria-label"?: never;
        /** `id` элемента, чей текст служит доступным именем, когда видимой подписи нет. Не задаётся вместе с `aria-label`: два источника одного имени. */
        "aria-labelledby"?: never;
      }
    | ({ label?: never } & AccessibleName)
  );

/**
 * Набор меток для ПОКАЗА: оттенок палитры, ссылка, необязательное удаление.
 *
 * Построен на `TagGroup` из react-aria, и всё поведение — от неё: стрелки между
 * метками, Delete и Backspace, фокус после удаления на соседней метке. Tab
 * с метки уходит на её кнопку удаления — так устроена и `TagInput`.
 *
 * ЭТО НЕ ФИЛЬТР, НЕ СТАТУС И НЕ ВВОД. Выбор из набора — `Chip` и `Segmented`,
 * поэтому `selectionMode` наружу НЕ пробрасывается: метка, которую можно
 * выделить, становится вторым переключателем с другой клавиатурой. Состояние
 * объекта — `StatusBadge`. Ввод новых меток — `TagInput`.
 *
 * Набор переносится на новую строку целиком, по метке, а не по слову.
 */
export const TagGroup = forwardRef<HTMLDivElement, TagGroupProps>(function TagGroup(
  { label, onRemove, empty, children, className, ...rest },
  ref
) {
  return (
    <AriaTagGroup
      {...rest}
      ref={ref}
      onRemove={onRemove}
      className={cn("flex flex-col gap-1.5", className)}
    >
      {hasContent(label) ? <Label className="text-fg-2 text-caption">{label}</Label> : null}
      <TagList
        className="flex flex-wrap gap-1.5"
        renderEmptyState={
          // `hasContent`, а не `!= null`: пустая строка дала бы пустой `span`
          // вместо «нет меток» — то есть ту же пустую группу, от которой проп и есть.
          hasContent(empty) ? () => <span className="text-fg-3 text-sm">{empty}</span> : undefined
        }
      >
        {children}
      </TagList>
    </AriaTagGroup>
  );
});

interface TagBaseProps {
  /**
   * Ключ метки: его получает `onRemove`. Без `id` ключом станет React-ключ
   * элемента, так что для удаляемых наборов задавайте оба.
   */
  id?: TagKey;
  /**
   * Оттенок из палитры меток (`LABEL_HUES`) — точка рядом с подписью, а не
   * заливка под текстом.
   *
   * Это решение палитры, а не вкус: восемь оттенков, читаемых под текстом во
   * всех трёх темах, стоили бы вдвое большего набора. Точка скринридеру
   * невидима (`aria-hidden`): оттенок слова не заменяет, и смысл метки несёт
   * подпись — иначе метки не различил бы человек с нарушением цветового зрения.
   */
  hue?: LabelHue;
  /**
   * Адрес — метка становится ссылкой: Enter и щелчок переходят по нему.
   *
   * react-aria не рисует `<a>`, а открывает ссылку при нажатии (атрибуты лежат
   * в `data-href`): так метка остаётся строкой группы и сохраняет стрелки и
   * удаление. Цена — нет контекстного меню «открыть в новой вкладке»; для
   * клиентской маршрутизации ставится `RouterProvider` react-aria.
   */
  href?: string;
  /** Где открыть ссылку (`_blank` и т. п.); действует вместе с `href`. */
  target?: string;
  /** Атрибут `rel` ссылки; действует вместе с `href`. */
  rel?: string;
}

/**
 * Метка с текстом: имя берётся из содержимого. Метка с узлом внутри обязана
 * сообщить имя сама — иначе его нечем назвать ни кнопке удаления, ни скринридеру.
 */
export type TagProps = TagBaseProps &
  (
    | {
        /** Содержимое метки: подпись текстом или узлом. */
        children: string | number;
        /** Текстовое имя метки для кнопки удаления и скринридера; по умолчанию — `children`, обязательно, когда `children` не строка. */
        textValue?: string;
      }
    | {
        /** Содержимое метки: подпись текстом или узлом. */
        children: ReactNode;
        /** Текстовое имя метки для кнопки удаления и скринридера; по умолчанию — `children`, обязательно, когда `children` не строка. */
        textValue: string;
      }
  );

/** Метка внутри `TagGroup`. */
export function Tag({ id, hue, href, target, rel, children, textValue }: TagProps) {
  const messages = useMessages();
  // `||`, а не `??`: пустой `textValue` оставил бы кнопку удаления с именем
  // «Удалить: » — без того, что она удаляет.
  const name =
    textValue ||
    (typeof children === "string" || typeof children === "number" ? String(children) : "");

  return (
    <AriaTag
      id={id}
      textValue={name}
      // Пустой адрес — не ссылка: метка с `href=""` вела бы на текущую страницу.
      href={href || undefined}
      target={target}
      rel={rel}
      className={cn(TAG_CLASS, href && "cursor-pointer hover:underline")}
    >
      {({ allowsRemoving }) => (
        <>
          {hue ? (
            <span
              aria-hidden="true"
              className={cn("size-2.5 shrink-0 rounded-full", LABEL_BG_CLASS[hue])}
            />
          ) : null}
          {children}
          {allowsRemoving ? (
            /*
              Кнопка — `Button` из react-aria, а не `<button>`: поведение
              удаления приходит через её контекст (см. `TagInput`).

              Имя целиком из каталога, а react-aria по умолчанию ДОПИСЫВАЕТ
              подпись метки к имени кнопки через `aria-labelledby`. Пустая
              строка перекрывает его: `undefined` не годится — слияние пропсов
              пропускает его и оставляет значение react-aria, а пустой
              `aria-labelledby` по спецификации игнорируется, и имя берётся из
              `aria-label`.
            */
            <AriaButton
              slot="remove"
              aria-label={messages.tagGroup.remove({ label: name })}
              aria-labelledby=""
              className={TAG_REMOVE_CLASS}
            >
              <CloseIcon size={12} />
            </AriaButton>
          ) : null}
        </>
      )}
    </AriaTag>
  );
}
