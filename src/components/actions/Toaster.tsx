"use client";

import { type ReactNode } from "react";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";
import { ErrorIcon, InfoIcon, SuccessIcon, WarningIcon } from "../../icons.js";
import { TONE_TOKENS } from "../../lib/variants.js";

export interface ToasterProps {
  /** Угол или край экрана, в котором стекаются тосты. По умолчанию `bottom-right`. */
  position?: "top-right" | "top-center" | "bottom-right" | "bottom-center";
  /** Сколько тост держится на экране, мс. По умолчанию 4000. */
  duration?: number;
  /** Тема. Нужна витрине; в приложении цвета и так приходят из токенов. */
  theme?: "light" | "dark" | "system";
  /**
   * Имя CSS-переменной с высотой нижней панели приложения. Тосты у нижнего края
   * встают на эту высоту выше обычного отступа, а не под панель. По умолчанию
   * `--bottombar-h` — её публикует слот `bottomBar` у `AppShell`. Переменной нет
   * (панели нет или она скрыта на широком экране) — отступ прежний. Для верхних
   * позиций не имеет значения.
   */
  offsetVar?: string;
}

/** Умолчание общее с `AppShell` (`bottomBarHeightVar`). */
const DEFAULT_OFFSET_VAR = "--bottombar-h";

/**
 * Область, в которой всплывают тосты. Ставится один раз рядом с корнем.
 *
 * СОБРАН НА `sonner`, а не написан заново, и не на react-aria: тостов она не
 * даёт вовсе. Стек, очередь, свайп, пауза при наведении, схлопывание пачки —
 * всё это у sonner уже есть и проверено; своя реализация была бы не примитивом,
 * а второй библиотекой. Ровно та же логика, по которой порталы арендованы у
 * Radix, а поведение полей — у react-aria.
 *
 * Вид задаётся токенами пакета через `--normal-*`, которые sonner подставляет
 * в свои внутренние классы. Умолчания sonner при этом не отключаются наполовину:
 * `unstyled` увёл бы за собой и раскладку, и анимации, а вместе с ними смысл
 * брать библиотеку.
 */
export function Toaster({
  position = "bottom-right",
  duration = 4000,
  theme,
  offsetVar = DEFAULT_OFFSET_VAR,
}: ToasterProps) {
  return (
    <SonnerToaster
      position={position}
      // Отступ sonner по умолчанию (24px, на узком экране 16px) сохраняется,
      // к нему прибавляется высота нижней панели: тост поверх `MobileTabBar`
      // перекрывал бы вкладки. `calc` с запасным `0px` не меняет вид там, где
      // панели нет. Ширина, на которой sonner переключается на `mobileOffset`,
      // его собственная (600px), а панель скрывается на `md` — поэтому на
      // промежутке 600–768px нужны обе записи.
      offset={{ bottom: `calc(var(${offsetVar}, 0px) + 24px)` }}
      mobileOffset={{ bottom: `calc(var(${offsetVar}, 0px) + 16px)` }}
      duration={duration}
      theme={theme}
      // `--normal-*` — публичные переменные sonner: он красит ими подложку,
      // текст и рамку тоста. Отдаём токены пакета, и тост едет за темой
      // приложения сам, без переключателя внутри библиотеки.
      style={
        {
          // Подложка полупрозрачная и с размытием — так тост выглядел во фронте
          // до переезда, и этот вид уезжает в пакет, а не теряется: размытие
          // уже часть словаря системы (подложка диалога), а «стеклянность»
          // всплывающего слоя — решение дизайн-системы, а не отдельного экрана.
          "--normal-bg": "color-mix(in srgb, var(--surface-elevated) 82%, transparent)",
          "--normal-text": "var(--fg-0)",
          "--normal-border": "var(--line-soft)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "rounded-lg border text-[13px] shadow-[var(--shadow-2)] backdrop-blur-[14px]",
          title: "font-semibold",
          description: "text-fg-2 text-[12px]",
          actionButton: TONE_TOKENS.accent.solid,
          cancelButton: TONE_TOKENS.neutral.solid,
        },
      }}
      icons={{
        success: <SuccessIcon size={16} className="text-success-strong" />,
        error: <ErrorIcon size={16} className="text-danger-strong" />,
        warning: <WarningIcon size={16} className="text-warning-strong" />,
        info: <InfoIcon size={16} className="text-accent-strong" />,
      }}
    />
  );
}

export interface ToastOptions {
  /** Вторая строка — подробности. У ошибки сюда идёт текст с сервера. */
  description?: ReactNode;
  /** Сколько этот тост держится на экране, мс. Перекрывает `duration` области `Toaster`. */
  duration?: number;
  /** Кнопка действия в тосте: подпись и обработчик нажатия. */
  action?: { label: string; onClick: () => void };
}

/**
 * Тосты по тонам словаря.
 *
 * ЧЕТЫРЕ МЕТОДА, А НЕ ПРОИЗВОЛЬНЫЙ JSX. У sonner есть и `toast.custom`, и
 * произвольное содержимое — здесь их нет намеренно: тост, умеющий всё,
 * перестаёт быть частью системы, и через полгода в приложении оказывается
 * пять разных тостов. Тон — это словарь пакета, а не оформление места вызова.
 *
 * `neutral` выражается `info`: отдельного «никакого» тона у события не бывает.
 *
 * ЧТО СЮДА НЕ ВХОДИТ: разбор ошибки API. `extractErrorMessage` остаётся у
 * потребителя — формат ответов сервера это его знание, а не дизайн-системы.
 * Вызов выглядит так:
 *
 *     toast.error("Не удалось сохранить", { description: extractErrorMessage(err) })
 */
export const toast = {
  success: (message: ReactNode, options?: ToastOptions) => sonnerToast.success(message, options),
  error: (message: ReactNode, options?: ToastOptions) => sonnerToast.error(message, options),
  warning: (message: ReactNode, options?: ToastOptions) => sonnerToast.warning(message, options),
  info: (message: ReactNode, options?: ToastOptions) => sonnerToast.info(message, options),
  /**
   * Тост, следящий за промисом: ожидание → успех или ошибка.
   *
   * Сигнатура СВОЯ, а не проброшенная у sonner, и это вынужденно: его тип
   * ссылается на внутренний, неэкспортированный (`PromiseIExtendedResult`), и
   * компилятор отказывается порождать `.d.ts` пакета — «cannot be named».
   * Пакет всё равно обязан объявлять свой контракт, так что здесь он написан
   * явно и заодно сужен до того, что действительно нужно.
   *
   * Подписи задаёт вызывающий: только он знает, что именно сохраняется.
   */
  // Запятая в `<T,>` обязательна: в `.tsx` дженерик-стрелка иначе неотличима
  // от JSX-тега, и парсер спотыкается.
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: ReactNode;
      success: ReactNode | ((data: T) => ReactNode);
      error: ReactNode | ((error: unknown) => ReactNode);
    }
  ): void => {
    sonnerToast.promise(promise, messages);
  },
  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
};
