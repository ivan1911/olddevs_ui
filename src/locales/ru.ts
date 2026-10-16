import type { UiMessages } from "../i18n/messages.js";

/**
 * Русская локаль.
 *
 * Подключается одной строкой и не попадает в бандл к тем, кто её не
 * импортировал:
 *
 *     import ru from "@olddevs/ui/locales/ru";
 *     <UiProvider locale="ru-RU" messages={ru}>…</UiProvider>
 *
 * `locale` здесь обязателен наравне с `messages`: строки приносит каталог, а
 * формат дат и чисел — локаль, и одно без другого даёт русские подписи с
 * английскими датами.
 *
 * Тексты — те же, что были зашиты в компонентах до 2.0.0, дословно. Это
 * проверяемо: `git log` этого репозитория содержит историю до форка.
 */

/** Правила склонения знает локаль, а не компонент. */
const plural = new Intl.PluralRules("ru-RU");

/** «1 день / 2 дня / 5 дней» — по категории, а не по цепочке остатков. */
/**
 * Склонение по числу.
 *
 * Через модульный `plural`, а не через `new Intl.PluralRules(...)` на вызов:
 * конструктор разбирает локаль, и это самая дорогая часть операции. Сообщения
 * зовутся из рендера — `uploadQueue.summary` на каждом тике прогресса загрузки,
 * `notifications.unreadCount` при каждой перерисовке значка, — то есть разбор
 * платился бы заново на каждом кадре.
 */
function pluralize(n: number, one: string, few: string, many: string): string {
  const form = plural.select(n);
  if (form === "one") return one;
  if (form === "few") return few;
  return many;
}

export const locale = "ru-RU";

export const messages: UiMessages = {
  common: {
    close: "Закрыть",
    clear: "Очистить",
    notFound: "Ничего не найдено",
    empty: "Пусто",
    loading: "Загрузка",
    searchPlaceholder: "Поиск…",
  },

  alert: {
    close: "Закрыть сообщение",
  },

  banner: {
    close: "Скрыть объявление",
  },

  breadcrumbs: {
    label: "Хлебные крошки",
    collapsed: ({ count }) => `Пропущено звеньев: ${count}`,
  },

  combobox: {
    showSuggestions: "Показать подсказки",
  },

  commandPalette: {
    title: "Командная палитра",
    placeholder: "Поиск по действиям",
    emptyHint: "Начните вводить название действия",
  },

  confirmDialog: {
    confirm: "Подтвердить",
    cancel: "Отменить",
    typeToConfirm: ({ text }) => `Введите «${text}», чтобы подтвердить`,
    typeToConfirmHint: "Регистр важен.",
  },

  datePicker: {
    placeholder: "Выбрать дату",
  },

  dateRangePicker: {
    placeholder: "Выбрать период",
  },

  errorState: {
    title: "Ошибка загрузки",
  },

  fileDropzone: {
    label: "Перетащите файлы сюда",
    browse: "Выбрать файлы",
    tooLarge: ({ size }) => `слишком большой, ${size}`,
    singleFileOnly: "принимается только один файл",
    foldersNotAccepted: "папки не принимаются",
    wrongType: "Неподходящий тип",
    unreadable: "Не удалось прочитать",
    folderName: "папка",
  },

  filterBar: {
    label: "Применённые фильтры",
    remove: "Снять фильтр",
    clear: "Снять все",
    add: "Добавить фильтр",
    field: "Поле",
    value: "Значение",
    apply: "Применить",
    fromField: "От",
    toField: "До",
    rangeBetween: ({ from, to }) => `${from}–${to}`,
    rangeFrom: ({ from }) => `от ${from}`,
    rangeTo: ({ to }) => `до ${to}`,
  },

  maskedInput: {
    rejected: ({ expected }) =>
      expected === "digit"
        ? "Здесь нужна цифра"
        : expected === "letter"
          ? "Здесь нужна буква"
          : "Здесь нужны цифра или буква",
    full: "Поле уже заполнено",
    truncated: ({ count }) =>
      `Вставленное значение длиннее на ${count} ${pluralize(count, "символ", "символа", "символов")} — хвост не принят`,
  },

  inlineEdit: {
    edit: "изменить",
    empty: "Не задано",
  },

  keyboard: {
    label: ({ layout }) => (layout === "ru" ? "Русская клавиатура" : "Английская клавиатура"),
    close: "Закрыть экранную клавиатуру",
    move: "Перемещать экранную клавиатуру",
    switchLayout: "Сменить раскладку",
    switchLayoutTo: ({ layout }) =>
      layout === "ru" ? "Переключить раскладку на русскую" : "Переключить раскладку на английскую",
    showSymbols: "Показать символы",
    showLetters: ({ layout }) =>
      layout === "ru" ? "Показать русские буквы" : "Показать английские буквы",
    showPrimarySymbols: "Показать основной набор символов",
    showExtraSymbols: "Показать дополнительный набор символов",
    backspace: "Удалить символ",
    space: "Пробел",
    submit: "Отправить поиск",
    keyComma: "Запятая",
    keyPeriod: "Точка",
    keyLess: "Меньше",
    keyGreater: "Больше",
    keySemicolon: "Точка с запятой",
    keyColon: "Двоеточие",
  },

  link: {
    opensInNewTab: "(откроется в новой вкладке)",
  },

  numberInput: {
    decrement: ({ label }) => `${label}: меньше`,
    increment: ({ label }) => `${label}: больше`,
  },

  nav: {
    label: "Основная навигация",
    collapse: "Свернуть навигацию",
    expand: "Развернуть навигацию",
  },

  mobileTabBar: {
    label: "Разделы",
    new: "Есть новое",
    // «Новых: 3», а не «3 новых»: форма слова не зависит от числа, и склонять
    // не приходится.
    newCount: ({ count }) => `Новых: ${count}`,
  },

  pagination: {
    label: "Страницы",
    previous: "Предыдущая страница",
    next: "Следующая страница",
  },

  passwordInput: {
    toggle: "Показать пароль",
    capsLock: "Включён Caps Lock",
  },

  pinInput: {
    digit: ({ index, total }) => `Цифра ${index} из ${total}`,
  },

  searchControl: {
    clear: "Очистить поиск",
    openKeyboard: "Открыть экранную клавиатуру",
  },

  savedViews: {
    label: "Сохранённые виды",
  },

  contextualSaveBar: {
    label: "Несохранённые изменения",
    unsaved: "Есть несохранённые изменения",
    changes: ({ count }) =>
      `${count} ${pluralize(count, "несохранённое изменение", "несохранённых изменения", "несохранённых изменений")}`,
    save: "Сохранить",
    cancel: "Отменить",
    saving: "Сохранение\u2026",
  },

  selectionBar: {
    label: "Действия над выбранным",
    clearSelection: "Снять выделение",
    count: ({ count }) => `${pluralize(count, "Выбран", "Выбрано", "Выбрано")} ${count}`,
  },

  shell: {
    skipToContent: "Перейти к содержимому",
    openNavigation: "Открыть навигацию",
  },

  spinner: {
    label: "Загрузка",
  },

  stepper: {
    label: "Шаги",
    state: ({ state }) => (state === "done" ? "пройден" : "не начат"),
  },

  table: {
    empty: "Ничего нет",
    selectAll: "Выделить все строки",
    selectRow: "Выделить строку",
    expandColumn: "Подробности строки",
    expandRow: ({ row }) => (row ? `Показать подробности: ${row}` : "Показать подробности"),
    collapseRow: ({ row }) => (row ? `Скрыть подробности: ${row}` : "Скрыть подробности"),
  },

  tablePreferences: {
    columns: "Колонки",
    density: "Плотность",
    comfortable: "Свободно",
    compact: "Плотно",
    moveUp: ({ column }) => `Переместить «${column}» выше`,
    moveDown: ({ column }) => `Переместить «${column}» ниже`,
  },

  tableToolbar: {
    total: ({ count }) => `${count} ${pluralize(count, "запись", "записи", "записей")}`,
    preferences: "Настройки таблицы",
  },

  tagInput: {
    remove: "Убрать тег",
    add: "Добавить тег",
    addTo: ({ label }) => `${label}: добавить`,
  },

  tagGroup: {
    remove: ({ label }) => `Удалить: ${label}`,
  },

  copyButton: {
    copy: "Копировать",
    copied: "Скопировано",
    failed: "Не удалось скопировать",
  },

  mediaCard: {
    select: "Выбрать",
  },

  notifications: {
    label: "Уведомления",
    unread: "Не прочитано",
    unreadCount: ({ count }) =>
      `${count} ${pluralize(count, "непрочитанное", "непрочитанных", "непрочитанных")}`,
  },

  editableList: {
    drag: "Перетащить",
    emptyValue: "Не задано",
  },

  sortableList: {
    drag: "Перетащить",
  },

  uploadQueue: {
    label: "Очередь загрузки",
    summary: ({ done, total, failed }) => {
      const uploaded = `Загружено ${done} из ${total}`;
      if (failed === 0) return uploaded;
      // Склонение живёт ЗДЕСЬ, а не в компоненте: правила знает локаль.
      return `${uploaded}, ${failed} ${pluralize(failed, "ошибка", "ошибки", "ошибок")}`;
    },
    progress: "Ход загрузки",
    itemProgress: ({ name }) => `Загрузка ${name}`,
  },

  treeView: {
    expand: "Раскрыть",
    collapse: "Свернуть",
    select: "Выбрать",
  },

  timePicker: {
    label: "Время",
    placeholder: "ЧЧ:ММ",
    placeholder12: "Ч:ММ AM",
    am: "AM",
    pm: "PM",
  },

  topbar: {
    label: "Шапка приложения",
  },

  rating: {
    value: ({ value, total }) => `Оценка ${value} из ${total}`,
    star: ({ index, total }) => `${index} из ${total}`,
  },

  colorPicker: {
    presets: "Заготовки",
    hex: "HEX",
  },

  treeSelect: {
    placeholder: "Выберите узел",
    more: ({ count }) => `ещё ${count}`,
  },

  transfer: {
    source: "Доступно",
    target: "Выбрано",
    moveToTarget: "Перенести в выбранное",
    moveToSource: "Вернуть в доступное",
    searchIn: ({ list }) => `Поиск: ${list}`,
  },

  splitPanel: {
    resize: "Изменить размер панели",
    resizeNamed: ({ panel }) => `Изменить размер: ${panel}`,
    size: ({ size }) => `${size} ${pluralize(size, "пиксель", "пикселя", "пикселей")}`,
  },

  splitButton: {
    more: ({ action }) => `Другие действия: ${action}`,
  },

  period: {
    presets: {
      "7d": "7 дней",
      "30d": "30 дней",
      "90d": "90 дней",
      "365d": "Год",
      thisMonth: "Этот месяц",
      lastMonth: "Прошлый месяц",
    },
    length: ({ days }) => `${days} ${pluralize(days, "день", "дня", "дней")}`,
  },

  carousel: {
    roleDescription: "карусель",
    slideRoleDescription: "слайд",
    previous: "Предыдущий слайд",
    next: "Следующий слайд",
    slide: ({ index, total }) => `${index} из ${total}`,
  },

  megaMenu: {
    back: "Назад",
  },

  shortcutsHelp: {
    title: "Горячие клавиши",
    list: "Сочетания клавиш",
    keySeparator: "плюс",
  },

  editor: {
    label: "Редактор текста",
    placeholder: "Начните писать…",
    // Глагол согласуется с числом так же, как существительное: «остался 1
    // символ», но «осталось 2 символа» и «осталось 5 символов».
    remaining: ({ count }) =>
      `${pluralize(count, "Остался", "Осталось", "Осталось")} ${count} ${pluralize(count, "символ", "символа", "символов")}`,
    overLimit: ({ count }) =>
      `Лимит превышен на ${count} ${pluralize(count, "символ", "символа", "символов")}`,
    required: "Заполните это поле",
    toolbar: "Форматирование",
    selectionToolbar: "Форматирование выделения",
    textStyle: ({ current }) => `Стиль текста: ${current}`,
    blockTypeMenu: "Тип блока",
    blockType: ({ current }) => `Тип блока: ${current}`,
    moreFormatting: "Ещё форматирование",
    textBlock: "Текст",
    paragraph: "Абзац",
    heading: ({ level }) => `Заголовок ${level}`,
    insertMenu: "Добавить блок",
    insertSection: "Добавить",
    turnIntoSection: "Превратить в",
    nothingFound: "Ничего не найдено",
    triggerList: "Подсказки",
    bold: "Жирный",
    italic: "Курсив",
    underline: "Подчёркнутый",
    strike: "Зачёркнутый",
    code: "Строчный код",
    superscript: "Верхний индекс",
    subscript: "Нижний индекс",
    clearFormatting: "Очистить стили",
    link: "Ссылка",
    linkAddress: "Адрес",
    linkApply: "Применить",
    linkRemove: "Убрать ссылку",
    linkInvalid: "Нужен адрес сайта (http, https) или почты (mailto)",
    bulletList: "Маркированный список",
    orderedList: "Нумерованный список",
    taskList: "Чек-лист",
    blockquote: "Цитата",
    codeBlock: "Блок кода",
    codeLanguage: ({ current }) => `Язык: ${current}`,
    codeLanguagePlain: "Обычный текст",
    codeCopy: "Копировать код",
    horizontalRule: "Разделитель",
    undo: "Отменить",
    redo: "Повторить",
    taskCheckbox: ({ text }) => (text ? `Выполнено: ${text}` : "Выполнено: пустой пункт"),
    highlight: ({ current }) => `Маркер: ${current}`,
    colorDefault: "По умолчанию",
    highlightNone: "Без маркера",
    highlightToggle: "Маркер",
    highlightRemove: "Убрать маркер",
    colorRemove: "Убрать цвет",
    color: "Цвет",
    colorMenu: ({ current }) => `Цвет: ${current}`,
    textColorSection: "Цвет текста",
    highlightSection: "Цвет маркера",
    colorAccent: "Акцентный",
    colorSuccess: "Зелёный",
    colorWarning: "Жёлтый",
    colorDanger: "Красный",
    colorLime: "Лаймовый",
    colorMuted: "Серый",
    markerGray: "Серый",
    markerBrown: "Коричневый",
    markerOrange: "Оранжевый",
    markerYellow: "Жёлтый",
    markerGreen: "Зелёный",
    markerBlue: "Синий",
    markerPurple: "Фиолетовый",
    markerPink: "Розовый",
    markerRed: "Красный",
    colorCustom: "Свой цвет…",
    colorCustomCurrent: ({ hex }) => `Свой ${hex}`,
    customColorText: "Свой цвет текста",
    customColorHighlight: "Свой цвет маркера",
    customColorValue: ({ hex }) => `Цвет ${hex}`,
    customColorApply: "Применить",
    customColorCancel: "Отмена",
    customColorLowContrastText: ({ ratio }) =>
      `Низкий контраст: ${ratio}:1 с фоном редактора (нужно 4,5:1)`,
    customColorLowContrastHighlight: ({ ratio }) =>
      `Низкий контраст: тёмный текст на этом маркере — ${ratio}:1 (нужно 4,5:1)`,
    customColorThemeNote: "Этот цвет не меняется вместе с темой.",
    alignLeft: "По левому краю",
    alignCenter: "По центру",
    alignRight: "По правому краю",
    alignMenu: ({ current }) =>
      current === "center"
        ? "Выравнивание: по центру"
        : current === "right"
          ? "Выравнивание: по правому краю"
          : "Выравнивание: по левому краю",
    listMenu: ({ current }) =>
      current === "bulletList"
        ? "Список: маркированный"
        : current === "orderedList"
          ? "Список: нумерованный"
          : current === "taskList"
            ? "Список: чек-лист"
            : "Списки",
    table: "Таблица",
    tableInsertDialog: "Вставить таблицу…",
    tableInsertDialogTitle: "Вставить таблицу",
    tableCell: "Ячейка",
    tableRow: "Строка",
    tableColumn: "Столбец",
    tableSort: "Сортировка",
    tableMergeCells: "Объединить ячейки",
    tableSplitCell: "Разделить ячейку",
    tableAddRowBefore: "Вставить строку выше",
    tableAddRowAfter: "Вставить строку ниже",
    tableAddColumnBefore: "Вставить столбец слева",
    tableAddColumnAfter: "Вставить столбец справа",
    tableDeleteRow: "Удалить строку",
    tableDeleteColumn: "Удалить столбец",
    tableHeaderRow: "Строка-заголовок",
    tableAlignLeft: "Столбец по левому краю",
    tableAlignCenter: "Столбец по центру",
    tableAlignRight: "Столбец по правому краю",
    tableSortAscending: "По возрастанию",
    tableSortDescending: "По убыванию",
    tableSortMerged: "Недоступно: в таблице есть объединённые ячейки",
    tableDelete: "Удалить таблицу",
    tableCancel: "Отмена",
    image: "Картинка",
    imageAddress: "Адрес картинки",
    imageInvalid: "Нужен адрес картинки, начинающийся с https:// или http://",
    imageAlt: "Альтернативный текст",
    imageAltHint:
      "Опишите картинку для тех, кто её не видит. Оставьте пустым, если она декоративная.",
    imageInsert: "Вставить",
    imageApply: "Применить",
    imageChooseFile: "Загрузить с устройства",
    imageRemove: "Убрать картинку",
    imageEdit: "Изменить картинку",
    imageWidth: "Ширина",
    // Между числом и знаком процента по-русски ставится неразрывный пробел.
    imageWidthPreset: ({ percent }) => `${percent}\u00a0%`,
    imageCaption: "Подпись (необязательно)",
    imageUploading: ({ name }) => `Загружается файл ${name}…`,
    imageUploaded: ({ name }) => `Файл ${name} загружен`,
    imageUploadFailed: ({ name }) => `Не удалось загрузить файл ${name}. Документ не изменился.`,
    imageNotImage: ({ name }) => `Файл ${name} — не картинка`,
    imageFilesUnsupported: "Файлы здесь не загружаются. Вставьте картинку по адресу.",
    toolsFailed: "Редактор не запустился. Документ не изменён.",
    retry: "Повторить",
    textCardShown: ({ label, shortcut }) =>
      `Открыта карточка «${label}». ${shortcut} — перейти в неё.`,
    tableGrid: "Размер таблицы",
    tableSize: ({ cols, rows }) =>
      `${cols} ${pluralize(cols, "столбец", "столбца", "столбцов")}, ${rows} ${pluralize(rows, "строка", "строки", "строк")}`,
    tableColumns: "Столбцы",
    tableRows: "Строки",
    tableInsert: "Вставить",
    layout: "Раскладка",
    layoutVariant: {
      "100": "Одна колонка",
      "50-50": "Две колонки",
      "33-33-33": "Три колонки",
      "25-25-25-25": "Четыре колонки",
      "60-40": "60/40",
      "40-60": "40/60",
    },
    wrapper: "Обёртка",
    unwrap: "Снять обёртку",
    wrapperTone: ({ current }) => `Тон: ${current}`,
    wrapperToneNone: "Без тона",
    wrapperToneName: {
      accent: "Заметка",
      success: "Совет",
      neutral: "Важно",
      warning: "Внимание",
      danger: "Осторожно",
    },
    details: "Сворачиваемый блок",
    unwrapDetails: "Снять сворачивание",
    detailsToggle: ({ text }) => (text ? `Подробности: ${text}` : "Подробности: без заголовка"),
    emoji: "Эмодзи",
    emojiGrid: "Выберите эмодзи",
    emojiCategory: {
      favorites: "Избранное",
      smileys: "Смайлы",
      gestures: "Жесты",
      animals: "Животные",
      food: "Еда",
      activities: "Занятия",
      travel: "Путешествия",
    },
    emojiName: {
      faceWithTearsOfJoy: "Лицо со слезами радости",
      redHeart: "Красное сердце",
      rollingOnTheFloorLaughing: "Катаюсь по полу от смеха",
      thumbsUp: "Большой палец вверх",
      loudlyCrying: "Громко плачущее лицо",
      foldedHands: "Сложенные ладони",
      blowingKiss: "Воздушный поцелуй",
      smilingWithHearts: "Улыбающееся лицо с сердечками",
      heartEyes: "Глаза-сердечки",
      partyPopper: "Хлопушка",
      beamingFace: "Сияющее лицо",
      fire: "Огонь",
      birthdayCake: "Праздничный торт",
      flushedFace: "Смущённое лицо",
      sunglassesFace: "Лицо в солнечных очках",
      sparkles: "Искры",
      eyes: "Глаза",
      pointingRight: "Указывает вправо",
      hundredPoints: "Сто баллов",
      angryFace: "Сердитое лицо",
      slightlySmiling: "Слегка улыбающееся лицо",
      grinningSmilingEyes: "Ухмыляющееся лицо с улыбающимися глазами",
      grinningSquinting: "Ухмыляющееся лицо с прищуром",
      winkingFace: "Подмигивающее лицо",
      tongueFace: "Лицо с высунутым языком",
      smilingBlushing: "Улыбающееся лицо с улыбающимися глазами и румянцем",
      smirkingFace: "Самодовольное лицо",
      thinkingFace: "Задумавшееся лицо",
      sleepyFace: "Сонное лицо",
      thumbsDown: "Большой палец вниз",
      victoryHand: "Жест победы",
      clappingHands: "Аплодисменты",
      raisedHands: "Поднятые руки",
      facepalm: "Рука у лица",
      shrug: "Пожимает плечами",
      oncomingFist: "Кулак",
      wavingHand: "Машущая рука",
      okHand: "Жест «окей»",
      dog: "Собака",
      cat: "Кошка",
      mouse: "Мышь",
      hamster: "Хомяк",
      rabbit: "Кролик",
      bear: "Медведь",
      panda: "Панда",
      lion: "Лев",
      pig: "Свинья",
      frog: "Лягушка",
      greenApple: "Зелёное яблоко",
      pizza: "Пицца",
      hamburger: "Гамбургер",
      frenchFries: "Картофель фри",
      spaghetti: "Спагетти",
      sushi: "Суши",
      iceCream: "Мороженое",
      doughnut: "Пончик",
      cookie: "Печенье",
      shortcake: "Кусок торта",
      soccerBall: "Футбольный мяч",
      basketball: "Баскетбольный мяч",
      americanFootball: "Мяч для американского футбола",
      baseball: "Бейсбольный мяч",
      tennis: "Теннис",
      bowling: "Боулинг",
      golfer: "Гольфист",
      fishing: "Рыбалка",
      cyclist: "Велосипедист",
      videoGame: "Видеоигра",
      airplane: "Самолёт",
      car: "Автомобиль",
      bicycle: "Велосипед",
      train: "Поезд",
      sailboat: "Парусник",
      worldMap: "Карта мира",
      beach: "Пляж",
      mountain: "Заснеженная гора",
      camping: "Кемпинг",
      luggage: "Чемодан",
    },
    source: "HTML",
    sourceField: "HTML-код документа",
    invisibleCharacters: "Невидимые символы",
    search: "Найти",
    searchReplace: "Найти и заменить",
    searchPanel: "Поиск и замена",
    searchField: "Найти",
    replaceField: "Заменить на",
    searchPrevious: "Предыдущее совпадение",
    searchNext: "Следующее совпадение",
    searchClose: "Закрыть поиск",
    searchMatchCase: "Учитывать регистр",
    searchWholeWord: "Слово целиком",
    searchRegex: "Регулярное выражение",
    replaceOne: "Заменить",
    replaceAll: "Заменить все",
    searchCount: ({ current, total }) => `${current} из ${total}`,
    searchNoMatches: "Нет совпадений",
    searchInvalid: "Неверное регулярное выражение",
    resizeField: "Изменить высоту поля",
    fieldHeight: ({ size }) =>
      `Высота ${size} ${pluralize(size, "пиксель", "пикселя", "пикселей")}`,
    shortcuts: "Сочетания клавиш",
    shortcutsCommand: "Команда",
    shortcutsKeys: "Сочетание",
    selectBlock: "Выделить текст блока",
    selectDocument: "Выделить всё (второе нажатие)",
    duplicateBlock: "Дублировать блок",
    moveBlockUp: "Переместить блок вверх",
    moveBlockDown: "Переместить блок вниз",
    indentListItem: "Сдвинуть пункт списка вправо",
    outdentListItem: "Сдвинуть пункт списка влево",
    focusToolbar: "Перейти в панель",
    blockActions: "Действия с блоком",
    blockAdd: "Добавить",
    blockFormat: "Формат",
    blockMoveUp: "Вверх",
    blockMoveDown: "Вниз",
    blockDuplicate: "Дублировать",
    blockDelete: "Удалить",
    toc: "Оглавление",
    video: "Видео",
    videoLink: "Ссылка на видео",
    videoInsert: "Вставить",
    videoNotFound: ({ services }) => `Введите ссылку на видео ${services}`,
    videoPlay: "Воспроизвести",
    videoPlayLabel: ({ service }) => `Воспроизвести видео ${service}`,
    videoPlayer: ({ service }) => `Видео ${service}`,
    typographyQuotes: "ru",
  },
};

export default messages;
