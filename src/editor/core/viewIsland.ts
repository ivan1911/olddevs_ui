import type { ComponentType } from "react";
import type { CustomIslandProps, ToolEntry } from "./customTool.js";
import { customToolOf } from "./toolDefinition.js";

/*
  Острова своих Блоков в Просмотре (ADR-0058, п. 3.3).

  Модуль серверный: `RichTextView` выбирает из `tools` лишь то, что нужно
  острову, и отдаёт клиентскому компоненту ссылки на Острова — описание целиком
  (Часть для движка, функции) через границу RSC не пройдёт. Выбор идёт по
  Документу, как `hasCodeBlocks` у «Копировать»: Остров Блока, которого в
  Документе нет, в клиентский граф не попадает, а значит, и его код не грузится.
*/

/** Остров одного своего Блока: имя Блока, компонент и объявленные атрибуты. */
export interface ViewIsland {
  block: string;
  island: ComponentType<CustomIslandProps>;
  /** Объявленные атрибуты Блока (имя — вид значения, данные): их имена получит компонент. */
  attributes: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Острова, нужные этому Документу. Блок в очищенном HTML всегда записан как
 * `data-block="<имя>"` в двойных кавычках (так пишет сериализатор DOM), поэтому
 * проверка — подстрока, без разбора разметки. Нет `tools`, нет Острова у Блока
 * или Блока нет в Документе — пустой список, и клиентского острова нет вовсе.
 */
export function islandsFor(tools: readonly ToolEntry[] | undefined, html: string): ViewIsland[] {
  // Строка из `tools` — имя Инструмента кита, Настроенный встроенный — его опции: блоков у них нет.
  return (tools ?? []).flatMap((entry) =>
    Object.entries(customToolOf(entry)?.blocks ?? {}).flatMap(([block, { island, attributes }]) =>
      island && html.includes(`data-block="${block}"`) ? [{ block, island, attributes }] : []
    )
  );
}
