/**
 * Separate entry point for color: `@olddevs/ui/color`.
 *
 * WHY NOT THE BARREL. The color subsystem of `react-aria-components` — seven components
 * the kit used nowhere else — costs **61 kB gzip** (the wave 25 measurement, method
 * `scripts/bundle-size.mjs`, with RAC not treated as external). For comparison: the whole
 * kit fits into 62 kB.
 *
 * The kit's own budget does not see this: in `npm run size`, RAC is declared external together
 * with the kit's other third-party libraries, and the fixture page does not import color.
 * A gate that passes regardless of the decision is not a gate.
 *
 * A separate entry point makes the sixty kilobytes visible in the import line itself, not only
 * in a measurement that does not count them. The kit has a precedent for exactly this reason:
 * the locale catalogs live as `@olddevs/ui/locales/ru`, "so that they are not pulled into the
 * bundle without an import".
 *
 * The decision and the numbers are in ADR-0038.
 */
export { ColorPicker } from "./components/inputs/ColorPicker.js";
export type { ColorPickerProps } from "./components/inputs/ColorPicker.js";
