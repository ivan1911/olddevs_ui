/**
 * Заплатки jsdom, без которых react-aria падает на своих же внутренностях.
 *
 * `CSS.escape` в jsdom нет вовсе, а react-aria зовёт его, собирая селекторы
 * для навигации по коллекции: любой ввод в `Combobox`, `CommandPalette` или
 * `Table` роняет тест с «Cannot read properties of undefined (reading
 * 'escape')». Это дыра ОКРУЖЕНИЯ, а не поведения компонента, и затыкать её
 * переносом теста в браузер (ADR-0012) значило бы уводить туда проверки,
 * которые прекрасно живут на уровне 0.
 *
 * Реализация та же, что в спецификации: экранируется всё, кроме букв, цифр,
 * дефиса и подчёркивания. Полная версия сложнее (кодовые точки, ведущая
 * цифра), но ключи коллекций у нас из этого набора и состоят.
 */
const g = globalThis as { CSS?: { escape?: (value: string) => string } };
g.CSS ??= {};
g.CSS.escape ??= (value: string) => String(value).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);

/**
 * Геометрия `Range` для ProseMirror.
 *
 * Редактор (`@olddevs/ui/editor`) после фокуса прокручивает выделение в
 * видимую область и меряет его `Range.getClientRects()`. В jsdom раскладки нет,
 * и у `Range` этих методов нет вовсе: вызов падает уже после теста, в
 * следующем кадре, необработанной ошибкой. Пустой список прямоугольников —
 * честный ответ окружения без раскладки, и ProseMirror его понимает.
 *
 * Проверка через `typeof`: в окружении node класса `Range` нет.
 */
if (typeof Range !== "undefined") {
  Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect ??= () => new DOMRect();
}
