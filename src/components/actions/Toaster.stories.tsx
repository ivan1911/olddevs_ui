import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button.js";
import { Toaster, toast } from "./Toaster.js";

const meta = {
  title: "Actions/Toaster",
  component: Toaster,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Четыре тона словаря — и ничего сверх них.
 *
 * `toast.custom` и произвольный JSX у sonner есть, а здесь их нет намеренно:
 * тост, умеющий всё, перестаёт быть частью системы, и через полгода в
 * приложении оказывается пять разных тостов.
 */
export const Tones: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-2">
      <Toaster position="top-right" />
      <Button onClick={() => toast.success("Settings saved")}>Success</Button>
      <Button
        onClick={() =>
          toast.error("Could not save", { description: "The channel does not answer — code 502" })
        }
      >
        Error with a description
      </Button>
      <Button onClick={() => toast.warning("2 posts left for today")}>Warning</Button>
      <Button onClick={() => toast.info("The draft was saved automatically")}>Message</Button>
      <Button
        onClick={() =>
          toast.promise(new Promise((r) => setTimeout(r, 1500)), {
            loading: "Saving…",
            success: "Saved",
            error: "Did not work",
          })
        }
      >
        Promise
      </Button>
      <Button variant="ghost" onClick={() => toast.dismiss()}>
        Dismiss all
      </Button>
    </div>
  ),
};
