---
component: Choice controls
exports: [Checkbox, CheckboxGroup, Radio, RadioGroup]
category: inputs
status: stable
source: src/components/inputs/Checkbox.tsx
story: src/components/inputs/Checkbox.stories.tsx
sourceHash: 46b11ed947ca
---

# Checkbox, CheckboxGroup, Radio and RadioGroup

## Summary for AI

`Checkbox` selects an independent yes/no, `CheckboxGroup` selects several values, `RadioGroup` gives one answer to a shared question. `Radio` exists only inside `RadioGroup`. The `appearance="card"` axis on both groups shows the options as cards with a label, a description and an icon.

## When to use

- `Checkbox`: a single setting, including `indeterminate` for the "some selected" state.
- `CheckboxGroup`: several independent options; `value` is an array of strings.
- `RadioGroup`: exactly one option from a mutually exclusive set; `value` is kept on the group.
- `appearance="card"`: two to five options that people compare before choosing: a plan, an export format, an access mode, a set of modules. Details are in the "Choice cards" section.

## When not to use

- Do not use RadioGroup for several filters — use CheckboxGroup or ToggleGroup.
- Do not let people clear a RadioGroup by "clicking the selected option"; add an explicit "Any" option.
- Do not use cards for a long list of same-kind values or for single-line settings: a card takes three or four lines, and ten cards read worse than ten rows. Use the default appearance there.
- Do not use Checkbox without `children` or `label`: it must have an accessible name.

## Minimal example

```tsx
<CheckboxGroup label="Channels" value={channels} onChange={setChannels}>
  <Checkbox value="telegram">Telegram</Checkbox>
</CheckboxGroup>

<RadioGroup label="View" value={view} onChange={setView}><Radio value="list">List</Radio></RadioGroup>
```

## Public API

- `Checkbox`: controlled `checked`/`onCheckedChange` or `defaultChecked`; when rendering, `indeterminate` takes priority over checked. `name` and `value` are for native form submit.
- `CheckboxGroup`: `value`, `onChange` and `label` are required; `errorMessage` replaces `description`, and `disabled` disables all children. The optional `tone` colors the checked boxes of the set (see below).
- `RadioGroup`: `value: string | null`, but `onChange` returns a string; `null` is only the initial empty state. `Radio` accepts `value`, a description and disabled.
- Both groups have `orientation`, `errorMessage`, `appearance` and `tone`; RadioGroup also sets a shared `size`.
- **Group tone.** The group's `tone` reaches the options through context and colors what is checked: the circle and dot, the box with the checkmark and (in cards) the border of the selected one. For `RadioGroup` the tone exists only on the group; `Radio` has none of its own. For `CheckboxGroup` the tone is optional: **a `tone` set on the group overrides the `tone` of every `Checkbox` inside** (the set cannot drift apart in look, as with radios); if it is not set, each checkbox is colored with its own `tone`, as outside a group. A single `Checkbox` outside a group uses its own `tone` as before. Unchecked ones are always neutral.
- `Radio` and `Checkbox` accept an optional `icon` and `description`.
- **Border of the checked box.** A checked (and "some selected") checkbox has its box outlined in the `*-strong` color of its tone, and in `fg-3` for `neutral`: the `solid` fill falls short of 3:1 against the background (WCAG 1.4.11) for four tones out of five, and the kit did not change tokens for the sake of a checkbox. The border holds the edge of the box; the checkmark relies on text contrast on the fill. The same goes for a switched-on `Toggle`. `npm run contrast` measures it. **This is a deliberate decision by the owner, not an oversight:** the fill of a checked checkbox was not raised to 3:1, because its color comes from the `solid` tokens of the tones, shared across the whole kit.

## Hit area

The hit area of the checkbox and radio is 24 pixels high regardless of size
and of whether a visible label is present; WCAG 2.5.8 requires this. The control
itself takes the same space in the layout as before: a pseudo-element extends the
area.

Padding cannot be used to enlarge it: the control's height is held by the list
row, 32 pixels, and a grown checkbox would stretch it. The visible size and the hit area
are separated in the same way as with `Button size="xs"`.

## Choice cards

```tsx
<RadioGroup label="Plan" appearance="card" value={plan} onChange={setPlan}>
  <Radio value="free" icon={<StorageIcon size={20} />} description="Up to three projects">
    Starter
  </Radio>
  <Radio value="team" description="No limits">Team</Radio>
</RadioGroup>

<CheckboxGroup label="Modules" appearance="card" value={modules} onChange={setModules}>
  <Checkbox value="billing" icon={<PaymentIcon size={20} />}>Payments</Checkbox>
</CheckboxGroup>
```

- **The axis is called `appearance`, not `variant`**: in the kit `variant` already
  means `solid|soft|outline|ghost`, that is, how a tone is presented, while here
  the look of the option itself changes: a row or a card. Values: `default` (the
  default; look and behavior unchanged) and `card`. The prop-name dictionary of the
  mirror (ADR-0036) does not use this name.
- The axis lives on the group and reaches the options through context, like `size`
  and `tone`: the set cannot drift apart in look. A single `Checkbox` outside a
  group stays the regular one.
- **The whole card is the hit area**, including the description and the empty
  space of the card. The semantics are native: react-aria's `radio` or `checkbox`,
  which also provides the arrow keys and Space. The description sits inside the
  `<label>` element so that a click
  on it selects the card, but it is hidden from the name (`aria-hidden`) and read
  as a description through `aria-describedby`: a screen reader does not read it
  twice. The icon is decorative and excluded from the name.
- **Selection is a border in the tone and an indicator.** The circle or the
  checkmark stay visible; the border is not the only sign. The tone is the group's
  `tone` (optional on `CheckboxGroup`, see "Group tone"). Unselected cards are
  neutral. The contrast of the selected card's border against the backgrounds and
  against the card itself is measured by `npm run contrast` (threshold 3:1, WCAG
  1.4.11); for `neutral` the border is `fg-3`, not the decorative `line`.
- The focus ring is on the card, not on the circle.
- `orientation="horizontal"` lays the cards out in a wrapping row; the vertical
  layout is cards at the full width of the column.
- Disabled and error work as in the regular groups: a disabled card is
  semi-transparent and cannot be selected, `errorMessage` colors the border of all
  cards `danger` and replaces the group's `description`.
- `icon` applies without a card too: in the default appearance the icon sits
  between the circle or box and the label.

**An axis "for the future" (ADR-0048).** There was no requesting screen at release, so the
API is modeled on comparable libraries: Chakra `RadioCard` and `CheckboxCard`,
Mantine `Radio.Card`, Carbon `SelectableTile`, Cloudscape `Tiles`. Your screen is
the first test of this API. Not included and not planned for now: an image slot
over the icon, selecting a whole card rendered as a link.

## Accessibility and forms

- The group label is required: it is the question the set answers.
- Do not pass `checked` to child Checkboxes inside a CheckboxGroup — the state is derived from the group's `value`.
- Do not set `tone` on a `Checkbox` inside a `CheckboxGroup` that has a `tone`: it is ignored: the set has one tone for all. If you want different tones, do not set `tone` on the group.
- Sources: `src/components/inputs/Checkbox.tsx`, `src/components/inputs/CheckboxGroup.tsx`, `src/components/inputs/CheckboxCard.tsx` (the card is internal, only the group pulls it in, so that a bare `Checkbox` does not drag it into the bundle), `src/components/inputs/RadioGroup.tsx`, the shared card classes are in `src/lib/choice-card.ts`; tests `checkbox*.test.tsx`, `radio-group.test.tsx`, `choice-cards.test.tsx`.
