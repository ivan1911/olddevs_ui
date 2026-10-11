"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { cn } from "../../lib/cn.js";
import { useOpenerFocus } from "../../hooks/useOpenerFocus.js";
import { hasOpenAriaOverlay, OVERLAY_LAYER } from "../../lib/overlay-layer.js";
import { useOverlayLayer } from "../../hooks/useOverlayLayer.js";
import { withoutToolbarAxis } from "../../lib/toolbar-axis.js";
import { ModalHeader } from "./ModalHeader.js";

/** Портал окна: ось `Toolbar`, из которой открыто окно, внутрь не проходит. */
const Portal = withoutToolbarAxis(DialogPrimitive.Portal);

export interface DialogProps {
  /** Показано ли окно. */
  open: boolean;
  /** Закрытие: кнопка закрытия, Escape, клик мимо — всё сюда. */
  onClose: () => void;
  /** Заголовок окна. Он же становится доступным именем диалога. */
  title: ReactNode;
  /** Строка под заголовком в шапке: слаг, дата, счётчик. */
  subtitle?: ReactNode;
  /**
   * `id` узла, который служит окну описанием — текстом, который скринридер
   * читает следом за именем.
   *
   * Идентификатор, а не сам текст, и это разбор дефекта. Первая версия
   * принимала `ReactNode` и рисовала его скрытой копией: `ConfirmDialog`
   * передавал туда свой `message` и тут же рисовал его же видимым абзацем —
   * текст оказывался в документе ДВАЖДЫ. `message` типизирован как `ReactNode`,
   * поэтому ссылка внутри него давала невидимый лишний табстоп, а компонент с
   * собственным `id` — дубль идентификатора в документе.
   *
   * Описание обязано указывать на ТОТ ЖЕ узел, который видит глаз. Нужен текст
   * только для озвучки — положите его в `children` под `sr-only` и сошлитесь
   * сюда.
   *
   * Для `role="alertdialog"` описание требует APG: подтверждение, объявившее
   * только имя и кнопку, вынуждает подтверждать вслепую.
   */
  describedBy?: string;
  /** Иконка слева от заголовка. Цвет задаёт потребитель — он знает тон окна. */
  icon?: ReactNode;
  /**
   * Идёт отправка: окно нельзя закрыть ни кнопкой закрытия, ни Escape, ни кликом мимо.
   *
   * Одно свойство вместо трёх запретов намеренно: «форма отправляется» — это
   * одно состояние, а не три независимых решения, и разводить их значит
   * позволить окну оказаться в состоянии «Escape закрывает, а кнопки закрытия нет».
   */
  loading?: boolean;
  /** Вертикальное выравнивание: по центру или от верхнего края. */
  align?: "center" | "start";
  /** Классы на само окно — ширина, скругление, рамка. */
  className?: string;
  /** Классы на подложку — для окон с особой геометрией или анимацией. */
  overlayClassName?: string;
  /** Стили подложки — например, цвет и размытие для особого окна. */
  overlayStyle?: CSSProperties;
  /** Динамические стили на само окно. */
  contentStyle?: CSSProperties;
  /** Рисовать ли стандартную шапку. Особые окна оставляют собственную. */
  header?: boolean;
  /** Слой окна. Отдельные оверлеи приложения живут выше обычных. */
  zIndex?: string;
  /**
   * `alertdialog` — для окна, которое прерывает работу и требует ответа:
   * подтверждение удаления, предупреждение о несохранённом. Обычные окна
   * с формой остаются `dialog`.
   *
   * Отдельного примитива под это не заводится: `@radix-ui/react-alert-dialog`
   * отличается от обычного диалога ровно ролью и тем, что его нельзя закрыть
   * кликом мимо, — а второе у нас и так решается пропом `loading`.
   */
  role?: "dialog" | "alertdialog";
  /**
   * Куда поставить фокус при открытии. По умолчанию — на первый элемент,
   * до которого доходит Tab, а это кнопка закрытия в шапке.
   *
   * Проп нужен потому, что «куда смотрит пользователь, когда окно открылось» —
   * решение самого окна, а не деталь реализации. Сделать это эффектом на
   * стороне вызывающего нельзя: Radix ставит фокус позже, чем отрабатывают
   * эффекты, и молча перебивает чужой вызов `focus()`. Проверено в витрине —
   * фокус уезжал на кнопку закрытия.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Дополнительная реакция на Escape для окон со своим внутренним состоянием. */
  onEscapeKeyDown?: DialogPrimitive.DialogContentProps["onEscapeKeyDown"];
  /** Доступное имя кнопки закрытия. Не задано — «Закрыть» из каталога сообщений. */
  closeLabel?: string;
  /** Содержимое окна под шапкой. */
  children?: ReactNode;
}

/**
 * Модальное окно целиком: подложка, ловушка фокуса, шапка и блокировка фона.
 *
 * ПОЧЕМУ ЭТО ОТДЕЛЬНЫЙ ПРИМИТИВ, А НЕ ПРОП У `ModalOverlay`. Подложка честно
 * делает одно — гасит фон и ловит клик мимо, — и `role="dialog"` она взять не
 * может: диалогу нужно доступное имя, а имя знает только вызывающий. Из-за
 * этого каждый диалог во фронте собирал модальность руками, и собрал по-разному:
 * из десяти окон роль и `aria-modal` были у одного, а ловушки фокуса не было
 * ни у одного — Tab уводил в фон под затемнением, к кнопкам, которых не видно.
 *
 * Здесь имя известно (это `title`), поэтому окно берёт на себя всё сразу.
 *
 * ПОВЕДЕНИЕ — `@radix-ui/react-dialog`, третья peer-зависимость пакета после
 * тултипа и поповера, и по той же логике (ADR-0004):
 * ловушка фокуса, возврат фокуса на триггер, `aria-modal`, портал, Escape по
 * слоям и `inert` для фона — это не то, что стоит писать заново. Своя ловушка
 * фокуса — не примитив, а вторая библиотека.
 *
 * ПРОКРУТКУ ФОНА БЛОКИРУЕТ RADIX, а не `useScrollLock`. Внутри у него
 * `react-remove-scroll`, и два замка на одном `body` — это два независимых
 * счётчика, которые не видят друг друга. Поэтому `Dialog` хук не зовёт;
 * `useScrollLock` остаётся для оверлеев, собранных вручную.
 *
 * ВЛОЖЕННОСТЬ РАБОТАЕТ САМА. Диалог подтверждения поверх окна редактирования —
 * обычное дело, и Escape закрывает верхний слой, а не оба сразу: Radix ведёт
 * стек слоёв. О ЧУЖОМ стеке он при этом не знает — меню пакета собраны на
 * react-aria, и их слой окно различает отдельно (см. `escapeBelongsToAriaLayer`). Прежней версии для этого приходилось ловить Escape на фазе
 * захвата и гасить событие `stopImmediatePropagation`.
 */
export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  describedBy,
  icon,
  loading = false,
  align = "center",
  className,
  overlayClassName,
  overlayStyle,
  contentStyle,
  header = true,
  zIndex = OVERLAY_LAYER.modal,
  role = "dialog",
  initialFocusRef,
  onEscapeKeyDown,
  closeLabel,
  children,
}: DialogProps) {
  // Во время отправки закрывать нечем — но обработчики не снимаются, а
  // гасятся: снятый `onOpenChange` оставил бы Radix в состоянии, где он
  // считает окно закрытым, а мы его всё ещё рисуем.
  const block = loading ? (e: Event) => e.preventDefault() : undefined;

  /** Само окно — чтобы отличить «Escape внутри» от «Escape в чужом слое». */
  const contentRef = useRef<HTMLDivElement>(null);

  /**
   * Escape, адресованный слою react-aria, до окна доходить не должен.
   *
   * Radix ведёт стек СВОИХ слоёв, и вложенные диалоги закрываются по одному.
   * Но меню и списки пакета собраны на react-aria, а она ведёт свой стек, и о
   * чужом ни одна из библиотек не знает: один Escape при открытом меню внутри
   * окна закрывал и меню, и окно — то есть уносил форму вместе с несохранённым.
   * Нашла история «Menu внутри Dialog».
   *
   * Признаком СЛУЖИЛО положение цели события: «`data-rac` и вне окна». Для
   * меню это работало, а для `Combobox` ВНУТРИ окна — нет: фокус стоит в
   * `Input`, который лежит внутри контента, список — в портале, и второе
   * условие было ложным. Escape закрывал окно вместо списка подсказок.
   *
   * С волны 26 чужой слой определяется наличием открытого оверлея RAC в
   * документе, а не положением цели, и живёт это в `lib/overlay-layer.ts`
   * вместе со стеком слоёв — ADR-0041.
   */
  const escapeBelongsToAriaLayer = () => hasOpenAriaOverlay();

  /**
   * Кто открыл окно — чтобы вернуть ему фокус при закрытии.
   *
   * Radix возвращает фокус на свой `Dialog.Trigger`, а его здесь нет: окна
   * открываются из состояния приложения, а не из обёрнутой кнопки. Без этого
   * фокус после закрытия уезжает на `<body>` — проверено и в витрине, и в
   * приложении, — и пользователь клавиатуры начинает обход страницы заново.
   *
   * Запоминаем в `onOpenAutoFocus`: он срабатывает ДО того, как Radix уведёт
   * фокус внутрь окна, то есть `activeElement` там ещё тот, кто открыл.
   */
  const { remember, restore } = useOpenerFocus(open, contentRef);
  // Слой состоит в общем стеке — ADR-0041 обещает это для ВСЕХ модальных
  // слоёв кита, а не только для подложки.
  useOverlayLayer(open, contentRef);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !loading) onClose();
      }}
    >
      <Portal>
        {/*
          Окно лежит ВНУТРИ подложки, а не рядом с ней. Так высокое содержимое
          прокручивается вместе с затемнением, а не вылезает за экран: подложка
          здесь одновременно и скролл-контейнер, и центрирующий флекс.
        */}
        <DialogPrimitive.Overlay
          className={cn(
            "animate-fadein data-[state=closed]:animate-fadeout fixed inset-0 flex justify-center overflow-auto p-6",
            zIndex,
            align === "start" ? "items-start" : "items-center",
            overlayClassName
          )}
          style={{
            background: "var(--overlay-scrim)",
            backdropFilter: "blur(4px)",
            ...overlayStyle,
          }}
        >
          <DialogPrimitive.Content
            // Роль ставится после спреда самого Radix, поэтому переопределяет
            // его `dialog` — отдельный примитив ради одного атрибута не нужен.
            role={role}
            /*
              Описание — проп, а не «его не бывает».

              Здесь стоял жёсткий `undefined` ради подавления предупреждения
              Radix, и следствие было шире, чем задумано: ни одно окно кита не
              могло иметь описания вовсе. Для `ConfirmDialog` это значило, что
              сам вопрос — «Удалить 12 элементов безвозвратно?» — скринридеру не
              читался: он объявлял имя окна и кнопку, на которую уехал фокус.
              Для роли `alertdialog` APG требует описание прямо.

              `undefined` остаётся умолчанием: окно без описания не должно
              ссылаться в пустоту, и предупреждение Radix тогда по-прежнему
              подавляется.
            */
            aria-describedby={describedBy}
            onOpenAutoFocus={(e) => {
              remember();
              if (initialFocusRef) {
                e.preventDefault();
                initialFocusRef.current?.focus();
              }
            }}
            onCloseAutoFocus={restore}
            ref={contentRef}
            onEscapeKeyDown={(event) => {
              if (loading) {
                event.preventDefault();
                return;
              }
              if (escapeBelongsToAriaLayer()) {
                event.preventDefault();
                return;
              }
              onEscapeKeyDown?.(event);
            }}
            onPointerDownOutside={block}
            onInteractOutside={block}
            className={cn(
              "animate-sheetin data-[state=closed]:animate-sheetout border-line bg-bg-1 rounded-lg border outline-none",
              className
            )}
            style={{ boxShadow: "var(--modal-shadow)", ...contentStyle }}
          >
            {header ? (
              <ModalHeader
                // Заголовок рисует Radix: он же регистрирует его как имя окна,
                // поэтому `aria-labelledby` проставляется без нашего участия.
                titleComponent={DialogPrimitive.Title}
                title={title}
                subtitle={subtitle}
                icon={icon}
                onClose={loading ? undefined : onClose}
                closeLabel={closeLabel}
              />
            ) : (
              <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
            )}
            {children}
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </Portal>
    </DialogPrimitive.Root>
  );
}
