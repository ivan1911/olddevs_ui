"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  Button,
  DropIndicator,
  GridList,
  GridListItem,
  useDragAndDrop,
  type Key,
} from "react-aria-components";
import { DragHandleIcon } from "../../icons.js";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { reorder } from "../../lib/reorder.js";
import { TextControl } from "../inputs/TextControl.js";

export interface EditableListItem {
  /** Стабильный идентификатор строки: по нему список сообщает о правке и новом порядке. */
  id: Key;
  /** Правимое по месту название. */
  value: string;
  /**
   * Строковое представление строки для доступного имени и объявлений о переносе.
   *
   * По умолчанию — `value`. Задавать имеет смысл там, где голое значение
   * неинформативно: «12.05» вместо «Срок сдачи, 12 мая».
   */
  textValue?: string;
  /** Строка отключена: её нельзя править и перетаскивать. */
  disabled?: boolean;
}

export interface EditableListProps {
  /** Строки списка в текущем порядке; порядок хранит потребитель. */
  items: EditableListItem[];
  /** Новый порядок целиком — список идентификаторов после перестановки. */
  onReorder: (ids: Key[]) => void;
  /** Подтверждение правки. Вызывается, только когда значение изменилось. */
  onValueChange: (id: Key, value: string) => void;
  /**
   * Доступное имя поля правки. Обязательно и проверяется компилятором: без него
   * правка по месту даёт поле без имени ровно в момент ввода.
   */
  editLabel: (item: EditableListItem) => string;
  /** Доступное имя списка. Безымянный список скринридер называет только по роли. */
  "aria-label": string;
  /**
   * Строка добавления в конце списка. Без пропа её нет вовсе.
   *
   * `label` — доступное имя поля; плейсхолдер именем не считается.
   */
  add?: {
    label: string;
    placeholder?: string;
    onAdd: (value: string) => void;
    /**
     * Добавление ещё сохраняется.
     *
     * Поле при этом НЕ выключается, и это не упущение. Выключенное поле
     * теряет фокус, а обратно его не получает: серия задач подряд — то
     * единственное, ради чего строка добавления и существует, — обрывалась
     * бы на первой же, как только сохранение идёт через сеть. Занятость
     * объявляется `aria-busy`, а ввод продолжается.
     */
    pending?: boolean;
    /**
     * Ведущие колонки строки добавления — ровно то же место, что занимает
     * `leading` у строк списка.
     *
     * Место ручки перетаскивания компонент резервирует сам; про `leading` он
     * знать не может — его ширину задаёт потребитель. Без этого слота у
     * списка с `leading` рамка поля встаёт на колонку флажка, а названия
     * строк уезжают правее, и низ списка выглядит рваным.
     *
     * Кладите РАСПОРКУ той же геометрии, а не живой контрол: флажок у задачи,
     * которой ещё нет, нечего отмечать, а фокус он бы забирал. Распорку
     * прячьте от скринридера — `aria-hidden`.
     */
    leading?: ReactNode;
  };
  /** Слот слева от названия: флажок выполнения, аватар исполнителя. */
  leading?: (item: EditableListItem) => ReactNode;
  /** Слот справа: бейдж состояния, кнопки действий строки. */
  trailing?: (item: EditableListItem) => ReactNode;
  /**
   * Вызывается по щелчку на строке и по пробелу на ней. Компонент сам их не трактует.
   *
   * Одиночный щелчок оставлен потребителю намеренно: правку открывает Enter, и
   * если бы щелчок делал то же, строке нечем было бы открыть подробности.
   */
  onRowAction?: (id: Key) => void;
  /**
   * Разделять строки волосяной линией.
   *
   * Без неё ряд держится одними отступами и на плотном списке читается
   * сплошным полотном: опорой остаются только плашки ручек. Линия разбивает
   * ряд, не превращая каждую строку в предмет, — это и есть разница в цене
   * между ней и подложкой с рамкой.
   *
   * Линия идёт МЕЖДУ строками, а не под каждой: под последней она подчеркнула
   * бы список, которого никто не подчёркивал.
   *
   * Скругление строки при этом снимается, и это не побочный эффект: у прямой
   * линии под скруглённой строкой углы загибаются вместе с рамкой, и
   * разделитель перестаёт быть прямым. Заодно подсветка по наведению
   * становится полосой во всю ширину — привычный вид разделённого списка.
   *
   * Подложки с рамкой у строки компонент не умеет намеренно: у такой подачи
   * сейчас нет заказчика, а ось, заведённая на будущее, — это API, который
   * придётся поддерживать без спроса (ADR-0031).
   */
  divided?: boolean;
  /** Что показать при пустом списке. */
  emptyText?: ReactNode;
  /** Классы корневого элемента. */
  className?: string;
}

/*
  ПОЛЕ В СПИСКЕ КОМПАКТНЕЕ ОБЫЧНОГО, и это не вкусовщина.

  У `TextControl` высота 42 пикселя: 20 строчного бокса, 2×10 отступа и 2
  рамки. Строка списка — 32. Разница видна ровно там, где поле стоит в одном
  ряду со строками: ряд начинает «дышать» неровно, а при открытии правки строка
  подпрыгивает на четырнадцать пикселей вместе со всем, что под ней.

  Отступ снимается с САМОГО ПОЛЯ, а не с оболочки: рамка и подсветка фокуса
  живут на оболочке, и обнулять её отступ значило бы прижать текст к рамке.
  `20 + 2×5 + 2 = 32` — ровно высота строки.
*/
const FIELD_COMPACT_CLASS = "py-[5px]";

export interface EditableListHandle {
  /**
   * Поставить фокус в строку добавления.
   *
   * Строки нет (`add` не передан) — вызов молча ничего не делает. Молча, а не
   * исключением: вызывающий приходит из палитры команд или горячей клавиши и
   * как раз НЕ хочет знать, в каком состоянии список. Исключение здесь
   * означало бы проверку на стороне каждого вызова.
   *
   * `select` выделяет набранное: повторный вызов тогда начинает ввод заново, а
   * не дописывает к прошлому. Без него поле, уже бывшее в фокусе, остаётся как
   * есть — ни каретка, ни текст не трогаются.
   */
  focusAdd: (options?: { select?: boolean }) => void;
}

//: `group` ЗДЕСЬ — КОНТРАКТ, А НЕ ВЁРСТКА (ADR-0046). Внутри кита им никто не
//: пользуется, но содержимое слотов `leading` и `trailing` у потребителя
//: опирается на `group-hover:` и `group-focus-within:`, чтобы показывать
//: действия строки по наведению. Снимете как мёртвый класс — у потребителя
//: молча сломается: кнопки просто станут видны всегда. Закреплено тестом
//: «строка остаётся корнем Tailwind-группы».
const ROW_CLASS =
  "group hover:bg-bg-2 flex items-center gap-1.5 rounded-lg px-1 py-1.5 text-[13px] " +
  "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "dragging:opacity-50";

//: Разделитель — рамка снизу у всех строк, кроме последней. Скругление
//: снимается: под скруглённой строкой линия загнулась бы по углам.
const DIVIDED_ROW_CLASS = "border-line-soft rounded-none border-b last:border-b-0";

/**
 * Строка, пропавшая из `items` и доживающая свой уход.
 *
 * Хранится СНИМОК элемента, а не ссылка на него в `items`: элемента там уже
 * нет, и взять подпись, иконку и слоты будет неоткуда — а рисовать уходящую
 * строку пустой значит показать не уход, а мигание.
 */
interface LeavingRow {
  item: EditableListItem;
  /** Место, на котором строка стояла: на нём она и доживает. */
  index: number;
  /**
   * Высота в момент пропажи — от неё идёт смыкание.
   *
   * Замеряется, потому что `height` не интерполируется от `auto`, а высота
   * строки зависит от содержимого потребителя: у списка с флажком она одна, у
   * списка с аватаром другая, и знать её заранее компонент не может.
   */
  height: number;
}

/**
 * Список вместе с призраками, каждый на своём прежнем месте.
 *
 * Места считаются по индексам ПРОПАЖИ, а не по соседям: соседей могло не
 * остаться вовсе — массовое действие снимает десяток строк разом.
 */
function withLeaving(items: EditableListItem[], leaving: LeavingRow[]): EditableListItem[] {
  const merged = [...items];
  for (const row of [...leaving].sort((a, b) => a.index - b.index))
    merged.splice(Math.min(row.index, merged.length), 0, row.item);
  return merged;
}

/**
 * Список, строки которого правят по месту, пополняют снизу и переставляют
 * перетаскиванием.
 *
 * ПОЧЕМУ ЭТО НЕ `SortableList` С ПОЛЕМ ВНУТРИ — разбор в
 * ADR-0045.
 * Коротко: строка добавления не является элементом коллекции `GridList`, и у
 * перехода фокуса в неё и обратно не остаётся владельца, если собирать это
 * композицией. Клавиши внутри строки — тоже контракт, а не вёрстка.
 *
 * ЧТО ВЫБИРАТЬ. Нужен только порядок — `SortableList`: он проще и его строка не
 * умеет ничего лишнего. Нужно дерево — `TreeView`. Порядок вычисляется из
 * значения колонки, а не назначается человеком, — `Table` и `DataTable`.
 *
 * СОСТОЯНИЕ НЕ ХРАНИТСЯ. Порядок и значения приходят пропами и уходят наружу
 * целиком (ADR-0023); внутри живут только два черновика — правки и добавления.
 * Компонент, хранящий подтверждённое, показывал бы своё после отказа сервера
 * сохранить.
 *
 * КЛАВИАТУРА:
 *
 * - `↑`/`↓` ходят по строкам, `→` уводит фокус на ручку, `Enter` на ручке
 *   начинает перенос — всё это даёт `GridList` (ADR-0028);
 * - `Enter` на строке открывает правку, двойной щелчок — то же мышью;
 * - в поле правки `Enter` подтверждает, `Escape` возвращает прежнее значение,
 *   и оба возвращают фокус на строку; щелчок мимо подтверждает и фокус не
 *   забирает — контракт `InlineEdit` перенесён дословно;
 * - `↓` с последней строки приводит в строку добавления, `↑` из неё —
 *   обратно на последнюю строку;
 * - в строке добавления `Enter` подтверждает и ОСТАВЛЯЕТ поле открытым: серия
 *   задач вводится подряд. Пустое подтверждение не создаёт ничего.
 *
 * ПОКА СТРОКА В ПРАВКЕ, ТАЩИТЬ ЕЁ НЕЛЬЗЯ: ручка выключена, а стрелки
 * принадлежат каретке. Без второго `↑`/`↓` из открытого поля уезжали бы по
 * списку — ради этого перехвата компонент и заводился, поэтому он проверяется
 * отдельным браузерным тестом.
 *
 * ДОМЕННЫХ СОСТОЯНИЙ КОМПОНЕНТ НЕ ЗНАЕТ. Зачёркивание выполненного,
 * приглушение отложенного, бейдж статуса рисует потребитель в `leading` и
 * `trailing`.
 */
export const EditableList = forwardRef<EditableListHandle, EditableListProps>(function EditableList(
  {
    items,
    onReorder,
    onValueChange,
    editLabel,
    "aria-label": ariaLabel,
    add,
    leading,
    trailing,
    onRowAction,
    divided = false,
    emptyText,
    className,
  }: EditableListProps,
  ref
) {
  const messages = useMessages();

  const [editingId, setEditingId] = useState<Key | null>(null);
  const [leaving, setLeaving] = useState<LeavingRow[]>([]);

  const fieldRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Escape снимает режим сам, и вслед за ним не должно сработать подтверждение
  // по потере фокуса.
  const cancelling = useRef(false);
  // Возврат фокуса нужен НЕ всегда: после щелчка мимо забирать его обратно
  // значит уводить оттуда, куда пользователь только что ушёл.
  const returnTo = useRef<Key | null>(null);
  /*
    ЧЕРНОВИКИ ЖИВУТ В САМИХ ПОЛЯХ, А НЕ В СОСТОЯНИИ — и это не экономия на
    ре-рендерах, а единственный способ, которым правка вообще работает.

    `GridList` перемонтирует содержимое строки на каждый рендер компонента.
    Черновик в состоянии означал бы рендер на каждое нажатие, а значит — новый
    узел поля, повторный вызов callback-ref и возврат исходного значения:
    набранное стиралось прямо во время набора. Проверено в живом браузере, и
    видно это было только там — в jsdom коллекция ведёт себя иначе.

    Отсюда правило: пока печатают, состояние здесь не меняется. Компонент
    перерисовывается ровно на переходе режима правки.
  */
  const openSeed = useRef("");

  /*
    Наружу отдаётся ОДНА ручка, а не сам элемент ввода.

    Отдай компонент `HTMLInputElement` — и его разметка станет публичным
    контрактом: потребитель начнёт читать `value`, вешать обработчики и
    полагаться на то, что поле именно `input`, а не, скажем, пара из поля и
    подложки. Узкий хэндл говорит ровно то, что нужно вызывающему: «поставь
    курсор туда, куда человек собирается печатать».

    Фокус ставится без `preventScroll`: если строка добавления за пределами
    видимой области, браузер сам приведёт её на экран — ради этого умолчание и
    существует, переопределять его нечем.
  */
  useImperativeHandle(
    ref,
    () => ({
      focusAdd: (options) => {
        const node = addRef.current;
        if (node == null) return;
        node.focus();
        if (options?.select) node.select();
      },
    }),
    []
  );

  const editing = items.find((item) => item.id === editingId) ?? null;
  const last = items.length > 0 ? items[items.length - 1] : null;

  /*
    Строка ищется в DOM по `data-key`, а не по карте рефов.

    `GridListItem` проп `ref` до своего элемента не доносит — проверено в живом
    браузере: карта оставалась пустой, и `Enter` на строке молча ничего не
    открывал. Атрибут же react-aria ставит сама, и он и так нужен обработчику
    клавиш, чтобы понять, на какой строке стоит фокус.
  */
  const rowNode = (id: Key) =>
    listRef.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(String(id))}"]`) ?? null;

  const focusRow = (id: Key) => rowNode(id)?.focus();

  /*
    СТРОКА, ПРОПАВШАЯ ИЗ `items`, ДОЖИВАЕТ СВОЙ УХОД.

    Довод тот же, по которому оверлеи получили уход в 3.23: исчезновение в кадр
    читается как сбой. У строки списка цена выше — она исчезает не одна:
    соседние смыкаются мгновенно, и вместе с ними подпрыгивает всё, что ниже.
    Человек отметил задачу выполненной, а список под курсором переложился
    рывком, и следующая строка оказалась под указателем раньше, чем он понял,
    какая ушла.

    ПРИДЕРЖАТЬ СТРОКУ МОЖЕТ ТОЛЬКО КОМПОНЕНТ. Разметка строк — его: наружу не
    выдаётся ни узел, ни `ref`, ни класс. Потребителю остаётся единственный
    способ — соврать, что запись ещё в списке; тогда на время ухода она
    остаётся настоящей строкой: её найдёт перетаскивание, по ней пойдёт фокус,
    её объявит скринридер, и `onReorder` вернёт её ключ в новом порядке.

    СРАВНЕНИЕ ИДЁТ В РЕНДЕРЕ, А НЕ В ЭФФЕКТЕ. Эффект стреляет после коммита, а
    к тому моменту строки в DOM уже нет: она пропала бы на кадр и вернулась
    призраком — то самое мигание, ради устранения которого всё и делается.
    Здесь же прежний DOM ещё на месте, и его можно и замерить, и спросить про
    фокус.
  */
  const shownItems = useRef(items);
  const focusFrom = useRef<number | null>(null);

  if (shownItems.current !== items) {
    const previous = shownItems.current;
    shownItems.current = items;
    const present = new Set(items.map((item) => String(item.id)));
    const gone: LeavingRow[] = [];
    /*
      Место берётся из DOM, а не из индекса в прежнем `items`.

      Прежний массив призраков не знает: строка, ушедшая секунду назад, в нём
      уже не числится, и индексы следующих сдвинуты на неё. Две пропажи подряд
      в разных местах от этого менялись местами на экране. На экране же порядок
      настоящий — его и спрашиваем.
    */
    const shown = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-key]") ?? [])];
    previous.forEach((item, fallbackIndex) => {
      if (present.has(String(item.id))) return;
      const node = rowNode(item.id);
      const index = node != null ? shown.indexOf(node) : fallbackIndex;
      /*
        Фокус спрашивается ДО коммита. После него строка уже `inert`, браузер
        снимает с неё фокус сам, и узнать, стоял ли он здесь, будет негде:
        `document.activeElement` к этому времени — `body`.

        Место берётся ЗДЕСЬ из прежнего `items`, а не с экрана: по нему потом
        ищется сосед в новом `items`, и экранный индекс, считающий призраков,
        указал бы мимо — через строку от ушедшей.
      */
      if (node != null && node.contains(document.activeElement))
        focusFrom.current = Math.min(focusFrom.current ?? fallbackIndex, fallbackIndex);
      gone.push({
        item,
        index: index < 0 ? fallbackIndex : index,
        height: node?.offsetHeight ?? 0,
      });
    });
    /*
      Вернувшийся ключ снимает своего призрака немедленно: двух строк с одним
      `id` в коллекции быть не может, а «удалил и сразу вернул» — обычный
      случай отмены у потребителя.
    */
    const kept = leaving.filter((row) => !present.has(String(row.item.id)));
    if (gone.length > 0 || kept.length !== leaving.length) setLeaving([...kept, ...gone]);
  }

  const rows = leaving.length === 0 ? items : withLeaving(items, leaving);

  /*
    ФОКУС УХОДИТ ВПЕРЁД, а не остаётся на призраке: с `inert` он провалится в
    `body`, и клавиатурная работа со списком оборвётся на каждом выполнении.

    Вперёд — это на строку, занявшую место ушедшей: фокус остаётся там же, где
    был. Её нет (ушла последняя) — предыдущая; списка не осталось вовсе —
    строка добавления.

    Без списка зависимостей: эффект стреляет на коммите, где строка пропала, а
    сторожит его ref, а не сравнение пропсов.
  */
  useLayoutEffect(() => {
    const from = focusFrom.current;
    if (from == null) return;
    focusFrom.current = null;
    const next = items[from] ?? items[items.length - 1];
    if (next != null) focusRow(next.id);
    else addRef.current?.focus();
  });

  const dropLeaving = (key: string) =>
    setLeaving((current) => current.filter((row) => String(row.item.id) !== key));

  /*
    ПРИЗРАК СНИМАЕТСЯ ПО КОНЦУ СВОЕЙ АНИМАЦИИ, а не по таймеру на ту же ступень:
    таймер пришлось бы держать в согласии со шкалой числом, то есть завести
    вторую запись длительности вне `styles.css`.

    Слушатель висит на обёртке, а не на строке: `animationend` всплывает, а
    `GridListItem` своих обработчиков анимации наружу не отдаёт. И он НАСТОЯЩИЙ,
    а не синтетический: React-обработчик `onAnimationEnd` на это событие в jsdom
    не срабатывает вовсе (проверено), то есть единственный способ проверить уход
    вне браузера пропал бы вместе с ним.

    Второй путь — для случая «анимации нет вовсе»: её нет в jsdom и у браузера,
    которому движение отключили настолько, что правило не применилось. Без него
    строка осталась бы на экране навсегда.

    КАДР ЗДЕСЬ ОБЯЗАТЕЛЕН. `GridList` монтирует строки отдельным проходом, позже
    нашего коммита: на момент эффекта узла призрака ещё нет, и пустой ответ
    `getAnimations` означал бы «не анимируется» для каждой уходящей строки.
    Проверено в живом браузере: без кадра уход не начинался вовсе — строка
    пропадала в тот же кадр, как и до правки.
  */
  useLayoutEffect(() => {
    if (leaving.length === 0) return;
    const node = listRef.current;
    const ids = new Set(leaving.map((row) => String(row.item.id)));

    const onAnimationEnd = (event: AnimationEvent) => {
      // Своя анимация строки, а не чужая: у потребителя в слотах бывает
      // собственная, и она всплывает сюда же.
      const key = (event.target as HTMLElement | null)?.getAttribute?.("data-key");
      if (key != null && ids.has(key)) dropLeaving(key);
    };
    node?.addEventListener("animationend", onAnimationEnd);
    // `animationcancel` — не перестраховка: анимацию прерывает любая правка
    // разметки строки у потребителя, а прерванная не досылает `animationend`,
    // и призрак остался бы на экране навсегда.
    node?.addEventListener("animationcancel", onAnimationEnd);

    const dropWhatDoesNotAnimate = () => {
      for (const key of ids)
        if ((rowNode(key)?.getAnimations?.().length ?? 0) === 0) dropLeaving(key);
    };
    const frame =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame(dropWhatDoesNotAnimate)
        : (dropWhatDoesNotAnimate(), null);

    return () => {
      node?.removeEventListener("animationend", onAnimationEnd);
      node?.removeEventListener("animationcancel", onAnimationEnd);
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, [leaving]);

  /*
    ФОКУС СТАВИТСЯ В CALLBACK-REF, А НЕ В ЭФФЕКТЕ — и это тоже находка живого
    браузера, а не вкусовщина.

    `GridList` монтирует содержимое строки отдельным проходом, позже собственного
    коммита: к моменту `useLayoutEffect` реф поля ещё пуст, и фокус уходил в
    никуда — поле открывалось, а печатать в него было нельзя. Callback-ref
    срабатывает ровно тогда, когда узел появился.

    Ссылка стабильна внутри одной правки (`useCallback` по `editingId`), иначе
    React отцеплял бы и прицеплял реф на каждый ввод символа и `select()`
    сбрасывал бы набранное.
  */
  const attachField = useCallback(
    (node: HTMLInputElement | null) => {
      fieldRef.current = node;
      if (node == null) return;
      cancelling.current = false;
      // Значение кладётся в DOM СИНХРОННО, до `select()`: `setDraft` — запрос на
      // рендер, а не запись, и к моменту выделения в поле стоял бы прежний текст.
      node.value = openSeed.current;
      node.focus();
      node.select();
    },
    [editingId]
  );

  useLayoutEffect(() => {
    if (editing != null) return;
    if (returnTo.current == null) return;
    const id = returnTo.current;
    returnTo.current = null;
    focusRow(id);
    // Зависимость ТОЛЬКО `editingId`: правка значения снаружи при открытом поле
    // не должна затирать набранное. Эффект стреляет на переходе режима, а не на
    // смене значения — то же решение, что в `InlineEdit`.
  }, [editingId]);

  const startEdit = (item: EditableListItem) => {
    if (item.disabled) return;
    openSeed.current = item.value;
    setEditingId(item.id);
  };

  const commit = (withFocus: boolean) => {
    if (!editing) return;
    const { id, value } = editing;
    // Набранное читается из DOM: своей копии у компонента нет.
    const next = fieldRef.current?.value ?? value;
    returnTo.current = withFocus ? id : null;
    setEditingId(null);
    if (next !== value) onValueChange(id, next);
  };

  const cancel = () => {
    if (!editing) return;
    cancelling.current = true;
    returnTo.current = editing.id;
    setEditingId(null);
  };

  /*
    ВСЕ КЛАВИШИ СПИСКА РАЗБИРАЮТСЯ ЗДЕСЬ, В ОДНОМ МЕСТЕ И В ФАЗЕ ПОГРУЖЕНИЯ.

    Так вышло не от любви к единому обработчику, а по замеру в живом браузере:
    `GridList` слушает клавиши САМ и делает это на погружении, то есть раньше
    любого обработчика на поле внутри строки. Обработчик, висевший на поле,
    отрабатывал уже после того, как список успевал увести фокус: `↓` из
    открытого поля прыгала на следующую строку вместо движения каретки. Ровно
    этот дефект компонент и обязан не допускать.

    Обёртка — предок списка, поэтому её погружение идёт первым: событие,
    остановленное тут, до react-aria не доходит вовсе.
  */
  const handleListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    // Поле опознаётся по атрибуту, а не по совпадению с рефом: `GridList`
    // перемонтирует содержимое строки, и сравнение по ссылке нет-нет да и
    // промахивалось — Escape уходил в список, тот уводил фокус, и правка
    // подтверждалась по потере фокуса вместо отмены.
    const field = target.getAttribute("data-field");

    if (field === "edit") {
      // Гасится ВСЁ, а не только Enter и Escape: стрелки, пробел и буквы
      // принадлежат каретке, а список забрал бы их себе под навигацию и набор
      // по первым буквам.
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        commit(true);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
      return;
    }

    if (field === "add") {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        const value = (addRef.current?.value ?? "").trim();
        // Пустое подтверждение — не создание пустой строки, а отсутствие ввода.
        if (value === "") return;
        // Поле чистится и ОСТАЁТСЯ открытым и в фокусе: в этом вся разница с
        // `InlineEdit`, который по Enter закрывается.
        if (addRef.current != null) addRef.current.value = "";
        add?.onAdd(value);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        // Первый Escape чистит черновик, второй уводит фокус: иначе из поля,
        // которое всегда на экране, некуда выйти с клавиатуры.
        if ((addRef.current?.value ?? "") !== "") {
          if (addRef.current != null) addRef.current.value = "";
          return;
        }
        if (last != null) focusRow(last.id);
        return;
      }
      if (event.key === "ArrowUp" && last != null) {
        // Однострочному полю вертикальные стрелки не нужны, а список наверху.
        event.preventDefault();
        focusRow(last.id);
      }
      return;
    }

    /*
      КЛАВИШИ НИЖЕ ПРИНАДЛЕЖАТ СТРОКЕ, А НЕ ТОМУ, ЧТО В НЕЙ ЛЕЖИТ.

      Раньше цель искалась через `closest("[data-key]")`, то есть срабатывала
      на любом потомке строки. Первой под это попадала собственная ручка
      переноса: `Enter` на ней гасился здесь и открывал правку, а до
      react-aria не доходил — перенос с клавиатуры не начинался никогда, хотя
      справочник его обещает. Следом попадало всё, что потребитель кладёт в
      `leading` и `trailing`: флажок и кнопки действий строки по `Enter`
      открывали правку вместо своего действия.

      Строка в фокусе — это она сама: `GridList` вешает `data-key` на элемент
      строки, и `event.target` при этом равен ему. Поэтому условие строгое.
    */
    const key = target.getAttribute("data-key");
    if (key == null) return;

    if (event.key === "Enter") {
      const item = items.find((candidate) => String(candidate.id) === key);
      if (item == null) return;
      event.preventDefault();
      event.stopPropagation();
      startEdit(item);
      return;
    }
    if (event.key === "ArrowDown" && add != null && last != null && key === String(last.id)) {
      event.preventDefault();
      event.stopPropagation();
      addRef.current?.focus();
    }
  };

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((key) => ({ "text/plain": String(key) })),
    /*
      ТОЛЬКО `move`, и это не украшение курсора.

      По умолчанию разрешены и перемещение, и копирование, а операционная
      система рисует для копирования «плюс» — пользователь видит его посреди
      перестановки и ждёт, что строка удвоится. Скопировать строку список не
      умеет и уметь не должен: он меняет порядок, а не состав.

      В WEBKIT ЗНАЧОК ВСЁ РАВНО МЕЛЬКАЕТ, и починить это отсюда нельзя.
      Настройка применяется: `effectAllowed` записывается и читается обратно
      как `move` в обоих движках, react-aria вдобавок пишет `dropEffect: move`
      на каждом `dragover`. Но WebKit теряет её на уровне сессии
      перетаскивания и отдаёт приёмнику `all` (bugs.webkit.org/show_bug.cgi
      ?id=178058), а `all` включает копирование — система и рисует «плюс»,
      пока её не переубедят. Сама перестановка при этом верна: react-aria
      держит настоящий набор операций в своей переменной и пересекает с тем,
      что пришло, — строк после броска столько же, сколько было. Замер обоих
      движков — в справочнике компонента.
    */
    getAllowedDropOperations: () => ["move"],
    onReorder(event) {
      const next = reorder(items, event.keys, event.target);
      if (next != null) onReorder(next.map((item) => item.id));
    },
    renderDropIndicator: (target) => (
      <DropIndicator
        target={target}
        className="drop-target:bg-accent-strong h-0.5 rounded-full bg-transparent"
      />
    ),
  });

  return (
    /*
      Перехват клавиш висит на ОБЁРТКЕ, а не на `GridList`: своих DOM-пропов
      событий он не принимает. Обёртка и без того нужна под строку добавления,
      а погружение до самого списка всё равно проходит через неё.
    */
    <div
      ref={listRef}
      className={cn("flex flex-col", divided ? "gap-0" : "gap-0.5", className)}
      onKeyDownCapture={handleListKeyDown}
    >
      <GridList
        aria-label={ariaLabel}
        // Призраки идут в коллекцию наравне со строками: место в ряду у них
        // настоящее, иначе уход шёл бы не там, где строка стояла.
        items={rows}
        /*
          БЕЗ ЭТОГО ПРАВКА НЕ ОТКРЫВАЕТСЯ ВОВСЕ — проверено в живом браузере.

          `GridList` строит коллекцию один раз и кеширует строки по элементам:
          смена внешнего состояния строки не перерисовывает. `editingId` в
          элементе не живёт (и жить не должен: он про режим, а не про данные),
          поэтому он объявляется зависимостью явно. Обработчик клавиш при этом
          отрабатывал исправно — дефект был бы тихим.
        */
        dependencies={[editingId, leaving]}
        dragAndDropHooks={dragAndDropHooks}
        renderEmptyState={emptyText != null ? () => emptyText : undefined}
        className={cn("flex flex-col", divided ? "gap-0" : "gap-0.5")}
      >
        {(item) => {
          const leavingRow = leaving.find((row) => row.item.id === item.id);
          const isLeaving = leavingRow != null;
          // Призрак не правится: поле в уходящей строке успело бы забрать
          // фокус и осталось бы открытым над пустым местом.
          const isEditing = !isLeaving && item.id === editingId;
          return (
            <GridListItem
              id={item.id}
              /*
                УХОДЯЩАЯ СТРОКА НЕЖИВАЯ НЕМЕДЛЕННО, а не в конце анимации.

                `inert` разом закрывает всё, что иначе пришлось бы закрывать
                по отдельности: строка не фокусируется, не отвечает на щелчок
                и не попадает в дерево доступности — для незрячего запись
                исчезла в момент действия, и держать её лишние 150 мс незачем.
                `isDisabled` добавлен рядом не для красоты: `inert` не знает
                про коллекцию react-aria, и без него стрелки продолжали бы
                считать призрака остановкой на пути.
              */
              inert={isLeaving}
              isDisabled={isLeaving}
              /*
                Высота уезжает переменной, а не классом: она разная у каждой
                строки, а классы Tailwind собираются на сборке (см. запрет на
                `` `h-[${n}px]` `` в `lib/variants.ts`).
              */
              style={
                isLeaving
                  ? ({ "--row-exit-h": `${leavingRow.height}px` } as CSSProperties)
                  : undefined
              }
              /*
                У пустого значения имя берётся из подписи-заглушки, а не
                остаётся пустым: react-aria на безымянную строку отвечает
                предупреждением в консоль, и список с такой строкой выглядит
                рабочим, а набором по первым буквам до неё не добраться.
              */
              textValue={
                item.textValue ??
                (item.value === "" ? messages.editableList.emptyValue : item.value)
              }
              onAction={onRowAction != null ? () => onRowAction(item.id) : undefined}
              /*
                В правке строка отдаёт свои вертикальные отступы полю: поле
                несёт собственную рамку и отступ, и сложенные вместе они давали
                44 пикселя против 32 у соседей — строка подпрыгивала, а вместе с
                ней уезжал вниз весь список.
              */
              className={cn(
                ROW_CLASS,
                divided && DIVIDED_ROW_CLASS,
                isEditing && "py-0",
                // `overflow-hidden` — часть смыкания: без него содержимое
                // строки торчало бы из схлопывающейся высоты.
                isLeaving && "animate-rowout overflow-hidden"
              )}
            >
              {/*
                Ручка — часть контракта, а не опция: без `<Button slot="drag">`
                строка таскается мышью, с клавиатуры не берётся вовсе, и
                react-aria лишь пишет предупреждение в консоль (ADR-0028).

                КУРСОР И ЩЕЛЧОК ЖИВУТ НА ОБЁРТКЕ, А НЕ НА САМОЙ РУЧКЕ.

                react-aria принудительно ставит кнопке переноса
                `pointer-events: none` — она нужна ему как цель для клавиатуры
                и скринридера, а не как цель указателя. Следствие, которое
                легко не заметить: `cursor-grab` на ней не применялся НИКОГДА.
                Замер: `getComputedStyle` у кнопки честно отдаёт `grab`, а
                `elementFromPoint` в центре шести точек возвращает саму строку
                с `cursor: auto`. То есть единственный видимый признак «здесь
                берут и тащат» отсутствовал, хотя в исходнике выглядел
                написанным.

                Обёртка же указатель ловит, поэтому курсор стоит на ней.

                Она же гасит щелчок: сквозь выключенную для указателя кнопку
                он попадал в строку и звал её действие — то есть щелчок по
                ручке делал то же, что щелчок по строке. Гасится pointerdown,
                а не click: действие строки react-aria вызывает из `usePress`
                по pointerup, до click. Перенос от этого не страдает — его
                ведёт нативный `draggable` на строке, а он о всплытии
                синтетических событий React ничего не знает.
              */}
              <span
                className={cn(
                  "flex shrink-0",
                  !(item.disabled || isEditing || isLeaving) && "cursor-grab"
                )}
                onPointerDownCapture={(event) => event.stopPropagation()}
              >
                <Button
                  slot="drag"
                  aria-label={messages.editableList.drag}
                  isDisabled={item.disabled || isEditing || isLeaving}
                  className={
                    "text-fg-3 hover:text-fg-1 focus-visible:outline-accent-strong flex size-5 shrink-0 " +
                    "items-center justify-center rounded-xs focus-visible:outline-2 " +
                    "disabled:opacity-30"
                  }
                >
                  <DragHandleIcon size={12} />
                </Button>
              </span>

              {leading?.(item)}

              {isEditing ? (
                <TextControl
                  ref={attachField}
                  data-field="edit"
                  className={FIELD_COMPACT_CLASS}
                  aria-label={editLabel(item)}
                  defaultValue={editing?.value ?? item.value}
                  onBlur={() => {
                    if (cancelling.current) {
                      cancelling.current = false;
                      return;
                    }
                    commit(false);
                  }}
                  shellClassName="w-full"
                />
              ) : (
                <span
                  onDoubleClick={() => startEdit(item)}
                  className={cn("min-w-0 flex-1 truncate", item.value === "" && "text-fg-3")}
                >
                  {item.value === "" ? messages.editableList.emptyValue : item.value}
                </span>
              )}

              {trailing?.(item)}
            </GridListItem>
          );
        }}
      </GridList>

      {add != null ? (
        <div className="flex items-center gap-1.5 px-1">
          {/*
            Строка добавления НЕ элемент коллекции: у неё нет ни ключа, ни
            места в порядке, и перетаскивать её нечем. Место ручки при этом
            занято пустым слотом — иначе поле разъезжается с названиями строк.
          */}
          <span aria-hidden className="size-5 shrink-0" />
          {/*
            Вторая ведущая колонка. Ширину `leading` задаёт потребитель, и
            вычислить её компонент не может: замерять чужую разметку значило
            бы читать раскладку в каждом рендере и всё равно промахиваться на
            первом кадре. Поэтому колонку сообщает тот, кто её и создал.
          */}
          {add.leading}
          <TextControl
            ref={addRef}
            data-field="add"
            className={FIELD_COMPACT_CLASS}
            aria-label={add.label}
            placeholder={add.placeholder}
            aria-busy={add.pending}
            shellClassName="w-full"
          />
        </div>
      ) : null}
    </div>
  );
});
