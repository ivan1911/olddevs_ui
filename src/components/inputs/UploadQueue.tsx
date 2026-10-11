"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { PROGRESS_STATUS_TONE, type ProgressStatus } from "../../lib/progress-status.js";
import { TONE_TOKENS, type Tone } from "../../lib/variants.js";
import { Progress } from "../actions/Progress.js";
import { StatusBadge } from "../actions/StatusBadge.js";

/*
  Тон по состоянию со страховкой от незнакомого значения.

  `??` отвечает только за отсутствующий ключ, а `state` приходит с бэкенда:
  строка `"constructor"` или `"toString"` нашла бы в обычном объекте унаследованную
  функцию, и `TONE_TOKENS[функция]` дал бы `undefined.fg`. Поэтому ключ
  проверяется на собственность — так же, как явный `tone`.
*/
function stateTone(state: ProgressStatus): Tone {
  return Object.hasOwn(PROGRESS_STATUS_TONE, state) ? PROGRESS_STATUS_TONE[state] : "neutral";
}

export interface UploadItem {
  /** Ключ строки, уникальный в пределах `items`. */
  id: string;
  /** Имя файла или адрес. */
  name: ReactNode;
  /**
   * Размер — УЖЕ отформатированный.
   *
   * Кит не форматирует: «2,4 МБ» и «2.4 MB» отличаются не только
   * разделителем, но и единицами, а выбор единиц (МБ или МиБ) — решение
   * приложения, а не дизайн-системы.
   */
  size?: ReactNode;
  /** Превью — обычно `Image`. Без него место не занимается. */
  preview?: ReactNode;
  /** Состояние элемента. Словарь общий на весь кит — `ProgressStatus`. */
  state: ProgressStatus;
  /**
   * `0`–`100`, `null` — прогресс НЕИЗВЕСТЕН, `undefined` — полосы нет вовсе.
   *
   * Разница между `null` и `0` та же, что у `Progress`: ноль означает «начали и
   * пока ничего не сделали», `null` — «сколько всего работы, неизвестно».
   */
  progress?: number | null;
  /** Подпись состояния бейджем: «Дубль», «Обработка». Нет — бейджа нет. */
  statusLabel?: ReactNode;
  /**
   * Тон бейджа и полосы прогресса строки.
   *
   * Тон строки — ДОМЕННЫЙ статус поверх механического `state`: «Дубль» при
   * технически успешной загрузке — `"warning"`, а не зелёный успех.
   *
   * Красит бейдж и полосу прогресса. Нет — тон выводится из `state` общей
   * таблицей `ProgressStatus`, как раньше. Цвет текста `meta` упавшего элемента
   * на `tone` не реагирует: он следует `state`.
   */
  tone?: Tone;
  /** Вторая строка: текст ошибки, идентификатор задачи. */
  meta?: ReactNode;
  /** Действия справа — обычно `Button size="sm"`: повтор, отмена, убрать. */
  actions?: ReactNode;
}

export interface UploadQueueProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /** Строки очереди в порядке показа. */
  items: UploadItem[];
  /** Доступное имя списка. */
  "aria-label"?: string;
  /** Что показать при пустой очереди. Нет — не рисуется ничего. */
  empty?: ReactNode;
}

/**
 * Менеджер загрузок: что уже отправлено, что идёт и что упало.
 *
 * ГРАНИЦА С `FileDropzone`: область — это ВЫБОР файла, очередь — его судьба.
 * Их часто путают, потому что на экране они стоят рядом; но выбор кончается в
 * тот момент, когда файлы получены, а очередь с этого момента только
 * начинается.
 *
 * ТРАНСПОРТА ЗДЕСЬ НЕТ. Отправка, повтор, отмена и опрос задач на сервере —
 * знание потребителя: формат ответов, адреса и правила повтора принадлежат
 * приложению (ADR-0027).
 * Кит даёт форму элемента, прогресс, состояния и объявление итога; очереди он
 * не хранит — элементы и обработчики приходят пропами. Прецедент — владение
 * состоянием таблицы (ADR-0023).
 *
 * ИТОГ ОБЪЯВЛЯЕТСЯ ЖИВОЙ ОБЛАСТЬЮ, и это не украшение. Частичный успех —
 * «девять из двенадцати, одна ошибка» — иначе виден только тому, кто
 * просматривает список глазами; пользователь скринридера, отправив дюжину
 * файлов, не узнаёт о единственной упавшей вовсе. Область смонтирована ВСЕГДА,
 * подменяется только текст: вставленная вместе с сообщением, она объявляется
 * ненадёжно — часть скринридеров успевает её пропустить. Тот же приём, что в
 * `FileDropzone`.
 *
 * СОСТОЯНИЕ — МЕХАНИКА, ПОДПИСЬ И ТОН — ДОМЕН. Четыре состояния описывают
 * судьбу работы; «Дубль» и «На модерации» приходят подписью (`statusLabel`), а
 * их цвет, если он должен отличаться от цвета состояния, — `tone`. Как у
 * `StatusBadge`, который приехал из фронта, оставив снаружи словарь из
 * одиннадцати доменных статусов.
 */
export const UploadQueue = forwardRef<HTMLDivElement, UploadQueueProps>(function UploadQueue(
  { items, empty, className, "aria-label": ariaLabel, ...rest },
  ref
) {
  const messages = useMessages();

  const done = items.filter((i) => i.state === "success").length;
  const failed = items.filter((i) => i.state === "failed").length;

  /*
    Объявляется УСТОЯВШИЙСЯ итог, а не каждый промежуточный переход.

    Текст области — это `summary({done, total, failed})`, и он менялся при
    каждом переходе файла в `success`/`failed`. Отправка двенадцати файлов
    давала двенадцать сообщений подряд — «1 of 12 uploaded», «2 of 12
    uploaded», … Очередь `polite` их не схлопывает, и пользователь скринридера
    получал минуту непрерывной речи вместо одного сообщения о результате.
    Докстрока обосновывала объявление ИТОГА, а объявлялся ход.
  */
  const pending = items.some((i) => i.state === "pending" || i.state === "running");
  const settled =
    items.length > 0 && !pending
      ? messages.uploadQueue.summary({ done, total: items.length, failed })
      : "";

  return (
    <div ref={ref} className={cn("flex flex-col gap-2", className)} {...rest}>
      {items.length === 0 ? (
        empty
      ) : (
        /*
          Настоящий список, а не набор `div`. Скринридер обязан сообщить, что
          это очередь и сколько в ней элементов; набор карточек не сообщает ни
          того, ни другого.
        */
        <ul aria-label={ariaLabel ?? messages.uploadQueue.label} className="flex flex-col gap-2">
          {items.map((item) => {
            /*
              Тон строки: явный `tone`, иначе из `state`, иначе нейтральный.

              Явный тон проверяется по словарю: потребитель на JS собирает его из
              собственной таблицы статусов, и неизвестное значение дало бы
              `undefined.fg` внутри бейджа, то есть падение всего экрана. Такой
              тон считается незаданным — как и неизвестный `state`.
            */
            const tone: Tone =
              item.tone !== undefined && Object.hasOwn(TONE_TOKENS, item.tone)
                ? item.tone
                : stateTone(item.state);
            return (
              <li
                key={item.id}
                className="bg-bg-2 border-line-soft flex items-center gap-3 rounded-lg border px-3 py-2.5"
              >
                {item.preview != null && (
                  <div className="bg-bg-3 border-line-soft size-12 shrink-0 overflow-hidden rounded-md border">
                    {item.preview}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium">{item.name}</span>
                    {item.size != null && (
                      <span className="text-fg-2 shrink-0 text-[11px] tabular-nums">
                        {item.size}
                      </span>
                    )}
                  </div>

                  {item.progress !== undefined && (
                    <div className="mt-1.5">
                      {/*
                        Имя полосы собирается из имени файла, а не задаётся
                        безликим «Загрузка»: в очереди из дюжины строк
                        одинаковые имена не говорят, о каком файле речь.
                        Строка сюда годится не всегда — `name` это `ReactNode`,
                        — поэтому берётся текст, только когда он текст.
                      */}
                      {/*
                        Полоса следует `tone`, а не `state`: она сидит в одной
                        строке с бейджем, и зелёная полоса рядом с жёлтым
                        «Дубль» говорит о том же элементе два разных слова.
                        Механику (идёт, не идёт, неизвестно) полоса показывает
                        сама — формой и `aria-valuenow`, а не цветом.
                      */}
                      <Progress
                        value={item.progress}
                        tone={tone}
                        size="sm"
                        label={
                          typeof item.name === "string"
                            ? messages.uploadQueue.itemProgress({ name: item.name })
                            : messages.uploadQueue.progress
                        }
                      />
                    </div>
                  )}

                  {item.meta != null && (
                    <div
                      className={cn(
                        "mt-0.5 text-[11px]",
                        // Цвет сбоя — из словаря тонов: тест сверяет его со словарём.
                        item.state === "failed" ? TONE_TOKENS.danger.fg : "text-fg-2"
                      )}
                    >
                      {item.meta}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {item.statusLabel != null && (
                    <StatusBadge tone={tone}>{item.statusLabel}</StatusBadge>
                  )}
                  {item.actions}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/*
        Область объявления смонтирована всегда, а содержимое подменяется.
        `role="status"`, а не `alert`: очередь — это ход работы, а не сбой, и
        перебивать им текущую речь незачем даже при упавшем файле.

        Пустая очередь итога не даёт: «ноль из нуля» — не сообщение.
      */}
      <div role="status" aria-live="polite" className="sr-only">
        {settled}
      </div>
    </div>
  );
});
