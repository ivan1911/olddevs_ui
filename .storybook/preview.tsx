import type { Decorator, Preview } from "@storybook/react-vite";
import { LucideProvider } from "lucide-react";
import "./preview.css";

/**
 * The import is there FOR ITS SIDE EFFECT, not for its value: do not remove it as unused.
 *
 * `react-aria` reads `HTMLElement.prototype.focus` at module level to wrap it with its own
 * focus tracking. Storybook replaces the same method with a getter that accesses
 * `this.ownerDocument` inside. On the prototype such access is impossible and throws
 * `Illegal invocation`. Whoever runs first decides the outcome:
 *
 * - on a full page load, the picker module runs before the replacement, silently;
 * - when switching between stories, the getter is already in place and the chunk is loaded
 *   lazily, so any story that uses `react-aria` (all date pickers, `FormField`) fails.
 *
 * Here the module runs before the first render, that is, before the replacement, and there
 * is no lazy loading left. The fix affects only the showcase: the application has no
 * Storybook getter, and it did not affect the axe accessibility checks in CI, where every
 * story is opened with a full page load.
 */
import "react-aria-components";

/**
 * Switching the theme, the accent, the brand and the radius preset.
 *
 * `withThemeByDataAttribute` from `@storybook/addon-themes` does not fit here: it manages ONE
 * attribute, while there are four axes (`data-theme` × 3, `data-accent` × 2,
 * `data-brand` × 2, `data-radius` × 4). So this is a custom decorator plus four buttons in
 * the toolbar.
 *
 * The attributes are set directly during render, not in `useEffect`: setting them is
 * idempotent, while `useEffect` would produce a frame with the old theme when switching.
 *
 * The `base` brand REMOVES the attribute rather than writing `data-brand="base"`: there is no
 * block with that name in the CSS, and a leftover attribute would look like a working overlay.
 * A set brand cancels the accent axis entirely, since that is how the cascade works, and the
 * toolbar does not hide it: with a brand, the accent switch has no effect.
 */
const withThemeAndAccent: Decorator = (Story, context) => {
  const root = document.documentElement;
  root.dataset.theme = String(context.globals.theme);
  root.dataset.accent = String(context.globals.accent);
  root.dataset.radius = String(context.globals.radius);
  const brand = String(context.globals.brand);
  if (brand === "base") delete root.dataset.brand;
  else root.dataset.brand = brand;
  return <Story />;
};

/**
 * Default icon size, as for a typical consumer.
 *
 * The icon set does not set the size: that is the job of the consumer's `LucideProvider`
 * (docs/icons.md). Without a provider, the showcase drew an icon with no `size` at 24px,
 * lucide's default, and in small buttons the icon came out larger than the label (found by
 * the showcase audit). 16 is the size the kit itself sets in buttons and fields.
 *
 * The stroke width is not set: the kit has no stroke width of its own, icons are drawn with
 * lucide's default stroke width, and the provider does not override explicit `size` values
 * in stories.
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
    radius: {
      description: "Corner-shape preset (ADR-0074), independent of the theme",
      toolbar: {
        title: "Radius",
        icon: "component",
        items: [
          { value: "none", title: "None" },
          { value: "small", title: "Small" },
          { value: "medium", title: "Medium" },
          { value: "large", title: "Large" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "dark", accent: "blue", brand: "base", radius: "medium" },
  parameters: {
    // Our themes set the background through --surface-app; Storybook's built-in background
    // switcher would override them and show a false picture.
    //
    // The prop is called `disable`, not `disabled`: the automatic migration on upgrading to
    // 10.5.6 renamed it to a second name that is absent from the package's types
    // (`BackgroundsParameters` in `storybook/dist/backgrounds`). The switcher would silently
    // come back, because the compiler does not check such props.
    backgrounds: { disable: true },
    controls: { expanded: true },
  },
};

export default preview;
