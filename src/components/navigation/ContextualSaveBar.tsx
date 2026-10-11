"use client";

import type { CSSProperties, ReactNode } from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { TONE_TOKENS } from "../../lib/variants.js";
import { Button } from "../actions/Button.js";

export interface ContextualSaveBarProps {
  /** Есть ли несохранённое. При `false` полоса не рисуется. */
  visible: boolean;
  /**
   * Сколько полей изменено. Без него полоса говорит «есть несохранённые
   * изменения»; с ним — называет число, и это заметно полезнее в длинной форме,
   * где изменённое поле уехало из кадра.
   */
  count?: number;
  /** Своя формулировка вместо умолчания — например, имя правимой сущности. */
  message?: ReactNode;
  /** Вызывается по кнопке сохранения. */
  onSave: () => void;
  /** Вызывается по кнопке отмены. Без обработчика кнопка не рисуется вовсе. */
  onCancel?: () => void;
  /** Идёт сохранение: кнопка показывает ход, обе кнопки выключены. */
  saving?: boolean;
  /** Текст отказа сохранения. Показывается в полосе и объявляется. */
  error?: ReactNode;
  /** Подпись кнопки сохранения. По умолчанию берётся из словаря сообщений. */
  saveLabel?: ReactNode;
  /** Подпись кнопки отмены. По умолчанию берётся из словаря сообщений. */
  cancelLabel?: ReactNode;
  /** Липнуть к нижнему краю окна браузера. Выключается там, где полоса стоит внутри окна (`Dialog`). */
  sticky?: boolean;
  /**
   * Имя CSS-переменной с высотой нижней панели приложения; полоса прилипает на
   * эту высоту выше края окна. По умолчанию `--bottombar-h`, которую публикует
   * слот `bottomBar` у `AppShell`. Переменной нет (панели нет, или она скрыта на
   * широком экране) — отступ `0px`, и полоса прилипает к самому низу.
   *
   * Работает только вместе со `sticky`.
   */
  offsetVar?: string;
  /** Доступное имя полосы. */
  "aria-label"?: string;
  /** Дополнительные классы на полосу. */
  className?: string;
}

/** Умолчание общее с `AppShell` (`bottomBarHeightVar`): так зовётся высота слота `bottomBar`. */
const DEFAULT_OFFSET_VAR = "--bottombar-h";

const PANEL =
  "border-line z-20 mt-4 flex flex-col gap-2 rounded-[14px] border p-[10px_14px] " +
  "backdrop-blur-md shadow-[var(--shadow-1)] sm:flex-row sm:items-center sm:gap-[14px]";

/**
 * Полоса несохранённых изменений: «есть что сохранить» и две кнопки.
 *
 * ГРАНИЦА ИЗ ТРЁХ СТРОК — как у `Banner`, и держать её стоит в голове:
 *
 *   `SelectionBar`      — про ВЫБОР: «Выбрано 12» и что с ними сделать.
 *   `Banner`            — про ПРИЛОЖЕНИЕ: «идут работы», переживает навигацию.
 *   `ContextualSaveBar` — про ТЕКУЩУЮ ФОРМУ: правки сделаны, но не отправлены.
 *
 * Отсюда и время жизни: полоса появляется с первой правкой и исчезает вместе с
 * ней — сохранением или отменой. Она не переживает уход со страницы, и об уходе
 * не предупреждает: перехват навигации принадлежит приложению, которое знает
 * свой маршрутизатор, а не киту.
 *
 * ДАННЫХ ФОРМЫ КОМПОНЕНТ НЕ ЗНАЕТ. Он принимает «грязно или нет», число правок
 * и два обработчика. Что считать правкой — решение потребителя: сравнение с
 * исходным значением, счётчик касаний поля или ответ формы.
 *
 * НАД НИЖНЕЙ ПАНЕЛЬЮ, А НЕ ПОД НЕЙ. На телефоне нижнюю границу окна занимает
 * `MobileTabBar` в слоте `bottomBar`; его высоту публикует `AppShell`
 * (`--bottombar-h`), и полоса прилипает на эту высоту выше края — так же, как
 * `SelectionBar` отсчитывает липкость от `--topbar-h`. Подпирать полосу
 * `max-md:bottom-14` на глаз больше не нужно: зашитое число расходится с
 * настоящей высотой панели (вырез экрана, перенос подписей).
 *
 * ЛИПНЕТ К НИЗУ, А НЕ К ВЕРХУ, И ЭТО РЕШЕНИЕ, А НЕ ВКУС. Наверху уже стоят
 * шапка и `SelectionBar`, обе отсчитывают липкость от `--topbar-h`
 * (ADR-0016, ADR-0019). Третий липкий слой сверху потребовал бы второй
 * переменной высоты и пересмотра контракта — то есть цены, несопоставимой с
 * задачей. Внизу свободно, и там же полосу ждут по привычке из админок.
 *
 * ПОЯВЛЕНИЕ СЛЫШНО, А НЕ ТОЛЬКО ВИДНО. Область объявления смонтирована всегда,
 * содержимое подменяется — тот же приём, что в `UploadQueue`. Живая область,
 * вставленная в дерево ВМЕСТЕ со своим текстом, объявляется ненадёжно: часть
 * скринридеров успевает увидеть только пустой узел.
 *
 * `role="status"`, а не `alert`, даже при отказе сохранения. Отказ здесь
 * сопровождает видимый текст в самой полосе, и перебивать им речь незачем;
 * `alert` в этом месте дал бы то самое двойное чтение, о котором предупреждает
 * ADR-0026.
 *
 * ЦЕНА ЭТОГО РЕШЕНИЯ НАЗВАНА ВСЛУХ: текст полосы попадает в дерево дважды —
 * видимой строкой и скрытой живой областью. В режиме обзора скринридер прочтёт
 * его два раза подряд. Размен сознательный: ненадёжное объявление появления
 * хуже лишнего повтора, а другого способа получить оба свойства сразу нет.
 * Тот же вопрос открыт у `MaskedInput` (ADR-0026) и закрывается одним прогоном
 * с NVDA и VoiceOver — на оба компонента разом, а не по отдельности.
 */
export function ContextualSaveBar({
  visible,
  count,
  message,
  onSave,
  onCancel,
  saving = false,
  error,
  saveLabel,
  cancelLabel,
  sticky = true,
  offsetVar = DEFAULT_OFFSET_VAR,
  "aria-label": ariaLabel,
  className,
}: ContextualSaveBarProps) {
  const messages = useMessages();
  const bar = messages.contextualSaveBar;

  const summary = message ?? (typeof count === "number" ? bar.changes({ count }) : bar.unsaved);
  const announcement = !visible ? "" : saving ? bar.saving : (error ?? summary);

  return (
    <>
      {visible ? (
        <div
          role="group"
          aria-label={ariaLabel ?? bar.label}
          // Отступ — КЛАССОМ, читающим переменную, а не инлайновым `bottom`: инлайн
          // сильнее любого класса, и `bottom-*` потребителя (своя нижняя панель вне
          // `AppShell`) молча проигрывал бы ему. Класс же `cn` сводит с классом
          // потребителя, и побеждает потребитель.
          className={cn(PANEL, sticky && "sticky bottom-[var(--od-savebar-bottom)]", className)}
          style={
            {
              background: "var(--topbar-bg)",
              "--od-savebar-bottom": `var(${offsetVar}, 0px)`,
            } as CSSProperties
          }
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[13px] font-semibold">{summary}</span>
            {error ? (
              <span className={cn("text-[12px]", TONE_TOKENS.danger.fg)}>{error}</span>
            ) : null}
          </div>

          <div className="hidden flex-1 sm:block" />

          <div className="flex flex-wrap items-center gap-2">
            {onCancel ? (
              <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
                {cancelLabel ?? bar.cancel}
              </Button>
            ) : null}
            <Button size="sm" tone="accent" onClick={onSave} loading={saving}>
              {saveLabel ?? bar.save}
            </Button>
          </div>
        </div>
      ) : null}

      {/*
        Смонтирована всегда — см. заголовок файла. Пустая строка, пока
        сохранять нечего: «нет изменений» не сообщение, а шум.
      */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </>
  );
}
