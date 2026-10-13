# Каталог компонентов

Каталог перечисляет компоненты кита по группам: у каждого есть ссылка на
страницу, экспорты и пояснение, что это за компонент и для чего он нужен. Близкие
компоненты (например, разные виды переключателей) описаны на одной странице.

## Действия и обратная связь

- [Button](actions/button.md): `Button` — кнопка, которая запускает действие: сохранить, отправить, открыть окно
- [Chip](actions/chip.md): `Chip` — компактная кнопка-фильтр, которую можно включить и выключить
- [SplitButton](actions/split-button.md): `SplitButton` — кнопка с главным действием и выпадающим списком других вариантов рядом
- [Toolbar](actions/toolbar.md): `Toolbar` — панель из кнопок и переключателей, например над полотном или полем ввода; по ней двигаются стрелками
- [Toggles](actions/toggles.md): `Toggle`, `Segmented`, `ToggleGroup`, `ButtonGroup` —
  переключатели: включить или выключить одну настройку, выбрать один режим из
  нескольких, отметить несколько независимых вариантов, собрать обычные кнопки в ряд
- [Feedback](actions/feedback.md): `Alert`, `Banner`, `Progress`, `Spinner`, `Toaster`,
  `toast`, `StatusBadge` — сообщения и индикаторы: уведомление на месте или на всё
  приложение, тост, полоса прогресса, индикатор ожидания, цветная
  метка статуса
- [CopyButton и Truncate](actions/copy-and-truncate.md): `CopyButton`, `Truncate` —
  кнопка «Скопировать» с подтверждением и обрезка длинного текста с подсказкой
  полного значения

## Поля ввода

- [TextControl](inputs/text-control.md): `TextControl` — базовое текстовое поле: одна строка или многострочный текст, с иконкой и плейсхолдером внутри; на нём построены остальные поля ввода
- [RichTextEditor](inputs/rich-text-editor.md): `RichTextEditor`, хук `useRichTextEditorState`, Пресеты `RICH_TEXT_PRESETS`, свой Инструмент (`CustomTool`) — редактор форматированного текста: заголовки, списки, ссылки, выделение слов (жирный, курсив, цвет). Подходит для длинных статей и описаний, значение хранится как HTML. Отдельный вход `@olddevs/ui/editor`; движок Tiptap потребитель ставит сам — командой со страницы
- [API расширения Редактора](../api/editor-extension.md) — справочник для тех, кто дописывает Редактор своими Инструментами, кнопками и Загрузчиками: что можно подключить и что не изменится между версиями
- [NumberInput](inputs/number-input.md): `NumberInput` — поле для числа с кнопками «больше» и «меньше», границами и форматированием; пустое поле даёт `null`, а не ноль
- [Choice controls](inputs/choice-controls.md): `Checkbox`, `CheckboxGroup`, `Radio`, `RadioGroup` — флажки и радиокнопки: отметить несколько независимых вариантов или выбрать ровно один из набора
- [Select](inputs/select.md): `Select` — выпадающий список: выбрать значение только из заранее заданного набора, нового создать нельзя
- [Combobox](inputs/combobox.md): `Combobox` — поле со списком вариантов при вводе: можно выбрать из списка, а можно ввести своё значение, которого в списке нет
- [TagInput](inputs/tag-input.md): `TagInput` — поле, в котором пользователь сам набирает несколько коротких значений-тегов, разделяя их Enter или запятой
- [Transfer](inputs/transfer.md): `Transfer` — две колонки «доступно» и «выбрано» с переносом элементов между ними; для выбора многих значений из большого списка
- [TreeSelect](inputs/tree-select.md): `TreeSelect` — выпадающее поле для выбора узла из иерархии: отдел в оргструктуре, категория в каталоге
- [ColorPicker](inputs/color-picker.md): `ColorPicker` — выбор любого цвета: палитра, полоса тона и ввод кода цвета; отдельный вход `@olddevs/ui/color`
- [SwatchGroup](inputs/swatch-group.md): `SwatchGroup` — выбор одного варианта из набора цветных образцов, например теги или категории; можно выбрать только оттенки из палитры кита, а не любой цвет
- [Rating](inputs/rating.md): `Rating` — оценка звёздами: пользователь ставит число баллов отзыву, товару или материалу
- [Slider](inputs/slider.md): `Slider`, `RangeSlider` — шкала с ползунком: `Slider` выбирает одно число, `RangeSlider` задаёт нижнюю и верхнюю границы диапазона
- [SearchControl](inputs/search-control.md): `SearchControl` — поле поиска с лупой и кнопкой очистки; запрос не выполняет, только собирает строку для вашего поиска
- [FileDropzone](inputs/file-dropzone.md): `FileDropzone` — область, в которую перетаскивают файлы или выбирают их кнопкой; проверяет тип и размер и объясняет отказ, но сама ничего не загружает
- [UploadQueue](inputs/upload-queue.md): `UploadQueue` — список загружаемых файлов с состоянием каждого (ожидает, грузится, готов, ошибка) и действиями: повторить, отменить, убрать
- [PasswordInput](inputs/password-input.md): `PasswordInput` — поле пароля с кнопкой «показать» и предупреждением о включённом Caps Lock
- [MaskedInput](inputs/masked-input.md): `MaskedInput`, `formatMask`, `unmask`, `maskCapacity` — поле, которое подставляет разделители по шаблону при вводе: дата, номер документа, номер счёта
- [PhoneInput](inputs/phone-input.md): `PhoneInput`, `RU_PHONE_MASK` — поле телефона с готовой российской маской; для другого формата берите `MaskedInput`
- [PinInput](inputs/pin-input.md): `PinInput` — ввод кода подтверждения по одной цифре в отдельной ячейке; код, вставленный из SMS, раскладывается по ячейкам сам
- [InlineEdit](inputs/inline-edit.md): `InlineEdit` — значение, которое меняют прямо на месте: клик превращает его в поле, Enter подтверждает, Escape отменяет
- [Form](inputs/form.md): `Form`, `FormField` — форма с общей отправкой: на время запроса она блокируется; `FormField` связывает поле с подписью, пояснением и ошибкой
- [FormLayout](inputs/form-layout.md): `FormLayout`, `FieldRow` — раскладка полей формы: одна или две колонки, подписи сверху или слева; ничего не проверяет и не отправляет

## Дата и время

- [Calendar](date-time/calendar.md): `Calendar`, `NAV_BUTTON_CLASS`,
  `WEEKDAY_CELL_CLASS` — сетка месяца для выбора одной даты, без поля и выпадающего окна: для собственной раскладки, обычно проще взять `DatePicker`
- [RangeCalendar](date-time/range-calendar.md): `RangeCalendar` — сетка из одного или двух месяцев для выбора периода от даты до даты, без поля и пресетов: для собственной раскладки, обычно проще взять `DateRangePicker`
- [DatePicker](date-time/date-picker.md): `DatePicker`, `formatDate` — поле выбора одной даты: по клику открывается календарь, значение хранится строкой `YYYY-MM-DD`
- [DateRangePicker](date-time/date-range-picker.md): `DateRangePicker` — поле выбора периода «с — по» с быстрыми вариантами вроде «7 дней» и кнопкой очистки, например для фильтра или отчёта
- [DateTimePicker](date-time/date-time-picker.md): `DateTimePicker`,
  `maskTime`, `normalizeTime` — пара полей для даты и времени вместе, например срок публикации или начало события; дата и время хранятся отдельно
- [TimePicker](date-time/time-picker.md): `TimePicker`, `upcomingSlots` — поле времени `ЧЧ:ММ`: можно напечатать точное время или выбрать из списка ближайших слотов

## Оверлеи

- [Dialog](overlays/dialog.md): `Dialog`, `ModalHeader`, `ModalOverlay` —
  модальное окно поверх страницы для формы или просмотра: пока оно открыто,
  работать с остальным экраном нельзя
- [ConfirmDialog](overlays/confirm-dialog.md): `ConfirmDialog` — короткое окно с вопросом «точно
  сделать?» перед удалением или другим необратимым действием; для форм берите `Dialog`
- [ShortcutsHelp](overlays/shortcuts-help.md): `ShortcutsHelp` — окно со списком
  сочетаний клавиш приложения, разложенных по разделам
- [Drawer](overlays/drawer.md): `Drawer` — панель, выезжающая сбоку или снизу поверх страницы: в ней
  можно просмотреть или отредактировать запись, не уходя с экрана
- [Popover](overlays/popover.md): `Popover`, `PopoverAnchor`, `PopoverClose`,
  `PopoverContent`, `PopoverTrigger` — небольшая панель с любым содержимым, которая
  открывается по клику рядом с кнопкой; основа для выпадающих блоков и календарей
- [HoverCard](overlays/hover-card.md): `HoverCard`, `HoverCardContent`,
  `HoverCardTrigger` — карточка с подробностями, которая появляется при наведении на имя
  или ссылку: аватар, должность, начало документа
- [Tooltip](overlays/tooltip.md): `Tooltip`, `TooltipContent`,
  `TooltipProvider`, `TooltipRoot`, `TooltipTrigger`, `HelpTooltip` — короткая
  текстовая подсказка при наведении или фокусе, например подпись к кнопке с иконкой;
  `HelpTooltip` — готовая иконка «?» с пояснением к полю
- [Menu](overlays/menu.md): `Menu`, `MenuButton`, `MenuItem`, `MenuSection`,
  `MenuSeparator`, `MenuTrigger`, `SubmenuTrigger` — выпадающий список команд по клику
  на кнопку, например «Переименовать» и «Удалить»; выбор значения в поле — это `Select`
- [Context menu](overlays/context-menu.md): `ContextMenu`,
  `ContextMenuCheckboxItem`, `ContextMenuContent`, `ContextMenuItem`,
  `ContextMenuLabel`, `ContextMenuRadioGroup`, `ContextMenuRadioItem`,
  `ContextMenuSeparator`, `ContextMenuSub`,
  `ContextMenuSubContent`, `ContextMenuSubTrigger`, `ContextMenuTrigger` — меню команд, которое открывается
  правой кнопкой мыши над файлом, строкой таблицы или карточкой
- [Command palette](overlays/command-palette.md): `CommandPalette` — окно быстрого поиска
  по командам приложения: пользователь вводит несколько букв и сразу запускает нужное действие

## Таблица

Готовые компоненты для списков сущностей поверх низкоуровневой `Table`.

- [DataTable](table/data-table.md): `DataTable` — готовая таблица для списка сущностей: настройки колонок и плотности, состояния загрузки и ошибки, полоса с фильтрами и действиями над таблицей
- [Table toolbar](table/toolbar.md): `TableToolbar`, `TablePreferences` — полоса над таблицей с заголовком, счётчиком и действиями, а также меню настроек: какие колонки показать, в каком порядке и насколько плотно
- [FilterBar](table/filter-bar.md): `FilterBar`, `FilterBarAdd` — ряд применённых фильтров, каждый из которых можно снять, и кнопка добавления нового; для списков, где фильтров несколько и набор меняется
- [SavedViews](table/saved-views.md): `SavedViews` — переключатель сохранённых наборов фильтров вроде «Мои» или «Черновики», которые пользователь создаёт сам и к которым возвращается одним щелчком

## Оболочка приложения

Компоненты, собранные из примитивов: каркас страницы, её навигация и шапка.

- [AppShell](app-shell/app-shell.md): `AppShell`, `useAppShell` — каркас страницы приложения: боковая навигация слева, шапка сверху, содержимое посередине; сам следит за мобильным режимом, фокусом при смене экрана и ссылкой «к содержимому»
- [SideNav](app-shell/side-nav.md): `SideNav`, `NavGroup`, `NavItem`, `useNavCollapsed` — боковое меню приложения: разделы с пунктами-ссылками, текущий пункт подсвечен, меню можно свернуть до иконок
- [MobileTabBar](app-shell/mobile-tab-bar.md): `MobileTabBar`, `MobileTabBarItem` — нижняя панель с главными разделами для телефона (до пяти пунктов): переход в один тап, на широком экране её заменяет `SideNav`
- [TopBar](app-shell/top-bar.md): `TopBar` — шапка приложения с логотипом, поиском и действиями (уведомления, профиль); отличается от `PageHeader`, который задаёт заголовок самой страницы
- [SplitPanel](app-shell/split-panel.md): `SplitPanel`, `useMediaQuery` — две области рядом или друг над другом с разделителем, который пользователь перетаскивает мышью: например, список и детали выбранной строки

## Навигация

- [Tabs](navigation/tabs.md): `Tabs` — ряд вкладок для переключения между равноправными представлениями одного экрана; панель с содержимым выводите сами
- [Accordion](navigation/accordion.md): `Accordion`, `AccordionItem` — список секций, которые раскрываются и сворачиваются по клику: FAQ, настройки, длинная страница из самостоятельных разделов
- [Breadcrumbs](navigation/breadcrumbs.md): `Breadcrumbs` — цепочка ссылок «Раздел / Подраздел / Страница», по которой видно, где пользователь, и можно вернуться на уровень выше
- [Pagination](navigation/pagination.md): `Pagination`, `pageRange` — переключатель страниц для длинной выдачи: номера, соседние страницы, переход к первой и последней; `pageRange` считает, какие номера показать
- [Stepper](navigation/stepper.md): `Stepper` — индикатор шагов мастера, импорта или оформления заказа: показывает текущий шаг и позволяет вернуться к уже пройденному
- [MegaMenu](navigation/mega-menu.md): `MegaMenu`, `MegaMenuCategory`, `MegaMenuGroup`, `MegaMenuLink`, `MegaMenuTrigger`, `MegaMenuButton` — каталог магазина в духе Amazon: столбец категорий, а справа от наведённой — Полка с колонками ссылок; курсор можно вести к Полке наискосок, категория под ним не перехватит наведение; та же разметка открывается выпадающим оверлеем от кнопки «Каталог»
- [TreeView](navigation/tree-view.md): `TreeView` — дерево с раскрываемыми ветками для категорий, папок и разделов; узлы можно выбирать, в том числе флажками
- [Selection bar](navigation/selection-bar.md): `SelectionBar`, `useStickyOffset` — полоса над списком или сеткой, где выбрано несколько объектов: показывает «Выбрано 12», кнопки массовых действий и сброс выделения
- [Contextual save bar](navigation/contextual-save-bar.md): `ContextualSaveBar` — полоса внизу окна, которая появляется после первой правки формы и предлагает сохранить или отменить несохранённые изменения
- [Page header](navigation/page-header.md): `PageHeader` — шапка страницы: главный заголовок, пояснение под ним и основные действия вроде «Создать» или «Загрузить»; один на страницу
- [Section header](navigation/section-header.md): `SectionHeader` — заголовок блока внутри страницы или карточки со счётчиком, ссылкой или маленькой кнопкой справа; для заголовка самой страницы есть `PageHeader`

## Содержимое

- [Typography](content/typography.md): `Text`, `Heading`, `Link` — текст страницы: заголовки нужного уровня, абзацы и подписи, ссылки для перехода по URL
- [Card](content/card.md): `Card` — панель с фоном, рамкой и отступом, которая отделяет самостоятельный блок от фона страницы; содержимое в неё кладут сами
- [Image](content/image.md): `Image` — картинка, которая показывает загрузку и заглушку, если URL пустой или файл не открылся
- [Timeline](content/timeline.md): `Timeline` — последовательность шагов процесса, где у каждого шага свой итог и любой может завершиться ошибкой: конвейер задачи, история публикации
- [CodeView](content/code-view.md): `CodeView` — блок с кодом или данными только для чтения, который можно скопировать целиком: ответ API, конфиг, тело вебхука; подсветку даёт помощник `highlightCodeNodes` из `@olddevs/ui/editor/highlight`
- [Notifications](content/notifications.md): `NotificationItem`, `NotificationList`, `NotificationCenter` — лента уведомлений в поповере или на странице: что произошло, когда, прочитано ли; в отличие от `toast`, остаётся на экране
- [MediaCard](content/media-card.md): `MediaCard` — плитка с превью, на которое наложены бейджи и кнопки; плитку можно выбрать среди других: кадры, документы, обложки
- [SortableList](content/sortable-list.md): `SortableList` — короткий список, который пользователь переставляет перетаскиванием: разделы меню, шаги сценария, приоритеты; списки одной `group` обмениваются строками: так собирается канбан-доска
- [EditableList](content/editable-list.md): `EditableList` — список, строки которого можно править на месте и переставлять перетаскиванием, а сам список — пополнять снизу: чек-лист, задачи; если нужен только порядок, хватит `SortableList`
- [RichTextView](content/rich-text-view.md): `RichTextView` — показ готового форматированного текста из Редактора без самого Редактора; отдельный вход `@olddevs/ui/editor`, годится серверному компоненту
- [VirtualGrid](content/virtual-grid.md): `VirtualGrid` — сетка из сотен и тысяч превью, которая отрисовывает только видимые ячейки и позволяет их выбирать; для десятка карточек хватит `Grid`
- [Avatar](content/avatar.md): `Avatar`, `AvatarGroup` — круглое изображение человека: фото или, если его нет, инициалы; `AvatarGroup` показывает нескольких участников со счётчиком остатка «+N»
- [Data display](content/data-display.md): `Badge`, `Stat`, `DescriptionList`, `Table` — четыре способа показать данные: счётчик или метка, ключевой показатель с пояснением, пары «свойство и значение», таблица однотипных записей
- [Empty and loading](content/empty-and-loading.md): `EmptyState`, `ErrorState`, `Skeleton` — три состояния экрана без данных: заглушка при пустом результате, сообщение о сбое с повтором, серый каркас, пока данные грузятся
- [Layout primitives](content/layout-primitives.md): `Separator`, `ScrollArea`, `AspectRatio`, `Kbd` — мелкие элементы раскладки: разделитель, прокручиваемый блок, область с заданными пропорциями, обозначение клавиши в тексте
- [Grid](content/grid.md): `Grid` — сетка равных колонок, число которых меняется по ширине экрана: карточки тарифов, плитки показателей; для сотен элементов нужен `VirtualGrid`
- [TagGroup](content/tag-group.md): `TagGroup`, `Tag` — набор тегов для показа рядом с записью: категории, проекты, статусы; тег можно сделать цветным, удаляемым или ссылкой, но не выбираемым
- [Carousel](content/carousel.md): `Carousel` — горизонтальный ряд слайдов, который листают кнопками, свайпом и клавишами-стрелками, чтобы подборка занимала одну строку: галерея, рекомендации
- [Keyboard and hidden text](content/keyboard.md): `Keyboard`, `VisuallyHidden` — экранная клавиатура для ввода в существующее поле касанием или мышью и текст, скрытый на экране, но доступный скринридеру

`@olddevs/ui/icons` и exports из `lib/`/`hooks/` — не компоненты. Их описание
находится в [icons.md](../icons.md) и [`api/utilities.md`](../api/utilities.md).
