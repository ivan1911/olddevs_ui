"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { BottomBarSlotContext } from "../../lib/bottom-bar-slot.js";
import { cn } from "../../lib/cn.js";
import { usePublishedHeight } from "../../lib/published-height.js";
import { Drawer } from "../overlays/Drawer.js";
import { NavInOverlayProvider } from "./SideNav.js";

/**
 * Связь каркаса с шапкой: единственное, что им нужно знать друг о друге, —
 * как открыть навигацию на узком экране.
 *
 * Контекст, а не слот в `TopBar`, потому что шапку в каркас передаёт
 * потребитель уже собранной, и вложить в неё кнопку снаружи нельзя.
 *
 * @internal Значение контекста; читать его следует через `useAppShell`.
 */
const AppShellContext = createContext<AppShellContextValue>({});

export interface AppShellContextValue {
  /**
   * Открыть навигацию ящиком. Есть, когда каркас получил `sidebar`. Ширину
   * экрана каркас не проверяет, поэтому свою кнопку показывают только там, где
   * колонка скрыта, то есть ниже `md`.
   */
  openNavigation?: () => void;
}

/**
 * Доступ к каркасу из своей шапки.
 *
 * Публичный, а не внутренний, и это исправление дефекта, а не удобство:
 * `openNavigation` умел читать только китовый `TopBar`, и потребитель со своей
 * шапкой получал навигацию, которую ниже `md` **нечем открыть** — колонка
 * скрыта, ящик открывать некому, предупреждения нет. Молчаливая недостижимость
 * целого раздела интерфейса.
 *
 * Вне `AppShell` возвращает пустой объект: своя шапка проверяет
 * `openNavigation` на наличие и рисует кнопку только когда та осмысленна.
 */
export const useAppShell = (): AppShellContextValue => useContext(AppShellContext);

export interface AppShellProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /** Боковая навигация — обычно `SideNav`. */
  sidebar?: ReactNode;
  /** Шапка — обычно `TopBar`. */
  header?: ReactNode;
  /**
   * Сообщения уровня приложения над шапкой — обычно один или несколько `Banner`.
   *
   * Стоят НАД шапкой, в колонке содержимого: деградация сервиса касается всего
   * приложения, но боковая навигация остаётся во всю высоту — иначе каркас
   * пришлось бы разворачивать из строки в колонку целиком ради узла, который
   * бывает пустым.
   *
   * НЕ ЛИПКИЕ, и это решение, а не упущение (ADR-0027).
   * Шапка остаётся на `top: 0`, а `--topbar-h` продолжает означать ровно её
   * высоту — контракт липкости (ADR-0016)
   * и его публикация шапкой (ADR-0019)
   * не трогаются. Липкая стопка потребовала бы второй переменной смещения, и
   * всё, что сегодня считает от `--topbar-h` — `SelectionBar`, липкая шапка
   * `Table`, — обязано было бы прибавлять её высоту.
   *
   * Очереди у слота нет: порядок и состав задаёт потребитель.
   */
  banners?: ReactNode;
  /**
   * Правая область рядом с содержимым: детали, справка, что угодно ещё.
   *
   * Безымянный слот без ручки изменения размера — и это решение, а не
   * недоделка. Ручку размера даёт отдельный компонент `SplitPanel`
   * (ADR-0018).
   */
  aside?: ReactNode;
  /**
   * Нижняя панель на узких экранах — обычно `MobileTabBar`; на `md` и шире скрыта.
   *
   * Слот даёт панели всё, что принадлежит каркасу, а не ей: прилипание к низу
   * окна, скрытие на `md` и шире, где есть боковая навигация, высоту в потоке и
   * отступ `env(safe-area-inset-bottom)` под вырез экрана. Поэтому
   * `MobileTabBar` своих `fixed`, `md:hidden` и отступа не несёт, а чужая
   * панель, поставленная сюда, не должна их повторять — отступ вышел бы
   * двойным.
   */
  bottomBar?: ReactNode;
  /**
   * Имя переменной, в которую слот `bottomBar` публикует свою высоту (вместе с
   * отступом под вырез экрана). По умолчанию `--bottombar-h`.
   *
   * Парная сторона контракта, как `heightVar` у `TopBar`: то же имя по
   * умолчанию читают `ContextualSaveBar` и `Toaster` (их проп `offsetVar`), и
   * они встают над панелью, а не под ней. На `md` и шире панель скрыта и высота
   * равна `0px`; без слота переменной нет вовсе, и читатели берут запасное `0px`.
   *
   * `null` отключает публикацию — когда в документе два каркаса и они не должны
   * перебивать друг друга.
   */
  bottomBarHeightVar?: string | null;
  /**
   * Ключ текущего маршрута: при его смене фокус уезжает в `<main>`, а ящик навигации закрывается.
   *
   * Проп, а не подписка на роутер: кит не знает, какой это роутер, и что
   * считать сменой экрана, знает только приложение. Не передан — возврата
   * фокуса не будет, и это **молчаливая деградация**: ни ошибки, ни
   * предупреждения не появится, поэтому проп стоит передавать всегда.
   */
  routeKey?: string;
  /** Содержимое страницы — попадает в `<main>`. */
  children: ReactNode;
}

/**
 * Каркас приложения: навигация слева, шапка сверху, содержимое, опциональные
 * правая область и нижняя панель.
 *
 * СКРОЛЛ ОСТАЁТСЯ У ДОКУМЕНТА, а не у `<main>`. Это не мелочь раскладки: липкие
 * элементы кита (`SelectionBar`) отсчитывают смещение от высоты шапки, и если
 * бы содержимое прокручивалось в собственном контейнере, полоса встала бы с
 * просветом в эту самую высоту. Прежняя оболочка во фронте устроена так же, и
 * контракт ADR-0016 продолжает работать без оговорок.
 *
 * МОБИЛЬНЫЙ РЕЖИМ переключает CSS, а не `matchMedia`: колонка навигации скрыта
 * классом, ящик показан классом. `matchMedia` в SSR даёт неверный первый кадр,
 * и пользователь видит скачок раскладки после гидратации (ADR-0018).
 */
export const AppShell = forwardRef<HTMLDivElement, AppShellProps>(function AppShell(
  {
    sidebar,
    header,
    banners,
    aside,
    bottomBar,
    bottomBarHeightVar = "--bottombar-h",
    routeKey,
    children,
    className,
    ...rest
  },
  ref
) {
  const messages = useMessages();
  const mainId = useId();
  const mainRef = useRef<HTMLElement | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const lastRouteKey = useRef(routeKey);
  const bottomBarRef = useRef<HTMLDivElement>(null);

  // Высота обёртки слота, а не самой полосы: в неё входят рамка и отступ под
  // вырез — ровно столько нижнего края окна панель занимает. Скрытая на `md`
  // обёртка (`display: none`) измеряется нулём, и переменная это отражает.
  usePublishedHeight(bottomBarRef, bottomBarHeightVar, bottomBar != null);

  useEffect(() => {
    // Загрузка страницы пропускается: фокус на ней принадлежит документу, и
    // забирать его в `<main>` значит красть его у пользователя, который уже
    // начал что-то делать.
    //
    // Сравнение с прошлым ключом, а не флаг «первый проход»: StrictMode в dev
    // запускает эффект дважды, а реф переживает повторное монтирование. Флаг
    // ко второму запуску был уже сброшен, и фокус уходил в `<main>` прямо на
    // загрузке.
    if (lastRouteKey.current === routeKey) return;
    lastRouteKey.current = routeKey;
    // Без прокрутки: при переходе её задаёт роутер. Своя прокрутка к фокусу
    // уводила верх `<main>` под липкую шапку.
    mainRef.current?.focus({ preventScroll: true });
  }, [routeKey]);

  // Ящик закрывается при смене маршрута сам: оставленный открытым, он
  // перекрыл бы экран, на который пользователь только что перешёл.
  useEffect(() => setNavOpen(false), [routeKey]);

  return (
    <AppShellContext.Provider
      value={{ openNavigation: sidebar ? () => setNavOpen(true) : undefined }}
    >
      <div ref={ref} className={cn("relative flex min-h-dvh", className)} {...rest}>
        {/*
          Первый фокусируемый элемент страницы. Виден только под фокусом, но это
          НЕ текст для скринридера: им пользуется клавиатурный пользователь без
          скринридера, и увидеть ссылку он должен глазами.

          Корень позиционирован (`relative`) ради этой ссылки: `focus:absolute`
          иначе отсчитывается от ближайшего позиционированного предка, и у
          вложенного каркаса ссылка всплывала бы не над ним, а где-то на
          странице.
        */}
        <a
          href={`#${mainId}`}
          className="focus:bg-bg-1 focus:text-fg-0 focus:outline-accent-strong sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:px-3 focus:py-2 focus:text-sm focus:outline-2"
        >
          {messages.shell.skipToContent}
        </a>

        {sidebar != null ? (
          <>
            <div className="sticky top-0 hidden h-dvh md:flex">{sidebar}</div>
            <Drawer
              open={navOpen}
              onClose={() => setNavOpen(false)}
              side="left"
              size="sm"
              title={messages.nav.label}
            >
              {/*
                Та же навигация, но в ящике: `SideNav` внутри разворачивается
                принудительно и прячет кнопку сворачивания. Иконочный режим
                отдаёт ширину содержимому страницы, а в оверлее содержимого
                рядом нет — отдавать некому.
              */}
              <NavInOverlayProvider value={true}>{sidebar}</NavInOverlayProvider>
            </Drawer>
          </>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          {/*
            Без слота узла нет вовсе — не пустой `div`, а ничего: каркас без
            баннеров обязан давать ровно ту разметку, что и до появления слота.
            Тот же приём, что у `bottomBar` и `aside`.
          */}
          {banners}
          {header}

          <div className="flex min-w-0 flex-1">
            <main id={mainId} ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 outline-none">
              {children}
            </main>
            {aside != null ? <aside className="shrink-0">{aside}</aside> : null}
          </div>

          {/*
            Панель стоит в потоке, а не `fixed`: так она сама съедает высоту и
            содержимое над ней не приходится отодвигать измеренным отступом.
            Отсутствует — в разметку не попадает и высоты не занимает.

            Вырез экрана добирается классом, а не инлайновым стилем: так отступ
            попадает в гейт покрытия классов и виден в тестах, а jsdom
            выбрасывает `env()` из инлайнового стиля целиком.
          */}
          {bottomBar != null ? (
            <div
              ref={bottomBarRef}
              className="border-line-soft sticky bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom,0px)] md:hidden"
            >
              {/* Полоса узнаёт, что отступ под вырез даёт слот, — см. `BottomBarSlotContext`. */}
              <BottomBarSlotContext.Provider value={true}>
                {bottomBar}
              </BottomBarSlotContext.Provider>
            </div>
          ) : null}
        </div>
      </div>
    </AppShellContext.Provider>
  );
});
