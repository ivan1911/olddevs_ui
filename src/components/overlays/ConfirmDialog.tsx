"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { WarningIcon } from "../../icons.js";
import { OVERLAY_LAYER } from "../../lib/overlay-layer.js";
import { Button } from "../actions/Button.js";
import { FormField } from "../inputs/FormField.js";
import { TextControl } from "../inputs/TextControl.js";
import { Dialog } from "./Dialog.js";
import { useMessages } from "../../i18n/useMessages.js";

/**
 * Характер вопроса. Это СОБСТВЕННАЯ ось диалога, а не кнопочная: «удаляем
 * безвозвратно» и «кнопка красная» — разные утверждения, и вызывающий обязан
 * говорить первое, а перевод во второе — работа компонента.
 */
export type ConfirmKind = "danger" | "warning" | "info";

export interface ConfirmDialogProps {
  /** Показано ли окно подтверждения. */
  open: boolean;
  /** Отмена: кнопка «Отменить», кнопка закрытия, Escape и клик мимо. Пока `loading`, не вызывается. */
  onClose: () => void;
  /** Пользователь подтвердил действие. Окно само не закрывается — закрыть его должен потребитель. */
  onConfirm: () => void;
  /** Заголовок окна: коротко называет действие. Он же — доступное имя диалога. */
  title: ReactNode;
  /** Вопрос или пояснение последствий. Выводится абзацем и служит описанием диалога для скринридера. */
  message: ReactNode;
  /** Подпись кнопки подтверждения. Не задана — «Подтвердить» из каталога сообщений. */
  confirmLabel?: string;
  /** Подпись кнопки отмены. Не задана — «Отменить» из каталога сообщений. */
  cancelLabel?: string;
  /**
   * Характер вопроса: `danger` и `warning` рисуют кнопку подтверждения контурной
   * красной, `info` — сплошной акцентной. По умолчанию `danger`.
   *
   * Тон иконки слева от заголовка тоже берётся из `kind`: красный, жёлтый или акцентный.
   */
  kind?: ConfirmKind;
  /** Идёт подтверждённое действие: кнопки заблокированы, закрыть нельзя. */
  loading?: boolean;
  /**
   * Подтверждение вводом: текст, который пользователь должен набрать, чтобы
   * кнопка подтверждения включилась, — обычно название удаляемой сущности
   * («Удалить пространство Acme»). В окне появляется поле с подписью из
   * каталога сообщений, фокус при открытии встаёт в него, а Enter подтверждает
   * только при совпадении.
   *
   * Сверка точная и регистрозависимая: смысл приёма в том, чтобы пользователь
   * прочёл название и набрал именно его, а «acme» вместо «Acme» отличает одно
   * пространство от другого. Пробелы по краям набранного не считаются
   * (вставка из буфера часто приносит хвост), `NFC`-нормализация сглаживает
   * разницу между «é» одной буквой и «e» с акцентом. Пустая строка — не
   * название: поля нет, окно подтверждается как обычно.
   *
   * Набранный текст живёт внутри окна и не переживает его закрытия; снаружи
   * его знать незачем — `onConfirm` вызывается уже после совпадения.
   */
  typeToConfirm?: string;
}

const ICON_COLOR: Record<ConfirmKind, string> = {
  danger: "var(--danger)",
  warning: "var(--warning)",
  info: "var(--accent)",
};

/**
 * Приводит текст к виду, в котором его сверяют: без пробелов по краям и в
 * канонической форме Unicode. Регистр НЕ трогается — см. `typeToConfirm`.
 */
const normalize = (value: string) => value.trim().normalize("NFC");

/**
 * Подпись поля с набираемым именем в его собственном регистре.
 *
 * Подписи `FormField` набраны капителью, и «Acme Labs» в них выглядело бы как
 * «ACME LABS» — при том, что сверка регистрозависимая и подсказка прямо это
 * говорит. Имя внутри подписи выводится из-под капители, остальной текст —
 * как у всех полей.
 */
function keepCase(label: string, name: string): ReactNode {
  const at = name ? label.indexOf(name) : -1;
  if (at === -1) return label;
  return (
    <>
      {label.slice(0, at)}
      <span className="tracking-normal normal-case">{name}</span>
      {label.slice(at + name.length)}
    </>
  );
}

/**
 * Диалог подтверждения необратимого действия.
 *
 * СТОИТ НА `Dialog`, А НЕ НА ПОДЛОЖКЕ. Раньше он собирал модальность сам:
 * `ModalOverlay` + своя роль + свой `aria-labelledby` + `useScrollLock` +
 * перехват Escape на фазе захвата с `stopImmediatePropagation`. Последнее —
 * не перестраховка, а вынужденная мера: диалог почти всегда открыт ПОВЕРХ
 * другого окна со своим обработчиком Escape, и без захвата одно нажатие
 * закрывало оба. Radix ведёт стек слоёв сам, поэтому весь этот механизм
 * исчез вместе с переносом.
 *
 * Роль остаётся `alertdialog`: окно прерывает работу и требует ответа, а не
 * показывает форму. С `typeToConfirm` форма в нём всё же появляется — но ради
 * одного поля-замка, а не ввода данных, и роль остаётся прежней.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  kind = "danger",
  loading = false,
  typeToConfirm,
}: ConfirmDialogProps) {
  const messageId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  // Пустая строка и строка из пробелов — не название: сверять не с чем.
  const expected = normalize(typeToConfirm ?? "");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      loading={loading}
      role="alertdialog"
      /*
        Описание указывает на ВИДИМЫЙ абзац с вопросом, а не на его копию.

        Без описания скринридер объявлял имя окна и кнопку, на которую уехал
        фокус, и пользователь подтверждал вслепую. Первая починка передавала
        сам `message` и рисовала его скрытой копией — текст оказывался в
        документе дважды, а ссылка внутри него давала невидимый лишний табстоп.
      */
      describedBy={messageId}
      zIndex={OVERLAY_LAYER.alert}
      // Фокус — на кнопке подтверждения: вопрос уже задан, и ответ на него
      // должен быть в одном нажатии. Умолчание Radix увело бы фокус на крестик.
      // С подтверждением вводом ответ начинается с набора, и фокус ждёт в поле.
      initialFocusRef={expected ? fieldRef : confirmRef}
      title={title}
      icon={<WarningIcon size={18} style={{ color: ICON_COLOR[kind] }} />}
      className="w-full max-w-[380px]"
    >
      {/* Тело — отдельный компонент: набранный текст живёт ровно столько, сколько
          содержимое окна, и не переживает закрытие (Radix размонтирует его). */}
      <ConfirmBody
        message={message}
        messageId={messageId}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        kind={kind}
        loading={loading}
        expected={expected}
        confirmRef={confirmRef}
        fieldRef={fieldRef}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    </Dialog>
  );
}

interface ConfirmBodyProps extends Pick<
  ConfirmDialogProps,
  "message" | "confirmLabel" | "cancelLabel" | "kind" | "onClose" | "onConfirm"
> {
  messageId: string;
  loading: boolean;
  /** Нормализованный текст, который надо набрать; пустая строка — подтверждение без поля. */
  expected: string;
  confirmRef: RefObject<HTMLButtonElement | null>;
  fieldRef: RefObject<HTMLInputElement | null>;
}

function ConfirmBody({
  message,
  messageId,
  confirmLabel,
  cancelLabel,
  kind,
  loading,
  expected,
  confirmRef,
  fieldRef,
  onClose,
  onConfirm,
}: ConfirmBodyProps) {
  const messages = useMessages();
  const [typed, setTyped] = useState("");
  const withField = expected !== "";
  const matches = !withField || normalize(typed) === expected;

  const confirmStyle =
    kind === "info"
      ? ({ variant: "solid", tone: "accent" } as const)
      : ({ variant: "outline", tone: "danger" } as const);

  function submit(event: FormEvent) {
    event.preventDefault();
    // Enter в поле приходит сюда даже при выключенной кнопке (если браузер
    // решил, что отправлять нечем): совпадение проверяется ещё раз.
    if (!matches || loading) return;
    onConfirm();
  }

  const body = (
    <>
      <div className="flex flex-col gap-3 px-5 py-4">
        <p id={messageId} className="text-fg-1 m-0 text-[13px] leading-relaxed">
          {message}
        </p>
        {withField ? (
          <FormField
            label={keepCase(messages.confirmDialog.typeToConfirm({ text: expected }), expected)}
            htmlFor={`${messageId}-field`}
            hint={messages.confirmDialog.typeToConfirmHint}
          >
            <TextControl
              ref={fieldRef}
              id={`${messageId}-field`}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              // Только чтение, а не `disabled`: Enter в поле запускает действие, и
              // выключенное поле унесло бы фокус на `body` прямо из-под пальцев.
              readOnly={loading}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              shellClassName="w-full"
            />
          </FormField>
        ) : null}
      </div>

      <div className="border-line-soft flex items-center gap-2.5 border-t px-5 py-4">
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          {cancelLabel ?? messages.confirmDialog.cancel}
        </Button>
        <div className="flex-1" />
        <Button
          ref={confirmRef}
          variant={confirmStyle.variant}
          tone={confirmStyle.tone}
          // С полем подтверждает отправка формы, а не клик: так Enter в поле и
          // кнопка идут одним путём и одной проверкой совпадения.
          type={withField ? "submit" : undefined}
          onClick={withField ? undefined : onConfirm}
          disabled={!matches}
          loading={loading}
        >
          {confirmLabel ?? messages.confirmDialog.confirm}
        </Button>
      </div>
    </>
  );

  return withField ? (
    <form noValidate onSubmit={submit}>
      {body}
    </form>
  ) : (
    body
  );
}
