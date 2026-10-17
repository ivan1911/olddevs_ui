import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../actions/Button.js";
import { ConfirmDialog, type ConfirmKind } from "./ConfirmDialog.js";

const meta = {
  title: "Overlays/ConfirmDialog",
  component: ConfirmDialog,
  parameters: { layout: "centered" },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A live dialog: open it, close it, press Escape, and tab through it. */
export const Playground: Story = {
  args: {
    open: false,
    onClose: () => {},
    onConfirm: () => {},
    title: "Delete the photo?",
    message: "This cannot be undone. The file and every related post will be deleted.",
  },
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="outline" tone="danger" onClick={() => setOpen(true)}>
          Delete
        </Button>
        <ConfirmDialog
          {...args}
          open={open}
          onClose={() => setOpen(false)}
          onConfirm={() => setOpen(false)}
        />
      </>
    );
  },
};

/**
 * Three kinds of question. `kind` is the dialog's own axis: the caller says "this is dangerous",
 * not "make the button red". The mapping to button axes happens here.
 */
export const Kinds: Story = {
  args: {
    open: false,
    onClose: () => {},
    onConfirm: () => {},
    title: "",
    message: "",
  },
  render: () => {
    const [kind, setKind] = useState<ConfirmKind | null>(null);
    const texts: Record<ConfirmKind, { title: string; message: string; label: string }> = {
      danger: {
        title: "Delete the photo?",
        message: "This cannot be undone.",
        label: "Delete",
      },
      warning: {
        title: "Unpublish?",
        message: "The post leaves the channel but stays in the schedule.",
        label: "Unpublish",
      },
      info: {
        title: "Publish now?",
        message: "The post goes out immediately, without waiting for the schedule.",
        label: "Publish",
      },
    };
    return (
      <>
        <div className="flex gap-2">
          {(Object.keys(texts) as ConfirmKind[]).map((k) => (
            <Button key={k} variant="outline" onClick={() => setKind(k)}>
              {k}
            </Button>
          ))}
        </div>
        {kind ? (
          <ConfirmDialog
            open
            kind={kind}
            title={texts[kind].title}
            message={texts[kind].message}
            confirmLabel={texts[kind].label}
            onClose={() => setKind(null)}
            onConfirm={() => setKind(null)}
          />
        ) : null}
      </>
    );
  },
};

/**
 * Submission in progress: the buttons are disabled, the close button is hidden, and a click
 * outside or Escape does not close the dialog. It is open from the start, otherwise the state
 * would be hard to catch by eye.
 */
export const Submitting: Story = {
  args: {
    open: true,
    loading: true,
    onClose: () => {},
    onConfirm: () => {},
    title: "Delete the photo?",
    message: "This cannot be undone. The file and every related post will be deleted.",
    confirmLabel: "Delete",
  },
};

/**
 * Typed confirmation: the button stays disabled until the name is typed. Focus lands in the
 * field on open, Enter confirms only on an exact match, and the case matters. The label and the
 * field hint come from the message catalog.
 */
export const TypeToConfirm: Story = {
  args: {
    open: false,
    onClose: () => {},
    onConfirm: () => {},
    title: "Delete the workspace?",
    message: "Every project, file and member is removed. This cannot be undone.",
    confirmLabel: "Delete the workspace",
    typeToConfirm: "Acme Labs",
  },
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="outline" tone="danger" onClick={() => setOpen(true)}>
          Delete the workspace
        </Button>
        <ConfirmDialog
          {...args}
          open={open}
          onClose={() => setOpen(false)}
          onConfirm={() => setOpen(false)}
        />
      </>
    );
  },
};
