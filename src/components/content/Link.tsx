"use client";

import type { ComponentPropsWithRef, ElementType, ReactNode } from "react";
import { ExternalLinkIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { TONE_TOKENS, type Tone } from "../../lib/variants.js";

export type LinkVariant = "inline" | "standalone" | "quiet";

export interface LinkOwnProps {
  /** Вид ссылки: `inline` (всегда подчёркнута), `standalone` (подчёркивание при наведении) или `quiet` (цвет текста, акцент при наведении). По умолчанию `inline`. */
  variant?: LinkVariant;
  /** Цветовой тон ссылки: `neutral`, `accent`, `success`, `warning` или `danger`. По умолчанию `accent`. */
  tone?: Tone;
  /**
   * Ссылка ведёт наружу: рядом с подписью появляется иконка.
   *
   * `target` этим пропом НЕ выставляется. Открывать ли внешнее в новой вкладке —
   * решение экрана, а не системы: в одном месте это удобно, в другом уносит
   * пользователя из наполовину заполненной формы.
   */
  external?: boolean;
  /** Содержимое ссылки. */
  children?: ReactNode;
  /** Классы корневого элемента. */
  className?: string;
}

/**
 * Пропсы полиморфны по `as`: с `next/link` компилятор примет и `prefetch`, и
 * объектный `href`, а с обычной `a` — только атрибуты якоря.
 *
 * Без этого тип был бы прибит к якорю, и каждый проп маршрутизатора
 * компилятор отвергал бы у компонента, который ради маршрутизатора и заведён.
 */
export type LinkProps<T extends ElementType = "a"> = LinkOwnProps & {
  /**
   * Тег или компонент ссылки: `next/link`, `Link` роутера, обычная `a`.
   *
   * Пакет намеренно не знает про маршрутизацию: у потребителя она своя, и
   * зависимость на неё превратила бы дизайн-систему в часть приложения.
   */
  as?: T;
} & Omit<ComponentPropsWithRef<T>, keyof LinkOwnProps | "as">;

/**
 * Подчёркивание — не украшение, а второй признак ссылки.
 *
 * `inline` подчёркнут ВСЕГДА: ссылка внутри абзаца, отличающаяся от текста
 * только цветом, для дальтоника не отличается ничем. Это прямое требование
 * WCAG 1.4.1, и оно не смягчается «у нас контрастный акцент».
 *
 * `standalone` — ссылка, стоящая отдельной строкой: её и так видно по месту,
 * подчёркивание появляется при наведении. `quiet` — ссылка цветом текста,
 * акцент только при наведении: хлебные крошки, служебные ссылки в подвале.
 */
const VARIANT_CLASS: Record<LinkVariant, string> = {
  inline: "underline underline-offset-2",
  standalone: "no-underline hover:underline hover:underline-offset-2",
  quiet: "no-underline hover:underline hover:underline-offset-2",
};

/**
 * Тон `quiet` при наведении. Отдельная таблица литеральных строк, а не
 * `hover:` + атом словаря: Tailwind сканирует исходники как текст, и класс,
 * склеенный в рантайме, молча не попадёт в CSS — ссылка осталась бы серой
 * навсегда, без единой ошибки сборки.
 */
const QUIET_HOVER_CLASS: Record<Tone, string> = {
  neutral: "hover:text-fg-0",
  accent: "hover:text-accent-strong",
  success: "hover:text-success-strong",
  warning: "hover:text-warning-strong",
  danger: "hover:text-danger-strong",
};

/**
 * Схемы, исполняющие код в origin страницы.
 *
 * Пробелы и переводы строк внутри схемы браузер игнорирует
 * (`java\tscript:`), регистр тоже, поэтому сверяется очищенное начало строки.
 */
function isExecutableHref(href: unknown): boolean {
  /*
    НЕ СТРОКА — не схема.

    `LinkProps` полиморфны по `as`, и докстрока пропа прямо обещает, что с
    `next/link` компилятор примет объектный `href` (`{ pathname, query }`).
    Проверка, добавленная без сужения типа, звала на нём `.replace` и роняла
    рендер: `TypeError: href.replace is not a function` — причём на том самом
    способе вызова, ради которого полиморфность и заведена. Исполняемую схему
    объект выразить не может: у `UrlObject` нет `protocol`, который дошёл бы
    до `<a>`.
  */
  if (typeof href !== "string" || !href) return false;
  // Управляющие символы здесь НУЖНЫ: браузер их из схемы выбрасывает, поэтому
  // `java\u0000script:` — рабочая ссылка, и вычищать их обязаны и мы.
  // eslint-disable-next-line no-control-regex
  const scheme = href.replace(/[\s\u0000-\u001f]/g, "").toLowerCase();
  return (
    /*
      Из `data:` блокируются только ИСПОЛНЯЕМЫЕ типы.

      Отвергать схему целиком значило молча ломать законную
      `<Link href={csvDataUrl} download="report.csv">`: подпись оставалась на
      экране, но не фокусировалась и не нажималась, а отказ ничем не
      объяснялся. Код исполняют `text/html`, `application/xhtml+xml` и
      `image/svg+xml`; картинка или CSV кодом не являются, а навигацию верхнего
      уровня по `data:` браузеры и так блокируют сами.
    */
    scheme.startsWith("javascript:") ||
    scheme.startsWith("vbscript:") ||
    scheme.startsWith("data:text/html") ||
    scheme.startsWith("data:application/xhtml+xml") ||
    scheme.startsWith("data:image/svg+xml")
  );
}

/**
 * Ссылка.
 *
 * Тон работает как везде в ките — семантикой, а не оттенком; у `quiet` он
 * проявляется только при наведении, поэтому в покое такая ссылка окрашена
 * приглушённым текстом, а не тоном.
 */
export function Link<T extends ElementType = "a">({
  as,
  variant = "inline",
  tone = "accent",
  external,
  className,
  children,
  ...rest
}: LinkProps<T>) {
  const messages = useMessages();
  const Comp = (as ?? "a") as ElementType;

  /*
    `rel` выводится из `target`, а не из `external`, и это не педантизм.
    `noopener` защищает от доступа открытой вкладки к `window.opener` — то есть
    имеет смысл ровно тогда, когда вкладка открывается. Навесить его на обычную
    внутристраничную ссылку значит поставить оберег от того, чего не бывает,
    и приучить читающего код не вчитываться в `rel`.

    Обратное тоже верно: `target="_blank"` получает `rel` независимо от того,
    объявлена ссылка внешней или нет, — дыра открывается тегом, а не пропом.
  */
  const props = rest as { target?: string; rel?: string; href?: unknown };
  const opensNewTab = props.target === "_blank";
  const rel = opensNewTab ? (props.rel ?? "noopener noreferrer") : props.rel;

  /*
    ИСПОЛНЯЕМЫЕ СХЕМЫ не доходят до разметки.

    Компонент уже взял на себя безопасность ссылки — выводит `rel` из `target`
    с обоснованием «дыру открывает тег, а не проп», — а схему не смотрел вовсе:
    `href` уходил на `<a>` как есть. Поле «сайт» в профиле пользователя,
    нарисованное как `<Link href={profile.website}>`, со значением
    `javascript:fetch('/api/keys')…` давало РАБОТАЮЩУЮ ссылку: щелчок исполнял
    код в origin приложения с сессионной кукой.

    ЧЁРНЫЙ СПИСОК, А НЕ БЕЛЫЙ, и это решение владельца. Белый список молча
    ломает собственные схемы приложений — `slack://`, `ms-teams://`, внутренние
    протоколы админок. Отвергается только то, что исполняет код: `javascript:`,
    `vbscript:` и исполняемые типы `data:` (см. `isExecutableHref`). Остальное —
    `http`, `https`, `mailto`, `tel`, относительные пути, якоря, картинка или
    CSV в `data:` — проходит без изменений.

    Ссылка без `href` остаётся в разметке `<a>` без адреса: так потребитель
    видит, что значение отвергнуто, а не гадает, почему ничего не происходит.
  */
  const href = isExecutableHref(props.href) ? undefined : props.href;

  return (
    <Comp
      {...rest}
      href={href}
      rel={rel}
      className={cn(
        // Раскладка НЕ флексовая, и это существенно: `inline-flex` — атомарный
        // бокс, его текст не разрывается между строками. Ссылка в четыре слова
        // внутри абзаца уезжала бы целиком на следующую строку или вылезала за
        // край — то есть вариант `inline` не работал бы ровно там, ради чего
        // заведён. Иконка ниже поэтому свой отступ несёт сама.
        "focus-visible:outline-accent-strong transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
        variant === "quiet" ? cn("text-fg-2", QUIET_HOVER_CLASS[tone]) : TONE_TOKENS[tone].fg,
        VARIANT_CLASS[variant],
        className
      )}
    >
      {children}
      {external ? (
        <ExternalLinkIcon size={12} aria-hidden className="ml-1 inline-block align-[-1px]" />
      ) : null}
      {opensNewTab ? <span className="sr-only">{messages.link.opensInNewTab}</span> : null}
    </Comp>
  );
}
