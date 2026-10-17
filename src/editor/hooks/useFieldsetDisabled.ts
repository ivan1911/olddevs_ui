"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Whether the node sits inside a disabled `<fieldset disabled>`, and it watches for changes.
 *
 * WHY THE DOM, NOT CONTEXT. The kit disables a form while a request is in flight
 * through `<fieldset disabled>` (`Form pending`), and a field that reads the `Form`
 * context stays blind to any foreign `fieldset`, while the consumer may disable a
 * group of fields on their own. Native fields react to both cases the same way, and
 * so that the editor does not differ, it reads what the browser reads: the ancestor's
 * attribute. A second channel through the `Form` context would duplicate this rule
 * and still would not cover foreign `fieldset`s.
 *
 * The walk goes up through the ancestors, not just to the nearest `fieldset`: a node
 * nested in a disabled one is disabled too. The browser's exception is repeated here:
 * the descendants of the FIRST `<legend>` of a disabled set stay enabled.
 *
 * A `MutationObserver` on the `disabled` attribute of each ancestor catches the toggles:
 * `Form pending` flips it without remounting the children. Moving the node itself into
 * another `fieldset` is not tracked, since React does not make such DOM moves.
 */
export function useFieldsetDisabled(ref: RefObject<HTMLElement | null>): boolean {
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const fieldsets: HTMLFieldSetElement[] = [];
    for (let el = node.parentElement; el; el = el.parentElement) {
      if (el.localName === "fieldset") fieldsets.push(el as HTMLFieldSetElement);
    }
    if (fieldsets.length === 0) return;

    const inFirstLegend = (fieldset: HTMLFieldSetElement) =>
      Array.from(fieldset.children)
        .find((child) => child.localName === "legend")
        ?.contains(node) ?? false;
    const read = () =>
      setDisabled(fieldsets.some((fieldset) => fieldset.disabled && !inFirstLegend(fieldset)));

    read();
    const observer = new MutationObserver(read);
    for (const fieldset of fieldsets) {
      observer.observe(fieldset, { attributes: true, attributeFilter: ["disabled"] });
    }
    return () => observer.disconnect();
  }, [ref]);

  return disabled;
}
