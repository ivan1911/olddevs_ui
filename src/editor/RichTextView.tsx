import { forwardRef, useId, useMemo, type ComponentPropsWithoutRef } from "react";
import { cn } from "../lib/cn.js";
import { BlockIsland } from "./ui/BlockIsland.js";
import { CodeCopyIsland } from "./features/code/CodeCopyIsland.js";
import { hasCodeBlocks, withCodeHeaders } from "./features/code/codeHeader.js";
import type { ToolEntry } from "./core/customTool.js";
import { proseClass } from "./styles/prose.js";
import { surfaceAttributes, type RichTextSurface } from "./styles/surface.js";
import { islandsFor } from "./core/viewIsland.js";

export interface RichTextViewProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "children" | "dangerouslySetInnerHTML"
> {
  /**
   * Сохранённый Документ — HTML-строка в формате Редактора.
   *
   * **НЕ САНИТИЗИРУЕТСЯ.** Строка кладётся в разметку как есть, через
   * `dangerouslySetInnerHTML`: компонент принимает HTML, который сервер
   * потребителя уже очистил по белому списку Схемы. Строка от пользователя,
   * не прошедшая серверную очистку, — XSS на вашей странице. Очистка —
   * `sanitizeRichText(html, DOMPurify)` из `@olddevs/ui/editor/schema`.
   */
  html: string;
  /**
   * Поверхность Документа: `"theme"` (по умолчанию) — в теме приложения;
   * `"paper"` — светлый Лист в любой теме, для писем, печати и PDF.
   * Как у `RichTextEditor`: один Документ на Листе выглядит одинаково в Редакторе
   * и в Просмотре.
   */
  surface?: RichTextSurface;
  /**
   * Свои Инструменты Документа — тот же массив, что у `RichTextEditor` и
   * `sanitizeRichText`; Настроенный Инструмент (`tool()`) в нём допустим и
   * Просмотром игнорируется. Просмотр читает из него только Острова своих Блоков
   * (`blocks[имя].island`): Блок, у которого он есть и который есть в
   * Документе, оживает клиентским компонентом, а серверный HTML Блока виден до
   * загрузки и без JS. Остальное в описании Просмотру не нужно. Без `tools`, и
   * у Документа без таких Блоков, Просмотр прежний и клиентского кода не тянет.
   */
  tools?: readonly ToolEntry[];
}

/**
 * Короткий отпечаток строки — FNV-1a по кодовым единицам и длина. Нужен острову
 * только затем, чтобы заметить смену Документа; криптографии здесь нет.
 */
function fingerprint(html: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < html.length; i++) {
    hash ^= html.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${html.length}:${(hash >>> 0).toString(36)}`;
}

/**
 * Просмотр сохранённого Документа: та же типографика, что в Редакторе, и никакого
 * движка.
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ КОМПОНЕНТ, А НЕ `readOnly` РЕДАКТОРА. `readOnly` держит
 * Tiptap и ProseMirror живыми ради страницы, где нужен только показ, а это
 * 130–170 кБ gzip на чтение. Здесь в графе модулей нет ни Tiptap, ни lowlight:
 * компонент годится для серверного рендера и не несёт `"use client"` (ADR-0029,
 * ADR-0050). Граф держит `tests/rich-text-view.test.tsx`.
 *
 * КНОПКА «КОПИРОВАТЬ» У БЛОКОВ КОДА — КЛИЕНТСКИЙ КУСОК. Сам
 * компонент остаётся серверным: он кладёт HTML с шапками блоков (подпись языка
 * и пустое гнездо — `withCodeHeaders`) и рядом рисует остров `CodeCopyIsland`,
 * который после монтирования вставляет кнопки в гнёзда. Только если блок кода
 * есть (`hasCodeBlocks`): текстовому Документу остров ни к чему — ни метки в
 * разметке, ни эффекта на клиенте. Остров — отдельный файл
 * со своей директивой, поэтому граница клиента проходит по нему, а не по
 * `RichTextView`. Проп для отключения не заведён: кнопка есть всегда
 * (решение владельца).
 *
 * ОСТРОВ СВОЕГО БЛОКА — ВТОРОЙ И ТАКОЙ ЖЕ (`BlockIsland`). `tools`
 * из пропсов не уходит на клиент целиком: `islandsFor` берёт из описаний только
 * Острова Блоков, которые есть в Документе, и отдаёт острову ссылки на
 * клиентские компоненты и имена объявленных атрибутов. Нет такого Блока —
 * нет острова, и код Острова потребителя не грузится. Серверный HTML Блока
 * приходит всегда; Остров заменяет его после монтирования.
 *
 * ХУКИ — `useId` и `useMemo`, оба разрешены серверным компонентам. Идентификатор
 * связывает остров со своими гнёздами и совпадает на сервере и клиенте; `useMemo`
 * держит объект разметки стабильным (см. ниже). Состояния и эффектов в самом
 * компоненте нет.
 *
 * ТИПОГРАФИКА — `proseClass(surface)`, тот же модуль, что вешает классы на содержимое
 * Редактора. Классы лежат на контейнере и находят теги по имени, поэтому в HTML
 * Документа ни классов, ни `style` нет и санитайзеру их разрешать не нужно;
 * шапка блока кода — разметка самого компонента, собранная после очистки.
 */
export const RichTextView = forwardRef<HTMLDivElement, RichTextViewProps>(function RichTextView(
  { html, surface = "theme", tools, className, ...rest },
  ref
) {
  const hostId = useId();
  const islands = islandsFor(tools, html);
  // Объект один на пару (Документ, просмотр): React сверяет `dangerouslySetInnerHTML`
  // по ссылке и при новом объекте переписывает `innerHTML` — вместе с кнопками и
  // Островами, которые острова вставили порталом. Перерисовка родителя с тем же
  // Документом (смена `className`, новый литерал `tools`) разметку трогать не должна.
  const inner = useMemo(() => ({ __html: withCodeHeaders(html, hostId) }), [html, hostId]);
  return (
    <>
      <div
        ref={ref}
        className={cn(proseClass(surface), className)}
        {...surfaceAttributes(surface)}
        {...rest}
        dangerouslySetInnerHTML={inner}
      />
      {/* Остров — только у Документа с кодом: тексту без блоков кода он не нужен. */}
      {hasCodeBlocks(html) && <CodeCopyIsland hostId={hostId} docKey={fingerprint(html)} />}
      {/* И острова своих Блоков — только у Документа, где такой Блок есть. */}
      {islands[0] && <BlockIsland islands={islands} docKey={fingerprint(html)} />}
    </>
  );
});
