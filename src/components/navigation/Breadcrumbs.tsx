"use client";

import { ChevronRightIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { Link } from "../content/Link.js";

export interface Crumb {
  /** Подпись звена. */
  label: string;
  /** Адрес. У последнего звена его не бывает — см. докстроку. */
  href?: string;
}

export interface BreadcrumbsProps {
  /** Звенья пути по порядку, от корня к текущему экрану. */
  items: Crumb[];
  /**
   * Сколько звеньев показывать целиком, прежде чем свернуть середину.
   *
   * Цепочка длиннее предела сворачивается в «первое … последние два»: середина
   * пути ничего не говорит о том, где пользователь находится, а вот первое
   * звено (корень) и ближайшие к текущему — говорят.
   */
  maxItems?: number;
  /** Дополнительные классы на `nav`. */
  className?: string;
  /** Доступное имя навигации. По умолчанию берётся из словаря сообщений. */
  "aria-label"?: string;
}

/**
 * Хлебные крошки: путь до текущего экрана.
 *
 * **Последнее звено — не ссылка**, и это не мелочь: ссылка на страницу, на
 * которой уже находишься, ничего не делает по нажатию, а скринридер объявляет
 * её ссылкой — то есть обещает переход, которого не будет. Текущее звено
 * помечается `aria-current="page"`.
 *
 * Разметка — `nav` со списком: скринридер даёт по ней прыжок «к навигации» и
 * читает число звеньев. Строка из ссылок через «/» ни того, ни другого не даёт.
 */
export function Breadcrumbs({
  items,
  maxItems = 4,
  className,
  "aria-label": ariaLabel,
}: BreadcrumbsProps) {
  const messages = useMessages();
  /*
    Сворачивание: первое звено, многоточие, последние два. Многоточие — не
    ссылка и не кнопка: раскрывать середину некуда, а кнопка обещала бы
    действие. Оно помечено `aria-hidden`, потому что «…» вслух не значит
    ничего; число пропущенных звеньев сообщает подпись рядом.
  */
  /*
    Сворачивать имеет смысл, только когда есть ЧТО прятать.

    Условие было просто `items.length > maxItems`, а свёрнутый вид всегда
    собирался как «первое + … + последние два» — три звена. На коротких
    цепочках это ломалось: при двух звеньях и `maxItems={1}` первое попадало и
    в начало, и в хвост (корень рисовался ДВАЖДЫ), а `skipped` уходил в минус,
    и подпись читалась как «Пропущено звеньев: −1». Вход достижим по
    документации — страница крошек прямо советует уменьшать `maxItems` в узком
    хедере.
  */
  const collapsed = items.length > maxItems && items.length > 3;
  const shown: (Crumb | "gap")[] = collapsed ? [items[0]!, "gap", ...items.slice(-2)] : [...items];
  const skipped = collapsed ? items.length - 3 : 0;

  return (
    <nav aria-label={ariaLabel ?? messages.breadcrumbs.label} className={cn("min-w-0", className)}>
      <ol className="text-fg-2 flex flex-wrap items-center gap-1.5 text-sm">
        {shown.map((item, index) => {
          const last = index === shown.length - 1;

          return (
            <li
              key={item === "gap" ? "gap" : `${item.label}-${index}`}
              className="flex min-w-0 items-center gap-1.5"
            >
              {item === "gap" ? (
                // `aria-hidden` обязателен: без него `title` даёт многоточию
                // доступное имя, и скринридер читает «Пропущено звеньев: 3»
                // как звено пути. Число он и так знает по длине списка.
                <span
                  aria-hidden
                  className="text-fg-3"
                  title={messages.breadcrumbs.collapsed({ count: skipped })}
                >
                  …
                </span>
              ) : last || !item.href ? (
                // Текущее звено: не ссылка, но объявлено текущим.
                <span aria-current={last ? "page" : undefined} className="text-fg-0 truncate">
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} variant="quiet" tone="neutral" className="truncate">
                  {item.label}
                </Link>
              )}
              {!last ? (
                <ChevronRightIcon size={12} aria-hidden className="text-fg-3 shrink-0" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
