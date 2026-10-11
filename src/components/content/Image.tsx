"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { ImageIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";

export interface ImageProps extends Omit<
  ComponentPropsWithoutRef<"img">,
  "className" | "loading" | "src" | "alt"
> {
  /** Адрес картинки. Пустое значение равносильно отказу загрузки — рисуется фолбэк. */
  src?: string | null;
  /**
   * Альтернативный текст, обязателен.
   *
   * Пустая строка — законное значение и означает «картинка декоративна»:
   * плитка обоя рядом с её названием, превью категории рядом с именем.
   * Обязательность нужна не ради текста, а ради выбора: `alt=""` — решение,
   * а отсутствующий атрибут — забывчивость, и скринридер в этом случае читает
   * вслух имя файла.
   */
  alt: string;
  /** Как картинка вписана в свою коробку. Не действует при `sizing="intrinsic"`. */
  fit?: "cover" | "contain";
  /**
   * Кто задаёт размер — коробка или сама картинка.
   *
   * `fill` (умолчание) — размер известен снаружи: плитка в сетке, аватар,
   * превью фиксированной высоты. Картинка растягивается на коробку и
   * вписывается по `fit`.
   *
   * `intrinsic` — размер у картинки, коробка её обнимает. Так устроен
   * просмотр кадра: у него нет своей высоты, есть только потолок
   * (`max-h-[45vh]`), и вешать этот потолок нужно на КАРТИНКУ, через
   * `imgClassName`. Повесить его на коробку нельзя: коробка обрежет кадр
   * вместо того, чтобы его уменьшить.
   *
   * Разница не косметическая: в режиме `fill` картинке проставлены
   * `h-full w-full`, то есть проценты от коробки, и коробка без собственного
   * размера схлопывается в ноль вместе с картинкой. Ленивая загрузка при этом
   * не стартует вовсе — браузеру нечего показывать.
   */
  sizing?: "fill" | "intrinsic";
  /**
   * Соотношение сторон коробки числом (`16 / 9`). Без него высоту задаёт
   * раскладка снаружи — так делают все плитки, стоящие в сетке.
   */
  ratio?: number;
  /**
   * Что показать вместо картинки, когда её нет или она не загрузилась.
   * По умолчанию — приглушённая иконка на приглушённой подложке; `null`
   * оставляет пустую коробку.
   *
   * Свой узел получает только центровку и место — ни подложки, ни цвета текста
   * ему не навязывается. Иначе фолбэк с собственным фоном (буква категории,
   * покрашенная по её имени) не смог бы существовать: подложка умолчания
   * закрывала бы его.
   */
  fallback?: ReactNode;
  /** Скелетон под картинкой, пока она грузится. */
  skeleton?: boolean;
  /**
   * Грузить сразу, без отложенной загрузки. По умолчанию загрузка отложена, но
   * для картинки первого экрана это вредно: браузер откладывает её и ухудшает
   * метрику LCP (Largest Contentful Paint).
   */
  eager?: boolean;
  /** Классы коробки: размер, скругление, рамка. */
  className?: string;
  /**
   * Классы самой картинки. В режиме `fill` нужны редко — вписывание задано
   * `fit`; в режиме `intrinsic` именно сюда идут ограничения размера.
   */
  imgClassName?: string;
  /** Инлайн-стиль картинки. Нужен там, где визуальный элемент — она, а не коробка. */
  imgStyle?: CSSProperties;
}

const FIT = {
  cover: "object-cover",
  contain: "object-contain",
} as const;

/**
 * Картинка со всеми тремя состояниями: грузится, загрузилась, не загрузилась.
 *
 * До пакета сырой `<img>` стоял в 24 файлах фронта, и каждое место решало
 * одно и то же по-своему: `loading="lazy"` расставлен в одних и забыт в
 * других, фолбэка при битом `src` нет нигде, скелетона нет нигде,
 * `object-cover` с радиусом расписан заново в каждом. Расхождение такого рода
 * видно, только если открыть 24 файла рядом, а починка стоит 24 правок.
 *
 * Решение стоять на обычном `<img>`, а не на `next/image` — [ADR-0011].
 * Коротко: пакет не знает про фреймворк потребителя, а картинки продукта уже
 * приходят с S3 в двух размерах, то есть оптимизированы там, где лежат.
 *
 * УСТРОЙСТВО: коробка и картинка внутри неё. Коробке — размер, скругление и
 * рамка (`className`), картинке — вписывание. Разделение вынужденное: под
 * скелетон и фолбэк нужен элемент, который остаётся на месте, когда самой
 * картинки нет; иначе плитка схлопывалась бы в ноль и раскладка прыгала.
 *
 * `radius` отдельным пропом не заведён: коробка и так принимает `className`, а
 * во фронте радиусов картинки семь разных (`10px`, `lg`, `xl`, `50%`, …) —
 * шкала из трёх ступеней описывала бы не предметную область, а мешала бы ей.
 * Та же причина, по которой числа принимает `Skeleton`.
 */
export const Image = forwardRef<HTMLImageElement, ImageProps>(function Image(
  {
    src,
    alt,
    fit = "cover",
    sizing = "fill",
    ratio,
    fallback,
    skeleton = true,
    eager = false,
    className,
    imgClassName,
    imgStyle,
    style,
    onLoad,
    onError,
    ...rest
  },
  ref
) {
  // Состояние привязано к адресу: при его смене всё начинается заново.
  // Без сброса плитка, один раз не загрузившаяся, оставалась бы с фолбэком
  // навсегда — в том числе после «попробовать снова» и после пагинации,
  // переиспользующей тот же узел под другой обой.
  const [state, setState] = useState<"loading" | "loaded" | "failed">(src ? "loading" : "failed");
  const imgRef = useRef<HTMLImageElement | null>(null);

  const setRefs = useCallback(
    (node: HTMLImageElement | null) => {
      imgRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  useEffect(() => {
    if (!src) {
      setState("failed");
      return;
    }
    setState("loading");

    // КАРТИНКА ИЗ КЕША УЖЕ ГОТОВА к моменту, когда React вешает обработчик, и
    // события `load` по ней больше не будет — ни одного. Без этой проверки
    // скелетон остаётся в разметке навсегда: он лежит ПОД картинкой, поэтому
    // на непрозрачном превью его не видно, и дефект живёт молча. Найден
    // внедрением: на экране библиотеки 33 плитки из 58 держали мёртвый
    // скелетон при полностью загруженных картинках.
    const node = imgRef.current;
    if (node?.complete) setState(node.naturalWidth > 0 ? "loaded" : "failed");
  }, [src]);

  const failed = state === "failed";
  const intrinsic = sizing === "intrinsic";
  // Умолчание несёт СВОЮ подложку, а не получает её от обёртки: обёртка даёт
  // только место и центровку, потому что свой фолбэк красится вызывающим
  // (буква категории покрашена по её имени, и чужая подложка закрыла бы её).
  const fallbackNode =
    fallback === undefined ? (
      <span className="bg-bg-2 text-fg-3 flex h-full w-full items-center justify-center">
        <ImageIcon size={18} strokeWidth={1.5} />
      </span>
    ) : (
      fallback
    );

  return (
    <span
      className={cn("relative overflow-hidden", intrinsic ? "inline-block" : "block", className)}
      style={ratio ? { aspectRatio: ratio, ...style } : style}
    >
      {/* Скелетон лежит ПОД картинкой, а не вместо неё: браузер начинает
          загрузку только когда `<img>` в дереве, и подмена откладывала бы её
          до конца загрузки, которой без элемента не случится.

          В режиме `intrinsic` его нет и быть не может: до загрузки коробка
          обнимает пустоту и своего размера не имеет, так что растягивать
          скелетон не по чему. Место под кадр там держит вызывающий. */}
      {skeleton && !intrinsic && state === "loading" ? (
        <span aria-hidden className="skeleton absolute inset-0 block rounded-none" />
      ) : null}

      {failed ? (
        fallbackNode ? (
          <span
            // Пустой `alt` означает «картинка декоративна», и фолбэк наследует
            // это решение. А вот осмысленную подпись терять нельзя: без неё
            // отказ превращает названный объект в пустое место, и скринридер
            // о нём не узнаёт вовсе.
            {...(alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true })}
            className={cn("flex items-center justify-center", intrinsic ? "" : "absolute inset-0")}
          >
            {fallbackNode}
          </span>
        ) : null
      ) : (
        <img
          ref={setRefs}
          src={src ?? undefined}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          style={imgStyle}
          className={cn("block", intrinsic ? null : cn("h-full w-full", FIT[fit]), imgClassName)}
          onLoad={(e: SyntheticEvent<HTMLImageElement>) => {
            setState("loaded");
            onLoad?.(e);
          }}
          onError={(e: SyntheticEvent<HTMLImageElement>) => {
            setState("failed");
            onError?.(e);
          }}
          {...rest}
        />
      )}
    </span>
  );
});
