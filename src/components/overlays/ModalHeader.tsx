"use client";

import type { ComponentType, ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { CloseIcon } from "../../icons.js";
import { Button } from "../actions/Button.js";

/** Всё, что нужно от компонента заголовка: принять `id`, класс и содержимое. */
type TitleProps = { id?: string; className?: string; children?: ReactNode };

export interface ModalHeaderProps {
  /**
   * Заголовок окна: одна строка слева в шапке.
   *
   * `ReactNode`, а не строка: во фронте рядом с текстом
   * регулярно стоит счётчик выбранного — «В коллекцию (12)», где скобка
   * набрана другим кеглем и цветом.
   */
  title: ReactNode;
  /**
   * `id` заголовка, чтобы сослаться на него из `aria-labelledby`.
   *
   * Нужен вызывающему, чтобы сослаться на него из
   * `aria-labelledby` своего диалога: имя окна знает только он, и назначить
   * его здесь мы не можем.
   */
  titleId?: string;
  /**
   * Строка под заголовком: слаг, дата, счётчик.
   *
   * Отдельным пропом, а не внутри
   * `title`, потому что `<h2>` принимает только фразовое содержимое — блочная
   * разметка внутри заголовка невалидна, а подпись почти всегда блочная.
   */
  subtitle?: ReactNode;
  /** Иконка слева от заголовка. Цвет задаёт потребитель — он же знает тон окна. */
  icon?: ReactNode;
  /**
   * Обработчик закрытия. Кнопка рисуется, только если он передан.
   *
   * Отдельного пропа «скрыть кнопку закрытия» нет намеренно: во фронте кнопка
   * пропадает на время отправки формы, и это выражается тем же самым —
   * `onClose={loading ? undefined : закрыть}`. Ещё один булев проп описывал бы
   * ровно то же состояние вторым способом.
   */
  onClose?: () => void;
  /** Доступное имя кнопки закрытия. */
  closeLabel?: string;
  /**
   * Чем рендерить заголовок. По умолчанию `<h2>`.
   *
   * Нужно ровно одному потребителю — `Dialog`, который передаёт сюда
   * `Dialog.Title` из Radix. Тот не просто рисует заголовок: он регистрирует
   * его в контексте диалога, и `aria-labelledby` проставляется сам. Без этого
   * пришлось бы либо дублировать разметку шапки внутри `Dialog` (а она вынесена
   * сюда именно потому, что повторялась десять раз), либо оставить в консоли
   * предупреждение Radix о диалоге без заголовка.
   */
  titleComponent?: ComponentType<TitleProps> | "h2";
  /** Классы на корень шапки. */
  className?: string;
}

/**
 * Шапка модального окна: заголовок слева, кнопка закрытия справа, линия снизу.
 *
 * Перенесена в кит потому, что повторялась ДЕСЯТЬ раз байт-в-байт — включая
 * набор классов `border-line-soft flex items-center justify-between border-b
 * px-5 py-4` и `m-0 text-base font-bold` на заголовке. Ровно тот случай, когда
 * копия расходится молча: достаточно поправить отступ в одном диалоге, и он
 * начинает отличаться от девяти остальных, а заметит это только глаз.
 *
 * Изначально в план был записан другой компонент — проп `closable` у
 * `ModalOverlay`, рисующий крестик в углу подложки. От него отказались, увидев
 * код: НИ ОДИН из пятнадцати крестиков во фронте не стоит в углу, все они
 * лежат в строке шапки рядом с заголовком. Тот проп не убрал бы ни одного
 * повтора и добавил бы неиспользуемый API.
 */
export function ModalHeader({
  title,
  titleId,
  subtitle,
  icon,
  onClose,
  closeLabel,
  titleComponent: Title = "h2",
  className,
}: ModalHeaderProps) {
  const messages = useMessages();

  return (
    <div
      className={cn(
        "border-line-soft flex items-center justify-between border-b px-5 py-4",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {icon}
        <div className="min-w-0">
          {/*
            `id` передаётся, ТОЛЬКО если он задан. Явный `id={undefined}`
            затирает собственный идентификатор `Dialog.Title` из Radix, и
            `aria-labelledby` окна начинает указывать в пустоту — то есть
            диалог остаётся без доступного имени, ровно как до этого примитива.
          */}
          <Title {...(titleId ? { id: titleId } : {})} className="m-0 truncate text-base font-bold">
            {title}
          </Title>
          {subtitle ? <div className="text-fg-3 mt-0.5 truncate">{subtitle}</div> : null}
        </div>
      </div>
      {onClose ? (
        <Button
          variant="ghost"
          iconOnly
          aria-label={closeLabel ?? messages.common.close}
          icon={<CloseIcon size={18} />}
          onClick={onClose}
        />
      ) : null}
    </div>
  );
}
