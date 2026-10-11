import type { Meta, StoryObj } from "@storybook/react-vite";
import { WarningIcon } from "../../icons.js";
import { ModalHeader } from "./ModalHeader.js";

const meta = {
  title: "Overlays/ModalHeader",
  component: ModalHeader,
  parameters: { layout: "padded" },
  args: { title: "New category", onClose: () => {} },
} satisfies Meta<typeof ModalHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Обычная шапка: заголовок и крестик. */
export const Playground: Story = {};

/**
 * Все формы, которые реально встречаются во фронте. Взяты из кода диалогов,
 * а не придуманы: иначе снимок сторожил бы не то, что ломается.
 */
export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <section>
        <p className="text-fg-2 mb-1 font-mono text-xs">plain</p>
        <ModalHeader title="New category" onClose={() => {}} />
      </section>

      <section>
        <p className="text-fg-2 mb-1 font-mono text-xs">with a count in the title</p>
        <ModalHeader
          title={
            <>
              To the collection
              <span className="text-fg-3 text-md ml-2 font-normal">(12)</span>
            </>
          }
          onClose={() => {}}
        />
      </section>

      <section>
        <p className="text-fg-2 mb-1 font-mono text-xs">with a subtitle</p>
        <ModalHeader
          title="Editing"
          subtitle={<span className="font-mono text-[11px]">nature-landscapes</span>}
          onClose={() => {}}
        />
      </section>

      <section>
        <p className="text-fg-2 mb-1 font-mono text-xs">with an icon — like in ConfirmDialog</p>
        <ModalHeader
          title="Delete the photo?"
          icon={<WarningIcon size={18} className="text-err" />}
          onClose={() => {}}
        />
      </section>

      <section>
        <p className="text-fg-2 mb-1 font-mono text-xs">
          no cross — submitting (`onClose` not passed)
        </p>
        <ModalHeader title="Saving…" />
      </section>

      <section>
        <p className="text-fg-2 mb-1 font-mono text-xs">a long title is truncated</p>
        <div className="w-[320px]">
          <ModalHeader
            title="A very long window title that does not fit the width"
            onClose={() => {}}
          />
        </div>
      </section>
    </div>
  ),
};
