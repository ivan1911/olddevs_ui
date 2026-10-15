# Каталог сообщений `UiMessages`

Публичный контракт: имена ключей и форма значения. Строку кит берёт по порядку
`проп → сообщение провайдера → фолбэк`; как подключить каталог — [i18n.md](../i18n.md).

Ключ-функция принимает параметры; строка собирается внутри локали, а не
склеивается в компоненте: склонение тоже живёт в локали. Колонки со значениями у таких
ключей пустые — показать «одно значение» у функции нельзя.

Страница обновляется вместе с ключом. Гейт `tests/i18n-gate.test.ts` сторожит
полноту русской локали, но не эту страницу: если таблица разошлась с кодом, врёт таблица.

## `common`

| Ключ                | Форма  | `en-US`       | `ru-RU`           |
| ------------------- | ------ | ------------- | ----------------- |
| `close`             | строка | Close         | Закрыть           |
| `clear`             | строка | Clear         | Очистить          |
| `notFound`          | строка | Nothing found | Ничего не найдено |
| `empty`             | строка | Empty         | Пусто             |
| `loading`           | строка | Loading       | Загрузка          |
| `searchPlaceholder` | строка | Search…       | Поиск…            |

## `alert`

| Ключ    | Форма  | `en-US`         | `ru-RU`           |
| ------- | ------ | --------------- | ----------------- |
| `close` | строка | Dismiss message | Закрыть сообщение |

## `banner`

| Ключ    | Форма  | `en-US`              | `ru-RU`           |
| ------- | ------ | -------------------- | ----------------- |
| `close` | строка | Dismiss announcement | Скрыть объявление |

## `breadcrumbs`

| Ключ        | Форма   | `en-US`     | `ru-RU`        |
| ----------- | ------- | ----------- | -------------- |
| `label`     | строка  | Breadcrumbs | Хлебные крошки |
| `collapsed` | функция | —           | —              |

## `carousel`

| Ключ                   | Форма   | `en-US`        | `ru-RU`          |
| ---------------------- | ------- | -------------- | ---------------- |
| `roleDescription`      | строка  | carousel       | карусель         |
| `slideRoleDescription` | строка  | slide          | слайд            |
| `previous`             | строка  | Previous slide | Предыдущий слайд |
| `next`                 | строка  | Next slide     | Следующий слайд  |
| `slide`                | функция | —              | —                |

`roleDescription` и `slideRoleDescription` — текст `aria-roledescription`, то
есть то, что скринридер произносит вместо роли; поэтому он переводится. `slide`
— имя слайда по положению («2 из 5»), а слово «слайд» к нему добавляет роль.

## `colorPicker`

| Ключ      | Форма  | `en-US` | `ru-RU`   |
| --------- | ------ | ------- | --------- |
| `presets` | строка | Presets | Заготовки |
| `hex`     | строка | HEX     | HEX       |

## `combobox`

| Ключ              | Форма  | `en-US`          | `ru-RU`            |
| ----------------- | ------ | ---------------- | ------------------ |
| `showSuggestions` | строка | Show suggestions | Показать подсказки |

## `commandPalette`

| Ключ          | Форма  | `en-US`                     | `ru-RU`                           |
| ------------- | ------ | --------------------------- | --------------------------------- |
| `title`       | строка | Command palette             | Командная палитра                 |
| `placeholder` | строка | Search actions              | Поиск по действиям                |
| `emptyHint`   | строка | Start typing an action name | Начните вводить название действия |

## `confirmDialog`

| Ключ                | Форма   | `en-US`                      | `ru-RU`        |
| ------------------- | ------- | ---------------------------- | -------------- |
| `confirm`           | строка  | Confirm                      | Подтвердить    |
| `cancel`            | строка  | Cancel                       | Отменить       |
| `typeToConfirm`     | функция | —                            | —              |
| `typeToConfirmHint` | строка  | The match is case-sensitive. | Регистр важен. |

## `contextualSaveBar`

| Ключ      | Форма   | `en-US`                  | `ru-RU`                      |
| --------- | ------- | ------------------------ | ---------------------------- |
| `label`   | строка  | Unsaved changes          | Несохранённые изменения      |
| `unsaved` | строка  | You have unsaved changes | Есть несохранённые изменения |
| `changes` | функция | —                        | —                            |
| `save`    | строка  | Save                     | Сохранить                    |
| `cancel`  | строка  | Discard                  | Отменить                     |
| `saving`  | строка  | Saving…                  | Сохранение…                  |

## `copyButton`

| Ключ     | Форма  | `en-US`        | `ru-RU`                |
| -------- | ------ | -------------- | ---------------------- |
| `copy`   | строка | Copy           | Копировать             |
| `copied` | строка | Copied         | Скопировано            |
| `failed` | строка | Could not copy | Не удалось скопировать |

## `datePicker`

| Ключ          | Форма  | `en-US`     | `ru-RU`      |
| ------------- | ------ | ----------- | ------------ |
| `placeholder` | строка | Pick a date | Выбрать дату |

## `dateRangePicker`

| Ключ          | Форма  | `en-US`       | `ru-RU`        |
| ------------- | ------ | ------------- | -------------- |
| `placeholder` | строка | Pick a period | Выбрать период |

## `editableList`

| Ключ         | Форма  | `en-US` | `ru-RU`    |
| ------------ | ------ | ------- | ---------- |
| `drag`       | строка | Drag    | Перетащить |
| `emptyValue` | строка | Not set | Не задано  |

## `editor`

Строки Редактора ([rich-text-editor.md](../components/inputs/rich-text-editor.md)) живут в общем каталоге, а не в своём. Ключи с точкой — вложенные: `emojiName.*` — имя каждого эмодзи, `emojiCategory.*` — категории.

| Ключ                                  | Форма   | `en-US`                                                                          | `ru-RU`                                                                            |
| ------------------------------------- | ------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `label`                               | строка  | Rich text editor                                                                 | Редактор текста                                                                    |
| `placeholder`                         | строка  | Start writing…                                                                   | Начните писать…                                                                    |
| `remaining`                           | функция | —                                                                                | —                                                                                  |
| `overLimit`                           | функция | —                                                                                | —                                                                                  |
| `required`                            | строка  | Fill in this field                                                               | Заполните это поле                                                                 |
| `toolbar`                             | строка  | Formatting                                                                       | Форматирование                                                                     |
| `selectionToolbar`                    | строка  | Selection formatting                                                             | Форматирование выделения                                                           |
| `textStyle`                           | функция | —                                                                                | —                                                                                  |
| `blockTypeMenu`                       | строка  | Block type                                                                       | Тип блока                                                                          |
| `blockType`                           | функция | —                                                                                | —                                                                                  |
| `moreFormatting`                      | строка  | More formatting                                                                  | Ещё форматирование                                                                 |
| `textBlock`                           | строка  | Text                                                                             | Текст                                                                              |
| `paragraph`                           | строка  | Paragraph                                                                        | Абзац                                                                              |
| `heading`                             | функция | —                                                                                | —                                                                                  |
| `insertMenu`                          | строка  | Insert block                                                                     | Добавить блок                                                                      |
| `insertSection`                       | строка  | Insert                                                                           | Добавить                                                                           |
| `turnIntoSection`                     | строка  | Turn into                                                                        | Превратить в                                                                       |
| `nothingFound`                        | строка  | Nothing found                                                                    | Ничего не найдено                                                                  |
| `triggerList`                         | строка  | Suggestions                                                                      | Подсказки                                                                          |
| `bold`                                | строка  | Bold                                                                             | Жирный                                                                             |
| `italic`                              | строка  | Italic                                                                           | Курсив                                                                             |
| `underline`                           | строка  | Underline                                                                        | Подчёркнутый                                                                       |
| `strike`                              | строка  | Strikethrough                                                                    | Зачёркнутый                                                                        |
| `code`                                | строка  | Inline code                                                                      | Строчный код                                                                       |
| `superscript`                         | строка  | Superscript                                                                      | Верхний индекс                                                                     |
| `subscript`                           | строка  | Subscript                                                                        | Нижний индекс                                                                      |
| `clearFormatting`                     | строка  | Clear formatting                                                                 | Очистить стили                                                                     |
| `link`                                | строка  | Link                                                                             | Ссылка                                                                             |
| `linkAddress`                         | строка  | Address                                                                          | Адрес                                                                              |
| `linkApply`                           | строка  | Apply                                                                            | Применить                                                                          |
| `linkRemove`                          | строка  | Remove link                                                                      | Убрать ссылку                                                                      |
| `linkInvalid`                         | строка  | Enter a web address (http, https) or an email (mailto)                           | Нужен адрес сайта (http, https) или почты (mailto)                                 |
| `bulletList`                          | строка  | Bulleted list                                                                    | Маркированный список                                                               |
| `orderedList`                         | строка  | Numbered list                                                                    | Нумерованный список                                                                |
| `taskList`                            | строка  | Checklist                                                                        | Чек-лист                                                                           |
| `blockquote`                          | строка  | Quote                                                                            | Цитата                                                                             |
| `codeBlock`                           | строка  | Code block                                                                       | Блок кода                                                                          |
| `codeLanguage`                        | функция | —                                                                                | —                                                                                  |
| `codeLanguagePlain`                   | строка  | Plain text                                                                       | Обычный текст                                                                      |
| `codeCopy`                            | строка  | Copy code                                                                        | Копировать код                                                                     |
| `horizontalRule`                      | строка  | Divider                                                                          | Разделитель                                                                        |
| `undo`                                | строка  | Undo                                                                             | Отменить                                                                           |
| `redo`                                | строка  | Redo                                                                             | Повторить                                                                          |
| `taskCheckbox`                        | функция | —                                                                                | —                                                                                  |
| `highlight`                           | функция | —                                                                                | —                                                                                  |
| `colorDefault`                        | строка  | Default                                                                          | По умолчанию                                                                       |
| `highlightNone`                       | строка  | None                                                                             | Без маркера                                                                        |
| `highlightToggle`                     | строка  | Highlight                                                                        | Маркер                                                                             |
| `highlightRemove`                     | строка  | Remove highlight                                                                 | Убрать маркер                                                                      |
| `colorRemove`                         | строка  | Remove color                                                                     | Убрать цвет                                                                        |
| `color`                               | строка  | Color                                                                            | Цвет                                                                               |
| `colorMenu`                           | функция | —                                                                                | —                                                                                  |
| `textColorSection`                    | строка  | Text color                                                                       | Цвет текста                                                                        |
| `highlightSection`                    | строка  | Highlight color                                                                  | Цвет маркера                                                                       |
| `colorAccent`                         | строка  | Accent                                                                           | Акцентный                                                                          |
| `colorSuccess`                        | строка  | Green                                                                            | Зелёный                                                                            |
| `colorWarning`                        | строка  | Amber                                                                            | Жёлтый                                                                             |
| `colorDanger`                         | строка  | Red                                                                              | Красный                                                                            |
| `colorLime`                           | строка  | Lime                                                                             | Лаймовый                                                                           |
| `colorMuted`                          | строка  | Gray                                                                             | Серый                                                                              |
| `markerGray`                          | строка  | Gray                                                                             | Серый                                                                              |
| `markerBrown`                         | строка  | Brown                                                                            | Коричневый                                                                         |
| `markerOrange`                        | строка  | Orange                                                                           | Оранжевый                                                                          |
| `markerYellow`                        | строка  | Yellow                                                                           | Жёлтый                                                                             |
| `markerGreen`                         | строка  | Green                                                                            | Зелёный                                                                            |
| `markerBlue`                          | строка  | Blue                                                                             | Синий                                                                              |
| `markerPurple`                        | строка  | Purple                                                                           | Фиолетовый                                                                         |
| `markerPink`                          | строка  | Pink                                                                             | Розовый                                                                            |
| `markerRed`                           | строка  | Red                                                                              | Красный                                                                            |
| `colorCustom`                         | строка  | Custom color…                                                                    | Свой цвет…                                                                         |
| `colorCustomCurrent`                  | функция | —                                                                                | —                                                                                  |
| `customColorText`                     | строка  | Custom text color                                                                | Свой цвет текста                                                                   |
| `customColorHighlight`                | строка  | Custom highlight color                                                           | Свой цвет маркера                                                                  |
| `customColorValue`                    | функция | —                                                                                | —                                                                                  |
| `customColorApply`                    | строка  | Apply                                                                            | Применить                                                                          |
| `customColorCancel`                   | строка  | Cancel                                                                           | Отмена                                                                             |
| `customColorLowContrastText`          | функция | —                                                                                | —                                                                                  |
| `customColorLowContrastHighlight`     | функция | —                                                                                | —                                                                                  |
| `customColorThemeNote`                | строка  | This color does not change with the theme.                                       | Этот цвет не меняется вместе с темой.                                              |
| `alignLeft`                           | строка  | Align left                                                                       | По левому краю                                                                     |
| `alignCenter`                         | строка  | Align center                                                                     | По центру                                                                          |
| `alignRight`                          | строка  | Align right                                                                      | По правому краю                                                                    |
| `alignMenu`                           | функция | —                                                                                | —                                                                                  |
| `listMenu`                            | функция | —                                                                                | —                                                                                  |
| `table`                               | строка  | Table                                                                            | Таблица                                                                            |
| `tableInsertDialog`                   | строка  | Insert table…                                                                    | Вставить таблицу…                                                                  |
| `tableInsertDialogTitle`              | строка  | Insert table                                                                     | Вставить таблицу                                                                   |
| `tableCell`                           | строка  | Cell                                                                             | Ячейка                                                                             |
| `tableRow`                            | строка  | Row                                                                              | Строка                                                                             |
| `tableColumn`                         | строка  | Column                                                                           | Столбец                                                                            |
| `tableSort`                           | строка  | Sort                                                                             | Сортировка                                                                         |
| `tableMergeCells`                     | строка  | Merge cells                                                                      | Объединить ячейки                                                                  |
| `tableSplitCell`                      | строка  | Split cell                                                                       | Разделить ячейку                                                                   |
| `tableAddRowBefore`                   | строка  | Insert row above                                                                 | Вставить строку выше                                                               |
| `tableAddRowAfter`                    | строка  | Insert row below                                                                 | Вставить строку ниже                                                               |
| `tableAddColumnBefore`                | строка  | Insert column left                                                               | Вставить столбец слева                                                             |
| `tableAddColumnAfter`                 | строка  | Insert column right                                                              | Вставить столбец справа                                                            |
| `tableDeleteRow`                      | строка  | Delete row                                                                       | Удалить строку                                                                     |
| `tableDeleteColumn`                   | строка  | Delete column                                                                    | Удалить столбец                                                                    |
| `tableHeaderRow`                      | строка  | Header row                                                                       | Строка-заголовок                                                                   |
| `tableAlignLeft`                      | строка  | Align column left                                                                | Столбец по левому краю                                                             |
| `tableAlignCenter`                    | строка  | Align column center                                                              | Столбец по центру                                                                  |
| `tableAlignRight`                     | строка  | Align column right                                                               | Столбец по правому краю                                                            |
| `tableSortAscending`                  | строка  | Sort ascending                                                                   | По возрастанию                                                                     |
| `tableSortDescending`                 | строка  | Sort descending                                                                  | По убыванию                                                                        |
| `tableSortMerged`                     | строка  | Unavailable: the table has merged cells                                          | Недоступно: в таблице есть объединённые ячейки                                     |
| `tableDelete`                         | строка  | Delete table                                                                     | Удалить таблицу                                                                    |
| `tableCancel`                         | строка  | Cancel                                                                           | Отмена                                                                             |
| `image`                               | строка  | Image                                                                            | Картинка                                                                           |
| `imageAddress`                        | строка  | Image address                                                                    | Адрес картинки                                                                     |
| `imageInvalid`                        | строка  | Enter an image address starting with https:// or http://                         | Нужен адрес картинки, начинающийся с https:// или http://                          |
| `imageAlt`                            | строка  | Alternative text                                                                 | Альтернативный текст                                                               |
| `imageAltHint`                        | строка  | Describe the image for people who can't see it. Leave empty if it is decorative. | Опишите картинку для тех, кто её не видит. Оставьте пустым, если она декоративная. |
| `imageInsert`                         | строка  | Insert                                                                           | Вставить                                                                           |
| `imageApply`                          | строка  | Apply                                                                            | Применить                                                                          |
| `imageChooseFile`                     | строка  | Upload from device                                                               | Загрузить с устройства                                                             |
| `imageRemove`                         | строка  | Remove image                                                                     | Убрать картинку                                                                    |
| `imageEdit`                           | строка  | Edit image                                                                       | Изменить картинку                                                                  |
| `imageWidth`                          | строка  | Width                                                                            | Ширина                                                                             |
| `imageWidthPreset`                    | функция | —                                                                                | —                                                                                  |
| `imageCaption`                        | строка  | Caption (optional)                                                               | Подпись (необязательно)                                                            |
| `imageUploading`                      | функция | —                                                                                | —                                                                                  |
| `imageUploaded`                       | функция | —                                                                                | —                                                                                  |
| `imageUploadFailed`                   | функция | —                                                                                | —                                                                                  |
| `imageNotImage`                       | функция | —                                                                                | —                                                                                  |
| `imageFilesUnsupported`               | строка  | Files can't be uploaded here. Insert the image by its address.                   | Файлы здесь не загружаются. Вставьте картинку по адресу.                           |
| `toolsFailed`                         | строка  | The editor couldn't start. The document is unchanged.                            | Редактор не запустился. Документ не изменён.                                       |
| `retry`                               | строка  | Retry                                                                            | Повторить                                                                          |
| `textCardShown`                       | функция | —                                                                                | —                                                                                  |
| `tableGrid`                           | строка  | Table size                                                                       | Размер таблицы                                                                     |
| `tableSize`                           | функция | —                                                                                | —                                                                                  |
| `tableColumns`                        | строка  | Columns                                                                          | Столбцы                                                                            |
| `tableRows`                           | строка  | Rows                                                                             | Строки                                                                             |
| `tableInsert`                         | строка  | Insert                                                                           | Вставить                                                                           |
| `layout`                              | строка  | Layout                                                                           | Раскладка                                                                          |
| `layoutVariant.100`                   | строка  | Single column                                                                    | Одна колонка                                                                       |
| `layoutVariant.50-50`                 | строка  | Two columns                                                                      | Две колонки                                                                        |
| `layoutVariant.33-33-33`              | строка  | Three columns                                                                    | Три колонки                                                                        |
| `layoutVariant.25-25-25-25`           | строка  | Four columns                                                                     | Четыре колонки                                                                     |
| `layoutVariant.60-40`                 | строка  | 60/40                                                                            | 60/40                                                                              |
| `layoutVariant.40-60`                 | строка  | 40/60                                                                            | 40/60                                                                              |
| `wrapper`                             | строка  | Wrapper                                                                          | Обёртка                                                                            |
| `unwrap`                              | строка  | Unwrap                                                                           | Снять обёртку                                                                      |
| `wrapperTone`                         | функция | —                                                                                | —                                                                                  |
| `wrapperToneNone`                     | строка  | None                                                                             | Без тона                                                                           |
| `wrapperToneName.accent`              | строка  | Note                                                                             | Заметка                                                                            |
| `wrapperToneName.success`             | строка  | Tip                                                                              | Совет                                                                              |
| `wrapperToneName.neutral`             | строка  | Important                                                                        | Важно                                                                              |
| `wrapperToneName.warning`             | строка  | Warning                                                                          | Внимание                                                                           |
| `wrapperToneName.danger`              | строка  | Caution                                                                          | Осторожно                                                                          |
| `details`                             | строка  | Collapsible block                                                                | Сворачиваемый блок                                                                 |
| `unwrapDetails`                       | строка  | Remove collapsing                                                                | Снять сворачивание                                                                 |
| `detailsToggle`                       | функция | —                                                                                | —                                                                                  |
| `emoji`                               | строка  | Emoji                                                                            | Эмодзи                                                                             |
| `emojiGrid`                           | строка  | Choose an emoji                                                                  | Выберите эмодзи                                                                    |
| `emojiCategory.favorites`             | строка  | Favorites                                                                        | Избранное                                                                          |
| `emojiCategory.smileys`               | строка  | Smileys                                                                          | Смайлы                                                                             |
| `emojiCategory.gestures`              | строка  | Gestures                                                                         | Жесты                                                                              |
| `emojiCategory.animals`               | строка  | Animals                                                                          | Животные                                                                           |
| `emojiCategory.food`                  | строка  | Food                                                                             | Еда                                                                                |
| `emojiCategory.activities`            | строка  | Activities                                                                       | Занятия                                                                            |
| `emojiCategory.travel`                | строка  | Travel                                                                           | Путешествия                                                                        |
| `emojiName.faceWithTearsOfJoy`        | строка  | Face with tears of joy                                                           | Лицо со слезами радости                                                            |
| `emojiName.redHeart`                  | строка  | Red heart                                                                        | Красное сердце                                                                     |
| `emojiName.rollingOnTheFloorLaughing` | строка  | Rolling on the floor laughing                                                    | Катаюсь по полу от смеха                                                           |
| `emojiName.thumbsUp`                  | строка  | Thumbs up                                                                        | Большой палец вверх                                                                |
| `emojiName.loudlyCrying`              | строка  | Loudly crying face                                                               | Громко плачущее лицо                                                               |
| `emojiName.foldedHands`               | строка  | Folded hands                                                                     | Сложенные ладони                                                                   |
| `emojiName.blowingKiss`               | строка  | Face blowing a kiss                                                              | Воздушный поцелуй                                                                  |
| `emojiName.smilingWithHearts`         | строка  | Smiling face with hearts                                                         | Улыбающееся лицо с сердечками                                                      |
| `emojiName.heartEyes`                 | строка  | Heart eyes                                                                       | Глаза-сердечки                                                                     |
| `emojiName.partyPopper`               | строка  | Party popper                                                                     | Хлопушка                                                                           |
| `emojiName.beamingFace`               | строка  | Beaming face                                                                     | Сияющее лицо                                                                       |
| `emojiName.fire`                      | строка  | Fire                                                                             | Огонь                                                                              |
| `emojiName.birthdayCake`              | строка  | Birthday cake                                                                    | Праздничный торт                                                                   |
| `emojiName.flushedFace`               | строка  | Flushed face                                                                     | Смущённое лицо                                                                     |
| `emojiName.sunglassesFace`            | строка  | Face with sunglasses                                                             | Лицо в солнечных очках                                                             |
| `emojiName.sparkles`                  | строка  | Sparkles                                                                         | Искры                                                                              |
| `emojiName.eyes`                      | строка  | Eyes                                                                             | Глаза                                                                              |
| `emojiName.pointingRight`             | строка  | Pointing right                                                                   | Указывает вправо                                                                   |
| `emojiName.hundredPoints`             | строка  | Hundred points                                                                   | Сто баллов                                                                         |
| `emojiName.angryFace`                 | строка  | Angry face                                                                       | Сердитое лицо                                                                      |
| `emojiName.slightlySmiling`           | строка  | Slightly smiling face                                                            | Слегка улыбающееся лицо                                                            |
| `emojiName.grinningSmilingEyes`       | строка  | Grinning face with smiling eyes                                                  | Ухмыляющееся лицо с улыбающимися глазами                                           |
| `emojiName.grinningSquinting`         | строка  | Grinning squinting face                                                          | Ухмыляющееся лицо с прищуром                                                       |
| `emojiName.winkingFace`               | строка  | Winking face                                                                     | Подмигивающее лицо                                                                 |
| `emojiName.tongueFace`                | строка  | Face with tongue                                                                 | Лицо с высунутым языком                                                            |
| `emojiName.smilingBlushing`           | строка  | Smiling face with smiling eyes                                                   | Улыбающееся лицо с улыбающимися глазами и румянцем                                 |
| `emojiName.smirkingFace`              | строка  | Smirking face                                                                    | Самодовольное лицо                                                                 |
| `emojiName.thinkingFace`              | строка  | Thinking face                                                                    | Задумавшееся лицо                                                                  |
| `emojiName.sleepyFace`                | строка  | Sleepy face                                                                      | Сонное лицо                                                                        |
| `emojiName.thumbsDown`                | строка  | Thumbs down                                                                      | Большой палец вниз                                                                 |
| `emojiName.victoryHand`               | строка  | Victory hand                                                                     | Жест победы                                                                        |
| `emojiName.clappingHands`             | строка  | Clapping hands                                                                   | Аплодисменты                                                                       |
| `emojiName.raisedHands`               | строка  | Raising hands                                                                    | Поднятые руки                                                                      |
| `emojiName.facepalm`                  | строка  | Facepalm                                                                         | Рука у лица                                                                        |
| `emojiName.shrug`                     | строка  | Shrug                                                                            | Пожимает плечами                                                                   |
| `emojiName.oncomingFist`              | строка  | Oncoming fist                                                                    | Кулак                                                                              |
| `emojiName.wavingHand`                | строка  | Waving hand                                                                      | Машущая рука                                                                       |
| `emojiName.okHand`                    | строка  | OK hand                                                                          | Жест «окей»                                                                        |
| `emojiName.dog`                       | строка  | Dog                                                                              | Собака                                                                             |
| `emojiName.cat`                       | строка  | Cat                                                                              | Кошка                                                                              |
| `emojiName.mouse`                     | строка  | Mouse                                                                            | Мышь                                                                               |
| `emojiName.hamster`                   | строка  | Hamster                                                                          | Хомяк                                                                              |
| `emojiName.rabbit`                    | строка  | Rabbit                                                                           | Кролик                                                                             |
| `emojiName.bear`                      | строка  | Bear                                                                             | Медведь                                                                            |
| `emojiName.panda`                     | строка  | Panda                                                                            | Панда                                                                              |
| `emojiName.lion`                      | строка  | Lion                                                                             | Лев                                                                                |
| `emojiName.pig`                       | строка  | Pig                                                                              | Свинья                                                                             |
| `emojiName.frog`                      | строка  | Frog                                                                             | Лягушка                                                                            |
| `emojiName.greenApple`                | строка  | Green apple                                                                      | Зелёное яблоко                                                                     |
| `emojiName.pizza`                     | строка  | Pizza                                                                            | Пицца                                                                              |
| `emojiName.hamburger`                 | строка  | Hamburger                                                                        | Гамбургер                                                                          |
| `emojiName.frenchFries`               | строка  | French fries                                                                     | Картофель фри                                                                      |
| `emojiName.spaghetti`                 | строка  | Spaghetti                                                                        | Спагетти                                                                           |
| `emojiName.sushi`                     | строка  | Sushi                                                                            | Суши                                                                               |
| `emojiName.iceCream`                  | строка  | Ice cream                                                                        | Мороженое                                                                          |
| `emojiName.doughnut`                  | строка  | Doughnut                                                                         | Пончик                                                                             |
| `emojiName.cookie`                    | строка  | Cookie                                                                           | Печенье                                                                            |
| `emojiName.shortcake`                 | строка  | Shortcake                                                                        | Кусок торта                                                                        |
| `emojiName.soccerBall`                | строка  | Soccer ball                                                                      | Футбольный мяч                                                                     |
| `emojiName.basketball`                | строка  | Basketball                                                                       | Баскетбольный мяч                                                                  |
| `emojiName.americanFootball`          | строка  | American football                                                                | Мяч для американского футбола                                                      |
| `emojiName.baseball`                  | строка  | Baseball                                                                         | Бейсбольный мяч                                                                    |
| `emojiName.tennis`                    | строка  | Tennis                                                                           | Теннис                                                                             |
| `emojiName.bowling`                   | строка  | Bowling                                                                          | Боулинг                                                                            |
| `emojiName.golfer`                    | строка  | Golfer                                                                           | Гольфист                                                                           |
| `emojiName.fishing`                   | строка  | Fishing                                                                          | Рыбалка                                                                            |
| `emojiName.cyclist`                   | строка  | Cyclist                                                                          | Велосипедист                                                                       |
| `emojiName.videoGame`                 | строка  | Video game                                                                       | Видеоигра                                                                          |
| `emojiName.airplane`                  | строка  | Airplane                                                                         | Самолёт                                                                            |
| `emojiName.car`                       | строка  | Car                                                                              | Автомобиль                                                                         |
| `emojiName.bicycle`                   | строка  | Bicycle                                                                          | Велосипед                                                                          |
| `emojiName.train`                     | строка  | Train                                                                            | Поезд                                                                              |
| `emojiName.sailboat`                  | строка  | Sailboat                                                                         | Парусник                                                                           |
| `emojiName.worldMap`                  | строка  | World map                                                                        | Карта мира                                                                         |
| `emojiName.beach`                     | строка  | Beach                                                                            | Пляж                                                                               |
| `emojiName.mountain`                  | строка  | Snow-capped mountain                                                             | Заснеженная гора                                                                   |
| `emojiName.camping`                   | строка  | Camping                                                                          | Кемпинг                                                                            |
| `emojiName.luggage`                   | строка  | Luggage                                                                          | Чемодан                                                                            |
| `source`                              | строка  | HTML                                                                             | HTML                                                                               |
| `sourceField`                         | строка  | HTML source                                                                      | HTML-код документа                                                                 |
| `search`                              | строка  | Find                                                                             | Найти                                                                              |
| `searchReplace`                       | строка  | Find and replace                                                                 | Найти и заменить                                                                   |
| `searchPanel`                         | строка  | Find and replace                                                                 | Поиск и замена                                                                     |
| `searchField`                         | строка  | Find                                                                             | Найти                                                                              |
| `replaceField`                        | строка  | Replace with                                                                     | Заменить на                                                                        |
| `searchPrevious`                      | строка  | Previous match                                                                   | Предыдущее совпадение                                                              |
| `searchNext`                          | строка  | Next match                                                                       | Следующее совпадение                                                               |
| `searchClose`                         | строка  | Close find and replace                                                           | Закрыть поиск                                                                      |
| `searchMatchCase`                     | строка  | Match case                                                                       | Учитывать регистр                                                                  |
| `searchWholeWord`                     | строка  | Whole words                                                                      | Слово целиком                                                                      |
| `searchRegex`                         | строка  | Regular expression                                                               | Регулярное выражение                                                               |
| `replaceOne`                          | строка  | Replace                                                                          | Заменить                                                                           |
| `replaceAll`                          | строка  | Replace all                                                                      | Заменить все                                                                       |
| `searchCount`                         | функция | —                                                                                | —                                                                                  |
| `searchNoMatches`                     | строка  | No matches                                                                       | Нет совпадений                                                                     |
| `searchInvalid`                       | строка  | Invalid regular expression                                                       | Неверное регулярное выражение                                                      |
| `resizeField`                         | строка  | Resize the editor                                                                | Изменить высоту поля                                                               |
| `fieldHeight`                         | функция | —                                                                                | —                                                                                  |
| `shortcuts`                           | строка  | Keyboard shortcuts                                                               | Сочетания клавиш                                                                   |
| `shortcutsCommand`                    | строка  | Command                                                                          | Команда                                                                            |
| `shortcutsKeys`                       | строка  | Shortcut                                                                         | Сочетание                                                                          |
| `selectBlock`                         | строка  | Select block text                                                                | Выделить текст блока                                                               |
| `selectDocument`                      | строка  | Select all (second press)                                                        | Выделить всё (второе нажатие)                                                      |
| `duplicateBlock`                      | строка  | Duplicate block                                                                  | Дублировать блок                                                                   |
| `moveBlockUp`                         | строка  | Move block up                                                                    | Переместить блок вверх                                                             |
| `moveBlockDown`                       | строка  | Move block down                                                                  | Переместить блок вниз                                                              |
| `indentListItem`                      | строка  | Indent list item                                                                 | Сдвинуть пункт списка вправо                                                       |
| `outdentListItem`                     | строка  | Outdent list item                                                                | Сдвинуть пункт списка влево                                                        |
| `focusToolbar`                        | строка  | Go to the toolbar                                                                | Перейти в панель                                                                   |
| `blockActions`                        | строка  | Block actions                                                                    | Действия с блоком                                                                  |
| `blockAdd`                            | строка  | Add                                                                              | Добавить                                                                           |
| `blockFormat`                         | строка  | Format                                                                           | Формат                                                                             |
| `blockMoveUp`                         | строка  | Move up                                                                          | Вверх                                                                              |
| `blockMoveDown`                       | строка  | Move down                                                                        | Вниз                                                                               |
| `blockDuplicate`                      | строка  | Duplicate                                                                        | Дублировать                                                                        |
| `blockDelete`                         | строка  | Delete                                                                           | Удалить                                                                            |
| `toc`                                 | строка  | Table of contents                                                                | Оглавление                                                                         |

## `errorState`

| Ключ    | Форма  | `en-US`        | `ru-RU`         |
| ------- | ------ | -------------- | --------------- |
| `title` | строка | Failed to load | Ошибка загрузки |

## `fileDropzone`

| Ключ                 | Форма   | `en-US`                   | `ru-RU`                      |
| -------------------- | ------- | ------------------------- | ---------------------------- |
| `label`              | строка  | Drop files here           | Перетащите файлы сюда        |
| `browse`             | строка  | Choose files              | Выбрать файлы                |
| `tooLarge`           | функция | —                         | —                            |
| `singleFileOnly`     | строка  | only one file is accepted | принимается только один файл |
| `foldersNotAccepted` | строка  | folders are not accepted  | папки не принимаются         |
| `folderName`         | строка  | folder                    | папка                        |
| `wrongType`          | строка  | Unsupported type          | Неподходящий тип             |
| `unreadable`         | строка  | Could not be read         | Не удалось прочитать         |

## `filterBar`

| Ключ           | Форма   | `en-US`         | `ru-RU`             |
| -------------- | ------- | --------------- | ------------------- |
| `label`        | строка  | Applied filters | Применённые фильтры |
| `remove`       | строка  | Remove filter   | Снять фильтр        |
| `clear`        | строка  | Clear all       | Снять все           |
| `add`          | строка  | Add filter      | Добавить фильтр     |
| `field`        | строка  | Field           | Поле                |
| `value`        | строка  | Value           | Значение            |
| `apply`        | строка  | Apply           | Применить           |
| `fromField`    | строка  | From            | От                  |
| `toField`      | строка  | To              | До                  |
| `rangeBetween` | функция | —               | —                   |
| `rangeFrom`    | функция | —               | —                   |
| `rangeTo`      | функция | —               | —                   |

## `inlineEdit`

| Ключ    | Форма  | `en-US` | `ru-RU`   |
| ------- | ------ | ------- | --------- |
| `edit`  | строка | edit    | изменить  |
| `empty` | строка | Not set | Не задано |

Окончание доступного имени кнопки-значения: «Ежедневная подборка, изменить». Имя
строится из содержимого, а не задаётся `aria-label`: иначе значение из имени
пропадает.

## `keyboard`

| Ключ                 | Форма   | `en-US`                      | `ru-RU`                                |
| -------------------- | ------- | ---------------------------- | -------------------------------------- |
| `label`              | функция | —                            | —                                      |
| `close`              | строка  | Close the on-screen keyboard | Закрыть экранную клавиатуру            |
| `move`               | строка  | Move the on-screen keyboard  | Перемещать экранную клавиатуру         |
| `switchLayout`       | строка  | Switch layout                | Сменить раскладку                      |
| `switchLayoutTo`     | функция | —                            | —                                      |
| `showSymbols`        | строка  | Show symbols                 | Показать символы                       |
| `showLetters`        | функция | —                            | —                                      |
| `showPrimarySymbols` | строка  | Show the primary symbol set  | Показать основной набор символов       |
| `showExtraSymbols`   | строка  | Show the extra symbol set    | Показать дополнительный набор символов |
| `backspace`          | строка  | Delete character             | Удалить символ                         |
| `space`              | строка  | Space                        | Пробел                                 |
| `submit`             | строка  | Submit search                | Отправить поиск                        |
| `keyComma`           | строка  | Comma                        | Запятая                                |
| `keyPeriod`          | строка  | Period                       | Точка                                  |
| `keyLess`            | строка  | Less than                    | Меньше                                 |
| `keyGreater`         | строка  | Greater than                 | Больше                                 |
| `keySemicolon`       | строка  | Semicolon                    | Точка с запятой                        |
| `keyColon`           | строка  | Colon                        | Двоеточие                              |

## `link`

| Ключ            | Форма  | `en-US`              | `ru-RU`                     |
| --------------- | ------ | -------------------- | --------------------------- |
| `opensInNewTab` | строка | (opens in a new tab) | (откроется в новой вкладке) |

## `maskedInput`

| Ключ        | Форма   | `en-US`                       | `ru-RU`                 |
| ----------- | ------- | ----------------------------- | ----------------------- |
| `rejected`  | функция | A digit is expected here      | Здесь нужна цифра       |
| `full`      | строка  | The field is already complete | Поле уже заполнено      |
| `truncated` | функция | …is N characters too long…    | …длиннее на N символов… |

`rejected` принимает `{ expected: "digit" | "letter" | "any" }` и говорит, что именно
здесь ждали. `truncated` принимает `{ count }` — сколько символов вставки не
влезло; появился в 3.5.0, до него обрезка вставки не объявлялась.

## `mediaCard`

| Ключ     | Форма  | `en-US` | `ru-RU` |
| -------- | ------ | ------- | ------- |
| `select` | строка | Select  | Выбрать |

## `megaMenu`

| Ключ   | Форма  | `en-US` | `ru-RU` |
| ------ | ------ | ------- | ------- |
| `back` | строка | Back    | Назад   |

## `mobileTabBar`

| Ключ       | Форма   | `en-US`  | `ru-RU`    |
| ---------- | ------- | -------- | ---------- |
| `label`    | строка  | Sections | Разделы    |
| `new`      | строка  | New      | Есть новое |
| `newCount` | функция | —        | —          |

## `nav`

| Ключ       | Форма  | `en-US`             | `ru-RU`              |
| ---------- | ------ | ------------------- | -------------------- |
| `label`    | строка | Main navigation     | Основная навигация   |
| `collapse` | строка | Collapse navigation | Свернуть навигацию   |
| `expand`   | строка | Expand navigation   | Развернуть навигацию |

## `notifications`

| Ключ          | Форма   | `en-US`       | `ru-RU`      |
| ------------- | ------- | ------------- | ------------ |
| `label`       | строка  | Notifications | Уведомления  |
| `unread`      | строка  | Unread        | Не прочитано |
| `unreadCount` | функция | —             | —            |

## `numberInput`

| Ключ        | Форма   | `en-US` | `ru-RU` |
| ----------- | ------- | ------- | ------- |
| `decrement` | функция | —       | —       |
| `increment` | функция | —       | —       |

## `pagination`

| Ключ       | Форма  | `en-US`       | `ru-RU`             |
| ---------- | ------ | ------------- | ------------------- |
| `label`    | строка | Pages         | Страницы            |
| `previous` | строка | Previous page | Предыдущая страница |
| `next`     | строка | Next page     | Следующая страница  |

## `passwordInput`

| Ключ       | Форма  | `en-US`         | `ru-RU`           |
| ---------- | ------ | --------------- | ----------------- |
| `toggle`   | строка | Show password   | Показать пароль   |
| `capsLock` | строка | Caps Lock is on | Включён Caps Lock |

Подпись кнопки показа одна на оба состояния: состояние объявляет `aria-pressed`,
и меняющееся вместе с ним имя читалось бы как «Скрыть пароль, нажато».

## `pinInput`

| Ключ    | Форма   | `en-US` | `ru-RU` |
| ------- | ------- | ------- | ------- |
| `digit` | функция | —       | —       |

«Цифра 3 из 6» — имя одного поля кода. Без него скринридер читает N безымянных
полей подряд.

## `rating`

| Ключ    | Форма   | `en-US` | `ru-RU` |
| ------- | ------- | ------- | ------- |
| `value` | функция | —       | —       |
| `star`  | функция | —       | —       |

## `savedViews`

| Ключ    | Форма  | `en-US`     | `ru-RU`          |
| ------- | ------ | ----------- | ---------------- |
| `label` | строка | Saved views | Сохранённые виды |

## `searchControl`

| Ключ           | Форма  | `en-US`                     | `ru-RU`                     |
| -------------- | ------ | --------------------------- | --------------------------- |
| `clear`        | строка | Clear search                | Очистить поиск              |
| `openKeyboard` | строка | Open the on-screen keyboard | Открыть экранную клавиатуру |

## `selectionBar`

| Ключ             | Форма   | `en-US`              | `ru-RU`                |
| ---------------- | ------- | -------------------- | ---------------------- |
| `label`          | строка  | Actions on selection | Действия над выбранным |
| `clearSelection` | строка  | Clear selection      | Снять выделение        |
| `count`          | функция | —                    | —                      |

## `shell`

| Ключ             | Форма  | `en-US`         | `ru-RU`               |
| ---------------- | ------ | --------------- | --------------------- |
| `skipToContent`  | строка | Skip to content | Перейти к содержимому |
| `openNavigation` | строка | Open navigation | Открыть навигацию     |

## `shortcutsHelp`

| Ключ           | Форма  | `en-US`            | `ru-RU`          |
| -------------- | ------ | ------------------ | ---------------- |
| `title`        | строка | Keyboard shortcuts | Горячие клавиши  |
| `list`         | строка | Shortcuts          | Сочетания клавиш |
| `keySeparator` | строка | plus               | плюс             |

`list` — имя области прокрутки со списком сочетаний; оно отличается от `title`, чтобы
скринридер не произносил имя окна дважды. `keySeparator` — слово между
клавишами сочетания для скринридера («Ctrl плюс K»): видимый «+» скрыт, потому
что NVDA по умолчанию знак плюса не читает.

## `sortableList`

| Ключ   | Форма  | `en-US` | `ru-RU`    |
| ------ | ------ | ------- | ---------- |
| `drag` | строка | Drag    | Перетащить |

## `spinner`

| Ключ    | Форма  | `en-US` | `ru-RU`  |
| ------- | ------ | ------- | -------- |
| `label` | строка | Loading | Загрузка |

## `splitButton`

| Ключ   | Форма   | `en-US` | `ru-RU` |
| ------ | ------- | ------- | ------- |
| `more` | функция | —       | —       |

## `splitPanel`

| Ключ          | Форма   | `en-US`          | `ru-RU`                |
| ------------- | ------- | ---------------- | ---------------------- |
| `resize`      | строка  | Resize the panel | Изменить размер панели |
| `resizeNamed` | функция | —                | —                      |
| `size`        | функция | —                | —                      |

## `stepper`

| Ключ    | Форма   | `en-US`                                | `ru-RU`                          |
| ------- | ------- | -------------------------------------- | -------------------------------- |
| `label` | строка  | Steps                                  | Шаги                             |
| `state` | функция | completed / current step / not started | пройден / текущий шаг / не начат |

## `table`

| Ключ           | Форма   | `en-US`         | `ru-RU`             |
| -------------- | ------- | --------------- | ------------------- |
| `empty`        | строка  | Nothing here    | Ничего нет          |
| `selectAll`    | строка  | Select all rows | Выделить все строки |
| `selectRow`    | строка  | Select row      | Выделить строку     |
| `expandColumn` | строка  | Row details     | Подробности строки  |
| `expandRow`    | функция | —               | —                   |
| `collapseRow`  | функция | —               | —                   |

## `tablePreferences`

| Ключ          | Форма   | `en-US`     | `ru-RU`   |
| ------------- | ------- | ----------- | --------- |
| `columns`     | строка  | Columns     | Колонки   |
| `density`     | строка  | Density     | Плотность |
| `comfortable` | строка  | Comfortable | Свободно  |
| `compact`     | строка  | Compact     | Плотно    |
| `moveUp`      | функция | —           | —         |
| `moveDown`    | функция | —           | —         |

## `tableToolbar`

| Ключ          | Форма   | `en-US`        | `ru-RU`           |
| ------------- | ------- | -------------- | ----------------- |
| `total`       | функция | —              | —                 |
| `preferences` | строка  | Table settings | Настройки таблицы |

## `tagGroup`

| Ключ     | Форма   | `en-US` | `ru-RU` |
| -------- | ------- | ------- | ------- |
| `remove` | функция | —       | —       |

Имя кнопки удаления **с** подписью тега внутри строки («Удалить: Дизайн»). У
`tagInput.remove` подписи тега в имени нет, поэтому там обычная строка. В первом
случае порядок слов принадлежит языку, поэтому это функция.

## `tagInput`

| Ключ     | Форма   | `en-US`    | `ru-RU`      |
| -------- | ------- | ---------- | ------------ |
| `remove` | строка  | Remove tag | Убрать тег   |
| `add`    | строка  | Add tag    | Добавить тег |
| `addTo`  | функция | —          | —            |

## `timePicker`

| Ключ            | Форма  | `en-US` | `ru-RU` |
| --------------- | ------ | ------- | ------- |
| `label`         | строка | Time    | Время   |
| `placeholder`   | строка | HH:MM   | ЧЧ:ММ   |
| `placeholder12` | строка | h:mm AM | Ч:ММ AM |
| `am`            | строка | AM      | AM      |
| `pm`            | строка | PM      | PM      |

## `topbar`

| Ключ    | Форма  | `en-US`            | `ru-RU`          |
| ------- | ------ | ------------------ | ---------------- |
| `label` | строка | Application header | Шапка приложения |

## `transfer`

| Ключ           | Форма   | `en-US`           | `ru-RU`               |
| -------------- | ------- | ----------------- | --------------------- |
| `source`       | строка  | Available         | Доступно              |
| `target`       | строка  | Selected          | Выбрано               |
| `moveToTarget` | строка  | Move to selected  | Перенести в выбранное |
| `moveToSource` | строка  | Move to available | Вернуть в доступное   |
| `searchIn`     | функция | —                 | —                     |

## `treeSelect`

| Ключ          | Форма   | `en-US`       | `ru-RU`       |
| ------------- | ------- | ------------- | ------------- |
| `placeholder` | строка  | Select a node | Выберите узел |
| `more`        | функция | —             | —             |

## `treeView`

| Ключ       | Форма  | `en-US`  | `ru-RU`  |
| ---------- | ------ | -------- | -------- |
| `expand`   | строка | Expand   | Раскрыть |
| `collapse` | строка | Collapse | Свернуть |
| `select`   | строка | Select   | Выбрать  |

Имена кнопок раскрытия **без** подписи узла: react-aria дописывает её сама, и
«Раскрыть Природа» читалось бы как «Раскрыть Природа Природа».

## `uploadQueue`

| Ключ           | Форма   | `en-US`         | `ru-RU`          |
| -------------- | ------- | --------------- | ---------------- |
| `label`        | строка  | Upload queue    | Очередь загрузки |
| `summary`      | функция | —               | —                |
| `progress`     | строка  | Upload progress | Ход загрузки     |
| `itemProgress` | функция | —               | —                |

## `period`

| Ключ                | Форма   | `en-US`    | `ru-RU`       |
| ------------------- | ------- | ---------- | ------------- |
| `presets.7d`        | строка  | 7 days     | 7 дней        |
| `presets.30d`       | строка  | 30 days    | 30 дней       |
| `presets.90d`       | строка  | 90 days    | 90 дней       |
| `presets.365d`      | строка  | Year       | Год           |
| `presets.thisMonth` | строка  | This month | Этот месяц    |
| `presets.lastMonth` | строка  | Last month | Прошлый месяц |
| `length`            | функция | —          | —             |
