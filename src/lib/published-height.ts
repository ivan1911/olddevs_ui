"use client";

import { useEffect, type RefObject } from "react";

/*
 * Публикация высоты панели в CSS-переменную корня документа (ADR-0016,
 * ADR-0019). Раньше жила внутри `TopBar`; вынесена, когда ту же роль для
 * нижней панели получил слот `bottomBar` у `AppShell` (`--bottombar-h`).
 * Реестр общий и ключуется именем переменной, поэтому две панели с разными
 * именами друг другу не мешают, а с одним именем — делят владение по стеку.
 */

/**
 * Кто сейчас владеет переменной высоты.
 *
 * Реестр модульный — по той же причине, что счётчик в `useScrollLock`: шапки
 * ПЕРЕКРЫВАЮТСЯ. При переходе между экранами новая монтируется раньше, чем
 * размонтируется старая; то же даёт шапка приложения плюс шапка встроенного
 * виджета с тем же именем переменной.
 *
 * ВЛАДЕНИЕ ПО ИДЕНТИЧНОСТИ, А НЕ ПО ЗНАЧЕНИЮ, и это разбор дефекта, а не вкус.
 * Уборщик сверял опубликованное значение со значением в стиле корня — но две
 * шапки одного компонента дают ОДИНАКОВУЮ высоту, и по значению они
 * неразличимы: уходящая снимала переменную, которую только что опубликовала
 * оставшаяся, и липкие полосы уезжали к верху окна.
 *
 * (До волны 26 дефекта не было видно по другой причине: уборщик перезамерял
 * `offsetHeight` уже отцепленного узла, получал ноль, и ветка снятия не
 * срабатывала никогда — переменная просто переживала шапку.)
 *
 * Пишет в корень только последний зарегистрировавшийся; уходящий отдаёт
 * публикацию предыдущему, а последний — снимает переменную.
 */
const heightOwners = new Map<string, { token: symbol; value: string }[]>();

/**
 * Что стояло в переменной ДО первой шапки.
 *
 * Публиковать высоту может и само приложение — кит не единственный, кто вправе
 * писать в эту переменную (ADR-0016: имя переменной здесь проп именно потому,
 * что кит не знает, чья это шапка). Ушедшая шапка возвращает прежнее значение,
 * а не стирает чужое.
 */
const heightBeforeFirstOwner = new Map<string, string>();

export function publishHeight(heightVar: string) {
  const token = Symbol("published-height");
  const stack = heightOwners.get(heightVar) ?? [];
  if (stack.length === 0) {
    heightBeforeFirstOwner.set(
      heightVar,
      document.documentElement.style.getPropertyValue(heightVar)
    );
  }
  stack.push({ token, value: "" });
  heightOwners.set(heightVar, stack);

  return {
    publish(value: string, root: HTMLElement) {
      const owners = heightOwners.get(heightVar);
      const own = owners?.find((entry) => entry.token === token);
      if (!own || !owners) return;
      own.value = value;
      // Чужую публикацию не перебиваем: наверху стека тот, кто смонтирован
      // последним, и переменная принадлежит ему.
      if (owners.at(-1)?.token === token) root.style.setProperty(heightVar, value);
    },
    release(root: HTMLElement) {
      const owners = heightOwners.get(heightVar);
      if (!owners) return;
      const own = owners.find((entry) => entry.token === token);
      const rest = owners.filter((entry) => entry.token !== token);

      /*
        Чужую запись не трогаем. Владение стеком отвечает на вопрос «кто из
        ШАПОК верхний», но переменную может переписать и не шапка — приложение,
        виджет, отладочный скрипт. Если в корне лежит не то, что публиковали мы,
        значит владелец сменился мимо реестра, и снимать это значение нельзя.
      */
      const inDom = root.style.getPropertyValue(heightVar);
      if (own && inDom !== own.value) {
        // Проверка идёт ДО любой ветки. Под условием «я последний» она пропускала
        // случай с тремя участниками: уходила не последняя шапка, и реестр
        // безусловно перезаписывал переменную значением следующего владельца —
        // чужая запись терялась молча.
        heightOwners.set(heightVar, rest);
        if (rest.length === 0) {
          heightOwners.delete(heightVar);
          heightBeforeFirstOwner.delete(heightVar);
        }
        return;
      }

      if (rest.length === 0) {
        heightOwners.delete(heightVar);
        const before = heightBeforeFirstOwner.get(heightVar) ?? "";
        heightBeforeFirstOwner.delete(heightVar);
        // Оставленная переменная заставила бы липкие полосы отступать от
        // несуществующего элемента — но если значение публиковало приложение,
        // возвращаем его, а не стираем.
        if (before) root.style.setProperty(heightVar, before);
        else root.style.removeProperty(heightVar);
        return;
      }

      heightOwners.set(heightVar, rest);
      const next = rest.at(-1)!;
      if (next.value) root.style.setProperty(heightVar, next.value);
    },
  };
}

/**
 * Публикует измеренную высоту узла в переменную корня документа и держит её
 * актуальной: замер на монтировании плюс `ResizeObserver` — высота меняется от
 * брейкпоинта (панель скрыта классом, и тогда она 0), от переноса содержимого
 * и от выреза экрана.
 *
 * `heightVar === null` отключает публикацию. `enabled = false` — узла сейчас
 * нет в разметке (слот не передан): переменной не должно быть вовсе.
 */
export function usePublishedHeight(
  ref: RefObject<HTMLElement | null>,
  heightVar: string | null,
  enabled = true
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || heightVar == null || !enabled) return;

    const root = document.documentElement;
    const token = publishHeight(heightVar);
    const apply = () => token.publish(`${el.offsetHeight}px`, root);
    apply();

    // Окружение без `ResizeObserver` (тестовый jsdom потребителя, старый
    // движок): остаётся замер на монтировании. Падать из-за наблюдателя
    // нельзя — слот `bottomBar` теперь измеряется у каждого каркаса.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(apply);
    observer?.observe(el);

    return () => {
      observer?.disconnect();
      token.release(root);
    };
  }, [ref, heightVar, enabled]);
}
