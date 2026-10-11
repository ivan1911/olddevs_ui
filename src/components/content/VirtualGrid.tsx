"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from "react";
import {
  Collection,
  GridLayout,
  GridList,
  GridListItem,
  GridListLoadMoreItem,
  Rect,
  Size,
  Virtualizer,
  type Key,
  type LayoutInfo,
  type Selection,
} from "react-aria-components";
import { cn } from "../../lib/cn.js";
import { devWarn } from "../../lib/dev-warn.js";
import { toPixels } from "../../hooks/useStickyOffset.js";
import { Spinner } from "../actions/Spinner.js";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "../overlays/ContextMenu.js";
import { useDragToSelect } from "./useDragToSelect.js";

export interface VirtualGridItem {
  /** Идентификатор ячейки: ключ выбора. */
  id: Key;
  /**
   * Содержимое ячейки — любой узел, обычно `MediaCard`. Кнопки внутри законны:
   * ячейка — `gridcell`. Кружок выбора — `<Checkbox slot="selection" />`, его
   * сетка связывает со своим выбором сама.
   */
  content: ReactNode;
  /**
   * Строковое представление ячейки: по нему работает поиск набором с
   * клавиатуры. Обязателен, потому что содержимое — вёрстка, а не текст.
   */
  textValue: string;
  /**
   * Пункты контекстного меню ячейки: `ContextMenuItem`, `ContextMenuSeparator`,
   * `ContextMenuSub` и прочее из семейства `ContextMenu`. Панель, триггер и
   * изоляцию от выбора сетка ставит сама. Без поля у ячейки меню нет.
   *
   * Открывается правой кнопкой, долгим нажатием и с клавиатуры — Shift+F10 или
   * клавишей контекстного меню на сфокусированной ячейке.
   */
  contextMenu?: ReactNode;
}

/** Что сетка сообщает о ячейке, которую открыли. */
export interface VirtualGridActionDetails {
  /**
   * Прямоугольник ячейки в координатах окна в момент действия — для анимации
   * открытия «из места» (карточка вырастает из превью).
   */
  rect: DOMRect;
}

export interface VirtualGridProps {
  /** Ячейки сетки. */
  items: VirtualGridItem[];
  /** Доступное имя сетки. Безымянную сетку скринридер называет только по роли. */
  "aria-label": string;
  /**
   * Наименьший размер ячейки в пикселях. Число колонок из него и считается.
   *
   * Числами, а не классом `Size` из react-aria: класс библиотеки в публичном
   * API кита обязал бы потребителя импортировать его ради двух чисел.
   */
  minItemWidth?: number;
  /**
   * Наименьшая высота ячейки в пикселях. По умолчанию 180. Ячейка с более
   * высоким содержимым вырастает, ниже — не бывает.
   */
  minItemHeight?: number;
  /** Зазор между ячейками, пиксели. */
  gap?: number;
  /**
   * Отступ по краям сетки, равный `gap`. По умолчанию есть; `false` ставит
   * крайние ячейки вплотную к краям — сетка «1fr без полей».
   */
  edgeGap?: boolean;
  /** Предел числа колонок. Без него колонок столько, сколько влезает. */
  maxColumns?: number;
  /** Что показать при пустой сетке. */
  emptyText?: ReactNode;
  /**
   * Что прокручивается: свой контейнер (`container`, по умолчанию) или окно.
   *
   * `container` — высоту задаёт потребитель (`h-[600px]`, `flex-1` в колонке):
   * без неё контейнер вырастет по содержимому и прокрутки не будет.
   * `window` — сетка растёт по содержимому, прокручивается страница, а в DOM
   * по-прежнему только ячейки у окна.
   */
  scroll?: "container" | "window";
  /**
   * CSS-переменная с высотой липкой шапки — та же, что у `SelectionBar` и
   * `useStickyOffset`. В режиме `window` ячейка, к которой ушёл фокус, не
   * прячется под шапку. По умолчанию `--topbar-h`: её публикует `TopBar`.
   */
  offsetVar?: string;
  /**
   * Ось выбора. Включается явно и живёт у самой сетки, а не внутри ячейки.
   *
   * Кружок выбора внутри ячейки — `<Checkbox slot="selection" />`: он часть
   * той же оси, а не своё состояние карточки.
   */
  selectionMode?: "none" | "single" | "multiple";
  /**
   * Как клик обращается с выбором — правило react-aria.
   *
   * `toggle` (по умолчанию): клик добавляет или снимает ячейку, а при
   * `onAction` клик открывает, выбирает Space. `replace`: как в файловом
   * менеджере — клик выделяет одну ячейку, Ctrl/Cmd добавляет, а открывают
   * двойной клик и Enter.
   */
  selectionBehavior?: "toggle" | "replace";
  /**
   * Что делает диапазон по Shift (клик, стрелки). `replace` — правило
   * react-aria: набор заменяется диапазоном от якоря, и выбранное вне его
   * снимается. `add` — диапазон добавляется к прежнему выбору и ничего не
   * снимает.
   */
  rangeSelection?: "replace" | "add";
  /**
   * Выделение протяжкой пальца: удержать ячейку и вести по соседним — они
   * добавляются диапазоном, у края окна сетка прокручивается сама. Только
   * касание и только при `selectionMode="multiple"`.
   *
   * Жест не единственный путь к тому же: кружок выбора и Shift со стрелками
   * дают его с мыши и клавиатуры.
   */
  dragToSelect?: boolean;
  /** Выбранные ключи. Состояние держит потребитель — кит даёт форму (ADR-0023). */
  selectedKeys?: Selection;
  /** Вызывается с новым набором выбранных ячеек. */
  onSelectionChange?: (keys: Selection) => void;
  /**
   * Действие над ячейкой: клик, Enter, касание. Приходит `id` ячейки и её
   * прямоугольник.
   *
   * Это «открыть», а не «выбрать»: ячейка не выделяется, `onSelectionChange`
   * молчит. Вместе с `selectionMode` оба срабатывают по правилам react-aria —
   * см. страницу компонента.
   */
  onAction?: (id: Key, details: VirtualGridActionDetails) => void;
  /**
   * Подгрузка следующей страницы: вызывается, когда до конца загруженного
   * остаётся меньше высоты окна. Без пропа сетка ничего не подгружает.
   */
  onLoadMore?: () => void;
  /** Идёт подгрузка: под последней строкой стоит индикатор. */
  isLoadingMore?: boolean;
  /** Свой индикатор подгрузки вместо крутилки кита — например, ряд скелетонов. */
  loadingMore?: ReactNode;
  /**
   * Классы контейнера. В режиме `container` высоту задаёт потребитель — см.
   * раздел о прокрутке.
   */
  className?: string;
}

/**
 * `GridLayout` без внешнего отступа: крайние ячейки вплотную к краям.
 *
 * Раскладка react-aria ставит зазор и снаружи — слева, справа и сверху, — и
 * опции, которая его снимает, нет. Её поля (`layoutInfos`, `margin`) закрыты,
 * поэтому подкласс не пересчитывает раскладку заново, а переводит готовые
 * прямоугольники в публичных методах: колонка остаётся колонкой, а ширина
 * ячейки растёт на долю двух снятых краевых зазоров.
 */
class EdgeToEdgeGridLayout<T = unknown> extends GridLayout<T> {
  /**
   * Заказанный зазор (`minSpace`), а не тот, что раскладка react-aria
   * поставила сама. Она вычитает из ширины зазоры по числу колонок, а ставит
   * на один больше и округляет вниз — её зазор выходит меньше заказанного
   * (замер Библиотеки: 16 вместо 18). «Вплотную» внешних зазоров нет, и
   * заказанный помещается всегда.
   */
  private requestedGap: number | null = null;

  /**
   * Число колонок «вплотную». react-aria считает их как
   * `floor(ширина / (min + зазор))` — с местом под внешний зазор, которого
   * здесь нет, и теряет колонку: на телефоне (343 px, min 160, зазор 18)
   * выходила одна колонка вместо двух, как у CSS-грида `minmax(160px, 1fr)`.
   * Здесь колонок `floor((ширина + зазор) / (min + зазор))`, а раскладке
   * react-aria подставляется такая наименьшая ширина, при которой её счёт даёт
   * то же число. Ячейку всё равно ставит `flush` — шире, на долю снятых
   * краевых зазоров.
   */
  override update(invalidationContext: Parameters<GridLayout<T>["update"]>[0]) {
    const options = invalidationContext.layoutOptions;
    const gap = options?.minSpace?.width ?? null;
    const minItem = options?.minItemSize;
    const width = this.virtualizer?.size.width ?? 0;
    this.requestedGap = gap;
    if (!options || !minItem || gap == null || width <= 0) {
      super.update(invalidationContext);
      return;
    }
    const fit = Math.floor((width + gap) / (minItem.width + gap));
    const columns = Math.max(1, Math.min(options.maxColumns ?? Infinity, fit));
    const sourceMin = Math.max(1, Math.floor(width / columns) - gap);
    super.update({
      ...invalidationContext,
      layoutOptions: { ...options, minItemSize: new Size(sourceMin, minItem.height) },
    });
  }

  /** Ширина ячейки и шаг колонок в исходной раскладке и в «вплотную». */
  private columns() {
    const width = this.virtualizer?.size.width ?? 0;
    const columns = Math.max(1, this.numColumns);
    // Шаг исходной раскладки — по её собственному зазору: по нему ячейка
    // узнаёт свою колонку. Ставится ячейка уже с заказанным.
    const sourceGap = this.gap.width;
    const gap = this.requestedGap ?? sourceGap;
    const first = this.firstItemRect();
    const itemWidth = Math.max(0, Math.floor((width - (columns - 1) * gap) / columns));
    return { width, gap, sourceGap, first, itemWidth };
  }

  private firstItemRect(): Rect | null {
    const key = this.virtualizer?.collection.getFirstKey();
    return key == null ? null : (super.getLayoutInfo(key)?.rect ?? null);
  }

  private flush(info: LayoutInfo | null): LayoutInfo | null {
    if (!info) return info;
    const { width, gap, sourceGap, first, itemWidth } = this.columns();
    const copy = info.copy();
    const y = info.rect.y - this.gap.height;
    if (info.type === "loader") {
      copy.rect = new Rect(0, y, width, info.rect.height);
      return copy;
    }
    const step = first ? first.width + sourceGap : 1;
    const column = first ? Math.round((info.rect.x - first.x) / step) : 0;
    copy.rect = new Rect(column * (itemWidth + gap), y, itemWidth, info.rect.height);
    return copy;
  }

  override getLayoutInfo(key: Key): LayoutInfo | null {
    return this.flush(super.getLayoutInfo(key));
  }

  override getVisibleLayoutInfos(rect: Rect): LayoutInfo[] {
    const query = new Rect(rect.x, rect.y + this.gap.height, rect.width, rect.height);
    return super
      .getVisibleLayoutInfos(query)
      .map((info) => this.flush(info))
      .filter((info): info is LayoutInfo => info != null);
  }

  override getContentSize(): Size {
    const size = super.getContentSize();
    // Снят верхний зазор; нижний — только когда последним идёт строка ячеек.
    // Строка подгрузки стоит ПОСЛЕ замыкающего зазора и уезжает вверх на один
    // зазор вместе со всеми: сними ещё один — и она обрезалась бы снизу.
    const collection = this.virtualizer?.collection;
    const lastKey = collection?.getLastKey();
    const loaderLast = lastKey != null && collection?.getItem(lastKey)?.type === "loader";
    const removed = (loaderLast ? 1 : 2) * this.gap.height;
    return new Size(size.width, Math.max(0, size.height - removed));
  }
}

/** Выбор react-aria: `Set` ключей с якорем и текущим ключом Shift-диапазона. */
type RangeSelection = Set<Key> & { anchorKey?: Key | null; currentKey?: Key | null };
type RangeSelectionClass = new (
  keys: Iterable<Key>,
  anchorKey?: Key | null,
  currentKey?: Key | null
) => Set<Key>;

/**
 * Объединение прежнего выбора с диапазоном react-aria — с ЯКОРЕМ диапазона.
 *
 * Якорь и текущий ключ Shift-диапазона react-aria держит на самом объекте
 * выбора (`Selection` из react-stately — подкласс `Set`) и переносит их в своё
 * состояние, только если получает экземпляр этого класса. Объединение в
 * обычном `Set` якорь теряло: второй Shift+клик подряд выделял одну ячейку
 * вместо диапазона от якоря. Класс не публичный, и react-stately
 * не зависимость кита, поэтому конструктор берётся у `next` — это экземпляр,
 * который react-aria только что отдал в `onSelectionChange`.
 */
function unionKeepingAnchor(previous: Set<Key>, next: Set<Key>): Set<Key> {
  const range = next as RangeSelection;
  const Ctor = next.constructor as RangeSelectionClass;
  return new Ctor([...previous, ...next], range.anchorKey, range.currentKey);
}

/**
 * Сетка карточек с виртуализацией: в DOM живут только видимые ячейки.
 *
 * СТОИТ НА `Virtualizer` И `GridLayout` ИЗ react-aria, а не на
 * `@tanstack/react-virtual`
 * (ADR-0028).
 * Замер перед решением: 300 ячеек дали 27 узлов в DOM, при прокрутке на 4000
 * пикселей первой отрисованной оказалась 129-я.
 *
 * ДВА РЕЖИМА ПРОКРУТКИ. `container` (по умолчанию) крутит свой контейнер, и
 * высоту ему задаёт потребитель. `window` крутит страницу: `Virtualizer`
 * react-aria 1.21 сам пересекает свою область с окном и держит в DOM только
 * ячейки у окна. Липкой шапке отвечает `scroll-margin-top` ячеек из той же
 * переменной, что у `SelectionBar`: без него стрелка, уводящая фокус за верх
 * окна, ставила ячейку под шапку. Раньше режим был один, и здесь
 * стояло «без высоты виртуализация не включится» — для react-aria 1.21 это
 * уже неправда.
 *
 * ЯЧЕЙКА — `gridcell`, А НЕ `option`. Сетка стоит на `GridList` (раньше
 * на `ListBox`): кнопки внутри `option` давали вложенный
 * интерактив уровня serious, а в `gridcell` они законны. Выбор — ось сетки,
 * кружок выбора — `Checkbox slot="selection"` внутри ячейки.
 *
 * КОЛОНКИ СЧИТАЕТ РАСКЛАДКА, а не `matchMedia` и не `ResizeObserver` в нашем
 * коде: `GridLayout` берёт ширину контейнера и наименьший размер ячейки. Роли
 * (`grid`/`row`/`gridcell`), клавиатура и поиск набором — тоже слой поведения.
 *
 * ПЕРЕТАСКИВАНИЯ ЗДЕСЬ НЕТ. Виртуализация и сортировка вместе в ките не
 * проверены; сетка получит перетаскивание тем же `useDragAndDrop`, когда
 * появится экран-заказчик (ADR-0027). Протяжка пальцем (`dragToSelect`) —
 * выделение, а не перенос.
 */
export function VirtualGrid({
  items,
  "aria-label": ariaLabel,
  minItemWidth = 180,
  minItemHeight = 180,
  gap = 12,
  edgeGap = true,
  maxColumns,
  emptyText,
  scroll = "container",
  offsetVar = "--topbar-h",
  selectionMode = "none",
  selectionBehavior,
  rangeSelection = "replace",
  dragToSelect = false,
  selectedKeys,
  onSelectionChange,
  onAction,
  onLoadMore,
  isLoadingMore = false,
  loadingMore,
  className,
}: VirtualGridProps) {
  if (dragToSelect && selectionMode !== "multiple") {
    devWarn(
      'VirtualGrid: `dragToSelect` needs selectionMode="multiple" — a drag adds a range of ' +
        "cells, and the grid has no multiple selection to add it to. The gesture is off. " +
        'Pass selectionMode="multiple" or drop `dragToSelect`.'
    );
  }

  const gridRef = useRef<HTMLDivElement>(null);

  // `Size` — класс библиотеки, и новый экземпляр на каждый рендер заставлял бы
  // раскладку пересчитываться вхолостую.
  const layoutOptions = useMemo(
    () => ({
      minItemSize: new Size(minItemWidth, minItemHeight),
      minSpace: new Size(gap, gap),
      ...(maxColumns != null ? { maxColumns } : {}),
    }),
    [minItemWidth, minItemHeight, gap, maxColumns]
  );

  /*
    Shift-диапазон в режиме `add`. react-aria заменяет набор диапазоном от
    якоря; здесь новый набор складывается с тем, что было до нажатия. Признак
    Shift ловится на захвате — до того, как react-aria обработает событие и
    сообщит новый набор.
  */
  const shiftRef = useRef(false);
  const lastSelectionRef = useRef<Selection | undefined>(selectedKeys);
  lastSelectionRef.current = selectedKeys ?? lastSelectionRef.current;

  const emitSelection = useCallback(
    (next: Selection) => {
      let keys = next;
      const previous = lastSelectionRef.current;
      if (
        rangeSelection === "add" &&
        shiftRef.current &&
        next !== "all" &&
        previous != null &&
        previous !== "all"
      ) {
        keys = unionKeepingAnchor(previous, next);
      }
      // Признак одного события: иначе он залипал до следующего нажатия, и
      // смена выбора без клавиши (снаружи, флажком) складывалась бы как диапазон.
      shiftRef.current = false;
      lastSelectionRef.current = keys;
      onSelectionChange?.(keys);
    },
    [rangeSelection, onSelectionChange]
  );

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || rangeSelection !== "add") return;
    const remember = (event: KeyboardEvent | PointerEvent) => {
      shiftRef.current = event.shiftKey;
    };
    grid.addEventListener("keydown", remember, true);
    grid.addEventListener("pointerdown", remember, true);
    return () => {
      grid.removeEventListener("keydown", remember, true);
      grid.removeEventListener("pointerdown", remember, true);
    };
  }, [rangeSelection]);

  /*
    Липкая шапка в режиме окна. react-aria прокручивает к сфокусированной
    ячейке, только когда та целиком вне окна, и про `scroll-margin` не знает:
    ячейка, на которую стрелка перевела фокус и которая видна лишь нижней
    частью, оставалась под шапкой (замер: верх на 48 px при шапке 56). Здесь
    окно доворачивается на недостающее — только при фокусе с клавиатуры:
    щелчок по выглядывающей ячейке страницу не дёргает.
  */
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || scroll !== "window") return;
    const onFocusIn = (event: FocusEvent) => {
      const row = (event.target as HTMLElement | null)?.closest<HTMLElement>('[role="row"]');
      if (!row || !row.matches(":focus-visible")) return;
      const raw = getComputedStyle(document.documentElement).getPropertyValue(offsetVar).trim();
      const offset = Number.parseFloat(toPixels(raw, "0px")) || 0;
      const top = row.getBoundingClientRect().top;
      if (top < offset) window.scrollBy(0, top - offset);
    };
    grid.addEventListener("focusin", onFocusIn);
    return () => grid.removeEventListener("focusin", onFocusIn);
  }, [scroll, offsetVar]);

  const order = useMemo(() => items.map((item) => item.id), [items]);
  useDragToSelect(gridRef, {
    enabled: dragToSelect && selectionMode === "multiple",
    order,
    scroll,
    offsetVar,
    selection: () => lastSelectionRef.current ?? new Set<Key>(),
    onChange: (keys) => {
      lastSelectionRef.current = keys;
      onSelectionChange?.(keys);
    },
  });

  const handleAction = useMemo(() => {
    if (!onAction) return undefined;
    return (key: Key) => {
      const row = Array.from(
        gridRef.current?.querySelectorAll<HTMLElement>('[role="row"]') ?? []
      ).find((element) => element.dataset.key === String(key));
      onAction(key, { rect: row?.getBoundingClientRect() ?? new DOMRect() });
    };
  }, [onAction]);

  /*
    Выделяет ли react-aria ячейку долгим нажатием прямо сейчас — его же
    условие из `useSelectableItem`: есть выбор и действие, и действие главное
    (выбор пуст при `toggle`) или вторичное (`replace`). Только тогда ячейка с
    меню гасит его долгое нажатие: в остальных случаях долгое нажатие у
    react-aria выключено, и отмена отняла бы у медленного тапа его нажатие.
  */
  const longPressSelectsRef = useRef(false);
  const currentSelection = selectedKeys ?? lastSelectionRef.current;
  const selectionEmpty =
    currentSelection == null || (currentSelection !== "all" && currentSelection.size === 0);
  longPressSelectsRef.current =
    selectionMode !== "none" &&
    onAction != null &&
    (selectionBehavior === "replace" || selectionEmpty);

  const rowStyle = scroll === "window" ? { scrollMarginTop: `var(${offsetVar}, 0px)` } : undefined;

  return (
    <Virtualizer layout={edgeGap ? GridLayout : EdgeToEdgeGridLayout} layoutOptions={layoutOptions}>
      <GridList
        ref={gridRef}
        aria-label={ariaLabel}
        layout="grid"
        selectionMode={selectionMode}
        {...(selectionBehavior != null ? { selectionBehavior } : {})}
        selectedKeys={selectedKeys}
        onSelectionChange={emitSelection}
        onAction={handleAction}
        renderEmptyState={emptyText != null ? () => emptyText : undefined}
        // Прокрутка своя только в режиме `container`: там без `overflow-auto` и
        // заданной высоты прокручивать нечего.
        className={cn(scroll === "container" && "overflow-auto", "outline-none", className)}
      >
        <Collection items={items}>
          {(item) => (
            <GridListItem
              id={item.id}
              textValue={item.textValue}
              style={rowStyle}
              className="focus-visible:outline-accent-strong rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {/* `gridcell` у react-aria — `display: contents`: высоту держит обёртка. */}
              <div className="h-full" style={{ minHeight: minItemHeight }}>
                {item.contextMenu != null ? (
                  <CellContextMenu
                    menu={item.contextMenu}
                    longPressSelectsRef={longPressSelectsRef}
                  >
                    {item.content}
                  </CellContextMenu>
                ) : (
                  item.content
                )}
              </div>
            </GridListItem>
          )}
        </Collection>
        {onLoadMore != null && (
          <GridListLoadMoreItem
            isLoading={isLoadingMore}
            // В режиме окна датчик свой (ниже): у датчика react-aria корень —
            // ближайший прокручиваемый предок, а это часто `body` с
            // `overflow: auto` во всю высоту страницы. Такой датчик «видит»
            // конец всегда, и сетка подгружала страницы подряд, пока не
            // кончатся данные (так было в Storybook: 1200 из 1200 без прокрутки).
            onLoadMore={scroll === "container" ? onLoadMore : undefined}
          >
            <div className="flex h-full items-center justify-center">
              {loadingMore ?? <Spinner />}
            </div>
          </GridListLoadMoreItem>
        )}
      </GridList>
      {scroll === "window" && onLoadMore != null && (
        <WindowLoadMoreSentinel onLoadMore={onLoadMore} count={items.length} />
      )}
    </Virtualizer>
  );
}

/**
 * Датчик подгрузки в режиме окна: пустой узел сразу под сеткой, корень —
 * окно. Срабатывает, когда до конца загруженного меньше высоты окна.
 *
 * Наблюдатель пересоздаётся на каждую новую страницу (по числу ячеек), как у react-aria: при
 * большом `rootMargin` датчик, оставшийся в зоне после подгрузки, иначе не
 * сообщил бы о себе снова, и короткая страница не дотянула бы следующую.
 */
function WindowLoadMoreSentinel({ onLoadMore, count }: { onLoadMore: () => void; count: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const loadRef = useRef(onLoadMore);
  loadRef.current = onLoadMore;

  useEffect(() => {
    const node = ref.current;
    // Без API (сервер, jsdom потребителя) подгрузки по прокрутке нет — не ошибка.
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadRef.current();
      },
      { root: null, rootMargin: "0px 0px 100% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
    // По числу ячеек, а не по массиву: потребитель собирает `items` в рендере,
    // и наблюдатель пересоздавался бы на каждый рендер, зовя подгрузку снова.
  }, [count]);

  return <div ref={ref} aria-hidden className="h-px" />;
}

const stop = (event: SyntheticEvent) => event.stopPropagation();

/** Отмена долгого нажатия react-aria у ячейки с меню: раньше его 500 мс. */
const LONG_PRESS_MS = 450;
/** Сдвиг пальца, после которого это уже не долгое нажатие. */
const LONG_PRESS_SLOP_PX = 8;

/**
 * Контекстное меню ячейки. Внутренняя часть сетки, наружу не выходит.
 *
 * ТРИГГЕР СТОИТ ВНУТРИ `row`, И ЭТО ТРЕБУЕТ ДВУХ ЗАПЛАТОК, обе — про одно и
 * то же: меню Radix привязано к триггеру, а настоящий фокус у сетки на ячейке.
 *
 * 1. Клавиатура. Shift+F10 и клавиша меню шлют событие `contextmenu` (или
 *    вовсе ничего — на macOS) в сфокусированный элемент, то есть в `row`, а
 *    триггер лежит ниже. Корень Radix открыться снаружи не умеет, поэтому
 *    сетка ловит клавишу на ячейке и отправляет триггеру то самое событие, в
 *    точку по центру ячейки. Закрывшееся меню возвращает фокус на ячейку само:
 *    Radix запоминает сфокусированный элемент при открытии.
 * 2. Всплытие. Панель меню вынесена порталом, но события React всплывают по
 *    дереву компонентов — до `row`: клик по пункту выбирал бы ячейку и
 *    запускал `onAction`. Обёртка с `display: contents` гасит их на границе.
 *    Экран «Медиатека» обходил это локальной обёрткой; теперь это работа кита.
 * 3. Долгое нажатие на касании — только меню. У сетки с выбором
 *    и `onAction` react-aria по своему правилу выделяет ячейку долгим нажатием
 *    (500 мс), а меню Radix открывается по своему таймеру позже (700 мс) —
 *    человек получал и меню, и выделение. Здесь свой таймер раньше react-aria
 *    (450 мс) шлёт `pointercancel` в `row`: событие всплывает к документу и
 *    снимает нажатие react-aria вместе с его долгим нажатием, но через
 *    триггер Radix не проходит — меню открывает его же таймер. Открыть меню
 *    своим `contextmenu` не выйдет: react-aria гасит это событие на время
 *    касания (`preventDefault`), а Radix отменённое не обрабатывает. Сдвиг
 *    пальца до срабатывания — прокрутка или протяжка, таймер снимается.
 */
function CellContextMenu({
  menu,
  longPressSelectsRef,
  children,
}: {
  menu: ReactNode;
  longPressSelectsRef: RefObject<boolean>;
  children: ReactNode;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trigger = triggerRef.current;
    const row = trigger?.closest<HTMLElement>('[role="row"]');
    if (!trigger || !row) return;

    const onKeyDown = (event: KeyboardEvent) => {
      // Только сама ячейка: Shift+F10 внутри вложенного поля — не наше дело.
      if (event.target !== row) return;
      const byKey = event.key === "ContextMenu";
      const byShortcut = event.key === "F10" && event.shiftKey;
      if (!byKey && !byShortcut) return;
      event.preventDefault();
      const box = row.getBoundingClientRect();
      trigger.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: box.left + box.width / 2,
          clientY: box.top + box.height / 2,
        })
      );
    };

    let timer = 0;
    let press: { x: number; y: number; id: number } | null = null;
    const cancel = () => {
      window.clearTimeout(timer);
      timer = 0;
      press = null;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || !longPressSelectsRef.current) return;
      cancel();
      press = { x: event.clientX, y: event.clientY, id: event.pointerId };
      timer = window.setTimeout(() => {
        const at = press;
        cancel();
        if (!at) return;
        // В `row`, а не в элемент касания: событие всплывает к документу, где
        // нажатие слушает react-aria, но не проходит через триггер Radix (он
        // ниже) — его таймер остаётся жить и открывает меню.
        row.dispatchEvent(
          new PointerEvent("pointercancel", {
            bubbles: true,
            pointerId: at.id,
            pointerType: "touch",
          })
        );
      }, LONG_PRESS_MS);
    };
    // Касание, а не указатель: `pointermove` при касании уходит к элементу
    // под пальцем, `touchmove` остаётся у стартового.
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!press || !touch) return;
      if (Math.hypot(touch.clientX - press.x, touch.clientY - press.y) > LONG_PRESS_SLOP_PX)
        cancel();
    };

    row.addEventListener("keydown", onKeyDown);
    trigger.addEventListener("pointerdown", onPointerDown);
    trigger.addEventListener("touchmove", onTouchMove, { passive: true });
    trigger.addEventListener("touchend", cancel);
    trigger.addEventListener("touchcancel", cancel);
    // Жест, который забрал браузер (масштаб, системный), отменяет указатель
    // без `touchmove` за порог — таймер снимается и тут.
    trigger.addEventListener("pointerup", cancel);
    trigger.addEventListener("pointercancel", cancel);
    return () => {
      cancel();
      row.removeEventListener("keydown", onKeyDown);
      trigger.removeEventListener("pointerdown", onPointerDown);
      trigger.removeEventListener("touchmove", onTouchMove);
      trigger.removeEventListener("touchend", cancel);
      trigger.removeEventListener("touchcancel", cancel);
      trigger.removeEventListener("pointerup", cancel);
      trigger.removeEventListener("pointercancel", cancel);
    };
  }, [longPressSelectsRef]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div ref={triggerRef} className="h-full">
          {children}
        </div>
      </ContextMenuTrigger>
      <div
        className="contents"
        onClick={stop}
        onPointerDown={stop}
        onPointerUp={stop}
        onKeyDown={stop}
        onKeyUp={stop}
      >
        <ContextMenuContent>{menu}</ContextMenuContent>
      </div>
    </ContextMenu>
  );
}
