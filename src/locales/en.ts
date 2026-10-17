/**
 * The English locale: a re-export of the fallback, not a second copy.
 *
 * There is no need to import it: without a provider the kit already speaks English.
 * The module exists for symmetry with `@olddevs/ui/locales/ru`. Code that picks a
 * message catalog by the user's locale should not trip over the fact that one language has
 * an import and another does not.
 */
export { DEFAULT_MESSAGES as messages, DEFAULT_LOCALE as locale } from "../i18n/defaults.js";
export { DEFAULT_MESSAGES as default } from "../i18n/defaults.js";
