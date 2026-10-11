"use client";

import { cn } from "../../lib/cn.js";
import { Avatar } from "./Avatar.js";

/** Участник стопки с фотографией. Строка в `names` — то же самое без `src`. */
export interface AvatarGroupMember {
  /** Имя участника: из него выводятся инициалы, оттенок и альтернативный текст аватара. */
  name: string;
  /** Адрес фотографии; без него или при ошибке загрузки — инициалы. */
  src?: string | null;
}

export interface AvatarGroupProps {
  /**
   * Участники: имя строкой или объект `{ name, src? }`. Инициалы и оттенок
   * Avatar выведет сам, фотографию нарисует по `src`.
   */
  names: Array<string | AvatarGroupMember>;
  /**
   * Сколько аватаров показать до «+N».
   *
   * Умолчание — три. Ряд из десяти перекрывающихся кругов не сообщает ни
   * одного имени и занимает место, а число сверх предела говорит ровно то же
   * самое короче.
   */
  max?: number;
  /** Размер аватаров в стопке: `md` или `lg`. По умолчанию `md`. */
  size?: "md" | "lg";
  /** Классы корневого элемента. */
  className?: string;
  /** Доступное имя стопки для скринридера. */
  "aria-label"?: string;
}

/**
 * Стопка аватаров с остатком «+N».
 *
 * Аватары перекрываются отрицательным отступом, и порядок наложения обратный
 * (`z-index` убывает): первый круг лежит поверх второго — иначе последний
 * закрывал бы всех, и глаз читал бы ряд справа налево.
 *
 * **Список объявляется целиком, а не по кругам.** У каждого аватара нет своей
 * подписи: скринридеру он не сообщает ничего полезного («АБ» — это не имя).
 * Поэтому круги скрыты, а группа несёт одно имя со всеми участниками — так
 * читающий получает список, а не набор двухбуквенных обрывков.
 */
export function AvatarGroup({
  names,
  max = 3,
  size = "md",
  className,
  "aria-label": ariaLabel,
}: AvatarGroupProps) {
  // Единая форма участника: дальше код не различает строку и объект.
  const members = names.map((entry) => (typeof entry === "string" ? { name: entry } : entry));
  const shown = members.slice(0, max);
  const rest = members.length - shown.length;

  return (
    <span
      className={cn("inline-flex items-center", className)}
      aria-label={ariaLabel || members.map((member) => member.name).join(", ")}
      role="img"
    >
      {shown.map(({ name, src }, index) => (
        <span
          key={`${name}-${index}`}
          aria-hidden
          className={cn("ring-bg-1 relative rounded-full ring-2", index > 0 && "-ml-2")}
          style={{ zIndex: shown.length - index }}
        >
          {/* `alt=""`: круг скрыт, имя объявляет группа — подпись у фото была бы вторым чтением. */}
          <Avatar name={name} src={src} alt="" size={size} />
        </span>
      ))}
      {rest > 0 ? (
        <span
          aria-hidden
          className={cn(
            // `text-fg-1`, а не `fg-2`: на подложке `bg-3` вторая ступень не держит 4.5 —
            // поймал аудит axe. Остаток «+N» это содержимое, а не подсказка.
            "bg-bg-3 text-fg-1 ring-bg-1 relative -ml-2 flex items-center justify-center rounded-full font-semibold ring-2",
            size === "lg" ? "text-md h-16 w-16" : "text-caption h-7 w-7"
          )}
        >
          +{rest}
        </span>
      ) : null}
    </span>
  );
}
