"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface KbdProps extends ComponentPropsWithoutRef<"kbd"> {
  /** `sm` — внутри пункта меню; `md` — в шпаргалке шорткатов. */
  size?: "sm" | "md";
}

/** Знаки модификаторов Apple: `⌘ ⌥ ⇧ ⌃`. */
const KEY_SYMBOLS = /([⌘⌥⇧⌃])/;

/**
 * Знаки клавиш в строке — отдельными `span` пропорциональным шрифтом.
 *
 * В моноширинном стеке кита (SF Mono, Menlo) знака `⇧` нет, браузер берёт его
 * из запасного шрифта, и стрелка выходит тонкой и бледной рядом с `⌘` и буквой.
 * У `--font-sans` все четыре знака есть и одного веса; переводить
 * на него всю подпись нельзя — буквы и цифры клавиш держат моноширинный ряд.
 * Текст подписи не меняется: `span` без роли скринридер читает слитно.
 *
 * Экспорт — для меню: подсказка сочетания у пункта `Menu`, `ContextMenu` и
 * Слэш-меню — свой `<kbd>` другого размера, а знаки в нём те же.
 */
export function keyGlyphs(children: ReactNode): ReactNode {
  if (typeof children !== "string" || !KEY_SYMBOLS.test(children)) return children;
  return children.split(KEY_SYMBOLS).map((part, index) =>
    // Нечётные части — сами знаки: `split` с группой кладёт их между кусками.
    index % 2 === 1 ? (
      <span key={index} data-key-symbol className="font-sans">
        {part}
      </span>
    ) : (
      part
    )
  );
}

/**
 * Клавиша на клавиатуре: `⌘`, `Esc`, `⇧+D`.
 *
 * Тег `<kbd>` — не косметика: он объявляет содержимое пользовательским вводом,
 * и скринридер читает его иначе, чем окружающий текст. Замена его на `<span>`
 * со шрифтом моноширинным выглядела бы так же и не значила ничего.
 *
 * Шрифт берётся из токена `--font-mono`, а не из системного `monospace`:
 * подписи клавиш почти всегда стоят рядом друг с другом (`⌘` + `K`), и разная
 * ширина знака делает ряд рваным.
 */
export function Kbd({ size = "sm", className, children, ...rest }: KbdProps) {
  return (
    <kbd
      className={cn(
        "border-line-soft bg-bg-2 text-fg-2 inline-flex items-center justify-center rounded-xs border font-mono",
        // Высота задана, а не выведена, — по тому же правилу, что у контролов:
        // клавиша стоит в строке рядом с текстом, и её рост не должен зависеть
        // от того, один в подписи знак или четыре.
        size === "sm" ? "text-caption h-5 min-w-5 px-1" : "h-6 min-w-6 px-1.5 text-xs",
        className
      )}
      {...rest}
    >
      {keyGlyphs(children)}
    </kbd>
  );
}
