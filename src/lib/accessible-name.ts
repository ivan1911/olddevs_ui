/**
 * Accessible name of a component without a visible label: exactly one of `aria-label` and
 * `aria-labelledby`.
 *
 * The rule is written in `docs/conventions.md` ("Accessible name"): in the kit, `label` is only a
 * visible caption, and a name that is not drawn is given by its own ARIA attribute. Before the rule,
 * the same requirement was built three different ways in three components. `label` was rendered on
 * screen in one of them and went into an attribute in a neighbor, so a consumer could not tell what
 * would appear.
 *
 * Both attributes at once are forbidden: they are two sources of one name, and on edit they silently
 * diverge (per the spec, `aria-labelledby` wins, and the string in `aria-label` stops meaning anything).
 *
 * OPTIONAL NAME: the same type under `Partial`. For a component with a default from the message
 * catalog (`MobileTabBar`) the name may be omitted, but the rule "not both at once" still holds.
 * `Partial` distributes over the union, so `Partial<AccessibleName>` means "one of the two, or nothing".
 *
 * `@internal`: not exported from the package. The consumer sees it expanded in the component's props.
 */
export type AccessibleName =
  | {
      /** Accessible name as a string, when there is no visible label. Not set together with `aria-labelledby`: two sources of one name. */
      "aria-label": string;
      /** `id` of the element whose text serves as the accessible name, when there is no visible label. Not set together with `aria-label`: two sources of one name. */
      "aria-labelledby"?: never;
    }
  | {
      /** `id` of the element whose text serves as the accessible name, when there is no visible label. Not set together with `aria-label`: two sources of one name. */
      "aria-labelledby": string;
      /** Accessible name as a string, when there is no visible label. Not set together with `aria-labelledby`: two sources of one name. */
      "aria-label"?: never;
    };
