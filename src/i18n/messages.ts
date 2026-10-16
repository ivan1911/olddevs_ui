/**
 * Каталог сообщений кита: тип и форма значения.
 *
 * Пространство имён — на семью компонентов; строки, которые встречаются в
 * нескольких семьях, живут в `common` и не дублируются. Правило простое: если
 * подпись значит одно и то же в двух местах, у неё один ключ.
 *
 * ФОРМА ЗНАЧЕНИЯ. Простое сообщение — строка. Параметризованное — функция
 * `(vars) => string`, а не ICU-шаблон. Параметризованных из девяноста строк
 * кита девять, из них три со склонением, и ради них тащить в бандл потребителя
 * парсер ICU несоразмерно. Цена решения записывается прямо: файл локали
 * перестаёт быть данными и становится кодом, поэтому во внешний TMS он не
 * отдаётся как есть. Решение — ADR-0002.
 *
 * Склонение живёт ВНУТРИ файла локали и делается `Intl.PluralRules`: правила
 * знает локаль, а не компонент. Компонент, который считает окончания, — это
 * компонент, который умеет только один язык.
 */

/** Подписи, общие для нескольких семей. Дублировать их в семьях нельзя. */
export interface CommonMessages {
  /** Крестик закрытия: `Alert`, `ModalHeader`, `Dialog`, `Keyboard`. */
  close: string;
  /** Сброс значения: `Select`, `DateRangePicker`, `SearchControl`. */
  clear: string;
  /** Поиск не дал результата: `Select`, `Combobox`, `CommandPalette`. */
  notFound: string;
  /** Данных нет вовсе — в отличие от `notFound`, где есть запрос. */
  empty: string;
  /** Идёт загрузка: `Spinner`. */
  loading: string;
  /** Плейсхолдер поля поиска. */
  searchPlaceholder: string;
}

export interface UiMessages {
  common: CommonMessages;

  alert: {
    /**
     * Своя подпись, а не `common.close`: у сообщения крестик закрывает ИМЕННО
     * сообщение, и скринридер обязан это сказать. Обобщение до «Закрыть»
     * стоило бы конкретности имени — ровно того, ради чего подпись есть.
     */
    close: string;
  };

  banner: {
    /**
     * Своя подпись, а не `common.close`: баннер закрывает СООБЩЕНИЕ УРОВНЯ
     * ПРИЛОЖЕНИЯ, и «Закрыть» рядом с крестиком шапки или диалога звучало бы
     * одинаково для разных вещей. Та же причина, что у `alert.close`.
     */
    close: string;
  };

  breadcrumbs: {
    label: string;
    /** Подсказка у свёрнутых звеньев. */
    collapsed: (vars: { count: number }) => string;
  };

  combobox: {
    /** Подпись кнопки, раскрывающей список подсказок. */
    showSuggestions: string;
  };

  commandPalette: {
    title: string;
    placeholder: string;
    /** Подсказка при пустом запросе. */
    emptyHint: string;
  };

  confirmDialog: {
    confirm: string;
    cancel: string;
    /** Подпись поля подтверждения вводом (`typeToConfirm`): что именно надо набрать. */
    typeToConfirm: (vars: { text: string }) => string;
    /** Подсказка под этим полем: по какому правилу сверяется набранное. */
    typeToConfirmHint: string;
  };

  datePicker: {
    placeholder: string;
  };

  dateRangePicker: {
    placeholder: string;
  };

  errorState: {
    title: string;
  };

  fileDropzone: {
    label: string;
    browse: string;
    /** Причина отказа: файл больше лимита. Размер уже отформатирован. */
    tooLarge: (vars: { size: string }) => string;
    /** Причина отказа: пришло несколько файлов, а принимается один. */
    singleFileOnly: string;
    /** Причина отказа: папки не принимаются. */
    foldersNotAccepted: string;
    /** Причина отказа: тип файла не подходит под `accept`. */
    wrongType: string;
    /** Причина отказа: файл не удалось прочитать. */
    unreadable: string;
    /** Подставляется вместо имени, когда у элемента его нет: это папка. */
    folderName: string;
  };

  filterBar: {
    /** Доступное имя набора применённых фильтров. */
    label: string;
    /**
     * Имя кнопки снятия — БЕЗ подписи фильтра.
     *
     * react-aria сам дописывает к имени кнопки подпись своего тега
     * (`aria-labelledby` на кнопку и на тег), и «Снять фильтр Раздел: Договоры»
     * превращалось в «…Раздел: Договоры Раздел: Договоры». Скринридер всё
     * равно читает фильтр — его добавляет библиотека.
     */
    remove: string;
    clear: string;
    /** Кнопка добавления фильтра и подписи её полей. */
    add: string;
    field: string;
    value: string;
    apply: string;
    /**
     * Диапазон (ADR-0063): подписи двух полей ввода и три формы подписи
     * токена. Токен собирается как «Поле: <форма>» — «Сумма: 50–100»,
     * «Сумма: от 50», «Дата: до 12 марта». Границы приходят уже
     * отформатированными по локали `UiProvider`.
     */
    fromField: string;
    toField: string;
    rangeBetween: (vars: { from: string; to: string }) => string;
    rangeFrom: (vars: { from: string }) => string;
    rangeTo: (vars: { to: string }) => string;
  };

  maskedInput: {
    /**
     * Символ не подошёл под маску.
     *
     * Говорит, ЧЕГО ждали, а не «неверный ввод»: пользователь, услышавший
     * второе, знает ровно столько же, сколько до объявления. Эталонная
     * реализация USWDS провалила на этом тест WCAG 3.3.3 — отброшенный ввод
     * там не объявляется вовсе.
     */
    rejected: (vars: { expected: "digit" | "letter" | "any" }) => string;
    /** Маска заполнена целиком — месту для нового символа взяться неоткуда. */
    full: string;
    /**
     * Вставленное значение длиннее маски, и хвост в поле не попал.
     *
     * Отдельно от `full`, потому что это ДРУГОЙ отказ: там места не было
     * изначально, здесь часть значения принята, а часть отброшена. Молчать
     * нельзя — обрезка даёт правдоподобный результат: `89161234567` под
     * маской телефона превращается в `+7 (891) 612-34-56`, то есть в чужой
     * номер, и ни компонент, ни глаз этого не замечают.
     */
    truncated: (vars: { count: number }) => string;
  };

  inlineEdit: {
    /**
     * Хвост доступного имени кнопки-значения: «Ежедневная подборка, изменить».
     *
     * Имя строится из СОДЕРЖИМОГО, а не задаётся `aria-label`: значение
     * обязано быть в имени, иначе скринридер объявляет «изменить название» и
     * не читает то, что там сейчас написано.
     */
    edit: string;
    /** Подпись пустого значения на кнопке. */
    empty: string;
  };

  keyboard: {
    /** Имя виджета целиком; раскладка — данные, а не перевод. */
    label: (vars: { layout: KeyboardLayoutName }) => string;
    close: string;
    /** Подпись ручки перетаскивания. */
    move: string;
    switchLayout: string;
    switchLayoutTo: (vars: { layout: KeyboardLayoutName }) => string;
    showSymbols: string;
    showLetters: (vars: { layout: KeyboardLayoutName }) => string;
    showPrimarySymbols: string;
    showExtraSymbols: string;
    backspace: string;
    space: string;
    submit: string;
    /** Имена символьных клавиш: озвучиваются, но не рисуются. */
    keyComma: string;
    keyPeriod: string;
    keyLess: string;
    keyGreater: string;
    keySemicolon: string;
    keyColon: string;
  };

  link: {
    /** Только для скринридера: ссылка откроется в новой вкладке. */
    opensInNewTab: string;
  };

  numberInput: {
    decrement: (vars: { label: string }) => string;
    increment: (vars: { label: string }) => string;
  };

  nav: {
    /** Доступное имя `<nav>` сайдбара. */
    label: string;
    /**
     * Подписи кнопки сворачивания. Две, а не одна с подстановкой: кнопка
     * называет ДЕЙСТВИЕ, и «свернуть»/«развернуть» — разные действия, а не
     * одно с параметром.
     */
    collapse: string;
    expand: string;
  };

  mobileTabBar: {
    /** Доступное имя `<nav>` нижней полосы разделов. */
    label: string;
    /**
     * Текст точки «есть новое» для скринридера.
     *
     * Точка — сигнал для глаз и текста в разметке не несёт: без этой строки
     * пункт с точкой звучит так же, как без неё.
     */
    new: string;
    /**
     * Имя числового счётчика пункта: голое «3» рядом с названием раздела
     * ни о чём не говорит. Настоящее число, а не «99+» с экрана.
     */
    newCount: (vars: { count: number }) => string;
  };

  pagination: {
    label: string;
    previous: string;
    next: string;
  };

  passwordInput: {
    /**
     * Подпись кнопки показа — ОДНА на оба состояния.
     *
     * Состояние объявляет `aria-pressed`, а не подпись: кнопка-переключатель,
     * у которой меняется и имя, и состояние, читается дважды и противоречиво
     * («Скрыть пароль, нажато»). Правило APG — имя постоянно, меняется признак.
     */
    toggle: string;
    /** Предупреждение о включённом Caps Lock. */
    capsLock: string;
  };

  pinInput: {
    /** Имя одного поля кода: без него скринридер читает N безымянных полей. */
    digit: (vars: { index: number; total: number }) => string;
  };

  searchControl: {
    clear: string;
    openKeyboard: string;
  };

  selectionBar: {
    label: string;
    clearSelection: string;
    /** Со склонением: 1 выбран, 2 выбрано, 5 выбрано. */
    count: (vars: { count: number }) => string;
  };

  shell: {
    /**
     * Первая фокусируемая ссылка страницы: перескочить навигацию и уйти в
     * `<main>`. Видима только под фокусом, но это НЕ sr-only текст —
     * клавиатурный пользователь без скринридера видит её глазами.
     */
    skipToContent: string;
    /** Кнопка, открывающая навигацию ящиком на узких экранах. */
    openNavigation: string;
  };

  spinner: {
    label: string;
  };

  stepper: {
    label: string;
    /**
     * Состояние шага для озвучки: пройден или впереди.
     *
     * Состояние выражалось ТОЛЬКО кружком с номером или галочкой, а он помечен
     * `aria-hidden`. Скринридер читал мастер из пяти одинаковых пунктов и
     * текущий — какие уже заполнены, а какие впереди, не сообщалось никак.
     *
     * ТЕКУЩЕГО ШАГА ЗДЕСЬ НЕТ: его объявляет `aria-current="step"`, и своя
     * строка давала бы «current step, current step, Оплата».
     */
    state: (vars: { state: "done" | "upcoming" }) => string;
  };

  table: {
    empty: string;
    selectAll: string;
    selectRow: string;
    /** Доступное имя колонки-раскрывателя: без него столбец безымянный. */
    expandColumn: string;
    /**
     * Подписи кнопки раскрытия. Две, потому что это разные действия.
     *
     * Принимают имя строки: одинаковое «Показать подробности» у двадцати строк
     * даёт скринридеру в режиме перечисления кнопок двадцать одинаковых имён.
     * Имя необязательно — его даёт `rowLabel`, а его у таблицы может не быть;
     * ветвление живёт в файле локали, как и склонение.
     */
    expandRow: (vars: { row?: string }) => string;
    collapseRow: (vars: { row?: string }) => string;
  };

  tablePreferences: {
    columns: string;
    density: string;
    comfortable: string;
    compact: string;
    /** Подписи кнопок порядка называют колонку: иначе они неразличимы. */
    moveUp: (vars: { column: string }) => string;
    moveDown: (vars: { column: string }) => string;
  };

  tableToolbar: {
    /** Сколько записей всего. Со склонением: 1 запись, 2 записи, 5 записей. */
    total: (vars: { count: number }) => string;
    /** Доступное имя кнопки настроек таблицы. */
    preferences: string;
  };

  tagInput: {
    /**
     * Имя кнопки снятия — БЕЗ имени тега.
     *
     * react-aria сам дописывает к имени кнопки подпись своего тега, и
     * «Убрать тег альфа» превращалось в «…альфа альфа». Найдено ревью волны 18
     * вычислением доступного имени; тот же дефект был у `FilterBar`.
     */
    remove: string;
    add: string;
    addTo: (vars: { label: string }) => string;
  };

  tagGroup: {
    /**
     * Имя кнопки удаления — С подписью метки внутри («Удалить: Дизайн»).
     *
     * В отличие от `tagInput.remove` подпись вписана в ЭТУ строку, а не
     * дописывается react-aria: порядок слов принадлежит языку, и «Удалить: X»
     * не везде строится как «глагол плюс имя». Поэтому на кнопке отключён
     * `aria-labelledby` react-aria — иначе имя читалось бы дважды.
     */
    remove: (vars: { label: string }) => string;
  };

  copyButton: {
    /** Обычное состояние кнопки. */
    copy: string;
    /** Получилось. Объявляется, а не только меняет иконку. */
    copied: string;
    /**
     * Не получилось.
     *
     * Отказ буфера — законный исход: в небезопасном контексте
     * `navigator.clipboard` отсутствует вовсе, а запись может быть запрещена
     * разрешениями. Молчать об этом значит показать пользователю кнопку,
     * которая ничего не делает.
     */
    failed: string;
  };

  mediaCard: {
    /**
     * Подпись кнопки выбора. Состояние в неё НЕ входит: его объявляет
     * `aria-pressed`, и «Выбрано, снять выбор» прозвучало бы дважды.
     */
    select: string;
  };

  notifications: {
    /** Доступное имя списка событий. */
    label: string;
    /**
     * Слово рядом с непрочитанным событием.
     *
     * Точка и подложка — сигнал для глаз; без этой строки человек, который их
     * не видит, не отличит новое событие от старого вовсе.
     */
    unread: string;
    /** Имя счётчика непрочитанных: голое «3» ни о чём не говорит. */
    unreadCount: (vars: { count: number }) => string;
  };

  editableList: {
    /**
     * Имя ручки перетаскивания — ТОЛЬКО глагол.
     *
     * Своё, а не общее с `sortableList`: два компонента, делящие один ключ,
     * ломаются молча, когда у одного из них подпись понадобится другая.
     */
    drag: string;
    /**
     * Что показать вместо пустого названия строки.
     *
     * Строка с пустым значением — не ошибка данных: правку могли подтвердить
     * пустой. Показывать нечего, а строка при этом обязана остаться видимой и
     * правимой, иначе исправить её нечем.
     */
    emptyValue: string;
  };

  sortableList: {
    /**
     * Имя ручки перетаскивания — ТОЛЬКО глагол.
     *
     * Подпись строки react-aria дописывает сама («Перетащить Отчёт за март»);
     * повторив её здесь, мы получили бы её дважды — тот же урок, что с
     * кнопками внутри `TagGroup` в ревью 2.1.0.
     */
    drag: string;
  };

  contextualSaveBar: {
    /** Доступное имя полосы. */
    label: string;
    /** Умолчание, когда число правок не передано. */
    unsaved: string;
    /** То же с числом: склонение делает локаль, а не компонент. */
    changes: (vars: { count: number }) => string;
    save: string;
    cancel: string;
    /** Ход сохранения — объявляется, а не только рисуется на кнопке. */
    saving: string;
  };

  savedViews: {
    /** Доступное имя группы переключателей вида. */
    label: string;
  };

  uploadQueue: {
    /** Доступное имя списка очереди. */
    label: string;
    /**
     * Итог очереди для скринридера: частичный успех иначе виден только глазами.
     *
     * Склонение делает файл локали через `Intl.PluralRules` — правила знает
     * локаль, а не компонент.
     */
    summary: (vars: { done: number; total: number; failed: number }) => string;
    /** Имя полосы прогресса, когда имя файла — не строка. */
    progress: string;
    /** Имя полосы прогресса конкретного файла. */
    itemProgress: (vars: { name: string }) => string;
  };

  treeView: {
    /**
     * Имя кнопки раскрытия — БЕЗ имени узла: react-aria дописывает подпись
     * своего элемента сам, и «Раскрыть Природа» превращалось бы в
     * «…Природа Природа» (урок ревью волны 18).
     */
    expand: string;
    collapse: string;
    /** Имя флажка выбора узла. */
    select: string;
  };

  timePicker: {
    label: string;
    /** Маска ввода: буквы часов и минут на языке локали. */
    placeholder: string;
    /** Маска ввода при `hourCycle={12}`. */
    placeholder12: string;
    /** Подпись времени до полудня на 12-часовых часах. */
    am: string;
    /** Подпись времени после полудня на 12-часовых часах. */
    pm: string;
  };

  topbar: {
    /**
     * Доступное имя `<header>`. Нужно даже при единственной шапке: во
     * встроенном виджете она перестаёт быть уникальным `banner` документа.
     */
    label: string;
  };

  rating: {
    /** Значение словами — единственный носитель величины для скринридера. */
    value: (vars: { value: number; total: number }) => string;
    /** Имя отдельной звезды в радиогруппе. */
    star: (vars: { index: number; total: number }) => string;
  };

  colorPicker: {
    /** Подпись ряда пресетов. */
    presets: string;
    /**
     * Подпись поля ввода. Всегда про шестнадцатеричный формат: поле такое и
     * есть, а `outputFormat` меняет только строку наружу.
     */
    hex: string;
  };

  treeSelect: {
    /** Подпись закрытого поля, когда ничего не выбрано. */
    placeholder: string;
    /** Свёрнутый хвост чипов: «ещё 4». */
    more: (vars: { count: number }) => string;
  };

  transfer: {
    /** Подпись левой колонки по умолчанию. */
    source: string;
    /** Подпись правой колонки по умолчанию. */
    target: string;
    /** Имя кнопки «вправо». */
    moveToTarget: string;
    /** Имя кнопки «влево». */
    moveToSource: string;
    /**
     * Имя поля поиска внутри колонки.
     *
     * Параметризовано подписью колонки: полей поиска на экране два, и «Поиск» у
     * обоих не различает их ничем.
     */
    searchIn: (vars: { list: string }) => string;
  };

  splitPanel: {
    /** Имя ручки, когда у панели нет своего имени. */
    resize: string;
    /**
     * Имя ручки, когда панель названа: «Изменить размер: Детали заказа».
     *
     * Два ключа, а не подстановка пустой строки: ручек на экране бывает
     * несколько, и «Изменить размер» у каждой не различает их ничем.
     */
    resizeNamed: (vars: { panel: string }) => string;
    /** Текущий размер словами — `aria-valuetext` ползунка. */
    size: (vars: { size: number }) => string;
  };

  splitButton: {
    /**
     * Доступное имя раскрывателя, построенное из подписи главного действия.
     *
     * Параметризовано намеренно: раскрывателей на странице обычно несколько, и
     * без подписи действия они неразличимы в речи — «кнопка», «кнопка»,
     * «кнопка».
     */
    more: (vars: { action: string }) => string;
  };

  period: {
    /** Подписи пресетов периода: 7 дней, этот месяц и так далее. */
    presets: Record<PeriodPresetKey, string>;
    /** Длина периода со склонением: 1 день, 2 дня, 5 дней. */
    length: (vars: { days: number }) => string;
  };

  carousel: {
    /**
     * Что скринридер называет регионом: `aria-roledescription` — это текст для
     * слуха, а не токен ARIA, и на русском интерфейсе английское «carousel»
     * прозвучало бы чужим словом.
     */
    roleDescription: string;
    /** То же для слайда: «слайд, 2 из 5». */
    slideRoleDescription: string;
    /** Имя кнопки «назад». */
    previous: string;
    /** Имя кнопки «вперёд». */
    next: string;
    /** Имя слайда: положение в ленте. Слово «слайд» добавляет роль, не имя. */
    slide: (vars: { index: number; total: number }) => string;
  };

  megaMenu: {
    /**
     * Строка возврата на узком экране: открытая Категория заменяет Столбец, и
     * эта кнопка возвращает его. Имя кнопки — одно слово без названия
     * Категории: название стоит рядом текстом, а регион им уже подписан.
     */
    back: string;
  };

  shortcutsHelp: {
    /** Заголовок окна по умолчанию. Он же доступное имя диалога. */
    title: string;
    /**
     * Имя прокручиваемой области со списком. Своё, а не повтор заголовка:
     * одинаковые имена у окна и у региона внутри него скринридер объявил бы
     * дважды подряд.
     */
    list: string;
    /**
     * Слово между клавишами сочетания, только для слуха: «Ctrl плюс K».
     *
     * Видимый «+» скринридеры читают по-разному — NVDA на умолчательном уровне
     * пунктуации его опускает, и «Ctrl K» звучит как две отдельные клавиши, а не
     * как сочетание. Слово из каталога снимает зависимость от настроек.
     */
    keySeparator: string;
  };

  /**
   * Редактор форматированного текста — отдельный вход `@olddevs/ui/editor`
   * (ADR-0050). Строки живут в общем каталоге, а не в своём: локаль
   * потребитель подключает одной строкой на весь кит, и второй каталог ради
   * подпути он бы просто не нашёл.
   */
  editor: {
    /**
     * Доступное имя поля, когда его не дали ни `aria-label`, ни подпись
     * `FormField`. Без него скринридер объявил бы безымянное «поле ввода».
     */
    label: string;
    /** Плейсхолдер пустого документа по умолчанию. */
    placeholder: string;
    /** Счётчик при `maxLength`, начиная с 80 % предела: «Осталось 12 символов». */
    remaining: (vars: { count: number }) => string;
    /**
     * Документ длиннее предела — пришёл таким в `value`. Своя строка, а не
     * отрицательное «осталось»: «Осталось −3 символа» читается как опечатка.
     */
    overLimit: (vars: { count: number }) => string;
    /**
     * Пузырь браузера на пустом обязательном редакторе. Своя строка, а не
     * родное «Please fill out this field»: оно живёт в языке браузера и не
     * следует за локалью кита.
     */
    required: string;
    /**
     * Имя Панели (`role="toolbar"`). Безымянную панель скринридер объявляет
     * просто «панель инструментов», не говоря, к чему она относится.
     */
    toolbar: string;
    /**
     * Имя меню выделения (`toolbar="bubble"`, `role="toolbar"`). Своё, а не
     * «Форматирование» Панели: это другой набор кнопок, и скринридер должен
     * отличать плашку над выделением от Панели над полем.
     */
    selectionToolbar: string;
    /**
     * Прежний список стиля текста на Панели («Стиль текста: Абзац»).
     *
     * @deprecated Панель его больше не читает: тип Блока выбирают в меню
     * «¶» (`blockType`). Ключ оставлен, чтобы частичный каталог потребителя с
     * ним компилировался; уйдёт в 4.0.0.
     */
    textStyle: (vars: { current: string }) => string;
    /**
     * Меню «¶» — тип Блока: имя кнопки (и меню), когда под
     * кареткой нет текстового Блока — выделена картинка или разделитель.
     */
    blockTypeMenu: string;
    /**
     * Имя кнопки меню «¶» с текущим типом Блока: «Тип блока: Заголовок 2».
     * Иконка кнопки показывает тип глазу, имя — скринридеру; без значения в
     * имени он узнал бы тип, только открыв меню.
     */
    blockType: (vars: { current: string }) => string;
    /**
     * Меню «…»: имя кнопки и меню с редкими метками, маркером,
     * цветом текста и очисткой стилей. Текущего значения в имени нет: у меню
     * много независимых отметок, и одно значение кнопка не назовёт.
     */
    moreFormatting: string;
    /**
     * Пункт «обычный текст» меню «¶». Не `paragraph`: в Меню вставки тот же
     * Блок называется «Абзац», а меню «¶» говорит словами образца — «Текст».
     */
    textBlock: string;
    /** Пункт «обычный абзац» в разделе «Превратить в» Меню вставки. */
    paragraph: string;
    /** Заголовок уровня `level` (1–4) — пункт меню «¶» и Меню вставки, значение на кнопке «¶». */
    heading: (vars: { level: number }) => string;
    /**
     * Меню вставки: имя кнопки «+» на Панели и имя списка, который открывает
     * `/` в тексте. Одно имя на оба входа — это одно меню.
     */
    insertMenu: string;
    /** Раздел меню вставки: новый Блок после текущего. */
    insertSection: string;
    /** Раздел меню вставки: сменить тип текущего Блока, сохранив текст. */
    turnIntoSection: string;
    /**
     * Строка меню вставки, когда набранное после `/` ничему не отвечает. Без
     * неё пустой список выглядел бы зависшим, а скринридер не услышал бы ничего.
     */
    nothingFound: string;
    /**
     * Имя списка своего символа-триггера (`@`, `#`), у которого потребитель не
     * задал `label`: список подсказок рядом с кареткой.
     */
    triggerList: string;
    bold: string;
    italic: string;
    underline: string;
    strike: string;
    /** Строчный код — метка внутри абзаца, не блок кода. */
    code: string;
    superscript: string;
    subscript: string;
    /** Снять все метки с выделения. */
    clearFormatting: string;
    /** Ссылка: кнопка Панели и имя поповера ссылки. */
    link: string;
    /** Подпись поля адреса в поповере ссылки. */
    linkAddress: string;
    /** Применить адрес — то же, что Enter в поле. */
    linkApply: string;
    /** Снять ссылку, оставив текст. Есть, когда каретка уже в ссылке. */
    linkRemove: string;
    /**
     * Адрес не принят: чужая схема (`javascript:`, `ftp:`), относительный путь
     * или пробел внутри. Называет, что принимается, — иначе непонятно, что
     * исправлять.
     */
    linkInvalid: string;
    bulletList: string;
    orderedList: string;
    /** Чек-лист: пункты с флажками. */
    taskList: string;
    blockquote: string;
    codeBlock: string;
    /**
     * Кнопка языка у блока кода: имя включает текущий язык, как у
     * меню цвета, — «Language: Python». Имена языков — данные
     * (`codeLanguages.ts`), они не переводятся; блок без языка называется
     * `codeLanguagePlain`.
     */
    codeLanguage: (vars: { current: string }) => string;
    /** Блок кода без языка: без подсветки и без `class` в Документе. */
    codeLanguagePlain: string;
    /**
     * Подсказка кнопки «копировать» в шапке блока кода: «Copy code». Имя
     * кнопки и «Скопировано» берутся из `copyButton` — как у кита везде.
     */
    codeCopy: string;
    /** Разделитель — горизонтальная черта между Блоками. */
    horizontalRule: string;
    undo: string;
    redo: string;
    /**
     * Имя флажка у пункта чек-листа. Флажок рисует движок, и без этой строки
     * скринридер слышал бы английское «Task item checkbox for …». Пустой пункт
     * приходит с `text: ""`.
     */
    taskCheckbox: (vars: { text: string }) => string;
    /**
     * Имя кнопки «Маркер» включает текущий цвет словом — образец глазу, имя
     * слуху. Цвет назван оттенком, а не ролью токена:
     * автор выбирает «красный», а не `danger`, и имя переводится.
     */
    highlight: (vars: { current: string }) => string;
    /** Пункт «снять цвет текста» и его подпись на триггере без цвета. */
    colorDefault: string;
    /** Пункт «снять маркер» и подпись триггера без маркера. */
    highlightNone: string;
    /**
     * Подсказка кнопки «Маркер» на Панели и в плашке меню выделения: щелчок
     * открывает ряд маркеров. Имя кнопки — `highlight` с текущим.
     */
    highlightToggle: string;
    /** «Убрать маркер» — последняя ячейка ряда и сетки маркеров, иконка с подсказкой. */
    highlightRemove: string;
    /** «Убрать цвет» — последняя ячейка сетки «Цвет текста», иконка с подсказкой. */
    colorRemove: string;
    /**
     * Кнопка «Цвет»: буква «A» текущего цвета, открывает сетки
     * цвета текста и маркера. Это же имя у её поповера.
     */
    color: string;
    /** Имя кнопки «Цвет» с текущим цветом текста: «Цвет: Красный». */
    colorMenu: (vars: { current: string }) => string;
    /** Заголовки сеток поповера «Цвет». */
    textColorSection: string;
    highlightSection: string;
    /** Имена цветов текста (`EDITOR_TEXT_COLORS` в `src/editor/styles/palette.ts`). */
    colorAccent: string;
    colorSuccess: string;
    colorWarning: string;
    colorDanger: string;
    colorLime: string;
    colorMuted: string;
    /** Имена цветов маркера (`EDITOR_MARKERS`): девять кружков сетки, по оттенку. */
    markerGray: string;
    markerBrown: string;
    markerOrange: string;
    markerYellow: string;
    markerGreen: string;
    markerBlue: string;
    markerPurple: string;
    markerPink: string;
    markerRed: string;
    /**
     * Произвольный цвет через `ColorPicker`: пункт у заголовка каждой сетки
     * поповера «Цвет». Многоточие — признак того, что пункт открывает окно, а
     * не применяет цвет.
     */
    colorCustom: string;
    /** Цвет автора в имени кнопки: «Цвет: Свой #00aa55», «Маркер: Свой #ffe066». */
    colorCustomCurrent: (vars: { hex: string }) => string;
    /** Имя поповера произвольного цвета текста. */
    customColorText: string;
    /** Имя поповера произвольного цвета маркера. */
    customColorHighlight: string;
    /** Кнопка выбора цвета в поповере: видимая подпись называет значение. */
    customColorValue: (vars: { hex: string }) => string;
    customColorApply: string;
    customColorCancel: string;
    /**
     * Предупреждение о контрасте цвета текста с фоном Редактора текущей темы
     * (WCAG 1.4.3, 4.5:1). Предупреждает, а не запрещает.
     */
    customColorLowContrastText: (vars: { ratio: string }) => string;
    /** То же для маркера: меряется основной текст Редактора на этой подложке. */
    customColorLowContrastHighlight: (vars: { ratio: string }) => string;
    /** Цвет автора не сменяется вместе с темой, в отличие от цветов палитры. */
    customColorThemeNote: string;
    /**
     * Выравнивание Блока: пункты меню «Выравнивание» и строки
     * справочника сочетаний. Имя каждого самодостаточно.
     */
    alignLeft: string;
    alignCenter: string;
    alignRight: string;
    /**
     * Меню «Выравнивание»: имя кнопки и меню с текущим
     * выравниванием — «Выравнивание: по центру». Иконка кнопки показывает его
     * глазу, имя — скринридеру. Умолчание (`left`) — тоже значение: Блок без
     * `data-align` выровнен влево.
     */
    alignMenu: (vars: { current: "left" | "center" | "right" }) => string;
    /**
     * Меню «Списки»: имя кнопки и меню с текущим видом списка —
     * «Список: нумерованный»; `null` — каретка не в списке, и имя просто
     * называет меню.
     */
    listMenu: (vars: { current: "bulletList" | "orderedList" | "taskList" | null }) => string;
    /**
     * Таблица. `table` — пункт Меню вставки, кнопка Панели и имя её
     * меню (как у TinyMCE: одна кнопка «Таблица ▾» на вставку и на действия), и
     * пункт этого меню с сеткой размера. `tableInsertDialog` — пункт, который
     * открывает окно с числовыми полями, `tableInsertDialogTitle` — заголовок
     * окна. `tableCell`, `tableRow`, `tableColumn`, `tableSort` — подменю.
     * Имя каждого пункта подменю самодостаточно: «Вставить строку выше», а не
     * «Выше» под заголовком «Строка» — скринридер читает пункт, а не его раздел.
     */
    table: string;
    tableInsertDialog: string;
    tableInsertDialogTitle: string;
    tableCell: string;
    tableRow: string;
    tableColumn: string;
    tableSort: string;
    tableMergeCells: string;
    tableSplitCell: string;
    tableAddRowBefore: string;
    tableAddRowAfter: string;
    tableAddColumnBefore: string;
    tableAddColumnAfter: string;
    tableDeleteRow: string;
    tableDeleteColumn: string;
    /** Пункт-переключатель: первая строка таблицы — заголовки столбцов. */
    tableHeaderRow: string;
    /** Выравнивание столбца под кареткой: пункты-радиокнопки подменю «Столбец». */
    tableAlignLeft: string;
    tableAlignCenter: string;
    tableAlignRight: string;
    tableSortAscending: string;
    tableSortDescending: string;
    /**
     * Почему сортировка недоступна: в таблице есть слитые ячейки, и строку
     * нельзя переставить, не разрезав слияние. Подпись раздела подменю.
     */
    tableSortMerged: string;
    tableDelete: string;
    /** Отмена в окне «Вставить таблицу». */
    tableCancel: string;
    /** Картинка: кнопка Панели, пункт Меню вставки и имя поповера картинки. */
    image: string;
    /** Подпись поля адреса картинки в поповере. */
    imageAddress: string;
    /**
     * Адрес картинки не принят: `data:`, `blob:`, относительный путь или чужая
     * схема. Называет, что принимается, — иначе непонятно, что исправлять.
     */
    imageInvalid: string;
    /** Подпись поля альтернативного текста. */
    imageAlt: string;
    /**
     * Подсказка под полем альтернативного текста: зачем оно и что значит
     * пустое. Без неё поле выглядит обязательным, а пустое — ошибкой.
     */
    imageAltHint: string;
    /** Вставить картинку по адресу — то же, что Enter в поле. */
    imageInsert: string;
    /** Применить изменения существующей картинки. */
    imageApply: string;
    /** Выбрать файл с устройства — есть, когда потребитель дал `onUploadImage`. */
    imageChooseFile: string;
    /** Убрать картинку из Документа. */
    imageRemove: string;
    /** Открыть поповер выделенной картинки: адрес, описание и ширина. */
    imageEdit: string;
    /** Имя группы пресетов ширины и плавающей панели картинки. */
    imageWidth: string;
    /** Пресет ширины: «50 %». Функцией — у языков свой знак процента и пробел перед ним. */
    imageWidthPreset: (vars: { percent: number }) => string;
    /** Подсказка пустой подписи картинки. Подпись необязательна — строка это говорит. */
    imageCaption: string;
    /** Плейсхолдер на месте загружаемой картинки и сообщение живого региона. */
    imageUploading: (vars: { name: string }) => string;
    /** Живой регион: картинка загружена и встала в Документ. */
    imageUploaded: (vars: { name: string }) => string;
    /**
     * Загрузка не удалась (`onUploadImage` отклонил обещание или вернул адрес
     * вне политики). Документ при этом не меняется.
     */
    imageUploadFailed: (vars: { name: string }) => string;
    /** Файл из буфера или перетаскивания — не картинка. */
    imageNotImage: (vars: { name: string }) => string;
    /**
     * Файл вставлен или перетащен, а загрузчика нет (`onUploadImage` не
     * передан). Подсказывает, как вставить картинку иначе.
     */
    imageFilesUnsupported: string;
    /**
     * Ошибка поля: Редактор не запустился — набор Инструментов собран с
     * ошибкой (ADR-0058, п. 1.5 и 2.4). Причину разработчик видит в консоли;
     * автору — что поле не работает и что Документ не тронут.
     */
    toolsFailed: string;
    /**
     * Кнопка у ошибки поля, когда упал загрузчик Extensions (сеть,
     * устаревший чанк): заново зовёт упавшие загрузчики (ADR-0058, п. 11.6).
     */
    retry: string;
    /**
     * Живой регион: у текста появилась Карточка своего Инструмента (ADR-0058,
     * п. 6.8). `label` — подпись записи, `shortcut` — сочетание, которое ведёт в
     * Карточку (`Alt+F10`). Функцией: подпись и клавиша стоят в середине фразы.
     */
    textCardShown: (vars: { label: string; shortcut: string }) => string;
    /**
     * Сетка выбора размера таблицы. `tableGrid` — имя сетки; `tableSize` — размер
     * словами («3 столбца, 4 строки») для имени ячейки и живой области: в русском
     * склонение по числу, поэтому функция, а не две строки. `tableColumns`,
     * `tableRows` — имена числовых полей, `tableInsert` — кнопка под ними.
     */
    tableGrid: string;
    tableSize: (vars: { cols: number; rows: number }) => string;
    tableColumns: string;
    tableRows: string;
    tableInsert: string;
    /**
     * Раскладка — Блок из колонок. `layout` — пункт Меню вставки и
     * подменю «Добавить › Раскладка ›» у ручки Блока; `layoutVariant` — имена
     * шести вариантов («Две колонки», «60/40»), пункты подменю и «Формат ›».
     * Ключи — имена вариантов Схемы (`editor/features/layout/columnLayouts.ts`).
     */
    layout: string;
    layoutVariant: Record<EditorLayoutVariant, string>;
    /**
     * Обёртка — Блок, собирающий группу Блоков. `wrapper` — пункт
     * Меню вставки и «Добавить ›» у ручки Блока; `unwrap` — пункт меню ручки,
     * который снимает Обёртку и оставляет её Блоки на месте.
     */
    wrapper: string;
    unwrap: string;
    /**
     * Тон Обёртки — подменю «Тон ›» меню ручки Обёртки.
     * `wrapperTone` — имя пункта с текущим тоном («Тон: Заметка»), как имя
     * кнопки «¶» с текущим типом; `wrapperToneNone` — пункт «Без тона» и
     * текущее значение Обёртки без тона; `wrapperToneName` — имена тонов
     * словами GitHub alerts (Заметка, Совет, Важно, Внимание, Осторожно), ключи
     * — имена `data-tone`. Слово, а не цвет: тон выбирают по смыслу заметки.
     */
    wrapperTone: (vars: { current: string }) => string;
    wrapperToneNone: string;
    wrapperToneName: Record<EditorWrapperTone, string>;
    /**
     * Сворачиваемый Блок (Details). `details` — пункт Меню вставки и «Добавить ›»
     * у ручки Блока; `unwrapDetails` — пункт меню ручки: Блок перестаёт
     * сворачиваться, заголовок становится абзацем, а содержимое остаётся на месте.
     * `detailsToggle` — имя кнопки раскрытия: движок рисует кнопку без текста,
     * и без имени скринридер слышал бы «кнопка». Имя называет Блок его
     * заголовком (`text` — текст summary, пустой у Блока без заголовка), а
     * раскрыт он или нет, говорит `aria-expanded`. Функцией: заголовок стоит в
     * середине фразы.
     */
    details: string;
    unwrapDetails: string;
    detailsToggle: (vars: { text: string }) => string;
    /**
     * Формулы (Mathematics, ADR-0070). `mathInline` и `mathBlock` — пункты Меню
     * вставки и «Добавить ›» у ручки Блока, они же имена рамки Поповера формулы.
     * В Поповере: `mathLatex` — подпись поля, `mathPreview` — имя области
     * предпросмотра, `mathEmpty` — её подсказка, пока поле пусто, `mathInvalid` —
     * ошибка в поле (`detail` — сообщение KaTeX: движок его не переводит, оно
     * по-английски), `mathInsert` и `mathApply` — кнопка новой и правимой формулы,
     * `mathRemove` — убрать правимую формулу из Документа.
     */
    mathInline: string;
    mathBlock: string;
    mathLatex: string;
    mathPreview: string;
    mathEmpty: string;
    mathInvalid: (vars: { detail: string }) => string;
    mathInsert: string;
    mathApply: string;
    mathRemove: string;
    /**
     * Эмодзи. `emoji` — имя кнопки Панели; `emojiGrid` — имя сетки в поповере.
     * `emojiCategory` — названия категорий, `emojiName` — имя каждого эмодзи:
     * скринридер читает ячейку по имени, а не по символу (разные программы
     * озвучивают один и тот же символ по-разному, а то и молчат). Ключи — из
     * `editor/features/emoji/emoji.ts`.
     */
    emoji: string;
    emojiGrid: string;
    emojiCategory: Record<EmojiCategory, string>;
    emojiName: Record<EmojiName, string>;
    /**
     * HTML-режим. `source` — имя и подсказка кнопки-переключателя
     * Панели; `sourceField` — имя поля с исходным HTML Документа, которое
     * заменяет Документ в режиме. Подпись кнопки — «HTML» и по-русски: так
     * режим называют Redactor и CMS, а «Исходный код» длиннее и не короче
     * объясняет.
     */
    source: string;
    sourceField: string;
    /**
     * Показ невидимых символов (пробелов, мягких переносов и концов абзацев):
     * `invisibleCharacters` — имя пункта-флажка меню «…» фиксированной Панели. О том,
     * показаны ли символы, говорит `aria-checked`, а не слова имени.
     */
    invisibleCharacters: string;
    /**
     * Поиск и замена. `search` — имя и подсказка кнопки Панели и
     * строка справочника `Mod+F`; `searchReplace` — строка `Mod+Alt+F`;
     * `searchPanel` — имя панели; остальные — её поля, флажки и кнопки.
     * `searchCount` — счётчик «3 из 12», озвучивается вежливо; без совпадений
     * — `searchNoMatches`.
     */
    search: string;
    searchReplace: string;
    searchPanel: string;
    searchField: string;
    replaceField: string;
    searchPrevious: string;
    searchNext: string;
    searchClose: string;
    searchMatchCase: string;
    searchWholeWord: string;
    searchRegex: string;
    replaceOne: string;
    replaceAll: string;
    searchCount: (vars: { current: number; total: number }) => string;
    searchNoMatches: string;
    searchInvalid: string;
    /**
     * Ручка высоты поля (`resizable`): `resizeField` — имя
     * ползунка, `fieldHeight` — его текущая высота словами (`aria-valuetext`).
     */
    resizeField: string;
    fieldHeight: (vars: { size: number }) => string;
    /**
     * Справочник сочетаний клавиш. `shortcuts` — имя кнопки Панели,
     * подсказка и имя поповера; `shortcutsCommand` и `shortcutsKeys` — заголовки
     * двух столбцов таблицы. Остальные — подписи команд, у которых нет своей
     * кнопки и потому нет подписи выше: команды над Блоками, выделение, сдвиг
     * пункта списка и переход в Панель. Подпись называет действие, а не клавишу:
     * клавиши рядом, в соседнем столбце.
     */
    shortcuts: string;
    shortcutsCommand: string;
    shortcutsKeys: string;
    /** Первое `⌘A`: выделить текст текущего Блока. */
    selectBlock: string;
    /** Второе `⌘A` подряд: выделить весь Документ. */
    selectDocument: string;
    duplicateBlock: string;
    moveBlockUp: string;
    moveBlockDown: string;
    indentListItem: string;
    outdentListItem: string;
    /** `Alt+F10`: перевести фокус из Документа в Панель. */
    focusToolbar: string;
    /**
     * Ручка Блока: `blockActions` — имя кнопки «⋮», её меню и
     * строки справочника сочетаний (`Mod+/`); остальные — пункты меню. Слова
     * короткие, без «блок»: меню и так названо «Действия с блоком».
     */
    blockActions: string;
    blockAdd: string;
    blockFormat: string;
    blockMoveUp: string;
    blockMoveDown: string;
    blockDuplicate: string;
    blockDelete: string;
    /**
     * Оглавление Документа (`RichTextToc`): имя кнопки-полосы и подпись
     * `nav` со списком заголовков — одно слово на оба, это одна вещь.
     */
    toc: string;
    /**
     * Видео по ссылке (Инструменты `youtube` и `twitch`, ADR-0071). `video` —
     * пункт Меню вставки и «Добавить ›» ручки Блока; `videoLink` — имя поля
     * ссылки в поповере; `videoInsert` — кнопка поповера; `videoNotFound` — ошибка
     * поля на ссылку, которая не ведёт на видео включённого сервиса (`services` —
     * названия сервисов через запятую: «YouTube» или «YouTube, Twitch»).
     * `videoPlay` — подпись кнопки заглушки; `videoPlayLabel` — её доступное имя
     * (видимое слово «Воспроизвести» входит в него целиком, WCAG 2.5.3);
     * `videoPlayer` — заголовок `iframe` для скринридера. Названия сервисов
     * (`service`) — имена брендов и не переводятся.
     */
    video: string;
    videoLink: string;
    videoInsert: string;
    videoNotFound: (vars: { services: string }) => string;
    videoPlay: string;
    videoPlayLabel: (vars: { service: string }) => string;
    videoPlayer: (vars: { service: string }) => string;
    /**
     * Набор кавычек языка каталога для Инструмента `typography`: `"ru"` —
     * «ёлочки» и „лапки“, `"en"` — “ ” и ‘ ’. Не текст для экрана, а признак
     * языка каталога: у каталога другого языка (немецкий, французский)
     * своего набора у кита нет, и пока значение не задано, действует `"en"`;
     * набор можно задать явно Опцией `quotes`.
     */
    typographyQuotes: EditorQuoteSet;
  };
}

/**
 * Варианты Раскладки Редактора — ключи `editor.layoutVariant`: доли колонок в
 * процентах через дефис, как их пишет `data-layout` (`editor/features/layout/columnLayouts.ts`).
 */
export type EditorLayoutVariant = "100" | "50-50" | "33-33-33" | "25-25-25-25" | "60-40" | "40-60";

/**
 * Тоны Обёртки Редактора — ключи `editor.wrapperToneName`: имена словаря `Tone`
 * кита, как их пишет `data-tone` (`editor/features/wrapper/wrapperTones.ts`).
 */
export type EditorWrapperTone = "neutral" | "accent" | "success" | "warning" | "danger";

/** Наборы кавычек `typography` — значения `editor.typographyQuotes` и Опции `quotes`. */
export type EditorQuoteSet = "en" | "ru";

/** Категории эмодзи Редактора — ключи `editor.emojiCategory`; порядок показа задаёт `editor/features/emoji/emoji.ts`. */
export type EmojiCategory =
  "favorites" | "smileys" | "gestures" | "animals" | "food" | "activities" | "travel";

/** Имена эмодзи Редактора — ключи `editor.emojiName`; состав категорий задаёт `editor/features/emoji/emoji.ts`. */
export type EmojiName =
  | "faceWithTearsOfJoy"
  | "redHeart"
  | "rollingOnTheFloorLaughing"
  | "thumbsUp"
  | "loudlyCrying"
  | "foldedHands"
  | "blowingKiss"
  | "smilingWithHearts"
  | "heartEyes"
  | "partyPopper"
  | "beamingFace"
  | "fire"
  | "birthdayCake"
  | "flushedFace"
  | "sunglassesFace"
  | "sparkles"
  | "eyes"
  | "pointingRight"
  | "hundredPoints"
  | "angryFace"
  | "slightlySmiling"
  | "grinningSmilingEyes"
  | "grinningSquinting"
  | "winkingFace"
  | "tongueFace"
  | "smilingBlushing"
  | "smirkingFace"
  | "thinkingFace"
  | "sleepyFace"
  | "thumbsDown"
  | "victoryHand"
  | "clappingHands"
  | "raisedHands"
  | "facepalm"
  | "shrug"
  | "oncomingFist"
  | "wavingHand"
  | "okHand"
  | "dog"
  | "cat"
  | "mouse"
  | "hamster"
  | "rabbit"
  | "bear"
  | "panda"
  | "lion"
  | "pig"
  | "frog"
  | "greenApple"
  | "pizza"
  | "hamburger"
  | "frenchFries"
  | "spaghetti"
  | "sushi"
  | "iceCream"
  | "doughnut"
  | "cookie"
  | "shortcake"
  | "soccerBall"
  | "basketball"
  | "americanFootball"
  | "baseball"
  | "tennis"
  | "bowling"
  | "golfer"
  | "fishing"
  | "cyclist"
  | "videoGame"
  | "airplane"
  | "car"
  | "bicycle"
  | "train"
  | "sailboat"
  | "worldMap"
  | "beach"
  | "mountain"
  | "camping"
  | "luggage";

/** Раскладка экранной клавиатуры. Это ДАННЫЕ ввода, а не язык интерфейса. */
export type KeyboardLayoutName = "ru" | "en";

/** Ключи пресетов периода; совпадают с `PeriodPreset` из `lib/period.ts`. */
export type PeriodPresetKey = "7d" | "30d" | "90d" | "365d" | "thisMonth" | "lastMonth";

/** Частичный каталог: потребитель переопределяет только то, что хочет. */
export type PartialUiMessages = {
  [K in keyof UiMessages]?: Partial<UiMessages[K]>;
};
