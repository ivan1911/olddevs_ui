"use client";

import katex, { type KatexOptions } from "katex";
/*
  CSS и шрифты KaTeX едут вместе с этим модулем (ADR-0070, п. 9). Кит собирается
  голым `tsc`, без сборщика, поэтому CSS не лежит файлом пакета: модуль просто
  импортирует `katex/dist/katex.min.css` из пакета `katex` потребителя, а его
  сборщик (Next.js, Vite, webpack) сам выпускает файл стилей и переписывает
  `url(fonts/…)` на шрифты из того же пакета. Модуль грузится только лениво —
  Загрузчиком Редактора и Островом `RichTextView` (`import()`), поэтому стили и
  шрифты не попадают на страницы без формул: сборщик кладёт CSS в тот же ленивый
  чанк. Никакого шага у потребителя нет: `katex` он ставит той же командой, что
  Tiptap (страница Редактора).
*/
import "katex/dist/katex.min.css";
import type { MathRenderOptions } from "./mathOptions.js";

export { katex };

/**
 * Опции KaTeX для одной формулы.
 *
 * `throwOnError` включён: Редактор и Остров ловят ошибку сами и показывают
 * исходник с пометкой, а предпросмотр Поповера пишет её в поле. `output` — HTML
 * и MathML (ADR-0070, п. 8): скринридер читает MathML, а не разрозненные `span`.
 * `trust` выключен (по умолчанию): `\href`, `\url` и `\includegraphics` из
 * чужого Документа не работают. `maxSize` ограничивает `\rule` и пробелы, чтобы
 * формула вроде `\rule{9999em}{9999em}` не растягивала страницу читателя;
 * `maxExpand` — потолок раскрытия макросов KaTeX, задан явно (1000, как умолчание
 * KaTeX), чтобы лимит не зависел от версии пакета потребителя.
 *
 * МАКРОСЫ — СВЕЖАЯ КОПИЯ НА КАЖДУЮ ОТРИСОВКУ. `\gdef` в формуле пишет в объект
 * `macros`, который KaTeX получил, и макрос одной формулы переезжал бы в
 * следующие. Одни и те же опции, однако, читает не один вызов: расширение Tiptap
 * отдаёт один объект `katexOptions` всем видам узлов Редактора, а Поповер — своим
 * предпросмотрам. Поэтому `macros` — геттер: KaTeX читает поле при каждой отрисовке
 * (`new Settings(options)`) и получает новый объект, так что формулы Редактора, его
 * Поповера и Острова `RichTextView` не делят `\gdef`. Копия опций (`{ ...options }`)
 * геттер вычисляет один раз, поэтому копировать надо перед каждым вызовом.
 */
export function katexOptionsFor(options: MathRenderOptions, display: boolean): KatexOptions {
  return {
    displayMode: display,
    output: "htmlAndMathml",
    throwOnError: true,
    strict: options.strict,
    get macros() {
      return { ...options.macros };
    },
    maxSize: 50,
    maxExpand: 1000,
  };
}

/**
 * Сообщение об ошибке KaTeX без префикса «KaTeX parse error:»: фраза идёт в поле
 * после нашего «Неверный LaTeX». Ошибка не из KaTeX (сбой рендера) — её текст.
 */
export function mathErrorDetail(error: unknown): string {
  const raw = (error as { rawMessage?: unknown } | null)?.rawMessage;
  const message =
    typeof raw === "string" ? raw : error instanceof Error ? error.message : String(error);
  return message.replace(/^KaTeX parse error:\s*/, "");
}
