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

/** Живой диалог: открыть, закрыть, нажать Escape, потыкать табом. */
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
 * Три характера вопроса. `kind` — собственная ось диалога: вызывающий говорит
 * «это опасно», а не «сделай кнопку красной». Перевод в кнопочные оси — здесь.
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
 * Идёт отправка: кнопки заблокированы, крестик скрыт, клик мимо и Escape
 * не закрывают. Открыт сразу — иначе состояние не поймать глазом.
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
 * Подтверждение вводом: кнопка выключена, пока не набрано название. Фокус при
 * открытии встаёт в поле, Enter подтверждает только при совпадении, регистр
 * важен. Подпись и подсказку поля даёт каталог сообщений.
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
