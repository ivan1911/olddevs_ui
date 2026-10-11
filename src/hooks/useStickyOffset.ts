"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface StickyOffsetOptions {
  /**
   * Имя CSS-переменной, в которой приложение публикует высоту своей верхней
   * панели. Проп, а не константа: пакет не знает, что у потребителя есть
   * шапка, как она называется и есть ли она вообще ([ADR-0016]).
   */
  offsetVar?: string;
  /** Смещение, когда переменной нет. Это законное состояние, а не ошибка. */
  fallback?: string;
}

export interface StickyOffset {
  /**
   * Вешается на пустой блок нулевой высоты **прямо перед** липким элементом.
   * Пересечение именно этого блока и означает, что полоса встала на место.
   *
   * Callback-ref, а не объект: полоса бывает условной и появляется позже самой
   * страницы, а эффект на монтировании такой маркер попросту не застаёт.
   */
  sentinelRef: (node: HTMLElement | null) => void;
  /** Полоса прижалась к верхней границе. */
  isStuck: boolean;
}

/**
 * Отступ со сменённым знаком.
 *
 * Приписывать минус строкой НЕЛЬЗЯ: опубликованное значение само бывает
 * отрицательным, и `-` + `-10px` давало `--10px` — `SyntaxError` в конструкторе
 * наблюдателя, то есть падение поддерева. Ровно тот отказ, ради которого писан
 * `toPixels`, только через другой вход.
 */
function negate(value: string): string {
  return value.startsWith("-") ? value.slice(1) : `-${value}`;
}

/**
 * Приводит опубликованную длину к пикселям.
 *
 * `IntersectionObserver` принимает ТОЛЬКО пиксели и проценты и бросает
 * `SyntaxError` на всём остальном. Значение уходило в `rootMargin` как есть, а
 * кит нигде не требует от приложения публиковать высоту именно в пикселях:
 * `--topbar-h: 4rem` роняло полосу и всё поддерево во время коммита.
 *
 * Единицы, которые браузер понимает сам, пропускаются без работы; остальные
 * меряются одноразовым элементом. Мерить приходится в документе — вне его
 * раскладки нет. Вызывающий обязан отсечь повтор ДО вызова (см. `rawRef`):
 * замер стоит двух принудительных пересчётов раскладки.
 *
 * Пределы, принятые осознанно: `em` меряется относительно шрифта `body`, а не
 * шапки; отрицательное значение в неизвестных единицах браузер отбрасывает, и
 * получается `0px` (в пикселях знак сохраняется).
 */
export function toPixels(value: string, fallback: string): string {
  const raw = value || fallback;
  // Пустая строка сюда доходит, когда потребитель передал пустой `fallback`:
  // тип пропа этого не запрещает. Без нормализации получался `rootMargin`
  // вида `"- 0px 0px 0px"` — то есть ровно то падение, ради которого функция и
  // написана, только через другой вход.
  if (raw === "") return "0px";
  // Число, а не `[\d.]+`: тот класс принимает `1.2.3` и `..`, то есть пропускал
  // бы мимо замера значение, которое браузер отвергнет, — и падение возвращалось
  // бы тем же путём, каким пришло с `4rem`.
  if (/^-?(\d+(\.\d+)?|\.\d+)(px|%)$/.test(raw)) return raw;

  const probe = document.createElement("div");
  // `setProperty`, а не `cssText`: значение приходит из CSS приложения, и
  // собственные объявления внутри него затёрли бы защитные свойства зонда.
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.setProperty("height", raw);
  document.body.appendChild(probe);
  const px = probe.getBoundingClientRect().height;
  probe.remove();
  return Number.isFinite(px) ? `${px}px` : fallback || "0px";
}

/**
 * Липкая полоса: знает, прижалась ли она уже к верхней панели приложения.
 *
 * Отсчёт идёт от НАСТОЯЩЕЙ высоты панели, а не от зашитого числа: на узких
 * экранах шапка ниже, чем на широких, и константа оставляет просвет, сквозь
 * который видно уезжающий контент. Высоту публикует приложение — в CSS-переменной,
 * имя которой здесь проп. Решение и отвергнутые варианты — [ADR-0016].
 *
 * Потребитель обычно использует `isStuck`, чтобы убрать верхние скругления:
 * у прижавшейся полосы они приоткрывают фон страницы уголками на стыке.
 */
export function useStickyOffset({
  offsetVar = "--topbar-h",
  fallback = "0px",
}: StickyOffsetOptions = {}): StickyOffset {
  const [isStuck, setIsStuck] = useState(false);
  const nodeRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  /** Последний применённый отступ: пересоздавать наблюдателя ради того же числа незачем. */
  const appliedRef = useRef<string | null>(null);
  /** Сырое значение переменной, из которого этот отступ получен. */
  const rawRef = useRef<string | null>(null);

  const connect = useCallback(() => {
    const node = nodeRef.current;
    if (!node) return;
    // Отсутствие API — законное состояние, а не ошибка: на сервере его нет
    // вовсе, а в тестах потребителя jsdom его не подкладывает. Полоса просто
    // никогда не считается прижатой.
    if (typeof IntersectionObserver === "undefined") return;

    /*
      Сначала сравниваем СЫРУЮ строку — до всякой работы.

      Отсечка стояла после `toPixels`, и это расходилось с её же комментарием
      («только при смене значения»): `getComputedStyle` корня и цикл зонда
      платились на каждый вызов. А вызовов много: наблюдатель за `style` корня
      будят и `usePreventScroll` из react-aria (он пишет туда `overflow` и
      `padding-right` при открытии ЛЮБОГО оверлея — то есть половина кита), и
      переключатель темы приложения, и `--vh`-полифилл. С `4rem` это давало два
      принудительных пересчёта раскладки на каждое такое пробуждение.
    */
    const raw = getComputedStyle(document.documentElement).getPropertyValue(offsetVar).trim();
    if (raw === rawRef.current && observerRef.current) return;
    rawRef.current = raw;

    const offset = toPixels(raw, fallback);
    if (offset === appliedRef.current && observerRef.current) return;

    observerRef.current?.disconnect();
    appliedRef.current = offset;
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry) setIsStuck(!entry.isIntersecting);
      },
      { rootMargin: `${negate(offset)} 0px 0px 0px` }
    );
    observerRef.current.observe(node);
  }, [offsetVar, fallback]);

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      nodeRef.current = node;
      if (node) {
        connect();
        return;
      }
      observerRef.current?.disconnect();
      observerRef.current = null;
      appliedRef.current = null;
      rawRef.current = null;
      setIsStuck(false);
    },
    [connect]
  );

  useEffect(() => {
    /*
      Пересборка сводится к одной на кадр.

      Обработчиком `resize` стоял сам `connect`, а он делает синхронный
      `getComputedStyle` корня (принудительный пересчёт стилей) и полный цикл
      жизни наблюдателя. Протягивание рамки окна мышью даёт десятки событий в
      секунду, и каждый новый наблюдатель выдавал стартовый колбэк — скругления
      липкой полосы подрагивали. Вдобавок значение переменной при этом почти
      всегда одно и то же: высота меняется на брейкпоинте, а не на каждом
      пикселе.
    */
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        connect();
      });
    };

    window.addEventListener("resize", schedule);

    /*
      Ширины окна НЕДОСТАТОЧНО. Парная сторона контракта (`TopBar`) публикует
      высоту через `ResizeObserver` и в комментарии прямо называет причины, не
      связанные с шириной: перенос содержимого слотов и вторая строка в поиске.
      Шапка становится двухстрочной, `--topbar-h` уезжает с 56 на 96, а
      `rootMargin` оставался прежним — полоса считала себя прижатой на 40px
      раньше, чем прижималась.

      Наблюдаем не за шапкой (хук про неё ничего не знает — ADR-0016), а за
      атрибутом `style` корня: переменную публикуют именно туда.
    */
    const mutations =
      typeof MutationObserver === "undefined" ? null : new MutationObserver(schedule);
    mutations?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    });

    /*
      Наблюдатель ставится ЗДЕСЬ, а не только из callback-ref.

      Смена `offsetVar` меняет идентичность `connect`, а с ней и `sentinelRef`.
      React отцепляет старый ref (обнуляя рефы), цепляет новый — тот создаёт
      живой наблюдатель, — и ТОЛЬКО ПОТОМ гоняет уборщик старого пассивного
      эффекта, который этот свежий наблюдатель и отключал. Пока отсечек в
      `connect` не было, следующий `resize` пересоздавал его безусловно, и сбой
      сам собой лечился. Отсечки по значению (выше) эту страховку убрали:
      мёртвый, но не обнулённый `observerRef` выглядит для них живым, и полоса
      замирала НАВСЕГДА.
    */
    connect();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      mutations?.disconnect();
      observerRef.current?.disconnect();
      // Сброс тот же, что в ветке отключения узла: иначе отсечки принимают
      // отключённый наблюдатель за действующий.
      observerRef.current = null;
      appliedRef.current = null;
      rawRef.current = null;
    };
  }, [connect]);

  return { sentinelRef, isStuck };
}
