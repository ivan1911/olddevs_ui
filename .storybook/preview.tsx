import type { Decorator, Preview } from "@storybook/react-vite";
import { LucideProvider } from "lucide-react";
import "./preview.css";

/**
 * Импорт РАДИ ПОБОЧНОГО ЭФФЕКТА, а не ради значения — не удалять как лишний.
 *
 * `react-aria` на уровне модуля читает `HTMLElement.prototype.focus`, чтобы
 * обернуть его своим отслеживанием фокуса. Storybook подменяет этот же метод
 * геттером, который внутри обращается к `this.ownerDocument` — на прототипе
 * такое обращение невозможно и бросает `Illegal invocation`. Кто успел первым,
 * тот и определяет исход:
 *
 * - при полной загрузке страницы модуль пикера выполняется до подмены — тихо;
 * - при переходе между историями геттер уже стоит, чанк подгружается лениво —
 *   и любая история на `react-aria` (все датапикеры, `FormField`) падает.
 *
 * Здесь модуль выполняется до первого рендера, то есть до подмены, и ленивой
 * загрузки уже не будет. Починка касается только витрины: в приложении
 * геттера Storybook нет, и на снимки с axe в CI это не влияло — там каждая
 * история открывается полной загрузкой.
 */
import "react-aria-components";

/**
 * Переключение темы, акцента и бренда.
 *
 * `withThemeByDataAttribute` из `@storybook/addon-themes` здесь не годится:
 * он управляет ОДНИМ атрибутом, а осей три (`data-theme` × 3, `data-accent` × 2,
 * `data-brand` × 2). Поэтому свой декоратор и три кнопки в тулбаре.
 *
 * Атрибуты пишутся прямо в рендере, а не в `useEffect`: запись идемпотентна,
 * а `useEffect` дал бы кадр со старой темой при переключении.
 *
 * Бренд `base` СНИМАЕТ атрибут, а не пишет `data-brand="base"`: в CSS блока с
 * таким именем нет, и оставленный атрибут выглядел бы как работающий оверлей.
 * Заданный бренд отменяет ось акцента целиком — так устроен каскад, и тулбар
 * это не скрывает: при бренде переключатель акцента ни на что не влияет.
 */
const withThemeAndAccent: Decorator = (Story, context) => {
  const root = document.documentElement;
  root.dataset.theme = String(context.globals.theme);
  root.dataset.accent = String(context.globals.accent);
  const brand = String(context.globals.brand);
  if (brand === "base") delete root.dataset.brand;
  else root.dataset.brand = brand;
  return <Story />;
};

/**
 * Размер иконок по умолчанию — как у типичного потребителя.
 *
 * Словарь иконок размер не задаёт: это работа `LucideProvider` у потребителя
 * (docs/icons.md). Без провайдера витрина рисовала иконку без `size` в 24px —
 * умолчании lucide — и в маленьких кнопках иконка выходила крупнее подписи
 * (аудит OLDSUI-243). 16 — размер, который кит сам ставит в кнопках и полях.
 *
 * Толщина линии не задаётся: своей у кита нет, иконки рисуются с толщиной
 * lucide по умолчанию, и явные `size` в историях провайдер не перебивает.
 */
const withIconDefaults: Decorator = (Story) => (
  <LucideProvider size={16}>
    <Story />
  </LucideProvider>
);

const preview: Preview = {
  decorators: [withThemeAndAccent, withIconDefaults],
  globalTypes: {
    theme: {
      description: "Colour theme",
      toolbar: {
        title: "Theme",
        icon: "paintbrush",
        items: [
          { value: "dark", title: "Dark" },
          { value: "light", title: "Light" },
          { value: "dim", title: "Dim" },
        ],
        dynamicTitle: true,
      },
    },
    accent: {
      description: "Accent colour",
      toolbar: {
        title: "Accent",
        icon: "circlehollow",
        items: [
          { value: "blue", title: "Blue" },
          { value: "violet", title: "Violet" },
        ],
        dynamicTitle: true,
      },
    },
    brand: {
      description: "Brand overlay; a set brand cancels the accent axis",
      toolbar: {
        title: "Brand",
        icon: "beaker",
        items: [
          { value: "base", title: "Base" },
          { value: "teal", title: "Teal" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "dark", accent: "blue", brand: "base" },
  parameters: {
    // Фон задают наши темы через --surface-app; штатный переключатель фона
    // Storybook перекрыл бы их и показывал бы неправду.
    //
    // Проп называется `disable`, а не `disabled`: автомиграция апгрейда до
    // 10.5.6 переименовала его во второе имя, которого в типах пакета нет
    // (`BackgroundsParameters` в `storybook/dist/backgrounds`). Переключатель
    // от этого вернулся бы молча — компилятор такие пропы не проверяет.
    backgrounds: { disable: true },
    controls: { expanded: true },
  },
};

export default preview;
