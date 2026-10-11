"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { TONE_TOKENS, type Tone } from "../../lib/variants.js";

export interface StatProps {
  /** Подпись показателя. */
  label: ReactNode;
  /** Значение показателя. */
  value: ReactNode;
  /** Пояснение под значением: период, доля, что угодно короткое. */
  hint?: ReactNode;
  /** Изменение: число или готовая строка («+320», «−4%»). */
  delta?: ReactNode;
  /**
   * Тон дельты. Задаётся пропом, а не выводится из знака.
   *
   * Рост не всегда зелёный: выросшее число отписок, ошибок публикации или
   * времени ответа — плохая новость, а падение расходов — хорошая. Компонент,
   * который красит плюс в зелёный, врёт ровно в тех случаях, где ошибиться
   * дороже всего.
   *
   * Не задан — дельта нейтральная: «изменилось на столько-то», без оценки.
   */
  deltaTone?: Tone;
  /**
   * Кегль значения.
   *
   * `md` — показатель в плотной панели, где их десяток и все равны.
   * `lg` — заглавное число экрана: то, ради чего на дашборд и заходят.
   * Разница здесь не косметическая: одинаковый кегль у главного показателя и
   * у соседней подписи означает, что иерархии на экране нет вовсе.
   */
  size?: "md" | "lg";
  /** Классы корневого элемента. */
  className?: string;
}

const VALUE_CLASS: Record<"md" | "lg", string> = {
  md: "text-xl font-semibold",
  lg: "text-2xl font-bold tracking-tight",
};

/**
 * Показатель: подпись, значение, изменение.
 *
 * Собран руками — поведения здесь нет вовсе, только раскладка и одно решение
 * про тон дельты.
 *
 * Разметка — `dl`: подпись и значение связаны как термин и определение, и
 * скринридер читает их парой. Два `div` рядом такой связи не дают, и значение
 * «12 480» звучит без всякого указания, чего именно.
 */
export function Stat({ label, value, hint, delta, deltaTone, size = "md", className }: StatProps) {
  return (
    <dl className={cn("m-0 flex flex-col gap-0.5", className)}>
      <dt className="text-fg-2 text-caption">{label}</dt>
      <dd className="m-0 flex items-baseline gap-2">
        <span className={cn("text-fg-0 tabular-nums", VALUE_CLASS[size])}>{value}</span>
        {delta != null ? (
          <span
            className={cn(
              "text-caption font-semibold",
              deltaTone ? TONE_TOKENS[deltaTone].fg : "text-fg-2"
            )}
          >
            {delta}
          </span>
        ) : null}
      </dd>
      {hint != null ? <dd className="text-fg-2 text-caption m-0">{hint}</dd> : null}
    </dl>
  );
}
