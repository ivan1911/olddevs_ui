"use client";

import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
} from "react";
import { useMessages } from "../../i18n/useMessages.js";
import {
  caretAfter,
  formatMask,
  maskRemainder,
  maskTokenAt,
  rawLengthBefore,
  unmask,
  unmaskOverflow,
  type MaskToken,
} from "../../lib/mask.js";
import { TextControl } from "./TextControl.js";

/** Токен маски → то, чего ждали, словами каталога. */
const EXPECTED: Record<MaskToken, "digit" | "letter" | "any"> = {
  "9": "digit",
  a: "letter",
  "*": "any",
};

export interface MaskedInputProps extends Omit<
  ComponentPropsWithoutRef<"input">,
  "onChange" | "value" | "defaultValue" | "size"
> {
  /**
   * Маска: `9` — цифра, `a` — буква, `*` — цифра или буква; остальное литерал.
   *
   * Кит о предметной области не знает: маска приходит пропом, и «телефон» или
   * «серия паспорта» — знание вызывающего.
   */
  mask: string;
  /** Сырое значение — без литералов маски. Именно оно уходит на сервер. */
  value: string;
  /**
   * Вызывается с обоими представлениями: сырым и показанным.
   *
   * Сырое нужно запросу, показанное — тому, кто хранит текст как есть. Отдать
   * одно — значит заставить половину потребителей форматировать заново.
   */
  onChange: (raw: string, formatted: string) => void;
  /** Классы на оболочку с рамкой. */
  shellClassName?: string;
  /**
   * Показывать формат прямо в поле: `+7 (___) ___-__-__`.
   *
   * ПО УМОЛЧАНИЮ ВКЛЮЧЕНО, и это не косметика. До появления трафарета поле не
   * сообщало формат ВООБЩЕ: `formatMask` подставляет литералы только пока есть
   * что ставить дальше, поэтому пустое поле показывало пустой прямоугольник, а
   * наполовину заполненное — обрубок без остатка. Пользователь узнавал формат
   * методом проб.
   *
   * Выключается там, где формат уже сказан рядом и повторять его в поле —
   * шум: короткая известная маска в плотной таблице, поле под своей подписью
   * с примером.
   *
   * Трафарет — УКРАШЕНИЕ: он `aria-hidden` и скринридеру не достаётся. Формат для
   * него живёт в подсказке `FormField`, которая с полем связана
   * (`aria-describedby`), — и это разделение сознательное: постоянная подсказка
   * доступна и при проверке набранного, а трафарет по мере ввода исчезает.
   */
  showMask?: boolean;
}

/**
 * Поле с маской ввода.
 *
 * СТОИТ НА `TextControl` (прецедент ADR-0009): рамка, фокус, выключенное и
 * невалидное состояния — его; здесь только механика маски.
 *
 * ЗНАЧЕНИЕ СЫРОЕ, ПОКАЗ ОТФОРМАТИРОВАННЫЙ. Хранить формат — значит хранить
 * решение о показе: маску можно поменять, а записанные с ней скобки останутся
 * в базе навсегда.
 *
 * КАРЕТКА — ТО, РАДИ ЧЕГО КОМПОНЕНТ ВООБЩЕ НУЖЕН. Форматирование на каждом
 * вводе перерисовывает строку целиком, и браузер ставит каретку в конец;
 * править середину номера становится невозможно. Поэтому позиция считается по
 * маске: сколько символов значения стояло левее — столько и останется.
 *
 * BACKSPACE ЧЕРЕЗ ЛИТЕРАЛ УДАЛЯЕТ СИМВОЛ ЗНАЧЕНИЯ, а не литерал. Иначе каретка
 * упирается в `)` и стирание встаёт: литерал удалится, тут же вернётся
 * форматированием, и нажатие ничего не изменит — дефект, который выглядит как
 * зависшая клавиша.
 *
 * Вставка отдельного обработчика не требует: вставленное приходит тем же
 * событием ввода, и разбор по маске раскладывает его так же, как набранное
 * (`unmask` в `lib/mask.ts`).
 */
export const MaskedInput = forwardRef<HTMLInputElement, MaskedInputProps>(function MaskedInput(
  { mask, value, onChange, onKeyDown, showMask = true, ...rest },
  ref
) {
  const innerRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLInputElement, []);
  // Каретка живёт в `ref`: она нужна ровно один раз, сразу после перерисовки.
  const caret = useRef<number | null>(null);

  const messages = useMessages();
  /*
    Что сказать об отброшенном символе.

    Отбрасывание было МОЛЧАЛИВЫМ: `unmask` пропускает не подошедший под токен
    символ и идёт дальше. Пользователь видел, что нажатие «не сработало», и
    оставался без объяснения — на этом же эталонная реализация USWDS провалила
    тест WCAG 3.3.3 (у неё несовпавший символ вдобавок обрывает весь остаток).

    Повторное нажатие той же неподходящей клавиши даёт ТУ ЖЕ строку, и
    скринридер её не переобъявляет — очереди из объявлений не возникает само
    собой, без подавления и таймеров.
  */
  const [rejection, setRejection] = useState("");

  const formatted = formatMask(value, mask);

  /*
    Трафарет маски под значением.

    СКРЫТЫЙ ПРЕФИКС ДЕРЖИТ НАБРАННОЕ, а не символы маски: тогда ширины
    совпадают ПО ПОСТРОЕНИЮ — под цифрой стоит та же цифра, — и остаток
    начинается ровно там, где кончился ввод. Держи он подчёркивания, совпадение
    зависело бы от того, одинаковой ли ширины `_` и `8` в шрифте потребителя,
    то есть было бы случайным.

    Считается из `value` в рендере, а не в обработчике нажатий. У эталонной
    реализации USWDS обработчик висит на `keyup`, и вставка мышью,
    автозаполнение и любое программное изменение оставляют трафарет
    рассинхронизированным с полем.

    `GrayText` в режиме высокой контрастности: система красит весь текст одним
    цветом, и без этого трафарет стал бы неотличим от набранного — то есть поле
    показывало бы цифры, которых нет.
  */
  const underlay = showMask ? (
    <>
      <span className="invisible">{formatted}</span>
      <span className="text-fg-2 forced-colors:text-[color:GrayText]">
        {maskRemainder(value, mask)}
      </span>
    </>
  ) : undefined;

  useLayoutEffect(() => {
    const el = innerRef.current;
    const at = caret.current;
    caret.current = null;
    if (el && at != null) el.setSelectionRange(at, at);
  });

  const commit = (raw: string, rawCaret: number) => {
    caret.current = caretAfter(mask, rawCaret);
    onChange(raw, formatMask(raw, mask));
  };

  const control = (
    <TextControl
      ref={innerRef}
      underlay={underlay}
      value={formatted}
      onChange={(event) => {
        const shown = event.target.value;
        const position = event.target.selectionStart ?? shown.length;
        const raw = unmask(shown, mask);

        /*
          Набранное пропало: строка показа выросла, а значение не изменилось.

          Вопрос задаётся именно так — «изменилось ли значение», а не «годится
          ли символ под токен». Разница видна на литерале маски, который сам
          допустимый символ: в `+7 (999) 999-99-99` литерал `7` — цифра.
          Пользователь набирает `7` первым (привычка набирать `+7`), `unmask`
          съедает его как литерал, значение остаётся пустым — и проверка «по
          токену» считала бы символ принятым и молчала. То есть ровно тот
          дефект, ради которого объявление и заводилось.

          Сравнение по значению, а не по его длине: правка СЕРЕДИНЫ заполненного
          поля меняет значение, не меняя длины, и по длине выглядела бы отказом.
          Она же роняла каретку лишней перерисовкой.

          Длина показа в условии обязательна: без неё удаление литерала (`)`)
          тоже даёт неизменное значение и объявлялось бы отказом.
        */
        const added = shown.length - formatted.length;
        /*
          Обрезка ВСТАВКИ — отдельная ветка, и различается она по `inputType`,
          а не по длине.

          Отличить её от соседей иначе нечем: набор лишнего символа в полном
          поле тоже даёт переполнение, но это `full`, а правка СЕРЕДИНЫ полного
          поля выталкивает символ и обязана молчать (см. ниже). Общее у этих
          двух — пользователь видит, что делает. У вставки не видит: хвост
          исчезает целиком, и `89161234567` становится `+7 (891) 612-34-56` —
          чужим, но правдоподобным номером.

          Условие `raw === value` ниже вставку не ловит принципиально: при ней
          значение МЕНЯЕТСЯ.
        */
        const native = event.nativeEvent;
        const inputType = native instanceof InputEvent ? native.inputType : undefined;
        /*
          «Пришло не по одному символу» — вот что на самом деле отличает этот
          случай, и одного `insertFromPaste` для этого мало:

          - перетаскивание текста мышью даёт `insertFromDrop`;
          - подстановка из менеджера паролей или строки подсказок телефона —
            `insertReplacementText`, а программная запись значения приходит
            обычным `Event`, у которого `inputType` пуст или отсутствует. На мобильном это
            САМЫЙ частый способ, каким телефон попадает в телефонное поле.

          Отсюда последнее условие: неизвестный `inputType` при `added > 1`.
          Оно же отделяет эти пути от набора символа в полном поле — там
          `added === 1`, и отвечать должна ветка `full` ниже.
        */
        const bulk =
          inputType === "insertFromPaste" ||
          inputType === "insertFromPasteAsQuotation" ||
          inputType === "insertFromDrop" ||
          inputType === "insertReplacementText" ||
          (!inputType && added > 1);
        const overflow = bulk ? unmaskOverflow(shown, mask) : 0;
        if (overflow > 0) {
          setRejection(messages.maskedInput.truncated({ count: overflow }));
        } else if (added > 0 && raw === value) {
          // Куда метил ввод: сколько символов значения стоит левее вставленного.
          const at = rawLengthBefore(mask, Math.max(position - added, 0));
          const token = maskTokenAt(mask, at);
          setRejection(
            token == null
              ? messages.maskedInput.full
              : messages.maskedInput.rejected({ expected: EXPECTED[token] })
          );
        } else if (rejection) setRejection("");

        // Сколько символов значения оказалось левее каретки — столько и
        // останется: позиция считается по показанной строке, а не по сдвигу.
        commit(raw, unmask(shown.slice(0, position), mask).length);
      }}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        // Чужой обработчик вызывается ПЕРВЫМ и может отменить наш `preventDefault`
        // — иначе он был бы вытеснен спредом, как это уже случилось со `style`
        // у `TopBar` в ревью 2.1.0.
        onKeyDown?.(event);
        if (event.defaultPrevented || event.key !== "Backspace") return;

        const el = event.currentTarget;
        const start = el.selectionStart ?? 0;
        if (start !== el.selectionEnd) return;

        const before = rawLengthBefore(mask, start);
        if (before === 0) return;
        event.preventDefault();
        commit(value.slice(0, before - 1) + value.slice(before), before - 1);
      }}
      {...rest}
    />
  );

  /*
    Живая область СМОНТИРОВАНА ВСЕГДА, подменяется только текст. Область,
    вставленная в документ вместе с сообщением, объявляется ненадёжно — часть
    скринридеров успевает её пропустить. Тот же приём и по той же причине, что
    в `FileDropzone`.

    `status`, а не `alert`: отброшенная клавиша — не ошибка формы, и перебивать
    ею текущую речь значит наказывать за опечатку.

    Фрагмент, а не обёртка: обёртка вокруг поля сменила бы разметку всем, кто
    уже ставит `MaskedInput` в свою раскладку. Область спрятана `sr-only`,
    выпадает из потока и на раскладку не влияет.
  */
  return (
    <>
      {control}
      <span role="status" aria-live="polite" className="sr-only">
        {rejection}
      </span>
    </>
  );
});
