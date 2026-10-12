"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useFieldDescribedBy } from "../../hooks/useFieldDescription.js";
import { cn } from "../../lib/cn.js";
import { LISTBOX_ITEM_CLASS } from "../../lib/menu.js";
import { FIELD_CLEAR_CLASS } from "../../lib/field.js";
import { useMessages } from "../../i18n/useMessages.js";
import { CheckIcon, CloseIcon, SelectIcon } from "../../icons.js";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "../overlays/Popover.js";
import { VisuallyHidden } from "../content/VisuallyHidden.js";

/** Минимум, который список требует от элемента. Остальные поля — ваши. */
export interface SelectItem {
  /** Идентификатор элемента; именно он попадает в `value` и `onChange`. */
  id: string | number;
  /** Подпись в списке и в триггере. По ней же идёт поиск. */
  label: string;
  /** Дополнительный текст для поиска — slug, описание, синонимы. Не показывается. */
  keywords?: string;
  /** Что показать справа у невыбранного элемента: счётчик, дата, тон. */
  meta?: ReactNode;
}

/**
 * Идентификатор элемента списка.
 *
 * Экспортируется, потому что стоит в публичной сигнатуре: `value` и `onChange`
 * говорят на нём. Без экспорта потребитель, объявляя состояние или обработчик,
 * писал `string | number | null` руками — то есть повторял определение кита в
 * своём коде, и при его изменении узнал бы об этом не от компилятора.
 *
 * Тип шире, чем `string`, ровно из-за `id` у `SelectItem`: категории приходят
 * с сервера с числовыми идентификаторами, коллекции — со строковыми.
 */
export type SelectId = string | number;

/** Общая часть обеих осей: всё, что не зависит от множественности. */
interface SelectCommonProps<T extends SelectItem> {
  /** Элементы списка. */
  items: T[];
  /** Подпись триггера, когда ничего не выбрано: «Категория», «Автор». */
  placeholder: string;
  /**
   * Поле поиска в панели. По умолчанию выключено: список из трёх статусов
   * искать незачем, а поле в нём — лишний шаг до цели.
   */
  searchable?: boolean;
  /** Плейсхолдер в поле поиска панели. */
  searchPlaceholder?: string;
  /** Когда список пуст изначально. */
  emptyText?: string;
  /** Когда пуст результат поиска. */
  notFoundText?: string;
  /** Показывать ли кнопку очистки у выбранного значения. */
  clearable?: boolean;
  /**
   * Подсвечивать ли триггер акцентом, когда значение выбрано.
   *
   * В фильтрах — да, и по умолчанию так: подсветка там означает «фильтр
   * применён», её ищут глазами, пробегая панель. В форме она означала бы
   * «поле заполнено» — а заполненное поле это норма, а не событие, и рядом
   * с обычными `TextControl` акцентная пилюля выглядит тревогой на пустом
   * месте.
   *
   * Выключенный вариант оставляет триггеру нейтральную рамку; фон и радиус
   * под соседние поля потребитель задаёт через `triggerClassName` — какой
   * именно вид у формы, пакет не знает.
   */
  highlightSelected?: boolean;
  /**
   * Рисует картинку слева от подписи: превью, эмодзи, аватар.
   *
   * Картинка слева: превью, эмодзи, аватар. `px` — сторона квадрата, которую
   * ждёт вёрстка: 20 в триггере, 28 в списке. Размер передаётся числом, а не
   * ступенью словаря, потому что это внутренняя геометрия списка, а не ось.
   *
   * 20 в триггере — это ровно строчный бокс контрола (`leading-5`), и меньшим
   * числом квадрат сделан именно поэтому: всё, что выше строки, растягивает
   * триггер, и он расходится по высоте с соседним `TextControl`.
   */
  renderMedia?: (item: T, px: number) => ReactNode;
  /**
   * Иконка слева в свёрнутом состоянии — когда ничего не выбрано. У выбранного
   * значения его место занимает `renderMedia`.
   *
   * По умолчанию `SelectIcon` из словаря дизайн-системы — общепринятая
   * стрелка-двусторонка выпадающего списка. Раньше здесь стоял текстовый символ
   * `⌄`, потому что пакет принципиально не тянул иконочную библиотеку; на деле
   * это означало, что привести компонент к своему стилю нельзя было вовсе,
   * и потребителю приходилось передавать иконку вручную в каждом месте вызова.
   *
   * Своя иконка по-прежнему передаётся сюда — она получит `aria-hidden`
   * от обёртки, потому что подпись рядом уже всё называет.
   */
  icon?: ReactNode;
  /** Раскрыт ли список, когда им управляют снаружи; обновлять в `onOpenChange`. */
  open?: boolean;
  /** Вызывается при открытии и закрытии списка. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Классы триггера: раскладка, внутренние отступы, скругление, фон.
   *
   * Здесь же снимается предел ширины подписи, если триггер широкий:
   * `[--select-label-max:none]`. По умолчанию подпись обрезается на 110px,
   * чтобы пилюля фильтра не растягивалась по длинному названию.
   */
  triggerClassName?: string;
  /** Классы выпадающей панели. */
  contentClassName?: string;
  /** Доступное имя кнопки очистки. */
  clearLabel?: string;
  /**
   * Как подписать значение, которому не нашлось элемента в `items`.
   *
   * Такое бывает в двух обычных случаях: значение пришло из адреса, пока список
   * ещё грузится, и значение указывает на удалённую запись. По умолчанию
   * показывается сам ключ — он честнее плейсхолдера, когда человекочитаем
   * (`section-contracts`). Но если идентификаторы у вас машинные, пользователь
   * увидит `9f2c1b04-…`; тогда подпись задаёт этот проп — кит не знает, как
   * выглядят ваши ключи.
   */
  missingLabel?: (id: SelectId) => ReactNode;
  /**
   * Выключенное поле: триггер не фокусируется, панель не открывается, кнопка
   * очистки исчезает, вид приглушён.
   *
   * Поведение и вид — как у `Button` и `TextControl`, и заведено оно ровно
   * поэтому: потребитель гасит форму на время запроса целиком, а поле, которое
   * осталось живым среди погасших соседей, читается как недоделка, а не как
   * замысел.
   */
  disabled?: boolean;
  /**
   * Доступное имя поля — «Иконка», «Проект».
   *
   * БЕЗ НЕГО ТРИГГЕР ИМЕНУЕТСЯ СОДЕРЖИМЫМ, то есть подписью выбранного значения
   * либо плейсхолдером. В панели фильтров этого хватает: там плейсхолдер и есть
   * название фильтра. В форме — нет: зрячий видит подпись «Иконка» над полем,
   * а скринридер объявляет «Без иконки, кнопка», и два таких поля рядом на слух
   * не различаются. Подпись `FormField` сюда не доходит сама: составной контрол
   * не принимает `id`, и `htmlFor` связывать нечего.
   *
   * ИМЯ СКЛАДЫВАЕТСЯ С СОДЕРЖИМЫМ, а не вытесняет его: строка уезжает в скрытый
   * узел, и триггер объявляется «Иконка, Круг, кнопка». Обычный `aria-label` на
   * кнопке победил бы содержимое, и поле выбора перестало бы сообщать, что в
   * нём выбрано. Тот же приём и по той же причине — в `TreeSelect`.
   */
  "aria-label"?: string;
  /**
   * Имя триггера ссылкой на `id` уже показанной подписи.
   *
   * То же имя, но ссылкой на уже нарисованную подпись: у потребителя она стоит
   * на экране, и повторять её текст здесь значило бы завести второй источник,
   * который разъедется с первым молча.
   *
   * Складывается с содержимым так же, как `aria-label`. Заданы оба — побеждает
   * ссылка: видимая подпись ближе к тому, что человек читает глазами.
   */
  "aria-labelledby"?: string;
  /**
   * Своё описание триггера. Сливается с описанием `FormField`, а не заменяет
   * его: подсказка формы и пояснение потребителя обязаны звучать обе.
   */
  "aria-describedby"?: string;
}

/*
  Предел ширины подписи — ОДИН на все ветки триггера.

  Стоял он только у выбранного значения, и остальные две подписи росли
  свободно: счётчик множественного выбора и подпись исчезнувшего значения
  (`missingLabel`). Замер потребителя: пилюля с «Проект удалён» занимала 170
  пикселей против 120 у обычной — одной такой хватало, чтобы панель отбора
  разъехалась на вторую строку. `truncate` там был, а обрезать ему было нечего:
  без `max-width` строка занимает столько, сколько занимает.

  Плейсхолдер намеренно без предела: это состояние по умолчанию, под него у
  всех потребителей уже собрана раскладка, и обрезать её задним числом значило
  бы сменить вид там, где никто не жаловался.
*/
const LABEL_CLASS = "max-w-[var(--select-label-max,110px)] truncate";

export type SelectProps<T extends SelectItem> =
  | (SelectCommonProps<T> & {
      /** Выбор одного элемента. По умолчанию. */
      multiple?: false;
      /** Выбранный `id` или, при `multiple`, массив `id`. Сравнение по строке: `1` и `"1"` — одно и то же; порядок в массиве — как пришёл. */
      value?: SelectId | null;
      /**
       * Выбран элемент — приходит его `id`; очищено — приходит `null`.
       *
       * Раньше очистка отдавала пустую строку, и договорённость держалась только
       * на комментарии: в типе `""` неотличима от любого другого `string`. `null`
       * виден компилятору, и потребитель обязан его обработать.
       */
      onChange: (id: SelectId | null) => void;
    })
  | (SelectCommonProps<T> & {
      /** Выбор нескольких элементов: `value` — массив `id`, `onChange` получает массив. */
      multiple: true;
      /** Выбранный `id` или, при `multiple`, массив `id`. Сравнение по строке: `1` и `"1"` — одно и то же; порядок в массиве — как пришёл. */
      value?: SelectId[];
      /** Всегда массив: очистка — пустой, а не `null`. */
      onChange: (ids: SelectId[]) => void;
      /**
       * Подпись триггера, когда выбрано больше одного: «Категории: 3».
       * Склонение — работа потребителя: пакет не знает ни языка подписи,
       * ни того, что `placeholder` был в единственном числе.
       */
      countLabel?: (count: number) => ReactNode;
    });

/**
 * Выпадающий список с двумя ортогональными осями: `searchable` и `multiple`.
 *
 * Пришёл на смену `SearchSelect`, который умел ровно одно сочетание —
 * «с поиском, по одному». Оси разведены, потому что во фронте одновременно
 * жили и он, и два рукописных дропдауна (статус и тон), повторявшие его
 * триггер и панель без поиска: сотня строк копии ради выключенной строки поиска.
 *
 * Типы — union по `multiple`, а не `SelectId | SelectId[] | null` одним полем.
 * Разница принципиальная: с union компилятор сам знает, что придёт в `onChange`,
 * и потребителю не приходится сужать тип в каждом обработчике.
 *
 * ДВЕ ВЕЩИ УСТРОЕНЫ ИНАЧЕ, ЧЕМ В ПРЕЖНИХ ПИКЕРАХ ФРОНТА, И ЭТО НЕ КОСМЕТИКА:
 *
 * 1. Крестик очистки — настоящая `<button>` рядом с триггером, а не `<span>`
 *    с `onClick` внутри него. Вложенная интерактивность недопустима в разметке,
 *    и такой крестик был недостижим с клавиатуры вовсе: до него нельзя было
 *    добраться табом, а Enter на нём открывал список вместо очистки.
 * 2. Триггер сообщает состояние: `aria-expanded` и `aria-haspopup="listbox"`.
 *    Прежняя версия отдавала скринридеру обычную кнопку, по которой нельзя
 *    было понять ни что она открывает, ни что уже выбрано.
 */
export function Select<T extends SelectItem>(props: SelectProps<T>) {
  /**
   * Описание поля из `FormField` плюс своё, если потребитель его передал.
   *
   * Тот же приём, что у `TextControl` и `NumberInput`: значения СЛИВАЮТСЯ, а
   * не заменяют друг друга. Вне `FormField` контекст пуст, и разметка та же,
   * что была до появления описаний.
   */
  const fieldDescribedBy = useFieldDescribedBy();
  const describedBy =
    [props["aria-describedby"], fieldDescribedBy].filter(Boolean).join(" ") || undefined;

  const {
    items,
    placeholder,
    searchable = false,
    searchPlaceholder,
    emptyText,
    notFoundText,
    clearable = true,
    highlightSelected = true,
    renderMedia,
    icon,
    open: controlledOpen,
    onOpenChange,
    triggerClassName,
    contentClassName,
    clearLabel,
    missingLabel,
    disabled = false,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
  } = props;

  const messages = useMessages();
  const [internalOpen, setInternalOpen] = useState(false);
  const [search, setSearch] = useState("");

  const open = controlledOpen ?? internalOpen;

  /**
   * ИМЯ ТРИГГЕРА СОБИРАЕТСЯ ИЗ ПОДПИСИ И СОДЕРЖИМОГО.
   *
   * `aria-label` на кнопке победил бы содержимое, и поле объявлялось бы
   * «Иконка, кнопка» — без единого слова о том, что в нём выбрано. Для поля
   * выбора это отказ основной функции, и axe его не ловит: имя у кнопки есть.
   * Поэтому подпись уезжает в скрытый узел, а `aria-labelledby` перечисляет её
   * вместе с узлом значения. Раскладка повторяет `TreeSelect`.
   *
   * Без подписи атрибута нет вовсе: тогда имя вычисляется из содержимого, как
   * и до появления этих пропов, — в панели фильтров плейсхолдер и есть название.
   */
  const fieldId = useId();
  const labelId = `${fieldId}-label`;
  const valueId = `${fieldId}-value`;
  const labelledBy = ariaLabelledBy ?? (ariaLabel ? labelId : undefined);

  /*
    Выключение ЗАКРЫВАЕТ панель, а не прячет её.

    Одного `open && !disabled` в разметке мало: управляемая смена `open` у Radix
    не зовёт `onOpenChange`, и состояние осталось бы `true` — форма ушла в
    отправку, панель исчезла, отправка кончилась, панель вернулась сама, хотя
    пользователь ничего не нажимал. Тот же приём и по той же причине, что в
    `TreeSelect` и `SplitButton`.

    Закрытие объявляется НАРУЖУ, а не только внутрь. У `TreeSelect` состояние
    всегда своё, здесь же `open` бывает управляемым: погасить одно внутреннее
    значило бы закрыть панель на экране и оставить `true` у потребителя — то
    самое возвращение, от которого эффект и заводится.

    Колбэк зовётся, только если панель была открыта: иначе каждое выключение
    поля слало бы `onOpenChange(false)` о том, чего не было.
  */
  useEffect(() => {
    if (!disabled || !open) return;
    setInternalOpen(false);
    onOpenChange?.(false);
    // Зависимость одна: эффект — про МОМЕНТ выключения, а `open` и колбэк
    // читаются в этот момент и в перезапуске не нуждаются.
  }, [disabled]);

  /**
   * Внутреннее состояние обновляется ВСЕГДА, даже когда потребитель слушает
   * `onOpenChange`. Иначе тот, кто передал только колбэк без `open`, получал
   * список, который не открывается никогда: `setOpen` уходил в колбэк, а
   * `internalOpen` оставался `false`.
   */
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  /**
   * Обе оси сводятся к одному списку строк — дальше разметке всё равно.
   *
   * Пустая строка — тоже «не выбрано». Компонент отдаёт при очистке `null`,
   * но потребители держат фильтры в URL, где пусто выражается именно `""`,
   * и присылают его обратно. Считать `""` выбором значит показать счётчик
   * «Статус: 1» на фильтре, где ничего не выбрано.
   */
  const selectedIds = props.multiple
    ? (props.value ?? []).map(String).filter((v) => v !== "")
    : props.value === null || props.value === undefined || props.value === ""
      ? []
      : [String(props.value)];

  const selected =
    selectedIds.length === 1 ? items.find((i) => String(i.id) === selectedIds[0]) : undefined;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.label.toLowerCase().includes(q) || (i.keywords ?? "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const select = (item: T) => {
    if (props.multiple) {
      // Панель остаётся открытой: мультивыбор из одного элемента бессмыслен,
      // а закрытие после каждого клика заставляло бы открывать её заново.
      const id = String(item.id);
      const current = props.value ?? [];
      props.onChange(
        current.some((v) => String(v) === id)
          ? current.filter((v) => String(v) !== id)
          : [...current, item.id]
      );
      return;
    }
    props.onChange(item.id);
    setSearch("");
    setOpen(false);
  };

  const clear = () => {
    if (props.multiple) props.onChange([]);
    else props.onChange(null);
    setSearch("");
    setOpen(false);
  };

  const hasSelection = selectedIds.length > 0;
  // `Set`, а не `includes` на каждой строке: список бывает в тысячи элементов,
  // а отмеченных — в сотни, и на каждый символ в поиске это давало сотни тысяч
  // сравнений строк синхронно, до отрисовки.
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds.join("\u0000")]);
  const countLabel = props.multiple ? props.countLabel : undefined;

  /**
   * КЛАВИАТУРА В ПАНЕЛИ. Фокус переносится по настоящим кнопкам
   * (roving focus), а не через `aria-activedescendant`: пункты списка здесь —
   * полноценные `<button>`, и второй способ адресации ничего не добавил бы,
   * кроме расхождения между «куда смотрит скринридер» и «где фокус на самом
   * деле».
   *
   * Обработчик один и висит на всей панели, а не на каждом пункте: до пунктов
   * дело доходит не всегда — сразу после открытия фокус стоит либо в поле
   * поиска, либо на самой панели (её фокусирует Radix), и события с них
   * до списка не всплывают, потому что список у них внутри, а не снаружи.
   */
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /**
   * Живые кнопки списка. Отфильтровать дырки обязательно: React обнуляет реф
   * при размонтировании, поэтому после сужения поиска в массиве остаются
   * `null` на месте выбывших пунктов — и `End` уводил бы фокус в такую дырку,
   * то есть никуда. Считаем здесь, а не подрезаем массив в рендере: писать
   * в реф во время рендера нельзя.
   */
  const liveOptions = () => optionRefs.current.filter((el): el is HTMLButtonElement => el !== null);

  const focusOption = (index: number) => {
    const options = liveOptions();
    if (options.length === 0) return;
    // Края не зацикливаются: список — не карусель, и «вниз» с последнего
    // пункта, прыгающее на первый, читается как промах, а не как переход.
    options[Math.max(0, Math.min(index, options.length - 1))]?.focus();
  };

  const onPanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const inSearch = document.activeElement === searchRef.current;
    const current = liveOptions().indexOf(document.activeElement as HTMLButtonElement);

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        // Из поля поиска и с самой панели — на первый пункт.
        focusOption(current < 0 ? 0 : current + 1);
        return;
      case "ArrowUp":
        if (inSearch) return;
        e.preventDefault();
        // Вверх с первого пункта — обратно в поиск: иначе фокус упирается
        // в потолок списка, а поле остаётся достижимым только мышью.
        if (current <= 0 && searchable) searchRef.current?.focus();
        else focusOption(current < 0 ? 0 : current - 1);
        return;
      case "Home":
      case "End":
        // В поле поиска это перемещение каретки по строке, а не по списку.
        if (inSearch) return;
        e.preventDefault();
        focusOption(e.key === "Home" ? 0 : liveOptions().length - 1);
        return;
    }

    // Печать с пункта списка возвращает в поиск: пользователь, начавший
    // набирать название, имеет в виду поиск, а не список.
    //
    // Пробел исключён намеренно — на кнопке это выбор пункта, и отдавать его
    // поиску значило бы сломать штатный способ выбрать элемент с клавиатуры.
    if (!searchable || inSearch || current < 0) return;
    if (e.key === "Backspace") {
      e.preventDefault();
      setSearch((s) => s.slice(0, -1));
      searchRef.current?.focus();
      return;
    }
    if (e.key.length === 1 && e.key !== " " && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      setSearch((s) => s + e.key);
      searchRef.current?.focus();
    }
  };

  return (
    <Popover
      // `open && !disabled`, а не условный `onOpenChange`: выключение при
      // открытой панели иначе заклинило бы её — и Escape, и клик снаружи идут
      // через обработчик, а открыться заново мешает атрибут `disabled`.
      open={open && !disabled}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSearch("");
      }}
    >
      {/*
        Пилюля — внешний бокс, а кнопка внутри растянута на всю его площадь
        через `after:inset-0`. Так решаются сразу три требования, которые иначе
        конфликтуют:

        1. Крестик обязан быть отдельной кнопкой — вложенная интерактивность
           недопустима, а прежний `<span onClick>` внутри кнопки был вдобавок
           недостижим с клавиатуры.
        2. Кликается вся пилюля, включая отступы. Промежуточный вариант, где
           кнопка была лишь внутренностью обёртки, оставлял 26px мёртвой зоны
           под `cursor-pointer` — курсор обещал клик там, где его не было.
        3. `triggerClassName` действует на том же боксе, что и до переноса:
           потребитель шлёт вперемешку и раскладку (`w-full`, `min-w`), и вид
           (`px-3`, `rounded-control`). Разложить это по двум элементам нечем,
           поэтому строка целиком остаётся на пилюле. Когда она висела на
           обёртке, а отступы были ещё и на кнопке, они складывались: на экране
           кампаний контрол вырастал с 36 до 56 пикселей рядом с 36-пиксельными
           соседями.

        Кольцо фокуса рисуется на псевдоэлементе, а не на кнопке: обводить надо
        пилюлю целиком, иначе она у`же собственного контура.
      */}
      {/*
        Якорь панели — вся пилюля, а не кнопка-триггер внутри неё: кнопка отступает
        от нижней кромки на рамку и `py-[7px]`, и панель с `sideOffset` в 4px
        заходила на пилюлю вместо зазора.
      */}
      <PopoverAnchor asChild>
        <span
          className={cn(
            "relative inline-flex items-center gap-2 rounded-full border px-3 py-[7px]",
            // `leading-5` задаёт высоту, а не наследует её: строчный бокс в 20px
            // плюс отступы дают ровно 36 — рост `Button` размера `md`, рядом с
            // которым пилюля и стоит в панели фильтров. С отступами формы
            // (`py-2.5` от потребителя) те же 20 дают 42 — рост `TextControl`
            // и `NumberInput` (см. `lib/field.ts`).
            //
            // Картинка выбранного значения тоже 20, и это условие, а не совпадение:
            // содержимое выше строчного бокса растягивало бы триггер. Пока она
            // была 22, пилюля с картинкой вырастала до 38, а триггер формы — до 44,
            // и контрол расходился и с соседним полем, и сам с собой в пустом
            // состоянии.
            // `transition-colors`, а не `transition-all`: на этом боксе меняются
            // только рамка, фон и цвет подписи — по ветке `hasSelection`. `all`
            // обещал переход всему, чего на пилюле нет, и заодно тому, что
            // потребитель пришлёт через `triggerClassName`. Заменено в волне 27
            // при ревизии движения: класс выглядел перемещающим, а перемещать
            // здесь нечего.
            "text-[13px] leading-5 font-semibold transition-colors",
            hasSelection && highlightSelected
              ? "border-accent-strong bg-accent-soft text-fg-0"
              : "border-line-soft text-fg-1 hover:border-line hover:bg-bg-2 bg-transparent",
            // Выбранное значение читается тёмным даже без акцентной подсветки:
            // подпись — это содержимое контрола, а не подсказка.
            hasSelection && !highlightSelected && "text-fg-0",
            // Гаснет ПИЛЮЛЯ, а не кнопка внутри неё: рамка и фон нарисованы здесь,
            // и приглушённая подпись рядом с яркой рамкой выглядела бы сбоем
            // отрисовки, а не выключенным полем.
            disabled && "cursor-not-allowed opacity-50",
            triggerClassName
          )}
        >
          {/*
          Подпись видна только скринридеру и стоит ВНЕ кнопки: внутри неё она
          попала бы в содержимое, то есть прочиталась бы дважды — один раз как
          имя, второй как значение.

          `elementType="span"`: по умолчанию react-aria рисует `<div>`, а здесь
          он оказался бы внутри строчной пилюли.
        */}
          {ariaLabel && !ariaLabelledBy ? (
            <VisuallyHidden elementType="span" id={labelId}>
              {ariaLabel}
            </VisuallyHidden>
          ) : null}

          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-haspopup="listbox"
              aria-expanded={open && !disabled}
              aria-labelledby={labelledBy ? `${labelledBy} ${valueId}` : undefined}
              aria-describedby={describedBy}
              className={cn(
                // `grow` + `justify-between`: когда потребитель растягивает пилюлю
                // (`w-full`, `min-w`), кнопка занимает всю ширину, и его
                // `justify-between` разводит иконку и подпись — как было до выноса.
                // На пилюле по размеру содержимого свободного места нет, и оба
                // класса ничего не меняют.
                "inline-flex min-w-0 grow cursor-pointer items-center justify-between gap-2 text-left",
                "disabled:cursor-not-allowed",
                "after:absolute after:inset-0 after:rounded-[inherit]",
                "focus-visible:after:outline-accent-strong focus-visible:after:outline-2 focus-visible:after:outline-offset-2",
                // Место под крестик — на кнопке, а не на пилюле: пилюля уже несёт
                // отступы потребителя, и добавка к ним сместила бы рамку.
                hasSelection && clearable && !disabled && "pr-6"
              )}
            >
              {/*
              Содержимое собрано в одну группу, а не выложено соседями кнопки.
              Иначе `justify-between` разводит по краям именно их: в пилюле по
              ширине содержимого это незаметно, а в широком триггере (`w-full`
              в форме) картинка прилипает к левому краю, подпись — к правому,
              и между ними дыра во всю строку.
            */}
              {selected ? (
                <span id={valueId} className="inline-flex min-w-0 items-center gap-2">
                  {renderMedia?.(selected, 20)}
                  {/*
                  Ширина подписи ограничена переменной, а не жёстким числом.
                  В пилюле фильтра предел нужен: она растёт по содержимому, и
                  «Абстрактные градиенты» растолкали бы соседние фильтры. В
                  широком триггере формы (`w-full`) он, наоборот, врёт — там
                  место есть, а подпись всё равно резалась на 110 пикселях.
                  Снимается это классом на триггере:
                  `triggerClassName="[--select-label-max:none]"`.
                */}
                  <span className={LABEL_CLASS}>{selected.label}</span>
                </span>
              ) : hasSelection && props.multiple ? (
                /*
                Счётчик — СТРОГО за множественным выбором.

                Ветка ловила и одиночный `Select`, у которого значение есть, а
                элемента для него в `items` не нашлось: значение пришло из
                адреса, пока список грузится, или указывает на удалённую запись.
                Триггер показывал «Категория: 1» — счётчик там, где считать
                нечего. Одиночный случай уходит теперь в ветку ниже и
                показывает сам ключ, как это делает `captionOf` в `TreeSelect`.
              */
                <span id={valueId} className={LABEL_CLASS}>
                  {countLabel
                    ? countLabel(selectedIds.length)
                    : `${placeholder}: ${selectedIds.length}`}
                </span>
              ) : hasSelection ? (
                /*
                Одиночный выбор, которому не нашлось элемента.

                Ключ ЧЕСТНЕЕ плейсхолдера, когда он человекочитаем
                (`section-contracts`), и хуже него, когда это UUID: пользователь
                видит `9f2c1b04-…` там, где ждал подпись. Решает это
                потребитель — он один знает, как выглядят его идентификаторы, —
                поэтому подпись отсутствующего значения берётся пропом, а по
                умолчанию показывается ключ, как это делает `captionOf` в
                `TreeSelect`.
              */
                <span id={valueId} className={LABEL_CLASS}>
                  {missingLabel ? missingLabel(selectedIds[0]!) : selectedIds[0]}
                </span>
              ) : (
                /*
                `id` значения стоит на КОРНЕ КАЖДОЙ ветки, а не на общей обёртке
                вокруг них: обёртка — лишний бокс во флексе триггера, и она
                сместила бы содержимое там, где менять его никто не просил.
              */
                <span id={valueId} className="inline-flex min-w-0 items-center gap-2">
                  <span aria-hidden className="inline-flex shrink-0 items-center opacity-60">
                    {icon ?? <SelectIcon size={14} />}
                  </span>
                  <span className="truncate">{placeholder}</span>
                </span>
              )}
            </button>
          </PopoverTrigger>

          {hasSelection && clearable && !disabled ? (
            <button
              type="button"
              aria-label={clearLabel ?? messages.common.clear}
              onClick={clear}
              className={FIELD_CLEAR_CLASS}
            >
              <CloseIcon size={10} aria-hidden />
            </button>
          ) : null}
        </span>
      </PopoverAnchor>

      <PopoverContent
        className={cn("w-[260px]", contentClassName)}
        align="start"
        onKeyDown={onPanelKeyDown}
      >
        {searchable ? (
          <div className="border-line-soft border-b px-3 py-2">
            <div className="border-line-soft bg-bg-2 focus-within:border-accent-strong flex items-center gap-2 rounded-sm border px-3 py-2 transition-[border-color,box-shadow] focus-within:ring-[3px] focus-within:ring-[color:var(--focus-ring)]">
              <input
                ref={searchRef}
                type="text"
                // Панель уже обведена рамкой фокуса — второй контур внутри неё лишний.
                data-disable-focus-ring="true"
                aria-label={searchPlaceholder ?? messages.common.searchPlaceholder}
                placeholder={searchPlaceholder ?? messages.common.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-fg-0 placeholder:text-fg-2 w-full border-none bg-transparent text-[13px] outline-none"
                autoFocus
              />
            </div>
          </div>
        ) : null}

        <div
          role="listbox"
          aria-multiselectable={props.multiple ? true : undefined}
          className="max-h-[280px] overflow-y-auto p-1"
        >
          {filtered.length === 0 ? (
            <div className="text-fg-2 px-3 py-4 text-center text-[13px]">
              {search
                ? (notFoundText ?? messages.common.notFound)
                : (emptyText ?? messages.common.empty)}
            </div>
          ) : (
            filtered.map((item, index) => {
              const isSelected = selectedSet.has(String(item.id));
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    optionRefs.current[index] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => select(item)}
                  /*
                    `data-selected` — чтобы ОБЩАЯ строка списка работала и здесь.

                    Вариант `selected:` плагина разворачивается в `[data-selected]`
                    без требования `data-rac` (у `selected` нет нативного
                    соответствия), поэтому его хватает и обычной кнопке. Так
                    строка `Select` наконец красится тем же, чем `Combobox`,
                    `CommandPalette` и `Transfer`: свой набор расходился с ними
                    и отступом (`py-[9px]` против `py-1.5`), и цветом выбора
                    (`bg-bg-3` против `selected:bg-accent-soft`) — списки кита,
                    поставленные рядом, различались и высотой строки, и тем, как
                    выглядит выбранное.
                  */
                  data-selected={isSelected || undefined}
                  className={cn(
                    LISTBOX_ITEM_CLASS,
                    // Своё остаётся только то, что не про вид строки списка:
                    // кнопка во всю ширину, зазор под медиа-слот и кольцо фокуса.
                    "w-full gap-[10px] text-left transition-colors",
                    "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:-outline-offset-2"
                  )}
                >
                  {renderMedia?.(item, 28)}
                  <span className="flex-1 truncate font-medium">{item.label}</span>
                  {isSelected ? (
                    <CheckIcon size={14} aria-hidden className="text-accent-strong shrink-0" />
                  ) : (
                    <span className="text-fg-2 font-mono tabular-nums">{item.meta}</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
