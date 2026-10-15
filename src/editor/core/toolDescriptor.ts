import type { Editor, Extensions } from "@tiptap/core";
import type { StarterKitOptions } from "@tiptap/starter-kit";
import type { ComponentType, ReactNode } from "react";
import type { UiMessages } from "../../i18n/messages.js";
import type { IconProps } from "../../icons.js";
import type { BlockTypeItem } from "./blockTypes.js";
import type {
  TextCardRangeAt,
  CustomTextCardRender,
  CustomTool,
  CustomTrigger,
  PrefixedName,
} from "./customTool.js";
import type { EditorExtensionOptions } from "./extensions.js";
import type { InsertItem } from "./insertItems.js";
import type { ShortcutCommand, ShortcutGroup } from "./shortcuts.js";
import type { ConfigurableToolName, RichTextTools } from "./toolOptions.js";
import type { ToolLoader } from "./toolLoader.js";
import type { Tool } from "./tools.js";

/**
 * Внутреннее описание встроенного Инструмента (ADR-0058, п. 10).
 *
 * НАДФОРМА. Тип — надмножество будущего публичного описания своего
 * Инструмента: те же Часть для движка, Признаки Блока и UI-записи, а сверху
 * привилегии кита, которых своему Инструменту не дают (теги Схемы кита,
 * модель содержимого, виджеты Панели, своё место в порядке поверхности).
 * Наружу описания встроенных не экспортируются: публичны только имена и
 * пресеты.
 *
 * ОДИН СПИСОК. `tools` и `preset` разворачиваются в список описаний
 * (`expandTools`, `features/builtins.ts`), и реестры по имени — движок, Меню
 * вставки, «¶», справочник сочетаний и следующие за ними — читают его
 * проекцию (`projectRecords`). Правило «выключенный Инструмент убирает и
 * кнопку, и Схему» этим держится само: записи и Часть для движка Инструмента,
 * которого нет в списке, не попадают никуда.
 *
 * У КАЖДОГО ВСТРОЕННОГО — ОПИСАНИЕ (OLDSUI-273): `BUILTIN_TOOLS` полон, и
 * компилятор не даст добавить имя в `TOOLS` без описания. Место записи на
 * поверхности держит порядок кита этой поверхности (`INSERT_ORDER`,
 * `BLOCK_TYPE_ORDER`, `SHORTCUT_ORDER`, `ENGINE_ORDER`), а не описание. Виджеты
 * Панели и Меню выделения, «…», подменю Ручки и поповеры картинки остаются
 * компонентами кита и спрашивают набор по имени (`tools.has`).
 */
export interface ToolDescriptor {
  /** Имя Инструмента — то же, что в `tools`; у своего — с Префиксом потребителя. */
  name: Tool | PrefixedName;
  /**
   * Часть для движка: расширения Tiptap Инструмента — Node, Mark, Extension,
   * плагины ProseMirror. Функция от контекста — привилегия кита: встроенным
   * нужны мосты `RichTextEditor` (поповер ссылки, Меню вставки, `Alt+F10`).
   * Второй аргумент — Опции этого Редактора (`options`), если они есть.
   */
  engine?: (context: ToolEngineContext, options?: object) => Extensions;
  /**
   * Доля StarterKit: ключи `StarterKit.configure`, которые включают Блоки и
   * Метки Инструмента (`bold: {}`, `heading: { levels }`). Привилегия кита.
   * Доли всех описаний сливаются в ОДИН `StarterKit` (`extensions.ts`): так
   * порядок Меток в сохранённом HTML и список пакетов движка остаются теми же,
   * что при StarterKit целиком. Ключ, которого нет ни в одной доле, выключен.
   */
  starterKit?: (context: ToolEngineContext) => Partial<StarterKitOptions>;
  /**
   * Загрузчик Части для движка (`toolLoader.ts`): движок создаётся после
   * загрузчиков всех описаний списка, и `engine` читает отданное `loaded`.
   */
  load?: ToolLoader;
  /**
   * Форма Блоков для Скелета, пока загрузчик не отработал (`skeleton.ts`):
   * лёгкие узлы с той же разметкой и тем же разбором атрибутов, без плагинов
   * и тяжёлых пакетов. Привилегия ленивого встроенного: без неё его Блоки в
   * Скелете видны текстом, и поле прыгает по высоте с приходом чанка.
   */
  skeleton?: () => Extensions;
  /** Признаки Блока по имени узла; кит переносит их в spec узла. Нет — обычный Блок. */
  blocks?: Readonly<Record<string, BlockTraits>>;

  /* Опции. */

  /**
   * Умолчания Опций встроенного Инструмента: полный набор полей, из которого
   * `tool()` меняет нужные. Нет — у Инструмента нет Опций. Поле — надформа:
   * публичные Опции своего Инструмента задаёт `defineTool` (`defaults`).
   */
  defaults?: object;
  /**
   * Проверки значений Опций по имени поля — по одной на каждое поле `defaults`.
   * Значение, не прошедшее проверку, заменяется умолчанием (`expandTools`):
   * потребитель на JS обходит типы карты `RichTextTools`.
   */
  checks?: Readonly<Record<string, (value: unknown) => boolean>>;
  /**
   * Опции этого Редактора: умолчания, слитые с `tool()`. Ставит `expandTools`
   * при сборке набора, поэтому описание в реестре — общее на все Редакторы, а
   * это поле — своё в списке каждого. Читаются один раз, вместе с набором.
   */
  options?: object;

  /* UI-записи. */

  /**
   * Кнопки Панели (фиксированной и плавающей — набор один), флагом — и Меню
   * выделения. Место встроенной кнопки на Панели — привилегия кита: её
   * отводит Панель по имени Инструмента (`EditorToolbar.tsx`).
   */
  buttons?: readonly KitToolButton[];
  /** Пункты Меню вставки: «/», «+», «Добавить ›» и «Формат ›» Ручки Блока. */
  insertItems?: readonly InsertItem[];
  /** Действия над Блоком в меню Ручки Блока. */
  blockActions?: readonly BlockAction[];
  /** Карточки у текста: у встроенных их пока нет, но форма одна (ADR-0058, п. 7.6). */
  textCards?: readonly TextCardRecord[];
  /** Символы-триггеры: у встроенных их нет, у своего Инструмента — один (ADR-0064). */
  triggers?: readonly TriggerRecord[];

  /**
   * Публичное описание своего Инструмента, из которого собрано это
   * (`customToolEngine.ts`): по нему набор проверяется при сборке.
   */
  custom?: CustomTool;

  /* Привилегии кита. */

  /**
   * Теги Схемы кита, которые пишет Инструмент (`p`, `h1`–`h4`, `a`, `table`…).
   * Свой Инструмент их не получает: его HTML — `data-block` и `data-mark`.
   */
  kitTags?: readonly string[];
  /**
   * Модель содержимого: узлы, которые Документ называет поимённо, а не через
   * группу `block`, — контейнеры верхнего уровня, как Раскладка и Обёртка
   * (`document.ts`).
   */
  documentContent?: readonly string[];
  /** Пункты виджета «¶» Панели: у него свои слова и иконки (`blockTypes.ts`). */
  blockTypes?: readonly BlockTypeItem[];
  /**
   * Строки справочника сочетаний для клавиш, которые вешает Часть для движка
   * (`shortcuts.ts`): у записи сочетание — её поле, а у Метки из движка — нет.
   */
  shortcuts?: readonly ShortcutCommand[];

  /* Команды. */

  /**
   * Команды Инструмента: то, что `handle.tool(name)` отдаёт экрану. Зовётся при
   * каждом обращении к Хэндлу и обязана быть дешёвой: только обёртки над движком
   * и мостом, без подписок и состояния. Нет — у Инструмента нет Команд, и
   * `handle.tool(name)` отдаёт `null`.
   */
  commands?: (context: ToolCommandsContext) => object;

  /* Состояние. */

  /**
   * Состояние Инструмента: снимок для `useRichTextToolState(ref, name)`. Хук
   * зовёт её на каждую транзакцию и каждое чтение, поэтому она быстрая и без
   * побочных эффектов. Есть только у своего Инструмента (`defineTool`): снимки
   * встроенных хук держит у себя (`SNAPSHOTS`), чтобы Поиск и Оглавление не
   * тянули их код в стартовый кусок Редактора. Нет — Состояния у Инструмента нет.
   */
  state?: (editor: Editor) => unknown;
}

/** Что функция Команд получает от `RichTextEditor`. */
export interface ToolCommandsContext {
  /** Живой движок: функцию зовут, только когда он создан и не уничтожен. */
  editor: Editor;
  /** Мост к тому, что держит сам `RichTextEditor`: панели и ленивый UI. */
  bridge: ToolBridge;
}

/**
 * Что Команды встроенных берут у `RichTextEditor`: панель Поиска и ядро
 * Оглавления живут в его React-дереве, а не в движке. Все методы возвращают
 * `false`, когда сделать нельзя (HTML-режим, UI ещё не загружен). Привилегия
 * кита: свой Инструмент моста не получает.
 */
export interface ToolBridge {
  /** Открыть панель Поиска; `query` — сразу в поле, без него — выделенный текст. */
  openSearch: (replace: boolean, query?: string) => boolean;
  /** Закрыть панель Поиска и убрать подсветку, не трогая фокус. */
  closeSearch: () => boolean;
  /** Открыт ли HTML-режим: Документа на экране нет, искать и заменять в нём нельзя. */
  sourceOpen: () => boolean;
  /** Перейти к заголовку Оглавления с индексом списка. */
  jumpToc: (index: number) => boolean;
}

/** Символ-триггер Инструмента в списке описаний: публичная запись и имя владельца для сообщений. */
export type TriggerRecord = CustomTrigger & { tool: string };

/**
 * Что Часть для движка встроенного получает от `RichTextEditor`: мосты и —
 * вместо всего набора — вопрос `has`. Связи между Инструментами (уровни
 * заголовка при `heading1`, Обёртка в колонке Раскладки, очистка формата)
 * спрашивают его, а не список описаний.
 */
export type ToolEngineContext = Omit<EditorExtensionOptions, "tools"> & {
  /** Включён ли Инструмент кита в этом Редакторе. */
  has: (tool: Tool) => boolean;
};

type EditorMessages = UiMessages["editor"];

/**
 * Признаки Блока, которые понимает только кит. Все выключены по умолчанию:
 * обычный Блок — не контейнер, без «Превратить в», с меню форматирования.
 */
export interface BlockTraits {
  /** Контейнер: Блоки внутри — со своей Ручкой Блока (`blockContainer` в spec узла). */
  container?: boolean;
  /** Блок можно превратить в другой: «Формат ›» Ручки Блока и «¶». */
  turnInto?: boolean;
  /** Атом без меню форматирования: кнопки Меток над ним не показываются. */
  plainAtom?: boolean;
}

/**
 * Подпись записи — строка или функция от контекста (ADR-0058, п. 6.1). Кит
 * зовёт её при отрисовке, поэтому смена локали `UiProvider` перерисовывает
 * запись. Встроенным в контекст кладутся ещё и `messages` кита: форма подписи
 * у своего и встроенного одна.
 */
export type ToolLabel = string | ((context: ToolLabelContext) => string);

export interface ToolLabelContext {
  /** Локаль `UiProvider` (`useUiLocale`). */
  locale: string;
  /** Строки Редактора из каталога кита — для встроенных Инструментов. */
  messages: EditorMessages;
}

/** Подпись записи в текущем контексте. */
export function toolLabel(label: ToolLabel, context: ToolLabelContext): string {
  return typeof label === "string" ? label : label(context);
}

/**
 * Содержимое поповера кнопки. Рамку держит кит: слой, якорь, стек Escape
 * (ADR-0041), имя рамки — подпись кнопки, возврат фокуса и выделения в
 * Документ. `close` закрывает поповер тем же путём, что Escape.
 */
export type ToolPopover = (props: { editor: Editor; close: () => void }) => ReactNode;

interface ToolButtonFields {
  /** Стабильный ключ, уникальный среди кнопок Панели. */
  id: string;
  label: ToolLabel;
  icon: ComponentType<IconProps>;
  /** Доступна ли кнопка сейчас. В нередактируемом поле кит выключает кнопки сам, проверять это здесь не нужно. */
  can: (editor: Editor) => boolean;
  /** Есть — кнопка-переключатель с `aria-pressed`; нет — разовое действие. */
  isActive?: (editor: Editor) => boolean;
  /** Предикат видимости по контексту; нет — кнопка видна всегда. */
  isVisible?: (editor: Editor) => boolean;
  /** Кнопка стоит и в Меню выделения. */
  selectionMenu?: boolean;
  /**
   * Сочетание в нотации Панели (`mod`, `alt`, `shift`, клавиша) — единственный
   * его источник: кит сам вешает клавишу, пишет её в подсказку,
   * `aria-keyshortcuts` и справочник сочетаний.
   */
  shortcut?: readonly string[];
}

/**
 * Кнопка Панели (фиксированной и плавающей — набор один), флагом — и Меню
 * выделения. Подсказка — подпись и `Kbd` сочетания; `aria-pressed` — только
 * при `isActive`. Форма та же, что у будущей публичной кнопки своего
 * Инструмента (ADR-0058, п. 5).
 *
 * ДЕЙСТВИЕ ИЛИ ПОПОВЕР — ровно одно из двух. `run` выполняется щелчком и
 * сочетанием. `popover` открывается щелчком у кнопки, а сочетанием — у
 * каретки: кнопки на экране может и не быть (`toolbar="none"`, спрятанная
 * плавающая Панель).
 */
export type ToolButton = ToolButtonFields &
  (
    | { run: (editor: Editor) => void; popover?: undefined }
    | { popover: ToolPopover; run?: undefined }
  );

/**
 * Кнопка встроенного Инструмента: публичная форма и привилегии кита, которых
 * своей кнопке не дают.
 */
export type KitToolButton = ToolButton &
  (
    | {
        /**
         * Сочетание, которое вешает не кит, а Часть для движка (`undoRedo` у
         * StarterKit, `Mod-B` у Метки): только подпись — подсказка,
         * `aria-keyshortcuts` и строка справочника. Взаимоисключимо с
         * `shortcut`: та и вешает клавишу, и подписывает её, и две привязки
         * одной клавиши спорили бы.
         */
        keys: readonly string[];
        shortcut?: undefined;
      }
    | { keys?: undefined }
  ) & {
    /**
     * Группа справочника сочетаний. Нет — строка встаёт в группу Инструмента без
     * заголовка после групп кита, как у своего Инструмента.
     */
    shortcutGroup?: ShortcutGroup;
    /** Рамка поповера, если она не умолчание кита (у кнопки, по содержимому). */
    popoverFrame?: {
      /**
       * `selection` — рамка всегда у выделения, и щелчком по кнопке тоже: поповер
       * правит выделенный текст, и стоит у него при любом способе открыть
       * (поповер ссылки).
       */
      anchor?: "selection";
      /** Классы размера и отступов рамки вместо умолчания `w-auto p-2`. */
      className?: string;
    };
  };

/** Действие над Блоком: пункт меню Ручки Блока, в секции Инструмента перед «Удалить». */
export interface BlockAction {
  id: string;
  /** Подпись в локали `UiProvider`: у встроенных — строка каталога, у своих — `ToolLabel`. */
  label: (messages: EditorMessages, locale: string) => string;
  icon: ComponentType<IconProps>;
  /**
   * Имена Блоков, для которых действие показывается: имя Блока Ручки или
   * контейнера, в котором он стоит прямо (`blockContainer` в spec узла). Так
   * «Снять обёртку» с `["wrapper"]` есть и у самой Обёртки, и у Блока в ней.
   */
  blocks: readonly string[];
  /**
   * Сочетание, которое вешает кит (ADR-0058, п. 5.7): на Блок под кареткой, у
   * которого действие видно. У встроенных нет.
   */
  shortcut?: readonly string[];
  /** `pos` — позиция Блока Ручки в Документе. */
  run: (editor: Editor, pos: number) => void;
  /**
   * Поповер своего Инструмента у Блока (ADR-0058, п. 5.6). `run` такого
   * Действия открывает его — меню Ручки и сочетание о поповере не знают.
   */
  popover?: (props: { editor: Editor; close: () => void; pos: number }) => ReactNode;
  isVisible?: (editor: Editor, pos: number) => boolean;
}

/**
 * Карточка у текста: диапазон у каретки и тело; рамку держит кит
 * (`TextCard.tsx`, ADR-0058, п. 7.6–7.11).
 */
export interface TextCardRecord {
  id: string;
  /** Подпись в локали `UiProvider`: доступное имя рамки и часть фразы о появлении. */
  label: (messages: EditorMessages, locale: string) => string;
  rangeAt: TextCardRangeAt;
  render: CustomTextCardRender;
}

/**
 * Развёрнутый набор Инструментов: список описаний и — как `Set` — имена
 * включённых Инструментов кита.
 *
 * Набор имён — тоже проекция списка: виджеты кита, которые спрашивают набор по
 * имени (`tools.has("table")`), читают его без правок. Свои Инструменты есть
 * только в списке описаний.
 */
export interface ToolList extends ReadonlySet<Tool> {
  /**
   * Ошибка сборки набора, найденная до движка: две записи `tool()` с одним
   * именем. Редактор показывает её тем же путём, что ошибки своих Инструментов
   * (`customToolsError`): строкой поля и `console.error` в разработке.
   */
  readonly error?: string;
  /**
   * Описания включённых Инструментов: встроенные в порядке кита, за ними
   * свои в порядке `tools`.
   */
  readonly descriptors: readonly ToolDescriptor[];
}

/**
 * Набор из имён кита и списка описаний — единственный способ его собрать:
 * развернуть `tools` (`expandTools`) или сузить готовый (Скелет).
 */
export function toolList(
  names: Iterable<Tool>,
  descriptors: readonly ToolDescriptor[],
  error?: string
): ToolList {
  return Object.assign(new Set(names), { descriptors, ...(error !== undefined && { error }) });
}

/**
 * Опции встроенного Инструмента этого Редактора: умолчания кита, слитые с
 * `tool()`. Инструмента нет в наборе или у него нет Опций — `undefined`.
 */
export function toolOptions<Name extends ConfigurableToolName>(
  tools: ToolList,
  name: Name
): RichTextTools[Name]["options"] | undefined {
  const descriptor = tools.descriptors.find((candidate) => candidate.name === name);
  return descriptor?.options as RichTextTools[Name]["options"] | undefined;
}

/**
 * Действия над Блоком набора — проекция списка описаний, в порядке кита. Фильтра
 * по Блоку здесь нет: имя и предикат видимости спрашивает меню Ручки на
 * своём Блоке (`blockActionVisible`).
 */
export function blockActionsOf(tools: ToolList): readonly BlockAction[] {
  return tools.descriptors.flatMap((descriptor) => descriptor.blockActions ?? []);
}

/**
 * Карточки у текста набора в порядке списка: при равной ширине диапазона
 * выигрывает та, что раньше, то есть Инструмент раньше в `tools`.
 */
export function textCardsOf(tools: ToolList): readonly TextCardRecord[] {
  return tools.descriptors.flatMap((descriptor) => descriptor.textCards ?? []);
}

/** Символы-триггеры набора в порядке списка (ADR-0064). */
export function triggersOf(tools: ToolList): readonly TriggerRecord[] {
  return tools.descriptors.flatMap((descriptor) => descriptor.triggers ?? []);
}

/**
 * Показывается ли действие у Блока `pos`: `block` — имя этого Блока, `container`
 * — имя контейнера, в котором он стоит прямо (у Блока Документа это сам Документ).
 */
export function blockActionVisible(
  action: BlockAction,
  editor: Editor,
  pos: number,
  block: { name: string; container: string }
): boolean {
  return (
    (action.blocks.includes(block.name) || action.blocks.includes(block.container)) &&
    (action.isVisible?.(editor, pos) ?? true)
  );
}

/**
 * Записи одной поверхности — проекция списка описаний.
 *
 * - `order` — место встроенных Инструментов на поверхности, привилегия кита.
 *   Инструменты набора вне него идут следом, в порядке списка: так встаёт
 *   запись, у которой своего места на поверхности нет.
 * - `own` — поле описания с записями этой поверхности.
 *
 * Фильтра по включённым Инструментам здесь нет: его держит сам список.
 */
export function projectRecords<R>(
  tools: ToolList,
  order: readonly Tool[],
  own: (descriptor: ToolDescriptor) => readonly R[] | undefined
): R[] {
  const list = tools.descriptors;
  const placed = order.flatMap((name) => list.filter((descriptor) => descriptor.name === name));
  const rest = list.filter((descriptor) => !(order as readonly string[]).includes(descriptor.name));
  return [...placed, ...rest].flatMap((descriptor) => own(descriptor) ?? []);
}
