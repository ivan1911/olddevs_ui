---
component: Notifications
exports: [NotificationItem, NotificationList, NotificationGroup, NotificationCenter]
category: content
status: stable
source: src/components/content/NotificationList.tsx
story: src/components/content/NotificationList.stories.tsx
---

# NotificationItem, NotificationList and NotificationCenter

## Summary for AI

A list of events: what happened, when, and whether it has been read. The kit
knows no event types — the icon, tone and text come in as props. Groups
("Today", "Earlier") come already assembled.

## When to use

- A notification feed in a popover, a drawer (`Drawer`) or on a separate page.
- You need to tell read from unread and to mark items as read.

## When not to use

- For a temporary message about an event — that is `toast`: it pops up and goes
  away.
- For a persistent page state — that is `Alert`, for an app state — `Banner`.
- For the steps of one process — that is `Timeline`: there the process sets the
  order, not time, and a step has no actions.

## Minimal example

```tsx
import { NotificationList, NotificationItem } from "@olddevs/ui";

<NotificationList
  groups={[
    {
      id: "today",
      label: "Today",
      children: <NotificationItem title="Publication failed" unread time="5 minutes ago" />,
    },
  ]}
  empty={<EmptyState title="All quiet for now" />}
/>;
```

## Props

`NotificationItem`: `title`, `description`, `time`, `icon`, `media`, `tone`,
`unread` and **one of** `actions` / `onAction`.

`NotificationList`: `groups` **or** `children`, `empty`, `aria-label`.

`NotificationCenter`: `title`, `level`, `titleId`, `unreadCount`,
`filters`, `actions`, `selectedCount`, `onClearSelection`, `selectionActions`,
`footer`, `children`.

## Preview and icon — two independent slots

`icon` says **what** happened (the event type, the tone), `media` — **to what**
(a preview of the object the event is about). The row shows both: the icon on
the left, the preview next, then the text. The element itself sets the preview
size (`Image` at 36px, `Avatar`); the slot only keeps it from shrinking. If the
title already names the object, the preview is decorative and gets `alt=""`.

```tsx
<NotificationItem
  title="Moderation finished"
  icon={<InfoIcon size={16} />}
  media={<Image src={item.previewUrl} alt="" className="size-9 rounded-md" />}
/>
```

## The whole row is one button (`onAction`)

`onAction` turns the row into **one button that covers the whole row**: a click, Enter
and Space call the handler. The row is still the list's `<li>`; the button sits
inside it. The unread background stays on the `li`, while the hover and the focus
ring are on the button; the ring is rendered inside the row because the center's
scrolling would clip it on the outside.

- **The button name is the title** and the word "Unread" (`aria-labelledby` on
  both nodes), not the whole text: with the full content the name would run to
  half a page. **The time and details are the button description**
  (`aria-describedby`), so they are not lost.
- There are no nested interactive elements inside the button, and the row blocks
  are `span` elements: a `button` allows only phrasing content.
- **The row padding and layout sit on the button**, while `className` goes to
  the `<li>`: the background and border change through it, `px-*`, `py-*` and
  `gap-*` do not. Without `onAction` they sit on the `li` itself.
- **Only the title, the word "Unread", the time and the details go into the name
  and description.** The preview `alt` and the icon text are not included: write
  what matters about the object ("photo of Anna K.") in the title, and keep the
  preview decorative.
- **`onAction` is a button, not a link.** If a click navigates to a URL and you
  need to open it in a new tab or with the middle mouse button, wrap the row in a
  link or navigate through `actions` with a link; a button with `router.push`
  does not support these.
- On hover, an unread row darkens the accent background, a read one fills with a
  neutral color.
- A row without `onAction` contains no button — the markup is as before, with no
  extra `id` attributes.

```tsx
<NotificationItem title="Publication failed" unread onAction={() => markRead(id)} />
```

**It does not combine with `actions`**, and the type says so: buttons inside a
button are invalid markup. If you need both a click on the row and separate
actions, pick one: an action on the whole row or buttons on the right.

A consumer on JS could pass both props: the types do not stop them. The kit
does not crash the page: **`actions` wins, `onAction` is ignored.** Of the two
losses the smaller is chosen: `actions` may be the only path to an action
("delete", "open"), while a click on the whole row is a convenience. The failure
is visible at once: the row does not respond to a click. In development mode the
console also reports it: a `console.warn` with English text once per module load:
what was passed, what won and how to fix it. In a production build the kit is
silent. The rules for such warnings are in
[conventions.md](../../conventions.md#warnings-in-development-mode).

## Center title: level and `id`

By default the `NotificationCenter` title is plain text (a `span`): it is not
part of the page's heading structure. `level` (`2`, `3` or `4`; the name is the
same as on `SectionHeader`) makes it a real `<h2>`–`<h4>`: the level depends on
where the center is placed, and the consumer knows that. `titleId` sets an `id`
on the title element so that the popover's or drawer's `aria-labelledby` can
point to it:

```tsx
<PopoverContent aria-labelledby="bell-title">
  <NotificationCenter level={2} titleId="bell-title" unreadCount={12}>
    …
  </NotificationCenter>
</PopoverContent>
```

`titleId` works without `level` too (the `id` lands on the `span`): the container
name comes from the title, and the center does not touch the page structure.
With neither prop, the markup and behavior are as before.

## The center has no container

`NotificationCenter` is not a popover, a drawer or a page: it is their
**content**. The consumer places it inside an existing `Popover` or `Drawer`, or
straight on a page, and the center neither opens nor closes itself — the
container state lives outside.

Otherwise the kit would have to pick one container for all apps at once, while in
an admin panel the feed is more often a page, and in a client app more often a
popover.

Bulk actions are the existing `SelectionBar`, not a bar of its own: it already
carries a counter, selection clearing, two action slots and the rule "at zero
there is no bar at all". Sticky positioning is off here: in a popover there is nothing
to stick to.

**The unread counter comes as a prop**, and is not computed from the rows: a
list can be a page of a collection, and "3" instead of "300" is a lie.
Visually, `Badge` truncates a large number to "99+", but the name for a
screen reader stays exact.

## Unread is heard, not only seen

The dot and the background are a signal for the eyes. Next to the title of an
unread event there is a word from the message catalog: without it, a person who
cannot see color would not tell a new event from an old one at all. The dot
itself is `aria-hidden` — otherwise a screen reader would announce a nameless
node next to the word.

## Groups come ready-made

The consumer's locale and time zone decide what "yesterday" is: an app with night
shifts has its own day boundary, and computing it in the kit would impose
the kit's calendar on the app.

A group is announced as a **labeled group** (`role="group"`), not as a heading.
The heading level (`h2`, `h3`) depends on where the list is placed (in a
popover, a drawer or on a page), and the kit does not know that. A group conveys
structure without taking up a level.

## The row decides nothing on its own

It neither navigates nor marks itself as read: both navigating and marking as read
are app actions. The app passes them in `actions` or `onAction` (the whole row is a
button), or wraps the row from the outside.

The time comes **already formatted**: "5 minutes ago" and "yesterday at 2:03 PM"
are put together by the app with `Intl.RelativeTimeFormat` and the consumer's time zone.

## Anti-patterns

- Adding `type: "publication_failed"` instead of `icon` and `tone`: domain event
  types do not move into the kit.
- Marking unread by color alone.
- Computing grouping inside the component.
- Computing the unread counter from the visible rows.
- Wrapping the center in your own popover inside the kit: the consumer chooses
  the container.
- Passing `onAction` together with `actions`: the types forbid it, and on JS
  `actions` wins (and in development the console warns).
- Putting interactive elements into `media` or `title` of a button row: they end
  up inside the button.
- Giving the popover an `aria-label` next to a real title instead of `titleId`:
  the name drifts from the visible title when it is edited.

## Related sources and tests

- Source: `src/components/content/NotificationList.tsx`
- Tests: `tests/notification-list.test.tsx`
- Showcase: `src/components/content/NotificationList.stories.tsx`, `src/components/content/NotificationCenter.stories.tsx`
- Center tests: `tests/notification-center.test.tsx`
- Decision: ADR-0027
