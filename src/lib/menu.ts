import { OVERLAY_LAYER } from "./overlay-layer.js";
import { TOUCH_HIDDEN_CLASS } from "./touch.js";
import { TONE_TOKENS, type Tone } from "./variants.js";

/**
 * Вид меню — одной таблицей на две реализации.
 *
 * В пакете два меню: `Menu` на react-aria-components и `ContextMenu` на Radix.
 * Разные библиотеки здесь не прихоть — контекстного меню react-aria не даёт
 * вовсе, — но выглядеть они обязаны одинаково, иначе правая кнопка мыши
 * открывала бы «другое» меню, и заметить это можно было бы только поставив оба
 * рядом. Поэтому вид живёт здесь, а обе реализации его только применяют.
 *
 * Приём не новый для пакета: так же вынесены `NAV_BUTTON_CLASS` и
 * `WEEKDAY_CELL_CLASS` у календаря.
 *
 * ЗДЕСЬ — ТОТ САМЫЙ СЛУЧАЙ, ГДЕ НУЖНЫ ВАРИАНТНЫЕ АТОМЫ. Правило пакета гласит:
 * состояние берут рендер-пропом там, где красят потомка, и вариантом там, где
 * красят сам элемент с `data-*`. Пункт меню — второй случай: вид задаётся одной
 * строкой на все пункты сразу, и рендер-проп взять неоткуда. Отсюда
 * `selected:`, `pressed:`, `open:` в таблице ниже.
 */

/** Панель меню: подложка, рамка, тень, отступы. */
export const MENU_PANEL_CLASS =
  "bg-surface-elevated border-line min-w-[180px] rounded-md border p-1 " +
  "shadow-[var(--shadow-2)] outline-none " +
  /*
    ПРОКРУТКА ВНУТРИ ПАНЕЛИ, А НЕ ПОВЕРХ СТРАНИЦЫ.

    Высоту панели задаёт не она: react-aria ставит поповеру инлайном
    `max-height` по видимой области, Radix — `--radix-…-available-height`. Без
    `overflow` всё, что в эту высоту не влезло, рисовалось за рамкой, поверх
    содержимого и без подложки. На iOS 27 в Safari высота вышла в несколько
    пикселей — рамка схлопнулась в полоску, а пункты меню легли на текст
    Документа. `overscroll-contain` — чтобы докрутка до конца списка не
    прокручивала страницу под меню.
  */
  "overflow-y-auto overscroll-contain " +
  /*
    НА iOS ВЫСОТУ ЗАДАЁМ САМИ. react-aria считает `max-height`
    поповера от видимой области (`calculatePosition`, `getMaxHeight`), и на
    iOS 27 в Safari выходил ноль: от панели оставались рамка и отступы — тонкая
    полоска под кнопкой, пункты прятались внутри неё. Место самого меню при
    этом верное, ошибается только высота, поэтому на iOS она перебивается
    правилом с `!important` (инлайновый стиль react-aria без него сильнее):
    24rem или 60 % динамической высоты экрана — что меньше. Остальное
    прокручивается внутри панели. `-webkit-touch-callout` понимает только
    WebKit на iOS; Android и десктоп считают высоту по-прежнему.
  */
  "[@supports(-webkit-touch-callout:none)]:max-h-[min(24rem,60dvh)]! " +
  /*
    СЛОЙ ОБЯЗАТЕЛЕН, и его здесь не было.

    `Popover` и `Tooltip` осознанно взяли `z-[120]` с комментарием про
    `ModalOverlay` (`z-90`); RAC-попоувер получает `zIndex: 100000` инлайном от
    библиотеки. А Radix-попперу копировать было нечего: он берёт z-index из
    вычисленного стиля содержимого, получал `auto`, и правый клик внутри
    `Dialog` или `Drawer` рисовал контекстное меню ПОД затемнением — размытым и
    некликабельным. Шкала слоёв — ADR-0041.
  */
  `${OVERLAY_LAYER.popover} ` +
  /*
    Появление и уход панели — НА ДВУХ ДИАЛЕКТАХ СРАЗУ, и это не дублирование.

    `entering:`/`exiting:` — варианты RAC, они разворачиваются в `[data-entering]`
    и `[data-exiting]`. Radix таких атрибутов не ставит вовсе: у него состояние
    живёт в `data-state`. Пока здесь стоял только диалект RAC, комментарий
    обещал, что «значения совпадают намеренно, иначе два меню открывались бы
    по-разному», — а `ContextMenu` не анимировался НИКАК, потому что ни одно
    правило до него не доставало. Обещание держалось на слове.

    Теперь оба диалекта названы явно, и оба меню открываются и закрываются
    одинаково — проверяется это в браузере, обоими путями сразу.

    Уход задан токеном, а не `opacity-0`. Прежняя запись выглядела выходом, но
    им не была: переход в ноль без длительности — то же мгновенное пропадание,
    записанное длиннее. Токен вдобавок виден гейту `reduce` (ADR-0043), а
    literal — нет.
  */
  "entering:animate-fadein exiting:animate-fadeout " +
  "data-[state=open]:animate-fadein data-[state=closed]:animate-fadeout";

/**
 * Пункт меню.
 *
 * `focus:` здесь равен `hover:` не по лени: в меню клавиатурный курсор и
 * указатель — одно и то же место, и подсвечивать их по-разному значило бы
 * показывать пользователю два курсора сразу. У react-aria это `data-focused`,
 * который ставится и от мыши, и от стрелок.
 */
export const MENU_ITEM_CLASS =
  "group flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] " +
  "outline-none select-none " +
  // Диалект react-aria.
  "hover:bg-bg-2 focus:bg-bg-2 disabled:pointer-events-none disabled:opacity-50 " +
  // Диалект Radix — см. комментарий ниже, без него ContextMenu разъезжается.
  "data-[highlighted]:bg-bg-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

/**
 * Строка списка — одна на все списки кита.
 *
 * С волны 26 её используют `Transfer`, `Combobox`, `CommandPalette` и `Select`.
 * Последний долго стоял особняком: его строка — не `ListBoxItem`, а обычная
 * кнопка, и набор классов расходился с общим отступом (`py-[9px]` против
 * `py-1.5`) и цветом выбора (`bg-bg-3` против `selected:bg-accent-soft`).
 * Списки, поставленные рядом, различались высотой строки и тем, как выглядит
 * выбранное.
 *
 * Работает это и на не-RAC узле: вариант `selected:` разворачивается в
 * `[data-selected]` без требования `data-rac` — у `selected` нет нативного
 * соответствия, — поэтому кнопке достаточно проставить атрибут.
 *
 * Строка списка выбора — `ListBoxItem` react-aria.
 *
 * Отличается от `MENU_ITEM_CLASS` одним: у списка есть выбранное состояние, у
 * меню его нет. Вынесена, когда четвёртым её написал `Transfer`, — и написал
 * с `focus-visible:` вместо `focus:`, то есть единственный в репозитории
 * разошёлся с остальными тремя.
 *
 * `focus:`, а не `focus-visible:`, и это существенно: у react-aria это
 * `data-focused`, который ставится и стрелками, и мышью. Подсвечивать их
 * по-разному значило бы показывать два курсора сразу — тот же довод, что у
 * пункта меню ниже.
 */
export const LISTBOX_ITEM_CLASS =
  "flex cursor-pointer items-center rounded-sm px-2.5 py-1.5 text-[13px] outline-none " +
  "text-fg-0 hover:bg-bg-2 focus:bg-bg-2 selected:bg-accent-soft " +
  "disabled:cursor-default disabled:opacity-50";

/*
  ПОЧЕМУ ЗДЕСЬ ДВА НАБОРА СЕЛЕКТОРОВ.

  Строка одна на две библиотеки, а состояния они называют по-разному, и
  совпадает далеко не всё:

    состояние      react-aria          Radix
    наведение      data-hovered        data-highlighted
    фокус          data-focused        data-highlighted (то же самое)
    выключен       data-disabled       data-disabled, но НЕ :disabled
    отмечен        data-selected       data-state="checked"

  Плагин `tailwindcss-react-aria-components` переопределяет `hover:` и
  `disabled:` на двойной селектор «элемент RAC ИЛИ нативный псевдокласс».
  На дивах Radix это спасает только `hover:` — у них есть настоящий `:hover`.
  А `:disabled` — псевдокласс полей формы, и на диве с `data-disabled` он не
  срабатывает вовсе: пункт выглядел бы рабочим, оставаясь неработающим.

  Отсюда правило: общая таблица вида обязана говорить на обоих диалектах.
  Проверяется это не рассуждением, а снимком «два меню рядом» в
  `Menu.stories.tsx` — расхождение видно глазами.
*/

/** Подпись раздела внутри меню. */
export const MENU_SECTION_LABEL_CLASS =
  "text-fg-3 px-2 pt-2 pb-1 text-[11px] font-bold tracking-wide uppercase";

/** Разделитель между группами пунктов. */
export const MENU_SEPARATOR_CLASS = "bg-line -mx-1 my-1 h-px";

/** Иконка слева от подписи: галочка отмеченного пункта, иконка действия. */
export const MENU_ITEM_ICON_CLASS = "flex size-4 shrink-0 items-center justify-center";

/** Горячая клавиша справа. Не действие, а напоминание — отсюда приглушённость. */
export const MENU_ITEM_SHORTCUT_CLASS = `text-fg-3 ml-auto pl-4 text-[11px] tabular-nums ${TOUCH_HIDDEN_CLASS}`;

/** Стрелка пункта с подменю. */
export const MENU_ITEM_SUBMENU_CLASS = "text-fg-3 ml-auto pl-4";

/**
 * Цвет пункта по тону.
 *
 * `danger` красит ТЕКСТ И ИКОНКУ, а не подложку. Подложкой пункт красится при
 * наведении, и красный фон на всю строку читался бы как «выбрано», а не как
 * «опасно» — то есть ровно наоборот.
 */
export const MENU_ITEM_TONE: Record<Tone, string> = {
  neutral: "text-fg-0",
  accent: TONE_TOKENS.accent.fg,
  success: TONE_TOKENS.success.fg,
  warning: TONE_TOKENS.warning.fg,
  danger: TONE_TOKENS.danger.fg,
};

/**
 * Отмеченный пункт-переключатель: подложка и цвет из словаря тонов.
 *
 * Второй парой идёт диалект Radix: у него отмеченность выражена не отдельным
 * атрибутом, а значением `data-state="checked"`.
 */
export const MENU_ITEM_SELECTED_CLASS =
  `${TONE_TOKENS.accent.selectedBg} ${TONE_TOKENS.accent.selectedFg} ` +
  "data-[state=checked]:bg-accent-soft data-[state=checked]:text-accent-strong";

/** Нажатый пункт — отдельный сигнал от наведения, ставится и с клавиатуры. */
export const MENU_ITEM_PRESSED_CLASS = TONE_TOKENS.neutral.pressedBg;
