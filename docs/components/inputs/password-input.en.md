---
component: PasswordInput
exports: [PasswordInput]
category: inputs
status: stable
source: src/components/inputs/PasswordInput.tsx
story: src/components/inputs/PasswordInput.stories.tsx
sourceHash: 5a5f6ae9aba8
---

# PasswordInput

## Summary for AI

A password field built on the slots of `TextControl`: a show button in `trailing`,
a Caps Lock warning under the field. It renders no border of its own. `autocomplete`
is **required** and comes as a prop — the kit does not know whether this is a
sign-in or a password change.

## When to use

- Any password field: sign-in, sign-up, password change, confirming an action.

## When not to use

- For an SMS code, use `PinInput`: it has N short fields and accepts a whole pasted code.
- For a secret that must never be shown (a token on a settings screen), use a
  regular `TextControl` with `type="password"` and no show button.

## Minimal example

```tsx
import { FormField, PasswordInput } from "@olddevs/ui";

<FormField label="Password" htmlFor="pwd">
  <PasswordInput id="pwd" autoComplete="current-password" />
</FormField>;
```

## Props

| Prop              | Default         | Purpose                                                                         |
| ----------------- | --------------- | ------------------------------------------------------------------------------- |
| `toggleLabel`     | message catalog | The label of the show button. One for both states.                              |
| `capsLockWarning` | `true`          | A warning under the field that Caps Lock is on.                                 |
| `shellClassName`  | —               | Classes for the shell with the border: width, corner radius, spacing.           |
| the rest          | —               | Passed straight through to the `input`: `autoComplete`, `required`, `disabled`. |

## `autocomplete` has no default value

The missing default is a decision, not an omission. The right value depends on what kind of
form it is: `current-password` on sign-in, `new-password` on password change and
on sign-up. The kit does not know this, and a wrong value is worse than a missing
one — the password manager would offer to fill the old password into the new
password field.

```tsx
<PasswordInput autoComplete="current-password" />  {/* sign-in */}
<PasswordInput autoComplete="new-password" />      {/* password change and sign-up */}
```

## The show button: a constant label plus `aria-pressed`

The state is announced by the `aria-pressed` attribute, not by the name. A button
whose label and state both change reads as contradictory — "Hide password,
pressed"; the ARIA Authoring Practices Guide (APG) rule for toggles is the
opposite: the name is constant, `aria-pressed` changes.

Without the attribute, a screen reader does not announce that the password is
currently visible on the screen. That is a security state.

**The caret is preserved on toggling.** Changing `type` resets the selection to the
end of the value, and a user who revealed the password in the middle of an edit
loses their place. The position is saved before the toggle and restored after it —
**without moving focus**: the button was pressed on purpose, and taking focus away
from it would break pressing it again from the keyboard.

## Caps Lock is read from the keyboard, not guessed

Whether Caps Lock is on comes from `getModifierState("CapsLock")` on the keyboard
event. The common trick "the character comes in uppercase without Shift" fails
here for two reasons: in a password field the characters are not visible, and a
password made of capitals only is legitimate.

The warning area (`role="status"`) exists in the markup **before** the text
appears: a live region inserted together with its content is not announced by the
screen reader. While there is no text, it is hidden from the layout and takes no
space.

The warning is cleared when leaving the field: it concerns typing in the field, not the
keyboard state in general.

## Related sources and tests

- Implementation: `src/components/inputs/PasswordInput.tsx`. The composition on `TextControl` is
  ADR-0009,
  the decision on the component is in ADR-0025,
  the wave contents are in ADR-0024.
- Tests: `tests/password-input.test.tsx` — state announcement, a constant
  label, the caret, Caps Lock, the single border.
- Story: `src/components/inputs/PasswordInput.stories.tsx`.
