# Message catalog `UiMessages`

The public contract: key names and the shape of a value. The kit takes a string in this order: `prop → provider message → fallback`. To connect a catalog, see [i18n.md](../i18n.md).

A function key takes parameters. The string is built inside the locale, not joined together in the component: inflection also lives in the locale. The value columns for such keys are empty, because a function cannot show one fixed value.

This page is updated together with the key. The gate `tests/i18n-gate.test.ts` checks that the Russian locale is complete, but it does not check this page. If the table and the code disagree, the table is wrong.

## `common`

| Key                 | Shape  | `en-US`       | `ru-RU`           |
| ------------------- | ------ | ------------- | ----------------- |
| `close`             | string | Close         | Закрыть           |
| `clear`             | string | Clear         | Очистить          |
| `notFound`          | string | Nothing found | Ничего не найдено |
| `empty`             | string | Empty         | Пусто             |
| `loading`           | string | Loading       | Загрузка          |
| `searchPlaceholder` | string | Search…       | Поиск…            |

## `alert`

| Key     | Shape  | `en-US`         | `ru-RU`           |
| ------- | ------ | --------------- | ----------------- |
| `close` | string | Dismiss message | Закрыть сообщение |

## `banner`

| Key     | Shape  | `en-US`              | `ru-RU`           |
| ------- | ------ | -------------------- | ----------------- |
| `close` | string | Dismiss announcement | Скрыть объявление |

## `breadcrumbs`

| Key         | Shape    | `en-US`     | `ru-RU`        |
| ----------- | -------- | ----------- | -------------- |
| `label`     | string   | Breadcrumbs | Хлебные крошки |
| `collapsed` | function | —           | —              |

## `carousel`

| Key                    | Shape    | `en-US`        | `ru-RU`          |
| ---------------------- | -------- | -------------- | ---------------- |
| `roleDescription`      | string   | carousel       | карусель         |
| `slideRoleDescription` | string   | slide          | слайд            |
| `previous`             | string   | Previous slide | Предыдущий слайд |
| `next`                 | string   | Next slide     | Следующий слайд  |
| `slide`                | function | —              | —                |

`roleDescription` and `slideRoleDescription` are the text of `aria-roledescription`: what a screen reader announces instead of the role. That is why this text is translated. `slide` is the name of a slide by its position, for example "2 из 5" in the Russian locale. The role adds the word "slide" to it.

## `colorPicker`

| Key       | Shape  | `en-US` | `ru-RU`   |
| --------- | ------ | ------- | --------- |
| `presets` | string | Presets | Заготовки |
| `hex`     | string | HEX     | HEX       |

## `combobox`

| Key               | Shape  | `en-US`          | `ru-RU`            |
| ----------------- | ------ | ---------------- | ------------------ |
| `showSuggestions` | string | Show suggestions | Показать подсказки |

## `commandPalette`

| Key           | Shape  | `en-US`                     | `ru-RU`                           |
| ------------- | ------ | --------------------------- | --------------------------------- |
| `title`       | string | Command palette             | Командная палитра                 |
| `placeholder` | string | Search actions              | Поиск по действиям                |
| `emptyHint`   | string | Start typing an action name | Начните вводить название действия |

## `confirmDialog`

| Key                 | Shape    | `en-US`                      | `ru-RU`        |
| ------------------- | -------- | ---------------------------- | -------------- |
| `confirm`           | string   | Confirm                      | Подтвердить    |
| `cancel`            | string   | Cancel                       | Отменить       |
| `typeToConfirm`     | function | —                            | —              |
| `typeToConfirmHint` | string   | The match is case-sensitive. | Регистр важен. |

## `contextualSaveBar`

| Key       | Shape    | `en-US`                  | `ru-RU`                      |
| --------- | -------- | ------------------------ | ---------------------------- |
| `label`   | string   | Unsaved changes          | Несохранённые изменения      |
| `unsaved` | string   | You have unsaved changes | Есть несохранённые изменения |
| `changes` | function | —                        | —                            |
| `save`    | string   | Save                     | Сохранить                    |
| `cancel`  | string   | Discard                  | Отменить                     |
| `saving`  | string   | Saving…                  | Сохранение…                  |

## `copyButton`

| Key      | Shape  | `en-US`        | `ru-RU`                |
| -------- | ------ | -------------- | ---------------------- |
| `copy`   | string | Copy           | Копировать             |
| `copied` | string | Copied         | Скопировано            |
| `failed` | string | Could not copy | Не удалось скопировать |

## `datePicker`

| Key           | Shape  | `en-US`     | `ru-RU`      |
| ------------- | ------ | ----------- | ------------ |
| `placeholder` | string | Pick a date | Выбрать дату |

## `dateRangePicker`

| Key           | Shape  | `en-US`       | `ru-RU`        |
| ------------- | ------ | ------------- | -------------- |
| `placeholder` | string | Pick a period | Выбрать период |

## `editableList`

| Key          | Shape  | `en-US` | `ru-RU`    |
| ------------ | ------ | ------- | ---------- |
| `drag`       | string | Drag    | Перетащить |
| `emptyValue` | string | Not set | Не задано  |

## `editor`

The Editor's strings ([rich-text-editor.md](../components/inputs/rich-text-editor.md)) live in the shared catalog, not in a catalog of their own. Keys with a dot are nested: `emojiName.*` is the name of each emoji, and `emojiCategory.*` is the name of each category. `typographyQuotes` is not text for the screen but the language of the quote set of the `typography` Tool: `ru` (guillemets and low-9 quotes) or `en` (curly quotes); a catalog of another language keeps `en`, or the `quotes` option sets the quotes.

| Key                                   | Shape    | `en-US`                                                                          | `ru-RU`                                                                            |
| ------------------------------------- | -------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `label`                               | string   | Rich text editor                                                                 | Редактор текста                                                                    |
| `placeholder`                         | string   | Start writing…                                                                   | Начните писать…                                                                    |
| `remaining`                           | function | —                                                                                | —                                                                                  |
| `overLimit`                           | function | —                                                                                | —                                                                                  |
| `required`                            | string   | Fill in this field                                                               | Заполните это поле                                                                 |
| `toolbar`                             | string   | Formatting                                                                       | Форматирование                                                                     |
| `selectionToolbar`                    | string   | Selection formatting                                                             | Форматирование выделения                                                           |
| `textStyle`                           | function | —                                                                                | —                                                                                  |
| `blockTypeMenu`                       | string   | Block type                                                                       | Тип блока                                                                          |
| `blockType`                           | function | —                                                                                | —                                                                                  |
| `moreFormatting`                      | string   | More formatting                                                                  | Ещё форматирование                                                                 |
| `textBlock`                           | string   | Text                                                                             | Текст                                                                              |
| `paragraph`                           | string   | Paragraph                                                                        | Абзац                                                                              |
| `heading`                             | function | —                                                                                | —                                                                                  |
| `insertMenu`                          | string   | Insert block                                                                     | Добавить блок                                                                      |
| `insertSection`                       | string   | Insert                                                                           | Добавить                                                                           |
| `turnIntoSection`                     | string   | Turn into                                                                        | Превратить в                                                                       |
| `nothingFound`                        | string   | Nothing found                                                                    | Ничего не найдено                                                                  |
| `triggerList`                         | string   | Suggestions                                                                      | Подсказки                                                                          |
| `bold`                                | string   | Bold                                                                             | Жирный                                                                             |
| `italic`                              | string   | Italic                                                                           | Курсив                                                                             |
| `underline`                           | string   | Underline                                                                        | Подчёркнутый                                                                       |
| `strike`                              | string   | Strikethrough                                                                    | Зачёркнутый                                                                        |
| `code`                                | string   | Inline code                                                                      | Строчный код                                                                       |
| `superscript`                         | string   | Superscript                                                                      | Верхний индекс                                                                     |
| `subscript`                           | string   | Subscript                                                                        | Нижний индекс                                                                      |
| `clearFormatting`                     | string   | Clear formatting                                                                 | Очистить стили                                                                     |
| `link`                                | string   | Link                                                                             | Ссылка                                                                             |
| `linkAddress`                         | string   | Address                                                                          | Адрес                                                                              |
| `linkApply`                           | string   | Apply                                                                            | Применить                                                                          |
| `linkRemove`                          | string   | Remove link                                                                      | Убрать ссылку                                                                      |
| `linkInvalid`                         | string   | Enter a web address (http, https) or an email (mailto)                           | Нужен адрес сайта (http, https) или почты (mailto)                                 |
| `bulletList`                          | string   | Bulleted list                                                                    | Маркированный список                                                               |
| `orderedList`                         | string   | Numbered list                                                                    | Нумерованный список                                                                |
| `taskList`                            | string   | Checklist                                                                        | Чек-лист                                                                           |
| `blockquote`                          | string   | Quote                                                                            | Цитата                                                                             |
| `codeBlock`                           | string   | Code block                                                                       | Блок кода                                                                          |
| `codeLanguage`                        | function | —                                                                                | —                                                                                  |
| `codeLanguagePlain`                   | string   | Plain text                                                                       | Обычный текст                                                                      |
| `codeCopy`                            | string   | Copy code                                                                        | Копировать код                                                                     |
| `horizontalRule`                      | string   | Divider                                                                          | Разделитель                                                                        |
| `undo`                                | string   | Undo                                                                             | Отменить                                                                           |
| `redo`                                | string   | Redo                                                                             | Повторить                                                                          |
| `taskCheckbox`                        | function | —                                                                                | —                                                                                  |
| `highlight`                           | function | —                                                                                | —                                                                                  |
| `colorDefault`                        | string   | Default                                                                          | По умолчанию                                                                       |
| `highlightNone`                       | string   | None                                                                             | Без маркера                                                                        |
| `highlightToggle`                     | string   | Highlight                                                                        | Маркер                                                                             |
| `highlightRemove`                     | string   | Remove highlight                                                                 | Убрать маркер                                                                      |
| `colorRemove`                         | string   | Remove color                                                                     | Убрать цвет                                                                        |
| `color`                               | string   | Color                                                                            | Цвет                                                                               |
| `colorMenu`                           | function | —                                                                                | —                                                                                  |
| `textColorSection`                    | string   | Text color                                                                       | Цвет текста                                                                        |
| `highlightSection`                    | string   | Highlight color                                                                  | Цвет маркера                                                                       |
| `colorAccent`                         | string   | Accent                                                                           | Акцентный                                                                          |
| `colorSuccess`                        | string   | Green                                                                            | Зелёный                                                                            |
| `colorWarning`                        | string   | Amber                                                                            | Жёлтый                                                                             |
| `colorDanger`                         | string   | Red                                                                              | Красный                                                                            |
| `colorLime`                           | string   | Lime                                                                             | Лаймовый                                                                           |
| `colorMuted`                          | string   | Gray                                                                             | Серый                                                                              |
| `markerGray`                          | string   | Gray                                                                             | Серый                                                                              |
| `markerBrown`                         | string   | Brown                                                                            | Коричневый                                                                         |
| `markerOrange`                        | string   | Orange                                                                           | Оранжевый                                                                          |
| `markerYellow`                        | string   | Yellow                                                                           | Жёлтый                                                                             |
| `markerGreen`                         | string   | Green                                                                            | Зелёный                                                                            |
| `markerBlue`                          | string   | Blue                                                                             | Синий                                                                              |
| `markerPurple`                        | string   | Purple                                                                           | Фиолетовый                                                                         |
| `markerPink`                          | string   | Pink                                                                             | Розовый                                                                            |
| `markerRed`                           | string   | Red                                                                              | Красный                                                                            |
| `colorCustom`                         | string   | Custom color…                                                                    | Свой цвет…                                                                         |
| `colorCustomCurrent`                  | function | —                                                                                | —                                                                                  |
| `customColorText`                     | string   | Custom text color                                                                | Свой цвет текста                                                                   |
| `customColorHighlight`                | string   | Custom highlight color                                                           | Свой цвет маркера                                                                  |
| `customColorValue`                    | function | —                                                                                | —                                                                                  |
| `customColorApply`                    | string   | Apply                                                                            | Применить                                                                          |
| `customColorCancel`                   | string   | Cancel                                                                           | Отмена                                                                             |
| `customColorLowContrastText`          | function | —                                                                                | —                                                                                  |
| `customColorLowContrastHighlight`     | function | —                                                                                | —                                                                                  |
| `customColorThemeNote`                | string   | This color does not change with the theme.                                       | Этот цвет не меняется вместе с темой.                                              |
| `alignLeft`                           | string   | Align left                                                                       | По левому краю                                                                     |
| `alignCenter`                         | string   | Align center                                                                     | По центру                                                                          |
| `alignRight`                          | string   | Align right                                                                      | По правому краю                                                                    |
| `alignMenu`                           | function | —                                                                                | —                                                                                  |
| `listMenu`                            | function | —                                                                                | —                                                                                  |
| `table`                               | string   | Table                                                                            | Таблица                                                                            |
| `tableInsertDialog`                   | string   | Insert table…                                                                    | Вставить таблицу…                                                                  |
| `tableInsertDialogTitle`              | string   | Insert table                                                                     | Вставить таблицу                                                                   |
| `tableCell`                           | string   | Cell                                                                             | Ячейка                                                                             |
| `tableRow`                            | string   | Row                                                                              | Строка                                                                             |
| `tableColumn`                         | string   | Column                                                                           | Столбец                                                                            |
| `tableSort`                           | string   | Sort                                                                             | Сортировка                                                                         |
| `tableMergeCells`                     | string   | Merge cells                                                                      | Объединить ячейки                                                                  |
| `tableSplitCell`                      | string   | Split cell                                                                       | Разделить ячейку                                                                   |
| `tableAddRowBefore`                   | string   | Insert row above                                                                 | Вставить строку выше                                                               |
| `tableAddRowAfter`                    | string   | Insert row below                                                                 | Вставить строку ниже                                                               |
| `tableAddColumnBefore`                | string   | Insert column left                                                               | Вставить столбец слева                                                             |
| `tableAddColumnAfter`                 | string   | Insert column right                                                              | Вставить столбец справа                                                            |
| `tableDeleteRow`                      | string   | Delete row                                                                       | Удалить строку                                                                     |
| `tableDeleteColumn`                   | string   | Delete column                                                                    | Удалить столбец                                                                    |
| `tableHeaderRow`                      | string   | Header row                                                                       | Строка-заголовок                                                                   |
| `tableAlignLeft`                      | string   | Align column left                                                                | Столбец по левому краю                                                             |
| `tableAlignCenter`                    | string   | Align column center                                                              | Столбец по центру                                                                  |
| `tableAlignRight`                     | string   | Align column right                                                               | Столбец по правому краю                                                            |
| `tableSortAscending`                  | string   | Sort ascending                                                                   | По возрастанию                                                                     |
| `tableSortDescending`                 | string   | Sort descending                                                                  | По убыванию                                                                        |
| `tableSortMerged`                     | string   | Unavailable: the table has merged cells                                          | Недоступно: в таблице есть объединённые ячейки                                     |
| `tableDelete`                         | string   | Delete table                                                                     | Удалить таблицу                                                                    |
| `tableCancel`                         | string   | Cancel                                                                           | Отмена                                                                             |
| `image`                               | string   | Image                                                                            | Картинка                                                                           |
| `imageAddress`                        | string   | Image address                                                                    | Адрес картинки                                                                     |
| `imageInvalid`                        | string   | Enter an image address starting with https:// or http://                         | Нужен адрес картинки, начинающийся с https:// или http://                          |
| `imageAlt`                            | string   | Alternative text                                                                 | Альтернативный текст                                                               |
| `imageAltHint`                        | string   | Describe the image for people who can't see it. Leave empty if it is decorative. | Опишите картинку для тех, кто её не видит. Оставьте пустым, если она декоративная. |
| `imageInsert`                         | string   | Insert                                                                           | Вставить                                                                           |
| `imageApply`                          | string   | Apply                                                                            | Применить                                                                          |
| `imageChooseFile`                     | string   | Upload from device                                                               | Загрузить с устройства                                                             |
| `imageRemove`                         | string   | Remove image                                                                     | Убрать картинку                                                                    |
| `imageEdit`                           | string   | Edit image                                                                       | Изменить картинку                                                                  |
| `imageWidth`                          | string   | Width                                                                            | Ширина                                                                             |
| `imageWidthPreset`                    | function | —                                                                                | —                                                                                  |
| `imageCaption`                        | string   | Caption (optional)                                                               | Подпись (необязательно)                                                            |
| `imageUploading`                      | function | —                                                                                | —                                                                                  |
| `imageUploaded`                       | function | —                                                                                | —                                                                                  |
| `imageUploadFailed`                   | function | —                                                                                | —                                                                                  |
| `imageNotImage`                       | function | —                                                                                | —                                                                                  |
| `imageFilesUnsupported`               | string   | Files can't be uploaded here. Insert the image by its address.                   | Файлы здесь не загружаются. Вставьте картинку по адресу.                           |
| `toolsFailed`                         | string   | The editor couldn't start. The document is unchanged.                            | Редактор не запустился. Документ не изменён.                                       |
| `retry`                               | string   | Retry                                                                            | Повторить                                                                          |
| `textCardShown`                       | function | —                                                                                | —                                                                                  |
| `tableGrid`                           | string   | Table size                                                                       | Размер таблицы                                                                     |
| `tableSize`                           | function | —                                                                                | —                                                                                  |
| `tableColumns`                        | string   | Columns                                                                          | Столбцы                                                                            |
| `tableRows`                           | string   | Rows                                                                             | Строки                                                                             |
| `tableInsert`                         | string   | Insert                                                                           | Вставить                                                                           |
| `layout`                              | string   | Layout                                                                           | Раскладка                                                                          |
| `layoutVariant.100`                   | string   | Single column                                                                    | Одна колонка                                                                       |
| `layoutVariant.50-50`                 | string   | Two columns                                                                      | Две колонки                                                                        |
| `layoutVariant.33-33-33`              | string   | Three columns                                                                    | Три колонки                                                                        |
| `layoutVariant.25-25-25-25`           | string   | Four columns                                                                     | Четыре колонки                                                                     |
| `layoutVariant.60-40`                 | string   | 60/40                                                                            | 60/40                                                                              |
| `layoutVariant.40-60`                 | string   | 40/60                                                                            | 40/60                                                                              |
| `wrapper`                             | string   | Wrapper                                                                          | Обёртка                                                                            |
| `unwrap`                              | string   | Unwrap                                                                           | Снять обёртку                                                                      |
| `wrapperTone`                         | function | —                                                                                | —                                                                                  |
| `wrapperToneNone`                     | string   | None                                                                             | Без тона                                                                           |
| `wrapperToneName.accent`              | string   | Note                                                                             | Заметка                                                                            |
| `wrapperToneName.success`             | string   | Tip                                                                              | Совет                                                                              |
| `wrapperToneName.neutral`             | string   | Important                                                                        | Важно                                                                              |
| `wrapperToneName.warning`             | string   | Warning                                                                          | Внимание                                                                           |
| `wrapperToneName.danger`              | string   | Caution                                                                          | Осторожно                                                                          |
| `details`                             | string   | Collapsible block                                                                | Сворачиваемый блок                                                                 |
| `unwrapDetails`                       | string   | Remove collapsing                                                                | Снять сворачивание                                                                 |
| `detailsToggle`                       | function | —                                                                                | —                                                                                  |
| `mathInline`                          | string   | Formula                                                                          | Формула                                                                            |
| `mathBlock`                           | string   | Block formula                                                                    | Блочная формула                                                                    |
| `mathLatex`                           | string   | LaTeX                                                                            | LaTeX                                                                              |
| `mathPreview`                         | string   | Preview                                                                          | Предпросмотр                                                                       |
| `mathEmpty`                           | string   | The formula appears here                                                         | Здесь появится формула                                                             |
| `mathInvalid`                         | function | —                                                                                | —                                                                                  |
| `mathInsert`                          | string   | Insert                                                                           | Вставить                                                                           |
| `mathApply`                           | string   | Apply                                                                            | Применить                                                                          |
| `mathRemove`                          | string   | Remove formula                                                                   | Убрать формулу                                                                     |
| `emoji`                               | string   | Emoji                                                                            | Эмодзи                                                                             |
| `emojiGrid`                           | string   | Choose an emoji                                                                  | Выберите эмодзи                                                                    |
| `emojiCategory.favorites`             | string   | Favorites                                                                        | Избранное                                                                          |
| `emojiCategory.smileys`               | string   | Smileys                                                                          | Смайлы                                                                             |
| `emojiCategory.gestures`              | string   | Gestures                                                                         | Жесты                                                                              |
| `emojiCategory.animals`               | string   | Animals                                                                          | Животные                                                                           |
| `emojiCategory.food`                  | string   | Food                                                                             | Еда                                                                                |
| `emojiCategory.activities`            | string   | Activities                                                                       | Занятия                                                                            |
| `emojiCategory.travel`                | string   | Travel                                                                           | Путешествия                                                                        |
| `emojiName.faceWithTearsOfJoy`        | string   | Face with tears of joy                                                           | Лицо со слезами радости                                                            |
| `emojiName.redHeart`                  | string   | Red heart                                                                        | Красное сердце                                                                     |
| `emojiName.rollingOnTheFloorLaughing` | string   | Rolling on the floor laughing                                                    | Катаюсь по полу от смеха                                                           |
| `emojiName.thumbsUp`                  | string   | Thumbs up                                                                        | Большой палец вверх                                                                |
| `emojiName.loudlyCrying`              | string   | Loudly crying face                                                               | Громко плачущее лицо                                                               |
| `emojiName.foldedHands`               | string   | Folded hands                                                                     | Сложенные ладони                                                                   |
| `emojiName.blowingKiss`               | string   | Face blowing a kiss                                                              | Воздушный поцелуй                                                                  |
| `emojiName.smilingWithHearts`         | string   | Smiling face with hearts                                                         | Улыбающееся лицо с сердечками                                                      |
| `emojiName.heartEyes`                 | string   | Heart eyes                                                                       | Глаза-сердечки                                                                     |
| `emojiName.partyPopper`               | string   | Party popper                                                                     | Хлопушка                                                                           |
| `emojiName.beamingFace`               | string   | Beaming face                                                                     | Сияющее лицо                                                                       |
| `emojiName.fire`                      | string   | Fire                                                                             | Огонь                                                                              |
| `emojiName.birthdayCake`              | string   | Birthday cake                                                                    | Праздничный торт                                                                   |
| `emojiName.flushedFace`               | string   | Flushed face                                                                     | Смущённое лицо                                                                     |
| `emojiName.sunglassesFace`            | string   | Face with sunglasses                                                             | Лицо в солнечных очках                                                             |
| `emojiName.sparkles`                  | string   | Sparkles                                                                         | Искры                                                                              |
| `emojiName.eyes`                      | string   | Eyes                                                                             | Глаза                                                                              |
| `emojiName.pointingRight`             | string   | Pointing right                                                                   | Указывает вправо                                                                   |
| `emojiName.hundredPoints`             | string   | Hundred points                                                                   | Сто баллов                                                                         |
| `emojiName.angryFace`                 | string   | Angry face                                                                       | Сердитое лицо                                                                      |
| `emojiName.slightlySmiling`           | string   | Slightly smiling face                                                            | Слегка улыбающееся лицо                                                            |
| `emojiName.grinningSmilingEyes`       | string   | Grinning face with smiling eyes                                                  | Ухмыляющееся лицо с улыбающимися глазами                                           |
| `emojiName.grinningSquinting`         | string   | Grinning squinting face                                                          | Ухмыляющееся лицо с прищуром                                                       |
| `emojiName.winkingFace`               | string   | Winking face                                                                     | Подмигивающее лицо                                                                 |
| `emojiName.tongueFace`                | string   | Face with tongue                                                                 | Лицо с высунутым языком                                                            |
| `emojiName.smilingBlushing`           | string   | Smiling face with smiling eyes                                                   | Улыбающееся лицо с улыбающимися глазами и румянцем                                 |
| `emojiName.smirkingFace`              | string   | Smirking face                                                                    | Самодовольное лицо                                                                 |
| `emojiName.thinkingFace`              | string   | Thinking face                                                                    | Задумавшееся лицо                                                                  |
| `emojiName.sleepyFace`                | string   | Sleepy face                                                                      | Сонное лицо                                                                        |
| `emojiName.thumbsDown`                | string   | Thumbs down                                                                      | Большой палец вниз                                                                 |
| `emojiName.victoryHand`               | string   | Victory hand                                                                     | Жест победы                                                                        |
| `emojiName.clappingHands`             | string   | Clapping hands                                                                   | Аплодисменты                                                                       |
| `emojiName.raisedHands`               | string   | Raising hands                                                                    | Поднятые руки                                                                      |
| `emojiName.facepalm`                  | string   | Facepalm                                                                         | Рука у лица                                                                        |
| `emojiName.shrug`                     | string   | Shrug                                                                            | Пожимает плечами                                                                   |
| `emojiName.oncomingFist`              | string   | Oncoming fist                                                                    | Кулак                                                                              |
| `emojiName.wavingHand`                | string   | Waving hand                                                                      | Машущая рука                                                                       |
| `emojiName.okHand`                    | string   | OK hand                                                                          | Жест «окей»                                                                        |
| `emojiName.dog`                       | string   | Dog                                                                              | Собака                                                                             |
| `emojiName.cat`                       | string   | Cat                                                                              | Кошка                                                                              |
| `emojiName.mouse`                     | string   | Mouse                                                                            | Мышь                                                                               |
| `emojiName.hamster`                   | string   | Hamster                                                                          | Хомяк                                                                              |
| `emojiName.rabbit`                    | string   | Rabbit                                                                           | Кролик                                                                             |
| `emojiName.bear`                      | string   | Bear                                                                             | Медведь                                                                            |
| `emojiName.panda`                     | string   | Panda                                                                            | Панда                                                                              |
| `emojiName.lion`                      | string   | Lion                                                                             | Лев                                                                                |
| `emojiName.pig`                       | string   | Pig                                                                              | Свинья                                                                             |
| `emojiName.frog`                      | string   | Frog                                                                             | Лягушка                                                                            |
| `emojiName.greenApple`                | string   | Green apple                                                                      | Зелёное яблоко                                                                     |
| `emojiName.pizza`                     | string   | Pizza                                                                            | Пицца                                                                              |
| `emojiName.hamburger`                 | string   | Hamburger                                                                        | Гамбургер                                                                          |
| `emojiName.frenchFries`               | string   | French fries                                                                     | Картофель фри                                                                      |
| `emojiName.spaghetti`                 | string   | Spaghetti                                                                        | Спагетти                                                                           |
| `emojiName.sushi`                     | string   | Sushi                                                                            | Суши                                                                               |
| `emojiName.iceCream`                  | string   | Ice cream                                                                        | Мороженое                                                                          |
| `emojiName.doughnut`                  | string   | Doughnut                                                                         | Пончик                                                                             |
| `emojiName.cookie`                    | string   | Cookie                                                                           | Печенье                                                                            |
| `emojiName.shortcake`                 | string   | Shortcake                                                                        | Кусок торта                                                                        |
| `emojiName.soccerBall`                | string   | Soccer ball                                                                      | Футбольный мяч                                                                     |
| `emojiName.basketball`                | string   | Basketball                                                                       | Баскетбольный мяч                                                                  |
| `emojiName.americanFootball`          | string   | American football                                                                | Мяч для американского футбола                                                      |
| `emojiName.baseball`                  | string   | Baseball                                                                         | Бейсбольный мяч                                                                    |
| `emojiName.tennis`                    | string   | Tennis                                                                           | Теннис                                                                             |
| `emojiName.bowling`                   | string   | Bowling                                                                          | Боулинг                                                                            |
| `emojiName.golfer`                    | string   | Golfer                                                                           | Гольфист                                                                           |
| `emojiName.fishing`                   | string   | Fishing                                                                          | Рыбалка                                                                            |
| `emojiName.cyclist`                   | string   | Cyclist                                                                          | Велосипедист                                                                       |
| `emojiName.videoGame`                 | string   | Video game                                                                       | Видеоигра                                                                          |
| `emojiName.airplane`                  | string   | Airplane                                                                         | Самолёт                                                                            |
| `emojiName.car`                       | string   | Car                                                                              | Автомобиль                                                                         |
| `emojiName.bicycle`                   | string   | Bicycle                                                                          | Велосипед                                                                          |
| `emojiName.train`                     | string   | Train                                                                            | Поезд                                                                              |
| `emojiName.sailboat`                  | string   | Sailboat                                                                         | Парусник                                                                           |
| `emojiName.worldMap`                  | string   | World map                                                                        | Карта мира                                                                         |
| `emojiName.beach`                     | string   | Beach                                                                            | Пляж                                                                               |
| `emojiName.mountain`                  | string   | Snow-capped mountain                                                             | Заснеженная гора                                                                   |
| `emojiName.camping`                   | string   | Camping                                                                          | Кемпинг                                                                            |
| `emojiName.luggage`                   | string   | Luggage                                                                          | Чемодан                                                                            |
| `source`                              | string   | HTML                                                                             | HTML                                                                               |
| `sourceField`                         | string   | HTML source                                                                      | HTML-код документа                                                                 |
| `invisibleCharacters`                 | string   | Invisible characters                                                             | Невидимые символы                                                                  |
| `language`                            | string   | Language                                                                         | Язык                                                                               |
| `languagePrimary`                     | function | —                                                                                | —                                                                                  |
| `languageRemove`                      | string   | Remove language mark                                                             | Убрать пометку                                                                     |
| `search`                              | string   | Find                                                                             | Найти                                                                              |
| `searchReplace`                       | string   | Find and replace                                                                 | Найти и заменить                                                                   |
| `searchPanel`                         | string   | Find and replace                                                                 | Поиск и замена                                                                     |
| `searchField`                         | string   | Find                                                                             | Найти                                                                              |
| `replaceField`                        | string   | Replace with                                                                     | Заменить на                                                                        |
| `searchPrevious`                      | string   | Previous match                                                                   | Предыдущее совпадение                                                              |
| `searchNext`                          | string   | Next match                                                                       | Следующее совпадение                                                               |
| `searchClose`                         | string   | Close find and replace                                                           | Закрыть поиск                                                                      |
| `searchMatchCase`                     | string   | Match case                                                                       | Учитывать регистр                                                                  |
| `searchWholeWord`                     | string   | Whole words                                                                      | Слово целиком                                                                      |
| `searchRegex`                         | string   | Regular expression                                                               | Регулярное выражение                                                               |
| `replaceOne`                          | string   | Replace                                                                          | Заменить                                                                           |
| `replaceAll`                          | string   | Replace all                                                                      | Заменить все                                                                       |
| `searchCount`                         | function | —                                                                                | —                                                                                  |
| `searchNoMatches`                     | string   | No matches                                                                       | Нет совпадений                                                                     |
| `searchInvalid`                       | string   | Invalid regular expression                                                       | Неверное регулярное выражение                                                      |
| `resizeField`                         | string   | Resize the editor                                                                | Изменить высоту поля                                                               |
| `fieldHeight`                         | function | —                                                                                | —                                                                                  |
| `shortcuts`                           | string   | Keyboard shortcuts                                                               | Сочетания клавиш                                                                   |
| `shortcutsCommand`                    | string   | Command                                                                          | Команда                                                                            |
| `shortcutsKeys`                       | string   | Shortcut                                                                         | Сочетание                                                                          |
| `selectBlock`                         | string   | Select block text                                                                | Выделить текст блока                                                               |
| `selectDocument`                      | string   | Select all (second press)                                                        | Выделить всё (второе нажатие)                                                      |
| `duplicateBlock`                      | string   | Duplicate block                                                                  | Дублировать блок                                                                   |
| `moveBlockUp`                         | string   | Move block up                                                                    | Переместить блок вверх                                                             |
| `moveBlockDown`                       | string   | Move block down                                                                  | Переместить блок вниз                                                              |
| `indentListItem`                      | string   | Indent list item                                                                 | Сдвинуть пункт списка вправо                                                       |
| `outdentListItem`                     | string   | Outdent list item                                                                | Сдвинуть пункт списка влево                                                        |
| `focusToolbar`                        | string   | Go to the toolbar                                                                | Перейти в панель                                                                   |
| `blockActions`                        | string   | Block actions                                                                    | Действия с блоком                                                                  |
| `blockAdd`                            | string   | Add                                                                              | Добавить                                                                           |
| `blockFormat`                         | string   | Format                                                                           | Формат                                                                             |
| `blockMoveUp`                         | string   | Move up                                                                          | Вверх                                                                              |
| `blockMoveDown`                       | string   | Move down                                                                        | Вниз                                                                               |
| `blockDuplicate`                      | string   | Duplicate                                                                        | Дублировать                                                                        |
| `blockDelete`                         | string   | Delete                                                                           | Удалить                                                                            |
| `blockSelect`                         | string   | Select                                                                           | Выделить                                                                           |
| `blockWrap`                           | string   | Wrap in                                                                          | Обернуть в                                                                         |
| `blockSelectionSelect`                | string   | Select block                                                                     | Выделить блок                                                                      |
| `blockSelectionExtend`                | string   | Extend selection                                                                 | Расширить выделение                                                                |
| `blocksSelected`                      | function | —                                                                                | —                                                                                  |
| `blockSelectionCleared`               | string   | Block selection cleared                                                          | Выделение блоков снято                                                             |
| `blocksDeleted`                       | function | —                                                                                | —                                                                                  |
| `blocksDuplicated`                    | function | —                                                                                | —                                                                                  |
| `blocksMoved`                         | function | —                                                                                | —                                                                                  |
| `blocksChanged`                       | function | —                                                                                | —                                                                                  |
| `blocksWrapped`                       | function | —                                                                                | —                                                                                  |
| `blocksCopied`                        | function | —                                                                                | —                                                                                  |
| `blocksCut`                           | function | —                                                                                | —                                                                                  |
| `blocksReplaced`                      | function | —                                                                                | —                                                                                  |
| `fullscreen`                          | string   | Fullscreen                                                                       | Во весь экран                                                                      |
| `fullscreenExit`                      | string   | Exit fullscreen                                                                  | Свернуть                                                                           |
| `fullscreenOpened`                    | string   | Fullscreen mode on                                                               | Редактор развёрнут во весь экран                                                   |
| `fullscreenClosed`                    | string   | Fullscreen mode off                                                              | Редактор свёрнут                                                                   |
| `focusMode`                           | string   | Focus mode                                                                       | Режим фокуса                                                                       |
| `toc`                                 | string   | Table of contents                                                                | Оглавление                                                                         |
| `video`                               | string   | Video                                                                            | Видео                                                                              |
| `videoLink`                           | string   | Video link                                                                       | Ссылка на видео                                                                    |
| `videoInsert`                         | string   | Insert                                                                           | Вставить                                                                           |
| `videoNotFound`                       | function | —                                                                                | —                                                                                  |
| `videoPlay`                           | string   | Play                                                                             | Воспроизвести                                                                      |
| `videoPlayLabel`                      | function | —                                                                                | —                                                                                  |
| `videoPlayer`                         | function | —                                                                                | —                                                                                  |
| `typographyQuotes`                    | string   | en                                                                               | ru                                                                                 |

## `errorState`

| Key     | Shape  | `en-US`        | `ru-RU`         |
| ------- | ------ | -------------- | --------------- |
| `title` | string | Failed to load | Ошибка загрузки |

## `fileDropzone`

| Key                  | Shape    | `en-US`                   | `ru-RU`                      |
| -------------------- | -------- | ------------------------- | ---------------------------- |
| `label`              | string   | Drop files here           | Перетащите файлы сюда        |
| `browse`             | string   | Choose files              | Выбрать файлы                |
| `tooLarge`           | function | —                         | —                            |
| `singleFileOnly`     | string   | only one file is accepted | принимается только один файл |
| `foldersNotAccepted` | string   | folders are not accepted  | папки не принимаются         |
| `folderName`         | string   | folder                    | папка                        |
| `wrongType`          | string   | Unsupported type          | Неподходящий тип             |
| `unreadable`         | string   | Could not be read         | Не удалось прочитать         |

## `filterBar`

| Key            | Shape    | `en-US`         | `ru-RU`             |
| -------------- | -------- | --------------- | ------------------- |
| `label`        | string   | Applied filters | Применённые фильтры |
| `remove`       | string   | Remove filter   | Снять фильтр        |
| `clear`        | string   | Clear all       | Снять все           |
| `add`          | string   | Add filter      | Добавить фильтр     |
| `field`        | string   | Field           | Поле                |
| `value`        | string   | Value           | Значение            |
| `apply`        | string   | Apply           | Применить           |
| `fromField`    | string   | From            | От                  |
| `toField`      | string   | To              | До                  |
| `rangeBetween` | function | —               | —                   |
| `rangeFrom`    | function | —               | —                   |
| `rangeTo`      | function | —               | —                   |

## `inlineEdit`

| Key     | Shape  | `en-US` | `ru-RU`   |
| ------- | ------ | ------- | --------- |
| `edit`  | string | edit    | изменить  |
| `empty` | string | Not set | Не задано |

The accessible name of the value button ends with "Ежедневная подборка, изменить". The name is built from the content, not set with `aria-label`. Otherwise, the value drops out of the name.

## `keyboard`

| Key                  | Shape    | `en-US`                      | `ru-RU`                                |
| -------------------- | -------- | ---------------------------- | -------------------------------------- |
| `label`              | function | —                            | —                                      |
| `close`              | string   | Close the on-screen keyboard | Закрыть экранную клавиатуру            |
| `move`               | string   | Move the on-screen keyboard  | Перемещать экранную клавиатуру         |
| `switchLayout`       | string   | Switch layout                | Сменить раскладку                      |
| `switchLayoutTo`     | function | —                            | —                                      |
| `showSymbols`        | string   | Show symbols                 | Показать символы                       |
| `showLetters`        | function | —                            | —                                      |
| `showPrimarySymbols` | string   | Show the primary symbol set  | Показать основной набор символов       |
| `showExtraSymbols`   | string   | Show the extra symbol set    | Показать дополнительный набор символов |
| `backspace`          | string   | Delete character             | Удалить символ                         |
| `space`              | string   | Space                        | Пробел                                 |
| `submit`             | string   | Submit search                | Отправить поиск                        |
| `keyComma`           | string   | Comma                        | Запятая                                |
| `keyPeriod`          | string   | Period                       | Точка                                  |
| `keyLess`            | string   | Less than                    | Меньше                                 |
| `keyGreater`         | string   | Greater than                 | Больше                                 |
| `keySemicolon`       | string   | Semicolon                    | Точка с запятой                        |
| `keyColon`           | string   | Colon                        | Двоеточие                              |

## `link`

| Key             | Shape  | `en-US`              | `ru-RU`                     |
| --------------- | ------ | -------------------- | --------------------------- |
| `opensInNewTab` | string | (opens in a new tab) | (откроется в новой вкладке) |

## `maskedInput`

| Key         | Shape    | `en-US`                       | `ru-RU`                 |
| ----------- | -------- | ----------------------------- | ----------------------- |
| `rejected`  | function | A digit is expected here      | Здесь нужна цифра       |
| `full`      | string   | The field is already complete | Поле уже заполнено      |
| `truncated` | function | …is N characters too long…    | …длиннее на N символов… |

`rejected` takes `{ expected: "digit" | "letter" | "any" }` and says what exactly was expected here. `truncated` takes `{ count }`, the number of characters from the paste that did not fit. It appeared in 3.5.0. Before that, a trimmed paste was not announced.

## `mediaCard`

| Key      | Shape  | `en-US` | `ru-RU` |
| -------- | ------ | ------- | ------- |
| `select` | string | Select  | Выбрать |

## `megaMenu`

| Key    | Shape  | `en-US` | `ru-RU` |
| ------ | ------ | ------- | ------- |
| `back` | string | Back    | Назад   |

## `mobileTabBar`

| Key        | Shape    | `en-US`  | `ru-RU`    |
| ---------- | -------- | -------- | ---------- |
| `label`    | string   | Sections | Разделы    |
| `new`      | string   | New      | Есть новое |
| `newCount` | function | —        | —          |

## `nav`

| Key        | Shape  | `en-US`             | `ru-RU`              |
| ---------- | ------ | ------------------- | -------------------- |
| `label`    | string | Main navigation     | Основная навигация   |
| `collapse` | string | Collapse navigation | Свернуть навигацию   |
| `expand`   | string | Expand navigation   | Развернуть навигацию |

## `notifications`

| Key           | Shape    | `en-US`       | `ru-RU`      |
| ------------- | -------- | ------------- | ------------ |
| `label`       | string   | Notifications | Уведомления  |
| `unread`      | string   | Unread        | Не прочитано |
| `unreadCount` | function | —             | —            |

## `numberInput`

| Key         | Shape    | `en-US` | `ru-RU` |
| ----------- | -------- | ------- | ------- |
| `decrement` | function | —       | —       |
| `increment` | function | —       | —       |

## `pagination`

| Key        | Shape  | `en-US`       | `ru-RU`             |
| ---------- | ------ | ------------- | ------------------- |
| `label`    | string | Pages         | Страницы            |
| `previous` | string | Previous page | Предыдущая страница |
| `next`     | string | Next page     | Следующая страница  |

## `passwordInput`

| Key        | Shape  | `en-US`         | `ru-RU`           |
| ---------- | ------ | --------------- | ----------------- |
| `toggle`   | string | Show password   | Показать пароль   |
| `capsLock` | string | Caps Lock is on | Включён Caps Lock |

The button's label is the same for both states: the state is announced by `aria-pressed`. A name that changed along with it would be read as "Скрыть пароль, нажато".

## `pinInput`

| Key     | Shape    | `en-US` | `ru-RU` |
| ------- | -------- | ------- | ------- |
| `digit` | function | —       | —       |

"Цифра 3 из 6" is the name of one code field. Without it, a screen reader reads N unnamed fields in a row.

## `rating`

| Key     | Shape    | `en-US` | `ru-RU` |
| ------- | -------- | ------- | ------- |
| `value` | function | —       | —       |
| `star`  | function | —       | —       |

## `savedViews`

| Key     | Shape  | `en-US`     | `ru-RU`          |
| ------- | ------ | ----------- | ---------------- |
| `label` | string | Saved views | Сохранённые виды |

## `searchControl`

| Key            | Shape  | `en-US`                     | `ru-RU`                     |
| -------------- | ------ | --------------------------- | --------------------------- |
| `clear`        | string | Clear search                | Очистить поиск              |
| `openKeyboard` | string | Open the on-screen keyboard | Открыть экранную клавиатуру |

## `selectionBar`

| Key              | Shape    | `en-US`              | `ru-RU`                |
| ---------------- | -------- | -------------------- | ---------------------- |
| `label`          | string   | Actions on selection | Действия над выбранным |
| `clearSelection` | string   | Clear selection      | Снять выделение        |
| `count`          | function | —                    | —                      |

## `shell`

| Key              | Shape  | `en-US`         | `ru-RU`               |
| ---------------- | ------ | --------------- | --------------------- |
| `skipToContent`  | string | Skip to content | Перейти к содержимому |
| `openNavigation` | string | Open navigation | Открыть навигацию     |

## `shortcutsHelp`

| Key            | Shape  | `en-US`            | `ru-RU`          |
| -------------- | ------ | ------------------ | ---------------- |
| `title`        | string | Keyboard shortcuts | Горячие клавиши  |
| `list`         | string | Shortcuts          | Сочетания клавиш |
| `keySeparator` | string | plus               | плюс             |

`list` is the name of the scroll area with the list of shortcuts. It differs from `title`, so that a screen reader does not read the dialog name twice. `keySeparator` is the word between the keys of a shortcut for a screen reader ("Ctrl плюс K"): the visible "+" is hidden, because NVDA does not read the plus sign by default.

## `sortableList`

| Key    | Shape  | `en-US` | `ru-RU`    |
| ------ | ------ | ------- | ---------- |
| `drag` | string | Drag    | Перетащить |

## `spinner`

| Key     | Shape  | `en-US` | `ru-RU`  |
| ------- | ------ | ------- | -------- |
| `label` | string | Loading | Загрузка |

## `splitButton`

| Key    | Shape    | `en-US` | `ru-RU` |
| ------ | -------- | ------- | ------- |
| `more` | function | —       | —       |

## `splitPanel`

| Key           | Shape    | `en-US`          | `ru-RU`                |
| ------------- | -------- | ---------------- | ---------------------- |
| `resize`      | string   | Resize the panel | Изменить размер панели |
| `resizeNamed` | function | —                | —                      |
| `size`        | function | —                | —                      |

## `stepper`

| Key     | Shape    | `en-US`                                | `ru-RU`                          |
| ------- | -------- | -------------------------------------- | -------------------------------- |
| `label` | string   | Steps                                  | Шаги                             |
| `state` | function | completed / current step / not started | пройден / текущий шаг / не начат |

## `table`

| Key            | Shape    | `en-US`         | `ru-RU`             |
| -------------- | -------- | --------------- | ------------------- |
| `empty`        | string   | Nothing here    | Ничего нет          |
| `selectAll`    | string   | Select all rows | Выделить все строки |
| `selectRow`    | string   | Select row      | Выделить строку     |
| `expandColumn` | string   | Row details     | Подробности строки  |
| `expandRow`    | function | —               | —                   |
| `collapseRow`  | function | —               | —                   |

## `tablePreferences`

| Key           | Shape    | `en-US`     | `ru-RU`   |
| ------------- | -------- | ----------- | --------- |
| `columns`     | string   | Columns     | Колонки   |
| `density`     | string   | Density     | Плотность |
| `comfortable` | string   | Comfortable | Свободно  |
| `compact`     | string   | Compact     | Плотно    |
| `moveUp`      | function | —           | —         |
| `moveDown`    | function | —           | —         |

## `tableToolbar`

| Key           | Shape    | `en-US`        | `ru-RU`           |
| ------------- | -------- | -------------- | ----------------- |
| `total`       | function | —              | —                 |
| `preferences` | string   | Table settings | Настройки таблицы |

## `tagGroup`

| Key      | Shape    | `en-US` | `ru-RU` |
| -------- | -------- | ------- | ------- |
| `remove` | function | —       | —       |

The remove button's name **includes** the tag label inside the row ("Удалить: Дизайн"). `tagInput.remove` has no tag label in its name, so there it is a plain string. In the first case, the word order depends on the language, so it is a function.

## `tagInput`

| Key      | Shape    | `en-US`    | `ru-RU`      |
| -------- | -------- | ---------- | ------------ |
| `remove` | string   | Remove tag | Убрать тег   |
| `add`    | string   | Add tag    | Добавить тег |
| `addTo`  | function | —          | —            |

## `timePicker`

| Key             | Shape  | `en-US` | `ru-RU` |
| --------------- | ------ | ------- | ------- |
| `label`         | string | Time    | Время   |
| `placeholder`   | string | HH:MM   | ЧЧ:ММ   |
| `placeholder12` | string | h:mm AM | Ч:ММ AM |
| `am`            | string | AM      | AM      |
| `pm`            | string | PM      | PM      |

## `topbar`

| Key     | Shape  | `en-US`            | `ru-RU`          |
| ------- | ------ | ------------------ | ---------------- |
| `label` | string | Application header | Шапка приложения |

## `transfer`

| Key            | Shape    | `en-US`           | `ru-RU`               |
| -------------- | -------- | ----------------- | --------------------- |
| `source`       | string   | Available         | Доступно              |
| `target`       | string   | Selected          | Выбрано               |
| `moveToTarget` | string   | Move to selected  | Перенести в выбранное |
| `moveToSource` | string   | Move to available | Вернуть в доступное   |
| `searchIn`     | function | —                 | —                     |

## `treeSelect`

| Key           | Shape    | `en-US`       | `ru-RU`       |
| ------------- | -------- | ------------- | ------------- |
| `placeholder` | string   | Select a node | Выберите узел |
| `more`        | function | —             | —             |

## `treeView`

| Key        | Shape  | `en-US`  | `ru-RU`  |
| ---------- | ------ | -------- | -------- |
| `expand`   | string | Expand   | Раскрыть |
| `collapse` | string | Collapse | Свернуть |
| `select`   | string | Select   | Выбрать  |

The names of the expand buttons **have no** node label: react-aria adds it on its own, and "Раскрыть Природа" would be read as "Раскрыть Природа Природа".

## `uploadQueue`

| Key            | Shape    | `en-US`         | `ru-RU`          |
| -------------- | -------- | --------------- | ---------------- |
| `label`        | string   | Upload queue    | Очередь загрузки |
| `summary`      | function | —               | —                |
| `progress`     | string   | Upload progress | Ход загрузки     |
| `itemProgress` | function | —               | —                |

## `period`

| Key                 | Shape    | `en-US`    | `ru-RU`       |
| ------------------- | -------- | ---------- | ------------- |
| `presets.7d`        | string   | 7 days     | 7 дней        |
| `presets.30d`       | string   | 30 days    | 30 дней       |
| `presets.90d`       | string   | 90 days    | 90 дней       |
| `presets.365d`      | string   | Year       | Год           |
| `presets.thisMonth` | string   | This month | Этот месяц    |
| `presets.lastMonth` | string   | Last month | Прошлый месяц |
| `length`            | function | —          | —             |
