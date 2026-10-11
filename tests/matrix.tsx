import { createElement as h, Fragment, type ReactElement } from "react";
import { parseDate } from "@internationalized/date";
import { Alert } from "../src/components/actions/Alert.js";
import { Banner } from "../src/components/actions/Banner.js";
import { UploadQueue } from "../src/components/inputs/UploadQueue.js";
import { NotificationItem, NotificationList } from "../src/components/content/NotificationList.js";
import { NotificationCenter } from "../src/components/content/NotificationCenter.js";
import { MediaCard } from "../src/components/content/MediaCard.js";
import { SortableList } from "../src/components/content/SortableList.js";
import { VirtualGrid } from "../src/components/content/VirtualGrid.js";
import { CopyButton } from "../src/components/actions/CopyButton.js";
import { Truncate } from "../src/components/actions/Truncate.js";
import { Avatar } from "../src/components/content/Avatar.js";
import { Calendar } from "../src/components/date-time/Calendar.js";
import { DatePicker } from "../src/components/date-time/DatePicker.js";
import { DateRangePicker } from "../src/components/date-time/DateRangePicker.js";
import { DateTimePicker } from "../src/components/date-time/DateTimePicker.js";
import { RangeCalendar } from "../src/components/date-time/RangeCalendar.js";
import { Button } from "../src/components/actions/Button.js";
import { Card } from "../src/components/content/Card.js";
import { Checkbox } from "../src/components/inputs/Checkbox.js";
import { CheckboxGroup } from "../src/components/inputs/CheckboxGroup.js";
import { NumberInput } from "../src/components/inputs/NumberInput.js";
import { Progress } from "../src/components/actions/Progress.js";
import { Radio, RadioGroup } from "../src/components/inputs/RadioGroup.js";
import { Spinner } from "../src/components/actions/Spinner.js";
import { Chip } from "../src/components/actions/Chip.js";
import { ConfirmDialog } from "../src/components/overlays/ConfirmDialog.js";
import { Segmented } from "../src/components/actions/Segmented.js";
import { Skeleton } from "../src/components/content/Skeleton.js";
import { EmptyState } from "../src/components/content/EmptyState.js";
import { SelectionBar } from "../src/components/navigation/SelectionBar.js";
import { ContextualSaveBar } from "../src/components/navigation/ContextualSaveBar.js";
import { SavedViews } from "../src/components/table/SavedViews.js";
import { Timeline } from "../src/components/content/Timeline.js";
import { AppShell } from "../src/components/app-shell/AppShell.js";
import { MobileTabBar, MobileTabBarItem } from "../src/components/app-shell/MobileTabBar.js";
import { NavItem, NavCollapsedProvider } from "../src/components/app-shell/NavItem.js";
import { NavGroup, SideNav } from "../src/components/app-shell/SideNav.js";
import { TopBar } from "../src/components/app-shell/TopBar.js";
import { Image } from "../src/components/content/Image.js";
import { ErrorState } from "../src/components/content/ErrorState.js";
import { FormField } from "../src/components/inputs/FormField.js";
import { HelpTooltip } from "../src/components/overlays/HelpTooltip.js";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../src/components/overlays/HoverCard.js";
import { ModalHeader } from "../src/components/overlays/ModalHeader.js";
import { PageHeader } from "../src/components/navigation/PageHeader.js";
import { FieldRow, FormLayout } from "../src/components/inputs/FormLayout.js";
import { PasswordInput } from "../src/components/inputs/PasswordInput.js";
import { InlineEdit } from "../src/components/inputs/InlineEdit.js";
import { MaskedInput } from "../src/components/inputs/MaskedInput.js";
import { PhoneInput } from "../src/components/inputs/PhoneInput.js";
import { TreeView } from "../src/components/navigation/TreeView.js";
import { PinInput } from "../src/components/inputs/PinInput.js";
import { SearchControl } from "../src/components/inputs/SearchControl.js";
import { Select } from "../src/components/inputs/Select.js";
import { SectionHeader } from "../src/components/navigation/SectionHeader.js";
import { StatusBadge } from "../src/components/actions/StatusBadge.js";
import { TextControl } from "../src/components/inputs/TextControl.js";
import { Tooltip, TooltipProvider } from "../src/components/overlays/Tooltip.js";
import { Toggle } from "../src/components/actions/Toggle.js";
import { AspectRatio } from "../src/components/content/AspectRatio.js";
import { Carousel } from "../src/components/content/Carousel.js";
import { Grid } from "../src/components/content/Grid.js";
import { Toolbar } from "../src/components/actions/Toolbar.js";
import { ShortcutsHelp } from "../src/components/overlays/ShortcutsHelp.js";
import { Heading } from "../src/components/content/Heading.js";
import { Kbd } from "../src/components/content/Kbd.js";
import { Keyboard } from "../src/components/content/Keyboard.js";
import { Link } from "../src/components/content/Link.js";
import { ScrollArea } from "../src/components/content/ScrollArea.js";
import { Separator } from "../src/components/content/Separator.js";
import { Text, type TextSize } from "../src/components/content/Text.js";
import { Accordion, AccordionItem } from "../src/components/navigation/Accordion.js";
import { AvatarGroup } from "../src/components/content/AvatarGroup.js";
import { Badge } from "../src/components/content/Badge.js";
import { Breadcrumbs } from "../src/components/navigation/Breadcrumbs.js";
import { ButtonGroup } from "../src/components/actions/ButtonGroup.js";
import { SplitButton } from "../src/components/actions/SplitButton.js";
import { SplitPanel } from "../src/components/app-shell/SplitPanel.js";
import { Transfer } from "../src/components/inputs/Transfer.js";
import { TreeSelect } from "../src/components/inputs/TreeSelect.js";
import { ColorPicker } from "../src/components/inputs/ColorPicker.js";
import { Rating } from "../src/components/inputs/Rating.js";
import { CodeView } from "../src/components/content/CodeView.js";
import { MenuItem } from "../src/components/overlays/Menu.js";
import { Combobox } from "../src/components/inputs/Combobox.js";
import { DescriptionList } from "../src/components/content/DescriptionList.js";
import { FileDropzone } from "../src/components/inputs/FileDropzone.js";
import { Pagination } from "../src/components/navigation/Pagination.js";
import { RangeSlider, Slider } from "../src/components/inputs/Slider.js";
import { Stat } from "../src/components/content/Stat.js";
import { Stepper } from "../src/components/navigation/Stepper.js";
import { DataTable } from "../src/components/table/DataTable.js";
import { FilterBar } from "../src/components/table/FilterBar.js";
import { DEFAULT_TABLE_STATE } from "../src/lib/table-state.js";
import { Table } from "../src/components/content/Table.js";
import { TablePreferences } from "../src/components/table/TablePreferences.js";
import { TableToolbar } from "../src/components/table/TableToolbar.js";
import { TagInput } from "../src/components/inputs/TagInput.js";
import { Tag, TagGroup } from "../src/components/content/TagGroup.js";
import { LABEL_HUES } from "../src/lib/variants.js";
import { ToggleGroup } from "../src/components/actions/ToggleGroup.js";
import type { ButtonSize, Size, Tone, Variant } from "../src/lib/variants.js";

const TONES: Tone[] = ["neutral", "accent", "success", "warning", "danger"];
const VARIANTS: Variant[] = ["solid", "soft", "outline", "ghost"];
const SIZES: Size[] = ["sm", "md", "lg"];
//: У кнопки ступеней четыре: `xs` заведена под кнопку-иконку в строке списка и
//: живёт только здесь, поэтому список свой, а не расширенный общий.
const BUTTON_SIZES: ButtonSize[] = ["xs", "sm", "md", "lg"];

/**
 * Полная матрица пропсов всех примитивов.
 *
 * Смысл в исчерпывающем переборе: класс, который выдаёт редкое сочетание,
 * должен попасть в разметку — иначе проверка покрытия его не увидит и
 * пропустит именно тот случай, который сломается в проде.
 */
export function renderMatrix(): ReactElement {
  const els: ReactElement[] = [];

  for (const variant of VARIANTS)
    for (const tone of TONES)
      for (const size of BUTTON_SIZES)
        els.push(h(Button, { key: `b-${variant}-${tone}-${size}`, variant, tone, size }, "Button"));
  els.push(h(Button, { key: "b-disabled", disabled: true }, "Disabled"));
  // Кольцо отправки на каждом размере: у него своя таблица классов.
  for (const size of BUTTON_SIZES)
    els.push(h(Button, { key: `b-loading-${size}`, size, loading: true }, "Submitting"));
  els.push(h(Button, { key: "b-icon", icon: h("span", null, "★") }, "With an icon"));
  for (const size of BUTTON_SIZES)
    for (const selected of [true, false])
      els.push(
        h(Button, {
          key: `b-only-${size}-${selected}`,
          size,
          iconOnly: true,
          selected,
          icon: h("span", null, "★"),
          "aria-label": "Icon",
        })
      );

  for (const tone of TONES)
    for (const selected of [true, false])
      for (const size of ["sm", "md"] as const)
        els.push(
          h(Chip, { key: `c-${tone}-${selected}-${size}`, tone, selected, size, count: 7 }, "Chip")
        );
  els.push(h(Chip, { key: "c-disabled", disabled: true }, "Disabled"));
  els.push(h(Chip, { key: "c-icononly", iconOnly: true, icon: h("span", null, "★") }));
  els.push(h(Chip, { key: "c-mobile", mobileIconOnly: true, icon: h("span", null, "★") }, "Chip"));

  for (const tone of TONES)
    for (const size of ["sm", "md"] as const)
      for (const dot of [true, false])
        // children в пропсах, а не третьим аргументом: у StatusBadge он обязателен,
        // и перегрузка createElement этого не видит.
        els.push(
          h(StatusBadge, { key: `s-${tone}-${size}-${dot}`, tone, size, dot, children: "Status" })
        );

  for (const size of ["sm", "md"] as const)
    els.push(h(Card, { key: `card-${size}`, size }, "Card"));
  // Нажимаемая карточка добавляет свою таблицу классов (курсор, hover рамки,
  // кольцо фокуса) — без неё в матрице половина `Card` осталась бы непокрытой.
  els.push(
    h(Card, { key: "card-aschild", asChild: true }, h("button", { type: "button" }, "Pressable"))
  );
  els.push(
    h(
      Card,
      { key: "card-interactive", interactive: true },
      h("a", { href: "#where", className: "after:absolute after:inset-0" }, "Stretched link")
    )
  );

  for (const checked of [true, false])
    for (const disabled of [true, false])
      els.push(
        h(Toggle, {
          key: `t-${checked}-${disabled}`,
          checked,
          disabled,
          onCheckedChange: () => {},
          label: "Switch",
        })
      );

  // Флажок — первый компонент на react-aria-components. Перебор полный: тон
  // окрашивает только отмеченное состояние, поэтому строка «не отмечен» у всех
  // пяти тонов даёт одни и те же классы, а «отмечен» — пять разных наборов.
  // `invalid` и `disabled` вынесены отдельно: они не зависят от тона.
  for (const tone of TONES)
    for (const checked of [true, false])
      for (const size of ["sm", "md"] as const)
        els.push(
          h(
            Checkbox,
            {
              key: `cb-${tone}-${checked}-${size}`,
              tone,
              checked,
              size,
              onCheckedChange: () => {},
            },
            "Checkbox"
          )
        );
  els.push(
    h(Checkbox, { key: "cb-ind", indeterminate: true, label: "Indeterminate" }),
    h(Checkbox, { key: "cb-dis", checked: true, disabled: true, label: "Disabled" }),
    h(Checkbox, { key: "cb-inv", invalid: true, label: "Invalid" }),
    h(Checkbox, { key: "cb-desc", label: "With a hint", description: "Hint" })
  );

  // Группа флажков: три состояния — обычное, выключенное и с ошибкой. Ошибка
  // вытесняет пояснение, поэтому классы обеих строк собираются разными
  // элементами матрицы, а не одним.
  for (const [key, extra] of [
    ["plain", { description: "Hint" }],
    ["disabled", { disabled: true, description: "Hint" }],
    ["invalid", { errorMessage: "Error" }],
  ] as const)
    for (const orientation of ["vertical", "horizontal"] as const)
      els.push(
        h(
          CheckboxGroup,
          {
            key: `cbg-${key}-${orientation}`,
            label: "Group",
            value: ["a"],
            onChange: () => {},
            orientation,
            ...extra,
          },
          h(Checkbox, { key: "a", value: "a" }, "First"),
          h(Checkbox, { key: "b", value: "b" }, "Second")
        )
      );

  // Радиогруппа: тон × размер × раскладка. Невыбранный вариант нейтрален при
  // любом тоне, поэтому классы кружка различаются только у выбранного.
  for (const tone of TONES)
    for (const size of ["sm", "md"] as const)
      els.push(
        h(
          RadioGroup,
          {
            key: `rg-${tone}-${size}`,
            label: "Set",
            value: "a",
            onChange: () => {},
            tone,
            size,
          },
          h(Radio, { key: "a", value: "a", description: "Hint" }, "First"),
          h(Radio, { key: "b", value: "b" }, "Second"),
          h(Radio, { key: "c", value: "c", disabled: true }, "Third")
        )
      );
  els.push(
    h(
      RadioGroup,
      {
        key: "rg-invalid",
        label: "Set",
        value: null,
        onChange: () => {},
        errorMessage: "Error",
        orientation: "horizontal",
      },
      h(Radio, { key: "a", value: "a" }, "First")
    ),
    h(
      RadioGroup,
      { key: "rg-disabled", label: "Set", value: "a", onChange: () => {}, disabled: true },
      h(Radio, { key: "a", value: "a" }, "First")
    )
  );

  // Карточки выбора: ось живёт у группы. Тон красит рамку выбранной карточки
  // (пять строк), размер — индикатор и подпись; ошибка, выключенность,
  // раскладка в строку и значок идут отдельными элементами.
  for (const tone of TONES)
    for (const size of ["sm", "md"] as const)
      els.push(
        h(
          RadioGroup,
          {
            key: `rgc-${tone}-${size}`,
            label: "Cards",
            appearance: "card",
            value: "a",
            onChange: () => {},
            tone,
            size,
          },
          h(Radio, { key: "a", value: "a", description: "Hint" }, "First"),
          h(Radio, { key: "b", value: "b", icon: h("svg", { key: "i" }) }, "Second"),
          h(Radio, { key: "c", value: "c", disabled: true, description: "Hint" }, "Third")
        )
      );
  els.push(
    h(
      RadioGroup,
      {
        key: "rgc-invalid",
        label: "Cards",
        appearance: "card",
        value: null,
        onChange: () => {},
        errorMessage: "Error",
        orientation: "horizontal",
      },
      h(Radio, { key: "a", value: "a", icon: h("svg", { key: "i" }), description: "Hint" }, "First")
    ),
    h(
      RadioGroup,
      {
        key: "rgc-disabled",
        label: "Cards",
        appearance: "card",
        value: "a",
        onChange: () => {},
        disabled: true,
      },
      h(Radio, { key: "a", value: "a" }, "First")
    ),
    h(
      RadioGroup,
      { key: "rg-icon", label: "Set", value: "a", onChange: () => {} },
      h(Radio, { key: "a", value: "a", icon: h("svg", { key: "i" }) }, "First")
    )
  );
  for (const [key, extra] of [
    ["plain", { description: "Hint" }],
    ["disabled", { disabled: true, description: "Hint" }],
    ["invalid", { errorMessage: "Error" }],
  ] as const)
    for (const orientation of ["vertical", "horizontal"] as const)
      els.push(
        h(
          CheckboxGroup,
          {
            key: `cbgc-${key}-${orientation}`,
            label: "Cards",
            appearance: "card",
            value: ["a", "d"],
            onChange: () => {},
            orientation,
            ...extra,
          },
          h(Checkbox, { key: "a", value: "a", description: "Hint" }, "First"),
          h(Checkbox, { key: "b", value: "b", icon: h("svg", { key: "i" }) }, "Second"),
          h(Checkbox, { key: "c", value: "c", disabled: true }, "Third"),
          h(
            Checkbox,
            { key: "d", value: "d", indeterminate: true, tone: "success", size: "sm" },
            "Fourth"
          )
        )
      );
  // Тон группы флажков: перекрывает `tone` флажка внутри («Second» просит
  // `danger`, но получает тон набора). Пять тонов × обычный вид и карточки.
  for (const tone of TONES)
    for (const appearance of ["default", "card"] as const)
      els.push(
        h(
          CheckboxGroup,
          {
            key: `cbgt-${tone}-${appearance}`,
            label: "Tone",
            appearance,
            value: ["a", "b"],
            onChange: () => {},
            tone,
          },
          h(Checkbox, { key: "a", value: "a", description: "Hint" }, "First"),
          h(Checkbox, { key: "b", value: "b", tone: "danger", indeterminate: true }, "Second"),
          h(Checkbox, { key: "c", value: "c" }, "Third")
        )
      );
  els.push(
    h(
      CheckboxGroup,
      { key: "cbg-icon", label: "Group", value: [], onChange: () => {} },
      h(Checkbox, { key: "a", value: "a", icon: h("svg", { key: "i" }) }, "First")
    )
  );

  // Числовое поле: оболочка общая с `TextControl`, поэтому её классы уже
  // покрыты; здесь важны кнопки ступеней и невалидное состояние.
  for (const [key, extra] of [
    ["plain", {}],
    ["invalid", { invalid: true }],
    ["disabled", { disabled: true }],
  ] as const)
    els.push(
      h(NumberInput, {
        key: `ni-${key}`,
        label: "Count",
        value: 10,
        onChange: () => {},
        placeholder: "—",
        ...extra,
      })
    );

  // FormField: ошибка и обязательность. Ошибка вытесняет пояснение, поэтому
  // классы обеих строк собираются разными элементами матрицы.
  els.push(
    h(FormField, { key: "ff-hint", label: "Label", hint: "Hint" }, "field"),
    h(FormField, { key: "ff-err", label: "Label", hint: "Hint", error: "Error" }, "field"),
    h(FormField, { key: "ff-req", label: "Label", required: true }, "field")
  );

  // Сообщения: тон × вид, плюс крестик и действие.
  for (const tone of TONES)
    for (const variant of ["soft", "outline"] as const)
      els.push(
        h(Alert, { key: `al-${tone}-${variant}`, tone, variant, title: "Title" }, "Message text")
      );
  els.push(
    h(Alert, { key: "al-dismiss", onDismiss: () => {} }, "With a cross"),
    h(Alert, { key: "al-action", action: h("span", null, "action") }, "With an action")
  );

  // Баннеры: тон, плюс крестик. Вида у баннера нет — он всегда полоса.
  for (const tone of TONES)
    els.push(h(Banner, { key: `bn-${tone}`, tone, title: "Title" }, "Application message"));
  els.push(h(Banner, { key: "bn-dismiss", onDismiss: () => {} }, "With a cross"));

  // Копирование и обрезка: оба состояния кнопки и обе раскладки обрезки.
  els.push(
    h(CopyButton, { key: "cb", value: "OLDSUI-42" }),
    h(CopyButton, { key: "cb-label", value: "OLDSUI-42", children: "Copy" }),
    h(Truncate, { key: "tr", children: "Value" }),
    h(Truncate, { key: "tr-lines", lines: 2, children: "A longer value" })
  );

  // Виртуальная сетка: в jsdom ячеек не отрисует (нет раскладки), но классы
  // контейнера в разметку попадают — ради них она здесь и стоит.
  els.push(
    h(VirtualGrid, {
      key: "vg",
      "aria-label": "Cells",
      // Высота — класс ПОТРЕБИТЕЛЯ, и в матрице ему не место: Tailwind сканирует
      // `src`, а не тесты, и гейт справедливо объявил бы его пропавшим.
      items: [{ id: "1", textValue: "Cell", content: h("span", null, "Cell") }],
    })
  );

  // Сортируемый список: строки с ручками.
  els.push(
    h(SortableList, {
      key: "sl",
      "aria-label": "Order",
      onReorder: () => {},
      items: [
        { id: "1", label: "First" },
        { id: "2", label: "Second" },
      ],
    })
  );

  // Плитка: с выбором и без, с бейджами и действиями, обе пропорции.
  for (const selected of [true, false])
    els.push(
      h(MediaCard, {
        key: `mc-${selected}`,
        selected,
        onSelectedChange: () => {},
        preview: h("span", null, "▦"),
        title: "kadr.png",
        subtitle: "1920×1080",
        badges: h("span", null, "badge"),
        actions: h("span", null, "action"),
      })
    );
  els.push(h(MediaCard, { key: "mc-plain", preview: h("span", null, "▦"), ratio: 16 / 9 }));

  // Уведомления: прочитанное и непрочитанное на всех тонах, плюс группы.
  els.push(
    h(
      NotificationList,
      { key: "nl" },
      TONES.map((tone) =>
        h(NotificationItem, {
          key: `ni-${tone}`,
          tone,
          unread: tone !== "neutral",
          title: "Event",
          description: "Details",
          time: "yesterday",
          icon: h("span", null, "!"),
          actions: h("span", null, "action"),
        })
      )
    )
  );
  els.push(
    h(NotificationList, {
      key: "nl-groups",
      groups: [
        {
          id: "g1",
          label: "Today",
          children: h(NotificationItem, { key: "g1-1", title: "One", unread: true }),
        },
        {
          id: "g2",
          label: "Earlier",
          children: h(NotificationItem, { key: "g2-1", title: "Two" }),
        },
      ],
    })
  );

  // Оси строки: превью рядом со значком; вся строка — кнопка, прочитанная и нет.
  els.push(
    h(
      NotificationList,
      { key: "nl-axes" },
      h(NotificationItem, {
        key: "ni-media",
        title: "Event",
        description: "Details",
        icon: h("span", null, "!"),
        media: h("span", null, "▦"),
        actions: h("span", null, "action"),
      }),
      h(NotificationItem, {
        key: "ni-btn-unread",
        title: "Event",
        description: "Details",
        time: "yesterday",
        unread: true,
        icon: h("span", null, "!"),
        media: h("span", null, "▦"),
        onAction: () => {},
      }),
      h(NotificationItem, { key: "ni-btn-read", title: "Event", onAction: () => {} })
    )
  );

  // Центр уведомлений: шапка со счётчиком, фильтры, выделение, низ.
  els.push(
    h(
      NotificationCenter,
      {
        key: "nc",
        unreadCount: 12,
        filters: h("span", null, "filter"),
        actions: h("span", null, "action"),
        selectedCount: 3,
        onClearSelection: () => {},
        selectionActions: h("span", null, "bulk"),
        footer: h("span", null, "bottom"),
      },
      h(NotificationList, { key: "nc-list" }, h(NotificationItem, { key: "nc-1", title: "One" }))
    )
  );

  // Центр с заголовком h2 и id: на него ссылается имя поверхности потребителя.
  els.push(
    h(
      "div",
      { key: "nc-titled", role: "region", "aria-labelledby": "matrix-nc-title" },
      h(
        NotificationCenter,
        { level: 2, titleId: "matrix-nc-title" },
        h(
          NotificationList,
          { key: "nc-titled-list" },
          h(NotificationItem, { key: "nc-t-1", title: "One" })
        )
      )
    )
  );

  // Очередь загрузок: все четыре состояния, оба вида прогресса, бейдж и мета.
  // Очередь загрузок: все четыре состояния, оба вида прогресса, бейдж и мета,
  // а также тон поверх состояния (D9): «Дубль» успешной загрузки — warning.
  els.push(
    h(UploadQueue, {
      key: "uq",
      items: [
        { id: "1", name: "done.pdf", size: "2 MB", state: "success", statusLabel: "Done" },
        { id: "2", name: "running.docx", state: "running", progress: 40 },
        { id: "3", name: "unknown.jpg", state: "running", progress: null },
        { id: "4", name: "error.xlsx", state: "failed", meta: "The server rejected the file" },
        {
          id: "5",
          name: "waiting.png",
          state: "pending",
          statusLabel: "Queued",
          preview: h("span", null, "▦"),
          actions: h("span", null, "action"),
        },
        {
          id: "f1",
          name: "skipped.png",
          state: "failed",
          tone: "warning",
          statusLabel: "Skipped",
          meta: "The server rejected the file",
        },
        ...(["neutral", "accent", "success", "warning", "danger"] as const).map((tone, i) => ({
          id: `t${i}`,
          name: `${tone}.png`,
          state: "success" as const,
          progress: 100,
          statusLabel: tone,
          tone,
        })),
      ],
    })
  );

  // Прогресс и спиннер: тон × размер, плюс неизвестное состояние.
  for (const tone of TONES) {
    for (const size of ["sm", "md"] as const)
      els.push(
        h(Progress, { key: `pr-${tone}-${size}`, tone, size, value: 60, label: "Progress" })
      );
    for (const size of SIZES) els.push(h(Spinner, { key: `sp-${tone}-${size}`, tone, size }));
  }
  els.push(
    h(Progress, { key: "pr-ind", value: null, label: "Unknown" }),
    h(Progress, { key: "pr-val", value: 30, label: "With a percentage", showValue: true })
  );

  // Скелетон: классов у него ровно один, но он должен дойти до CSS так же, как остальные.
  els.push(h(Skeleton, { key: "sk", width: 120, height: 12 }));

  // Картинка: коробка, вписывание и фолбэк — три разных набора классов.
  for (const fit of ["cover", "contain"] as const)
    els.push(h(Image, { key: `img-${fit}`, src: "/a.png", alt: "", fit, ratio: 1 }));
  els.push(h(Image, { key: "img-fallback", src: null, alt: "" }));
  // Контент-ведомая раскладка: у коробки свой набор классов, и без него
  // половина компонента осталась бы непокрытой.
  els.push(h(Image, { key: "img-intrinsic", src: "/a.png", alt: "", sizing: "intrinsic" }));
  els.push(h(Image, { key: "img-named-fallback", src: null, alt: "Night city" }));

  // Лента шагов: все четыре состояния разом — у каждого свой тон.
  els.push(
    h(Timeline, {
      key: "tl",
      "aria-label": "Steps",
      items: [
        { id: "1", label: "success", status: "success" as const, statusLabel: "done" },
        { id: "2", label: "running", status: "running" as const, statusLabel: "running" },
        {
          id: "3",
          label: "failed",
          status: "failed" as const,
          statusLabel: "error",
          details: "Reason",
        },
        { id: "4", label: "pending", status: "pending" as const, statusLabel: "pending" },
      ],
    })
  );

  // Полоса выделения: панель, счётчик, крестик и распорка — свой набор классов.
  els.push(
    h(
      SelectionBar,
      { key: "selbar", count: 12, sticky: false, onClear: () => {} },
      h(Button, { size: "sm" }, "Delete")
    )
  );

  // Полоса несохранённого: свои кнопки, свой тон отказа. Липкость выключена —
  // в матрице она только мешала бы раскладке.
  els.push(
    h(ContextualSaveBar, {
      key: "savebar",
      visible: true,
      count: 3,
      sticky: false,
      error: "The server did not answer",
      onSave: () => {},
      onCancel: () => {},
    })
  );

  // Сохранённые виды: активный и неактивный чипы разом — вид у переключателя
  // целиком чиповый, и свои классы он приносит только обёрткой.
  els.push(
    h(SavedViews, {
      key: "saved-views",
      views: [
        { id: "all", name: "All", state: {} },
        { id: "drafts", name: "Drafts", state: {} },
      ],
      activeId: "all",
      onSelect: () => {},
    })
  );

  // Пусто и отказ: геометрия у них общая (`lib/state.ts`), а тон разный — в
  // матрицу идут оба размера каждого, иначе половина таблицы остаётся непроверенной.
  for (const size of ["sm", "md"] as const) {
    els.push(
      h(EmptyState, {
        key: `es-${size}`,
        size,
        title: "Nothing found",
        description: "Narrow the query.",
        icon: h("span", null, "•"),
        action: h(Button, { size: "sm" }, "Reset"),
      })
    );
    els.push(
      h(ErrorState, {
        key: `ers-${size}`,
        size,
        description: "Could not load the collections.",
        action: h(Button, { size: "sm" }, "Retry"),
      })
    );
  }
  for (const size of ["md", "lg"] as const)
    els.push(h(Avatar, { key: `av-${size}`, size, name: "Ada" }));
  // Ось `src`: фото получает имя из `alt`, а без `alt` — из `name`.
  for (const size of ["md", "lg"] as const)
    els.push(h(Avatar, { key: `avp-${size}`, size, name: "Ada", src: "/ada.png" }));
  for (const size of ["sm", "md"] as const)
    els.push(h(SectionHeader, { key: `sh-${size}`, size, title: "Section", right: "right" }));
  els.push(h(PageHeader, { key: "ph", title: "Page", subtitle: "label", actions: "actions" }));
  for (const as of ["input", "textarea"] as const)
    els.push(h(TextControl, { key: `tc-${as}`, as, rows: 3, "aria-label": "Field" }));
  // Слоты переключают оболочку на flex — без перебора эта ветка классов
  // не попадает в разметку вовсе, а именно её и добавил `SearchControl`.
  els.push(
    h(TextControl, {
      key: "tc-icon",
      "aria-label": "With an icon",
      icon: h("span", null, "★"),
    })
  );
  els.push(
    h(TextControl, {
      key: "tc-trailing",
      "aria-label": "With a count",
      trailing: h("span", null, "12/120"),
    })
  );
  els.push(h(FormField, { key: "ff", label: "Label", hint: "Hint" }));
  // Боковая раскладка поля: своя сетка, отступ подписи и колонка пояснения —
  // без перебора эта ветка классов в разметке не появляется вовсе.
  els.push(
    h(FormField, {
      key: "ff-side",
      label: "Label",
      layout: "side",
      hint: "Hint",
    })
  );
  els.push(h(FormField, { key: "ff-side-err", label: "Label", layout: "side", error: "Error" }));
  els.push(h(PasswordInput, { key: "pi", "aria-label": "Password" }));
  els.push(h(PinInput, { key: "pin", value: "48", onChange: () => {}, label: "Code" }));
  els.push(
    h(MaskedInput, {
      key: "mi",
      mask: "+7 (999) 999-99-99",
      value: "916",
      onChange: () => {},
      "aria-label": "Phone",
    })
  );
  els.push(h(PhoneInput, { key: "ph", value: "916", onChange: () => {}, "aria-label": "Phone" }));
  els.push(h(InlineEdit, { key: "ie", value: "Name", onChange: () => {}, label: "Name" }));
  els.push(h(InlineEdit, { key: "ie-empty", value: "", onChange: () => {}, label: "Description" }));
  // Дерево: раскрытый узел, лист и флажок выбора — три ветки классов, каждая
  // появляется только в своём состоянии.
  for (const selectionMode of [undefined, "multiple"] as const)
    els.push(
      h(TreeView, {
        key: `tv-${selectionMode ?? "plain"}`,
        "aria-label": "Categories",
        selectionMode,
        defaultExpandedKeys: ["nature"],
        items: [
          { id: "nature", label: "Nature", children: [{ id: "forest", label: "Forest" }] },
          { id: "city", label: "City" },
        ],
      })
    );
  for (const columns of [1, 2] as const)
    els.push(
      h(
        FormLayout,
        { key: `fla-${columns}`, columns, labels: "side" },
        h(FormField, { key: "f", label: "Label" }),
        h(FieldRow, { key: "r" }, "full width")
      )
    );
  // Поле поиска: крестик существует только при непустом значении и только
  // во включённом состоянии, поэтому оба флага перебираются вместе со строкой.
  for (const value of ["", "sunset"])
    for (const clearable of [true, false])
      for (const disabled of [true, false])
        els.push(
          h(SearchControl, {
            key: `sc-${value || "empty"}-${clearable}-${disabled}`,
            value,
            clearable,
            disabled,
            label: "Search",
            onChange: () => {},
          })
        );
  els.push(
    h(SearchControl, {
      key: "sc-keyboard",
      value: "sunset",
      label: "Search with an on-screen keyboard",
      onChange: () => {},
      keyboard: { layout: "ru", onLayoutChange: () => {} },
    })
  );
  els.push(
    h(Keyboard, {
      key: "keyboard-ru",
      value: "sunset",
      selection: { start: 2, end: 2 },
      onChange: () => {},
      onSelectionChange: () => {},
      layout: "ru",
      onLayoutChange: () => {},
    }),
    h(Keyboard, {
      key: "keyboard-disabled",
      value: "",
      selection: { start: 0, end: 0 },
      onChange: () => {},
      onSelectionChange: () => {},
      layout: "en",
      onLayoutChange: () => {},
      disabled: true,
    })
  );
  // Вопросик справки: раскрытый поповер уходит в портал, ловим классы триггера.
  els.push(
    h(HelpTooltip, {
      key: "ht",
      label: "Help",
      children: h("span", null, "Hint"),
    })
  );
  // Диалог подтверждения — во всех характерах и в состоянии отправки.
  for (const kind of ["danger", "warning", "info"] as const)
    els.push(
      h(ConfirmDialog, {
        key: `cd-${kind}`,
        open: true,
        kind,
        title: "Title",
        message: "Hint",
        onClose: () => {},
        onConfirm: () => {},
      })
    );
  els.push(
    h(ConfirmDialog, {
      key: "cd-loading",
      open: true,
      loading: true,
      title: "Title",
      message: "Hint",
      onClose: () => {},
      onConfirm: () => {},
    })
  );
  // Свод горячих клавиш: группа с несколькими клавишами (разделитель) и с одной.
  els.push(
    h(ShortcutsHelp, {
      key: "sh",
      open: true,
      onOpenChange: () => {},
      groups: [
        {
          id: "nav",
          label: "Navigation",
          items: [
            { keys: ["Ctrl", "K"], description: "Search" },
            { keys: ["Esc"], description: "Close" },
          ],
        },
      ],
    })
  );
  // Шапка окна — в двух состояниях: с крестиком и без него (идёт отправка).
  for (const withClose of [true, false])
    els.push(
      h(ModalHeader, {
        key: `mh-${withClose ? "close" : "noclose"}`,
        title: "Title",
        subtitle: "Label",
        icon: h("span", null, "!"),
        onClose: withClose ? () => {} : undefined,
      })
    );
  // Раскрытый список живёт в портале и в статичную разметку не попадает —
  // проверяем классы триггера во всех его состояниях. Ось `searchable` на
  // триггер не влияет вовсе: поле поиска живёт в той же портальной панели,
  // поэтому здесь перебирается только `multiple` и наполнение выбора.
  for (const value of [null, "1"])
    for (const triggerClassName of [
      undefined,
      "w-full justify-between rounded-control px-3 py-2.5",
    ])
      for (const clearable of [true, false])
        els.push(
          h(Select, {
            key: `sel-${value ?? "empty"}-${triggerClassName ? "custom" : "default"}-${clearable}`,
            value,
            clearable,
            items: [{ id: "1", label: "Item", meta: 7 }],
            placeholder: "Category",
            onChange: () => {},
            triggerClassName,
          })
        );
  // Без акцентной подсветки: вид формы, а не фильтра.
  for (const value of [null, "1"])
    els.push(
      h(Select, {
        key: `sel-plain-${value ?? "empty"}`,
        value,
        highlightSelected: false,
        items: [{ id: "1", label: "Item", meta: 7 }],
        placeholder: "Category",
        onChange: () => {},
        triggerClassName: "w-full rounded-control px-3 py-2.5",
      })
    );
  // Мультивыбор: пусто, один (подпись элемента) и несколько (счётчик).
  for (const value of [[], ["1"], ["1", "2"]])
    els.push(
      h(Select, {
        key: `sel-multi-${value.length}`,
        multiple: true,
        value,
        items: [
          { id: "1", label: "Item", meta: 7 },
          { id: "2", label: "Second", meta: 3 },
        ],
        placeholder: "Category",
        countLabel: (n: number) => `Categories: ${n}`,
        onChange: () => {},
      })
    );
  // Календари рисуются целиком в разметке, поэтому берём их состояния прямо:
  // выбранное значение, границы и недоступные даты дают разные наборы классов
  // у ячейки, и мимо перебора ни один из них не проверяется.
  els.push(h(Calendar, { key: "cal", value: parseDate("2026-03-12") }));
  els.push(
    h(Calendar, {
      key: "cal-limits",
      defaultFocusedValue: parseDate("2026-03-01"),
      minValue: parseDate("2026-03-09"),
      maxValue: parseDate("2026-03-22"),
      isDateUnavailable: (date) => date.day === 15,
    })
  );
  for (const months of [1, 2] as const)
    els.push(
      h(RangeCalendar, {
        key: `rcal-${months}`,
        months,
        value: { start: parseDate("2026-03-09"), end: parseDate("2026-03-22") },
      })
    );
  // У пикеров раскрытая панель уходит в портал — ловим классы триггеров.
  for (const value of [null, "2026-03-12"])
    for (const disabled of [true, false])
      els.push(
        h(DatePicker, {
          key: `dp-${value ?? "empty"}-${disabled}`,
          value,
          disabled,
          onChange: () => {},
        })
      );
  for (const value of [null, { start: "2026-03-09", end: "2026-03-22" }])
    for (const period of [null, "30d"] as const)
      els.push(
        h(DateRangePicker, {
          key: `drp-${value ? "range" : "empty"}-${period ?? "none"}`,
          value,
          period,
          onChange: () => {},
        })
      );
  // С крестиком очистки: он появляется только при выбранном значении и только
  // когда обработчик передан, поэтому перебираются оба условия.
  for (const onClear of [() => {}, undefined])
    els.push(
      h(DateRangePicker, {
        key: `drp-clear-${onClear ? "on" : "off"}`,
        value: { start: "2026-03-09", end: "2026-03-22" },
        onClear,
        onChange: () => {},
      })
    );
  // Мусор в значении — не выдуманный случай: диапазон приходит из URL,
  // а URL правят руками. Матрица рендерится через `renderToStaticMarkup`,
  // поэтому падение на разборе даты уронит проверку покрытия — этого и хотим.
  els.push(
    h(DateRangePicker, {
      key: "drp-garbage",
      value: { start: "nonsense", end: "2026-03-22" },
      onChange: () => {},
    })
  );
  for (const zone of [undefined, "MSK"])
    for (const disabled of [true, false])
      els.push(
        h(DateTimePicker, {
          key: `dtp-${zone ?? "nozone"}-${disabled}`,
          date: "2026-03-12",
          time: "21:30",
          timeZoneLabel: zone,
          disabled,
          onDateChange: () => {},
          onTimeChange: () => {},
        })
      );
  for (const value of ["a", "b"])
    els.push(
      h(Segmented, {
        key: `sg-${value}`,
        value,
        onChange: () => {},
        options: [
          { value: "a", label: "First" },
          { value: "b", icon: h("span", null, "▯"), tooltip: "Second" },
        ],
      })
    );
  // Волна 7. `Link` здесь обязателен: его `QUIET_HOVER_CLASS` — таблица
  // литеральных `hover:text-*-strong` на каждый тон, то есть ровно тот случай,
  // ради которого покрытие классов и заведено. Пять строк, пять тонов, и без
  // этой матрицы ни одна из них не была бы проверена.
  const TEXT_SIZES: TextSize[] = ["caption", "xs", "sm", "md", "lg"];
  for (const size of TEXT_SIZES)
    for (const level of [1, 2, 3] as const)
      els.push(h(Text, { key: `tx-${size}-${level}`, size, level }, "text"));
  for (const tone of TONES) els.push(h(Text, { key: `tx-${tone}`, tone, weight: "bold" }, "text"));
  els.push(h(Text, { key: "tx-trunc", truncate: 2 }, "long text"));
  els.push(h(Text, { key: "tx-trunc1", truncate: true }, "long text"));
  els.push(h(Text, { key: "tx-num", numeric: "tabular" }, "0:11"));
  for (const level of [1, 2, 3, 4] as const)
    els.push(h(Heading, { key: `hd-${level}`, level }, "heading"));
  for (const size of ["md", "lg", "xl", "2xl"] as const)
    els.push(h(Heading, { key: `hd-s-${size}`, level: 2, size }, "heading"));
  els.push(h(Heading, { key: "hd-num", level: 2, numeric: "tabular" }, "1 280"));
  for (const variant of ["inline", "standalone", "quiet"] as const)
    for (const tone of TONES)
      els.push(h(Link, { key: `ln-${variant}-${tone}`, variant, tone, href: "#" }, "link"));
  els.push(h(Link, { key: "ln-ext", href: "#", external: true }, "external"));
  els.push(h(Link, { key: "ln-blank", href: "#", target: "_blank" }, "in a new tab"));
  for (const size of ["sm", "md"] as const) els.push(h(Kbd, { key: `kb-${size}`, size }, "K"));
  for (const spacing of ["none", "sm", "md"] as const)
    for (const orientation of ["horizontal", "vertical"] as const)
      els.push(h(Separator, { key: `sp-${spacing}-${orientation}`, spacing, orientation }));
  for (const orientation of ["vertical", "horizontal"] as const)
    els.push(h(ScrollArea, { key: `sa-${orientation}`, orientation, label: "List" }, "content"));
  els.push(h(AspectRatio, { key: "ar", ratio: 16 / 9 }, "image"));

  // Сетка: её классы и есть контракт, поэтому перебор полный — каждая клетка
  // словаря колонок на каждом брейкпойнте, каждая ширина автозаполнения, каждая
  // ступень зазора и каждый тег. Число (лестница) и объект идут разными путями
  // через один словарь, и проверяются оба.
  const GRID_COLUMNS = [1, 2, 3, 4, 5, 6] as const;
  for (const columns of GRID_COLUMNS) {
    els.push(h(Grid, { key: `gr-${columns}`, columns }, "cell"));
    for (const breakpoint of ["base", "sm", "md", "lg", "xl"] as const)
      els.push(
        h(Grid, { key: `gr-${breakpoint}-${columns}`, columns: { [breakpoint]: columns } }, "cell")
      );
  }
  for (const minItemWidth of [120, 160, 200, 240, 280, 320] as const)
    els.push(h(Grid, { key: `gr-min-${minItemWidth}`, minItemWidth }, "cell"));
  for (const gap of ["none", "xs", "sm", "md", "lg", "xl"] as const)
    els.push(h(Grid, { key: `gr-gap-${gap}`, gap }, "cell"));
  for (const as of ["ul", "ol"] as const)
    els.push(h(Grid, { key: `gr-${as}`, as, "aria-label": "Cells" }, h("li", null, "cell")));

  // Лента слайдов: класс ширины слайда и есть контракт, поэтому перебор полный —
  // каждая клетка словаря на каждом брейкпойнте. Скаляр и объект идут разными
  // путями через один словарь, и проверяются оба.
  for (const slidesPerView of [1, 2, 3, 4] as const) {
    els.push(
      h(
        Carousel,
        { key: `ca-${slidesPerView}`, "aria-label": "Slides", slidesPerView },
        h("div", null, "slide")
      )
    );
    for (const breakpoint of ["base", "sm", "md", "lg", "xl"] as const)
      els.push(
        h(
          Carousel,
          {
            key: `ca-${breakpoint}-${slidesPerView}`,
            "aria-label": "Slides",
            slidesPerView: { [breakpoint]: slidesPerView },
          },
          h("div", null, "slide")
        )
      );
  }
  // Панель действий: обе оси и разделитель в каждой. Разделитель без своего
  // `orientation` берёт его у панели, и в разметке должны быть обе ориентации.
  for (const orientation of ["horizontal", "vertical"] as const)
    els.push(
      h(
        Toolbar,
        { key: `tb-${orientation}`, "aria-label": "Tools", orientation },
        h(Button, { size: "sm" }, "One"),
        h(Separator, null),
        h(Button, { size: "sm" }, "Two")
      )
    );

  // Периферия волн 8–11. По ADR-0014 покрытие классов обязательно на ОБОИХ
  // уровнях: снимков у этих компонентов нет, и без матрицы их разметку не
  // сторожило бы ничего, кроме axe. Портальные части (`Drawer`,
  // `CommandPalette`, панель `Combobox`) сюда не попадают по той же причине,
  // что и тултип, — они рисуются вне статичной разметки.
  els.push(
    h(Combobox, {
      key: "cb",
      items: [{ id: "1", label: "Nature", meta: 12 }],
      "aria-label": "Category",
    })
  );
  els.push(
    h(TagInput, { key: "ti", value: ["sunset", "mountains"], onChange: () => {}, label: "Tags" })
  );
  // Метка для показа: каждый оттенок палитры, ссылка, удаление и пустая группа.
  els.push(
    h(
      TagGroup,
      { key: "tg-hues", label: "Categories", onRemove: () => {} },
      ...LABEL_HUES.map((hue) => h(Tag, { key: hue, id: hue, hue, children: hue }))
    ),
    h(
      TagGroup,
      { key: "tg-links", "aria-label": "Related" },
      h(Tag, { id: "design", href: "/posts?category=design", hue: "teal", children: "Design" }),
      h(Tag, { id: "docs", children: "Docs" })
    ),
    h(TagGroup, { key: "tg-empty", label: "Empty categories", empty: "No categories" })
  );
  els.push(h(Slider, { key: "sl", label: "Quality", defaultValue: 40 }));
  els.push(h(RangeSlider, { key: "rsl", label: "Size", defaultValue: [20, 80], minGap: 10 }));
  els.push(h(FileDropzone, { key: "fd", onFiles: () => {}, hint: "no more than 5 MB" }));
  els.push(
    h(
      Accordion,
      { key: "ac", defaultExpandedKeys: ["a"] },
      h(AccordionItem, { id: "a", title: "Expanded" }, "text"),
      h(AccordionItem, { id: "b", title: "Collapsed", disabled: true }, "text")
    )
  );
  els.push(
    h(Breadcrumbs, {
      key: "bc",
      items: [
        { label: "Root", href: "#" },
        { label: "Section", href: "#" },
        { label: "Second", href: "#" },
        { label: "Third", href: "#" },
        { label: "Current" },
      ],
    })
  );
  els.push(h(Pagination, { key: "pg", page: 7, pageCount: 24, onChange: () => {} }));
  els.push(
    h(Stepper, {
      key: "st",
      current: 1,
      onStepClick: () => {},
      steps: [
        { id: "a", label: "Files", hint: "12 photos" },
        { id: "b", label: "Description" },
        { id: "c", label: "Schedule" },
      ],
    })
  );
  for (const tone of TONES)
    els.push(
      h(ToggleGroup, {
        key: `tg-${tone}`,
        tone,
        "aria-label": "Statuses",
        options: [
          { id: "a", label: "First" },
          { id: "b", icon: h("span", null, "▯"), "aria-label": "Second" },
        ],
        value: ["a"],
        onChange: () => {},
      })
    );
  els.push(
    h(
      ButtonGroup,
      { key: "bg", "aria-label": "View" },
      h(Button, { variant: "outline" }, "List"),
      h(Button, { variant: "outline" }, "Tile")
    )
  );
  // `CodeView` с шапкой и гутером: обе части необязательны, и без экземпляра с
  // ними гейт покрытия увидел бы только `pre`.
  els.push(
    h(CodeView, {
      key: "code-view",
      code: '{\n  "id": 4821\n}',
      title: "response.json",
      copyable: true,
      lineNumbers: true,
    })
  );
  // Три состояния `Rating` сразу: закрашенная звезда, незакрашенная и показ без
  // ввода. Токен `--rating-star` встречается только здесь.
  els.push(
    h(Rating, { key: "rating", value: 3, onChange: () => {}, "aria-label": "Quality" }),
    h(Rating, {
      key: "rating-ro",
      value: 4,
      readOnly: true,
      size: "sm" as const,
      caption: "4.2",
      "aria-label": "Quality",
    })
  );
  // `ColorPicker` в закрытом виде: раскрытая панель живёт в портале и в
  // статическую разметку матрицы не попадает, а свои классы у компонента —
  // оболочка поля и образец цвета.
  els.push(
    h(ColorPicker, {
      key: "color-picker",
      value: "#4f7df3",
      onChange: () => {},
      label: "Brand colour",
    })
  );
  // `TreeSelect` в закрытом виде: раскрытое дерево уже покрыто `TreeView`, а
  // здесь свои классы только у поля — оболочка, чипы и крестик очистки.
  els.push(
    h(TreeSelect, {
      key: "tree-select",
      items: [{ id: "a", label: "Company", children: [{ id: "b", label: "Sales" }] }],
      value: ["b"],
      onChange: () => {},
      multiple: true,
      clearable: true,
      "aria-label": "Division",
    }),
    // Второй экземпляр — пустое одиночное поле: подсказка и подпись выбранного
    // лежат в других ветках, и без него гейт зелёный случайно.
    h(TreeSelect, {
      key: "tree-select-empty",
      items: [{ id: "a", label: "Company" }],
      value: [],
      onChange: () => {},
      "aria-label": "Division",
    })
  );
  // `Transfer` стоит здесь ради полей поиска, шапок колонок и кнопок переноса:
  // у `ListBoxItem` класс один статический литерал, и варианты `selected:` /
  // `disabled:` гейт видит из него независимо от состояния. Экземпляр с
  // выключенным элементом и поиском полезен аудиту axe, а не покрытию.
  els.push(
    h(Transfer, {
      key: "transfer",
      items: [
        { id: "a", label: "View reports" },
        { id: "b", label: "Delete records", disabled: true },
        { id: "c", label: "Export data" },
      ],
      value: ["c"],
      onChange: () => {},
      searchable: true,
    })
  );
  // Обе оси `SplitPanel`: у ручки и границ разные классы, и без второго
  // экземпляра гейт покрытия увидит только вертикальную полосу. Третий стоит
  // схлопнутым: `hidden` у панели — единственное состояние, в котором
  // раскладки нет вовсе.
  els.push(
    h(
      SplitPanel,
      { key: "sp-side", position: "side" as const, "aria-label": "Details", panel: "Details" },
      "List"
    ),
    h(
      SplitPanel,
      { key: "sp-bottom", position: "bottom" as const, "aria-label": "Details", panel: "Details" },
      "List"
    ),
    h(
      SplitPanel,
      { key: "sp-collapsed", collapsed: true, "aria-label": "Details", panel: "Details" },
      "List"
    )
  );
  // Раскрыватель у `SplitButton` — квадратная кнопка RAC рядом с обычной:
  // сочетание классов группы, `iconOnly` и вида кнопки не встречается больше
  // нигде, и без экземпляра гейт покрытия его не увидит.
  els.push(
    h(
      SplitButton,
      { key: "split-solid", label: "Export", variant: "solid", tone: "accent" },
      h(MenuItem, { key: "x" }, "Export to XLSX")
    ),
    h(
      SplitButton,
      { key: "split-outline", label: "Create", variant: "outline", size: "sm" },
      h(MenuItem, { key: "d" }, "Create a draft")
    )
  );
  els.push(
    h(Table<{ id: string; name: string }>, {
      key: "tb",
      "aria-label": "Photos",
      items: [{ id: "r1", name: "Night city" }],
      selectedKeys: new Set(["r1"]),
      onSelectionChange: () => {},
      sort: { column: "name", direction: "ascending" },
      onSortChange: () => {},
      stickyHeader: true,
      columns: [
        { id: "name", header: "Name", cell: (w: { name: string }) => w.name, sortable: true },
        { id: "size", header: "Size", cell: () => "2 MB", align: "end" as const },
      ],
    }),
    // Раскрытая строка: у детальной ячейки и кнопки-раскрывателя свои классы,
    // и без второго экземпляра гейт покрытия их не увидит.
    h(Table<{ id: string; name: string }>, {
      key: "table-detail",
      "aria-label": "Expansion",
      items: [{ id: "1", name: "Row" }],
      columns: [{ id: "name", header: "Name", cell: (r: { name: string }) => r.name }],
      renderDetail: () => "Details",
      expandedKeys: new Set(["1"]),
      onExpandedChange: () => {},
    })
  );
  for (const tone of TONES) els.push(h(Badge, { key: `bd-${tone}`, tone }, 5));
  els.push(h(Badge, { key: "bd-dot", dot: true }));
  for (const tone of TONES)
    els.push(
      h(Stat, {
        key: `sn-${tone}`,
        label: "Subscribers",
        value: "12 480",
        delta: "+320",
        deltaTone: tone,
        hint: "this week",
      })
    );
  els.push(
    h(DescriptionList, {
      key: "dl",
      items: [{ label: "Size", value: "2.4 MB" }],
    })
  );
  els.push(
    h(DescriptionList, {
      key: "dl2",
      layout: "stack",
      items: [{ label: "Description", value: "text" }],
    })
  );
  els.push(
    h(AvatarGroup, { key: "ag", names: ["Ada Lovelace", "Grace H", "Alan T", "Barbara L"] })
  );
  els.push(
    h(AvatarGroup, {
      key: "agp",
      names: [{ name: "Ada Lovelace", src: "/ada.png" }, "Grace H", { name: "Alan T" }],
    })
  );

  // У тултипа содержимое живёт в портале и в статичной разметке не появляется;
  // проверяем хотя бы то, что обёртка не съедает классы обёрнутой кнопки.
  els.push(
    h(
      Tooltip,
      { key: "tt", content: "Hint", children: h(Button, { tone: "accent" }, "Anchor") },
      null
    )
  );

  // Карточка-превью: триггер — ссылка со своим действием, панель открыта сразу,
  // чтобы её классы и разметка тоже попали под проверки матрицы.
  els.push(
    h(HoverCard, {
      key: "hover-card",
      defaultOpen: true,
      children: h(
        Fragment,
        null,
        h(
          HoverCardTrigger,
          null,
          h("a", { href: "#profile", className: "text-accent-strong underline" }, "Ada Lovelace")
        ),
        h(HoverCardContent, null, h("p", { className: "text-fg-1 p-3 text-sm" }, "Mathematician"))
      ),
    })
  );

  /*
   * Оболочка приложения. Рендерится в ОБОИХ режимах навигации: развёрнутая и
   * схлопнутая раскладки дают разные классы (`w-[var(--sidenav-w)]` против
   * `-collapsed`, `sr-only` у подписи, `justify-center` у пункта), и без
   * второго прохода половина осталась бы непокрытой.
   *
   * `AppShell` идёт без `sidebar`: колонка навигации уже отрисована ниже
   * отдельно, а внутри каркаса она добавила бы к ней ещё и копию в `Drawer` —
   * содержимое портала в статичной разметке всё равно не появляется.
   */
  els.push(
    h(AppShell, {
      key: "shell",
      header: h(TopBar, { brand: "Olddevs" }),
      bottomBar: h(
        MobileTabBar,
        null,
        // Все состояния пункта: текущий и обычный, число, точка, свой текст
        // значка, подпись без иконки и пункт через `asChild`.
        h(MobileTabBarItem, { label: "Home", href: "#", active: true, icon: h("span") }),
        h(MobileTabBarItem, { label: "Inbox", href: "#", icon: h("span"), badge: 3 }),
        h(MobileTabBarItem, { label: "Alerts", href: "#", icon: h("span"), badge: true }),
        h(MobileTabBarItem, {
          label: "Mail",
          href: "#",
          icon: h("span"),
          badge: 120,
          badgeLabel: "120 unread messages",
        }),
        h(MobileTabBarItem, { label: "Beta", href: "#", icon: h("span"), badge: "New" }),
        h(MobileTabBarItem, {
          label: "Custom",
          href: "#",
          icon: h("span"),
          badge: h("span", { className: "size-2 rounded-full bg-warning-strong" }),
          badgeLabel: "Needs attention",
        }),
        h(MobileTabBarItem, { label: "Text only", href: "#" }),
        h(
          MobileTabBarItem,
          { label: "Routed", asChild: true, icon: h("span") },
          h("a", { href: "#" })
        )
      ),
      children: "Content",
    })
  );
  // Та же полоса вне каркаса: подложка без хвоста под вырез — своя строка словаря.
  els.push(
    h(MobileTabBar, {
      key: "mtb-standalone",
      "aria-label": "Shortcuts",
      children: h(MobileTabBarItem, { label: "Home", href: "#", active: true, icon: h("span") }),
    })
  );

  for (const collapsed of [false, true])
    els.push(
      h(
        NavCollapsedProvider,
        { key: `nav-${collapsed}`, value: collapsed },
        h(SideNav, {
          collapsed,
          header: "Logo",
          footer: "User",
          children: h(NavGroup, {
            label: "Work",
            children: [
              h(NavItem, {
                key: "n1",
                label: "Dashboard",
                href: "#",
                active: true,
                icon: h("span"),
              }),
              h(NavItem, {
                key: "n2",
                label: "Activity",
                href: "#",
                icon: h("span"),
                badge: h("span", null, "7"),
                shortcut: h("span", null, "⌘N"),
              }),
            ],
          }),
        })
      )
    );

  els.push(
    h(DataTable<{ id: string; name: string }>, {
      key: "datatable",
      "aria-label": "Dense table",
      columns: [{ id: "name", header: "Name", cell: (r: { name: string }) => r.name }],
      items: [{ id: "1", name: "Row" }],
      state: { ...DEFAULT_TABLE_STATE, density: "compact" as const },
      onStateChange: () => {},
    })
  );

  els.push(
    h(FilterBar, {
      key: "filters",
      filters: [
        { id: "a", field: "section", value: "c", label: "Section: Contracts" },
        { id: "b", field: "section", value: "d", label: "Section: Reports" },
      ],
      onFiltersChange: () => {},
    })
  );

  els.push(
    h(TableToolbar, {
      key: "toolbar",
      title: "Documents",
      count: 12,
      actions: h(Button, { size: "sm" }, "Create"),
      filters: h("div", null, "Filters"),
    })
  );

  els.push(
    h(TablePreferences, {
      key: "prefs",
      columns: [
        { id: "name", label: "Name", required: true },
        { id: "section", label: "Section" },
      ],
      hiddenColumns: new Set<string>(),
      onHiddenColumnsChange: () => {},
      columnOrder: [],
      onColumnOrderChange: () => {},
      density: "comfortable" as const,
      onDensityChange: () => {},
    })
  );

  // Радикс требует провайдер над каждым тултипом и падает без него. Провайдер
  // здесь — часть контракта примитива, а не декорация теста: то же самое обязан
  // поставить у себя потребитель, о чём написано в docs/components/overlays/tooltip.md.
  return h(TooltipProvider, null, h(Fragment, null, els));
}
