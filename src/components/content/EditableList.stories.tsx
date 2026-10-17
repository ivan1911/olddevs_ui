import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState } from "react";
import type { Key } from "react-aria-components";
import { UiProvider } from "../../i18n/UiProvider.js";
import ru from "../../locales/ru.js";
import { MoreIcon } from "../../icons.js";
import { Button } from "../actions/Button.js";
import { Checkbox } from "../inputs/Checkbox.js";
import {
  EditableList,
  type EditableListHandle,
  type EditableListItem,
  type EditableListProps,
} from "./EditableList.js";
import { EmptyState } from "./EmptyState.js";
import { StatusBadge } from "../actions/StatusBadge.js";

const meta = {
  title: "Content/EditableList",
  component: EditableList,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<EditableListProps>;

export default meta;
type Story = StoryObj<EditableListProps>;

interface Row extends EditableListItem {
  done: boolean;
  state?: "overdue" | "waiting";
}

const INITIAL: Row[] = [
  { id: "1", value: "Agree the estimate with the contractor", done: false },
  { id: "2", value: "Pay for hosting", done: false, state: "overdue" },
  { id: "3", value: "Wait for the lawyer to reply", done: false, state: "waiting" },
  { id: "4", value: "Send contract amendments", done: false },
  { id: "5", value: "Collect the quarterly budget", done: true },
];

function Demo({
  locale,
  withAdd = true,
  divided,
}: {
  locale?: string;
  withAdd?: boolean;
  divided?: boolean;
}) {
  const [items, setItems] = useState(INITIAL);
  const [nextId, setNextId] = useState(6);

  const list = (
    <div className="w-[420px]">
      <EditableList
        items={items}
        divided={divided}
        aria-label="Tasks"
        editLabel={(item) => `Rename ${item.textValue ?? item.value}`}
        onReorder={(ids: Key[]) =>
          setItems(ids.map((id) => items.find((item) => item.id === id)!).filter(Boolean))
        }
        onValueChange={(id, value) =>
          setItems(items.map((item) => (item.id === id ? { ...item, value } : item)))
        }
        add={
          withAdd
            ? {
                label: "New task",
                placeholder: "What needs doing?",
                onAdd: (value) => {
                  setItems([...items, { id: String(nextId), value, done: false }]);
                  setNextId(nextId + 1);
                },
                /*
                  The same checkbox as in the row, but invisible: `visibility:
                  hidden` keeps the whole box and removes the element from the tab
                  order and from the accessibility tree. There is nothing to tick on
                  a task that does not exist yet.

                  A mirror, not a spacer set by eye, and this is not pedantry:
                  `Checkbox size="sm"` has a 16-pixel box but takes up 24, because the
                  label wrapper adds its own padding. A `size-4` spacer would be off by 8.
                */
                leading: (
                  <span className="invisible shrink-0">
                    <Checkbox size="sm" checked={false} label="" onCheckedChange={() => {}} />
                  </span>
                ),
              }
            : undefined
        }
        leading={(item) => (
          <Checkbox
            size="sm"
            checked={(item as Row).done}
            label={`Complete ${item.value}`}
            onCheckedChange={(done) =>
              setItems(items.map((row) => (row.id === item.id ? { ...row, done } : row)))
            }
          />
        )}
        trailing={(item) => {
          const state = (item as Row).state;
          return (
            <>
              {state != null ? (
                <StatusBadge tone={state === "overdue" ? "danger" : "warning"} size="sm" dot>
                  {state === "overdue" ? "Overdue" : "Waiting"}
                </StatusBadge>
              ) : null}
              {/*
                `size="xs"` is the only step that does not stretch the row: `sm` gives
                30 pixels against 20 for the content, and a 32-pixel row becomes 42.
                The hit area is 24 pixels anyway, expanded by a pseudo-element.
              */}
              <Button
                size="xs"
                variant="ghost"
                iconOnly
                icon={<MoreIcon size={14} />}
                aria-label={`Actions for ${item.value}`}
              />
            </>
          );
        }}
      />
      <p className="text-fg-3 mt-2 text-[11px]" data-testid="order">
        {items.map((item) => item.id).join(",")}
      </p>
    </div>
  );

  return locale ? (
    <UiProvider locale={locale} messages={ru}>
      {list}
    </UiProvider>
  ) : (
    list
  );
}

/**
 * Enter on a focused row opens the field — double-click does the same with a
 * mouse. Enter confirms and returns focus to the row, Escape restores the
 * previous value and the focus, clicking away confirms without taking focus.
 *
 * Arrow down from the last row lands in the add field; Enter there creates a
 * task and keeps the field open, so a series goes in one after another.
 */
export const Playground: Story = { render: () => <Demo /> };

/**
 * `divided` puts a hairline between the rows. Without it a dense list reads as
 * one sheet of text: the only thing breaking the row apart is the drag handle.
 *
 * The line goes BETWEEN the rows, never under the last one, and the row loses
 * its corner radius — under a rounded row the line would bend along the
 * corners and stop being straight. Hover then spans the full width, which is
 * how a divided list is expected to look.
 */
export const Divided: Story = { render: () => <Demo divided /> };

/**
 * The list hands out one imperative handle: `focusAdd()`. It exists for
 * everything that decides from the OUTSIDE where the caret should go — a
 * command palette, a "new item" shortcut, a wizard step that says "fix this
 * field".
 *
 * The handle is narrow on purpose: it does not expose the input element. Hand
 * out the element and the row markup becomes a public contract — consumers
 * start reading `value` and attaching handlers to it.
 *
 * `focusAdd({ select: true })` selects what is already typed, so a repeat call
 * starts the entry over instead of appending to it.
 */
export const FocusFromOutside: Story = {
  render: function FocusFromOutsideDemo() {
    const list = useRef<EditableListHandle>(null);
    const [items, setItems] = useState<EditableListItem[]>([
      { id: "1", value: "Agree the estimate with the contractor" },
      { id: "2", value: "Pay for hosting" },
    ]);

    return (
      <div className="flex w-[420px] flex-col gap-3">
        <div className="flex gap-2">
          <Button size="sm" onClick={() => list.current?.focusAdd()}>
            Add task
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => list.current?.focusAdd({ select: true })}
          >
            Add task, replacing the draft
          </Button>
        </div>
        <EditableList
          ref={list}
          items={items}
          aria-label="Tasks"
          editLabel={(item) => `Rename ${item.value}`}
          onReorder={(ids) => setItems(ids.map((id) => items.find((i) => i.id === id)!))}
          onValueChange={(id, value) =>
            setItems(items.map((item) => (item.id === id ? { ...item, value } : item)))
          }
          add={{
            label: "New task",
            placeholder: "What needs doing?",
            onAdd: (value) => setItems([...items, { id: String(items.length + 1), value }]),
          }}
        />
      </div>
    );
  },
};

/**
 * Without the `add` prop the list is only a list: the entry row does not exist
 * at all, and arrow down from the last row goes nowhere. This is the shape for
 * a list that is edited but not extended.
 */
export const WithoutAddRow: Story = { render: () => <Demo withAdd={false} /> };

/**
 * Under the Russian locale, react-aria itself announces drag and drop in Russian, for example
 * "Drag started…" and "Insert between…". The list has no live region of its own, because it
 * would duplicate those announcements.
 */
export const RussianLocale: Story = { render: () => <Demo locale="ru-RU" /> };

export const Empty: Story = {
  render: () => (
    <div className="w-[420px]">
      <EditableList
        items={[]}
        onReorder={() => {}}
        onValueChange={() => {}}
        editLabel={() => "Rename"}
        aria-label="Tasks"
        emptyText={<EmptyState title="Nothing to do right now" />}
        add={{ label: "New task", placeholder: "What needs doing?", onAdd: () => {} }}
      />
    </div>
  ),
};

/**
 * The "hover actions" recipe from the Reference, in full and in action.
 *
 * The story exists for the sake of a check: a recipe that lives only in the text silently rots.
 * Its previous version prescribed `group-focus-within:` on the slot's content, and the utility
 * NEVER fired. The row carries `data-rac`, and the react-aria plugin marks such an element with
 * a `data-focus-within` attribute, which the row does not set. A button reached by Tab stayed
 * invisible.
 *
 * So `focus-within:` is here on the consumer's own wrapper, without `group-`. The wrapper
 * carries no `data-rac`, falls into the second branch of the selector, and works with plain CSS.
 */
export const HoverActions: Story = {
  render: () => {
    const [items, setItems] = useState<Row[]>(INITIAL);
    return (
      <EditableList
        items={items}
        aria-label="Tasks"
        editLabel={(item) => `Rename ${item.value}`}
        onReorder={(ids: Key[]) =>
          setItems(ids.map((id) => items.find((item) => item.id === id)!).filter(Boolean))
        }
        onValueChange={(id, value) =>
          setItems(items.map((item) => (item.id === id ? { ...item, value } : item)))
        }
        trailing={(item) => (
          <span
            data-testid="row-actions"
            className={
              "pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 " +
              "flex items-center gap-1 transition-opacity duration-150 pointer-fine:focus-within:opacity-100"
            }
          >
            <Button
              size="xs"
              iconOnly
              variant="ghost"
              icon={<MoreIcon />}
              aria-label={`Actions for ${item.value}`}
            />
          </span>
        )}
      />
    );
  },
};

/**
 * Row exit: a row removed from `items` finishes its exit, and the space under it is released
 * by the same motion.
 *
 * The story is for browser checks, not snapshots: on a static frame the exit is indistinguishable
 * from its absence. "Done" on a row removes it the same way the consumer's checkbox does. So the
 * focus at the moment of removal sits INSIDE the leaving row, and you can see where it goes next.
 * The "Remove three" button removes three rows at once: the exits run simultaneously, with no
 * wave of delays.
 */
export const Leaving: Story = {
  render: () => {
    const [items, setItems] = useState<Row[]>(INITIAL);
    const remove = (ids: string[]) =>
      setItems((current) => current.filter((item) => !ids.includes(String(item.id))));

    return (
      <div className="flex w-[420px] flex-col gap-3">
        <div className="flex gap-2">
          <Button size="sm" onClick={() => remove(["1", "2", "3"])}>
            Remove three
          </Button>
          <Button size="sm" onClick={() => setItems(INITIAL)}>
            Reset
          </Button>
        </div>
        <EditableList
          items={items}
          aria-label="Tasks"
          editLabel={(item) => `Rename ${item.value}`}
          onReorder={(ids: Key[]) =>
            setItems(ids.map((id) => items.find((item) => item.id === id)!).filter(Boolean))
          }
          onValueChange={(id, value) =>
            setItems(items.map((item) => (item.id === id ? { ...item, value } : item)))
          }
          add={{
            label: "New task",
            placeholder: "Add a task",
            onAdd: () => {},
          }}
          trailing={(item) => (
            <Button size="xs" variant="ghost" onClick={() => remove([String(item.id)])}>
              Done
            </Button>
          )}
        />
      </div>
    );
  },
};
