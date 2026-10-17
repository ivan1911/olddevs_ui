---
component: HoverCard
exports: [HoverCard, HoverCardContent, HoverCardTrigger]
category: overlays
status: stable
source: src/components/overlays/HoverCard.tsx
story: src/components/overlays/HoverCard.stories.tsx
---

# HoverCard

## Summary for AI

`HoverCard` is a preview card: when you hover over a name or a link, or focus it
from the keyboard, a panel with details pops up next to it. Focus from a screen
reader does **not** open the card (deliberately, see "Accessibility and keyboard"). The
trigger is a link or a button **with its own action**; the card complements it
and replaces nothing. The content is only supplementary: everything in it must
also be available without the card. Do not put forms or required actions in the card.
It is built on the kit's `Popover`, with no new dependency.

## When to use

- A user name, a link to a document, a tag, an entity in text: on hover you need
  to show an avatar, a job title, the first lines — without navigating away from
  the page.
- The details are secondary: a user who did not see the card loses nothing (the
  link leads to the same information in full).
- **There was no requesting screen at release** (ADR-0048):
  the API was modeled on similar components — `HoverCard` in Radix and shadcn/ui,
  hover-card in Chakra and Mantine. The consumer's first screen is the first test
  of the contract; a mismatch between the contract and the screen is a reason to
  change the API.

## When not to use

- Use `Tooltip` for a short caption or the meaning of a term: it is one line of
  text, without markup, and opens faster.
- Use `HelpTooltip` for an explanatory paragraph that people need time to read: it
  is a popover **on click** of a question-mark button, and it does not vanish when
  the cursor moves away.
- For content with fields, action buttons or links that must be reachable, use
  `Popover` (opens on click, takes focus, returns it) or `Dialog`. The card
  closes when the cursor or focus leaves, and you cannot reach it with the Tab key.
- The only way to learn something important. On a phone it usually does not open.

## Minimal example

```tsx
import { Avatar, HoverCard, HoverCardContent, HoverCardTrigger } from "@olddevs/ui";

<HoverCard>
  <HoverCardTrigger asChild>
    <a href="/people/ada">Ada Lovelace</a>
  </HoverCardTrigger>
  <HoverCardContent>
    <div className="flex w-[280px] gap-3 p-3">
      <Avatar name="Ada Lovelace" />
      <p>Mathematician. Wrote the first published algorithm for a machine.</p>
    </div>
  </HoverCardContent>
</HoverCard>;
```

## Public API

**`HoverCard`** is the root and renders nothing.

| Prop           | Default | Meaning                                                                                            |
| -------------- | ------- | -------------------------------------------------------------------------------------------------- |
| `openDelay`    | `700`   | Milliseconds that hover or focus must last for the card to open                                    |
| `closeDelay`   | `300`   | Milliseconds after the cursor has left **both** the trigger **and** the card                       |
| `open`         | —       | Controlled state; the component still times the delays and requests changes through `onOpenChange` |
| `defaultOpen`  | `false` | Initial state when uncontrolled                                                                    |
| `onOpenChange` | —       | Called when the timer fires, on Escape, or on a click or focus outside the card                    |

**`HoverCardTrigger`** listens for hover and focus. `asChild` is on by default:
the trigger renders as its single child — a link or a button. The child's own
handlers are kept; a click on the trigger **toggles nothing**. The state for
styles is the `data-state="open" | "closed"` attribute. For why the trigger has
no `aria-haspopup` or `aria-expanded`, see "Accessibility and keyboard".

**`HoverCardContent`** is the panel. It accepts the `PopoverContent` props
(`side`, `align`, `sideOffset`, `className`): the look, the layer and the
animations are shared with it. Width and padding are set by the content, as with
a popover.

What sets the card apart from a popover:

- **Opening.** On `pointerenter`, after `openDelay`. On focus — only focus that
  came from a navigation key (Tab, Shift+Tab, Option+Tab in Safari on macOS,
  arrow keys, Home, End, PageUp, PageDown): a click on a link puts focus on it,
  and there is no point in opening the card after the action has already been
  taken. Focus with no key and no pointer (a screen reader swipe, a programmatic
  `focus()`) does not open the card. A quick fly-by of the cursor does not open it.
- **Closing.** When the cursor has left both the trigger and the card, after
  `closeDelay`. Moving the cursor from the trigger to the card does not close it;
  neither does returning to the trigger before the delay ends. A click (including
  on the trigger itself), focus on another element, and Escape close it at once;
  focus on the trigger itself does not close the card.
- **Focus.** On open it stays where it is — it does not move into the content. On
  close it does not return to the trigger: a close caused by the pointer must not
  drag focus around. There is no focus trap.
- **Devices without hover.** With `(hover: none)` and for touch input the card does
  not open on hover; a touch performs the trigger's action (following the link)
  and does not open the card. **Keyboard focus opens it there too:** a tablet may
  have a hardware keyboard, and Tab on the trigger works just as it does on a
  computer. Input modality tells a key from a touch: a key opens the card, a tap
  and a mouse click do not. A controlled `open` is not blocked by this.
- **Role.** The panel has no `role="dialog"`: a dialog that does not move focus is
  a promise it does not keep. If you need a role or a name, pass `role` or `aria-label`.

## Accessibility and keyboard

- Tab onto the trigger opens the card after `openDelay`; Tab onward or Escape
  closes it. A navigation key counts as keyboard: Tab, Shift+Tab, arrow keys, Home,
  End, PageUp, PageDown — and **Option+Tab**: in Safari on macOS it is the only
  way to reach links with the key until tabbing through all elements is turned on
  in the settings. Other combinations with Option, Ctrl and Cmd do not count as
  navigation (Ctrl+Tab switches browser tabs, Cmd+Tab switches applications).
  Radix listens for Escape, as it does for `Popover` and `Tooltip`; the component
  has no new Escape handlers and no `z-index` of its own — the panel sits on the
  `OVERLAY_LAYER.popover` step (ADR-0041),
  above dialogs, so it stays visible when opened from a `Dialog`. If the card is
  opened from a dialog, the first Escape press closes the card and the second
  closes the dialog.
- **Focus from a screen reader does not open the card — deliberately.** A
  VoiceOver or TalkBack swipe and, on desktop, the NVDA and JAWS virtual cursor
  (browse mode) set focus without sending the page a key or a pointer;
  `:focus-visible` matches in that case, so the kit works out the source of focus
  on its own (an internal input modality tracker, with no dependencies). A card
  that pops up without an announcement throws a screen reader user off, and with
  a screen magnifier it covers the neighboring text. By contract the content is
  supplementary and available another way — on the page the trigger leads to.
- **Hardware keyboard.** Tab and the arrow keys on it open the card even with a
  screen reader running: that is a real key. Focus that the browser returns to
  the trigger when the tab becomes active again, and focus that the app sets
  programmatically (for example, after a dialog closes), do not open the card
  either.
- **Limitation: the address bar.** If the first Tab came from the address bar or
  the browser toolbar, the page did not see the key — such focus is
  indistinguishable from screen reader focus, and the card does not open; the next
  Tab or a hover opens it.
- The trigger should not be the only path to the content for a screen reader: the
  card complements, it does not replace. Everything important in it must also be
  on the page the trigger leads to.
- **The trigger is built on `PopoverAnchor`, not on `PopoverTrigger`.** An anchor
  only defines what the panel attaches to: it carries neither click toggling nor
  the popover's ARIA attributes, and `HoverCard` itself opens and closes the card
  (the Radix popover under it is controlled). That is why the trigger has no
  `aria-haspopup` or `aria-expanded`, and a click does not toggle the card: a
  screen reader hears an ordinary link or a button with its own action, not a
  popover button promising a panel on press.
- Motion follows the kit's motion scale (ADR-0047):
  the entrance is `popoverIn`, and under `prefers-reduced-motion: reduce` only the
  appearance remains, with no shift.

## Good examples

- An author's name in a comment list → avatar, job title, number of materials.
- A link to a document in text → title, author, first lines.
- `openDelay={0}` for dense tables, where the person moves the cursor purposefully anyway.

## Anti-patterns

- A trigger without its own action (`span`, `div`, a dummy button): the card is
  for links and buttons that have somewhere to go on click.
- A form, a "Save" button or the only link to something important inside
  `HoverCardContent`.
- A one-line caption — `Tooltip` is for that.
- Your own `z-index` or your own Escape handler on the panel.
- `@radix-ui/react-hover-card` next to the kit: the component is built on `Popover`.

## Related sources and Storybook

- `src/components/overlays/HoverCard.tsx`
- `src/components/overlays/HoverCard.stories.tsx`
- `tests/hover-card.test.tsx`
