/**
 * Английская локаль — реэкспорт фолбэка, а не вторая копия.
 *
 * Подключать её незачем: без провайдера кит и так говорит по-английски. Модуль
 * существует ради симметрии с `@olddevs/ui/locales/ru` — код, который выбирает
 * каталог по локали пользователя, не должен спотыкаться на том, что для одного
 * языка импорт есть, а для другого нет.
 */
export { DEFAULT_MESSAGES as messages, DEFAULT_LOCALE as locale } from "../i18n/defaults.js";
export { DEFAULT_MESSAGES as default } from "../i18n/defaults.js";
