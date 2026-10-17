import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/actions/Button.js";
import type { RichTextSurface } from "../../styles/surface.js";
import { RichTextEditor, type RichTextEditorHandle } from "../../RichTextEditor.js";
import { RichTextToc } from "./RichTextToc.js";
import { RichTextView } from "../../RichTextView.js";

/*
  A neutral Document with every heading level: H1 has no indent, and each
  deeper level has a shorter stroke and a more indented item.
*/
const paragraph = (topic: string) =>
  `<p>This section describes ${topic}. It has enough text to give the page some height, ` +
  "so that the strip and the headings it points to do not all fit on one screen.</p>";

const ARTICLE =
  "<h1>Palette</h1>" +
  paragraph("the palette as a whole") +
  "<h2>How to read</h2>" +
  paragraph("how a color goes from a primitive to a class") +
  "<h2>Layer 1 — primitives</h2>" +
  paragraph("the primitives") +
  "<h3>Neutrals</h3>" +
  paragraph("the neutral scales") +
  "<h3>Tones</h3>" +
  paragraph("the tone scales") +
  "<h4>Semi-transparent primitives</h4>" +
  paragraph("the semi-transparent primitives") +
  "<h2>Layer 2 — roles by theme</h2>" +
  paragraph("the roles") +
  "<h3>Surfaces</h3>" +
  paragraph("the surfaces") +
  "<h3>Text</h3>" +
  paragraph("the text roles") +
  "<h3>Component tokens that a theme overrides for one family of controls</h3>" +
  paragraph("the component tokens") +
  "<h2>What's next</h2>" +
  paragraph("what comes next");

/** Headings inside a Wrapper go into the Table of contents; headings in Column layout columns do not. */
const BLOCKS =
  "<h2>Release 2.4</h2>" +
  paragraph("the release") +
  '<div data-block="wrapper" data-tone="warning"><h3>Before you upgrade</h3>' +
  paragraph("the upgrade") +
  "</div>" +
  '<div data-block="layout" data-layout="50-50">' +
  '<div data-block="column"><h3>Left column</h3><p>Not in the table of contents.</p></div>' +
  '<div data-block="column"><h3>Right column</h3><p>Not in the table of contents either.</p></div>' +
  "</div>" +
  "<h3>Known issues</h3>" +
  paragraph("the known issues");

/** A long Document: forty headings across three levels, so the strip reaches the window height. */
const LONG =
  "<h1>Handbook</h1>" +
  paragraph("the handbook") +
  Array.from({ length: 13 }, (_, index) => {
    const chapter = index + 1;
    return (
      `<h2>Chapter ${chapter}</h2>` +
      paragraph(`chapter ${chapter}`) +
      `<h3>Chapter ${chapter}, part one</h3>` +
      paragraph(`the first part of chapter ${chapter}`) +
      `<h4>Chapter ${chapter}, notes</h4>` +
      paragraph(`the notes to chapter ${chapter}`)
    );
  }).join("");

interface ScreenProps {
  html: string;
  surface?: RichTextSurface;
  /** Width of the Table of contents list (`listWidth`). */
  listWidth?: number | string;
}

/**
 * A screen as a consumer builds it: the Table of contents in its own column on the left,
 * with its own `sticky`, and the View on the right. The screen sets the column and the
 * stickiness, not the component.
 */
function Screen({ html, surface, listWidth }: ScreenProps) {
  const view = useRef<HTMLDivElement>(null);
  return (
    <div className="flex items-start gap-6">
      <div className="sticky top-[calc(var(--topbar-h,0px)+16px)] w-10 shrink-0">
        <RichTextToc target={view} listWidth={listWidth} />
      </div>
      <RichTextView
        ref={view}
        html={html}
        surface={surface}
        className="max-w-[640px] min-w-0 flex-1"
      />
    </div>
  );
}

interface EditorScreenProps extends ScreenProps {
  /** Read-only Editor. Defaults to `true`: this is the supported mode. */
  readOnly?: boolean;
  toolbar?: "fixed" | "floating" | "bubble" | "none";
  /** Field height: the Document scrolls inside the Editor, not the page. */
  maxHeight?: number | string;
  /** Button above the Editor that toggles `readOnly`. */
  toggle?: boolean;
}

/** Same as `Screen`, but the target is the Editor: its Handle, not the View element. */
function EditorScreen({
  html,
  surface,
  listWidth,
  readOnly = true,
  toolbar,
  maxHeight,
  toggle = false,
}: EditorScreenProps) {
  const editor = useRef<RichTextEditorHandle>(null);
  const [locked, setLocked] = useState(readOnly);
  return (
    <div className="flex flex-col gap-3">
      {toggle && (
        <div className="flex items-center gap-3 pl-16">
          <Button size="sm" variant="outline" onClick={() => setLocked((value) => !value)}>
            {locked ? "Edit" : "Done"}
          </Button>
          <span className="text-fg-2 text-[13px]">
            {locked ? "Read only" : "Editing: add or rename a heading and watch the strip"}
          </span>
        </div>
      )}
      <div className="flex items-start gap-6">
        <div className="sticky top-[calc(var(--topbar-h,0px)+16px)] w-10 shrink-0">
          <RichTextToc target={editor} listWidth={listWidth} />
        </div>
        <RichTextEditor
          ref={editor}
          aria-label="Document"
          defaultValue={html}
          readOnly={locked}
          surface={surface}
          toolbar={toolbar}
          maxHeight={maxHeight}
          className="max-w-[640px] min-w-0 flex-1"
        />
      </div>
    </div>
  );
}

const meta = {
  title: "Content/RichTextToc",
  component: Screen,
  parameters: { layout: "padded" },
  args: { html: ARTICLE },
} satisfies Meta<typeof Screen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The strip of strokes to the left of the View. Click it to open the list of headings. */
export const Playground: Story = {};

/** On a light Paper (`surface="paper"`), the Table of contents stays in the app theme: it is outside the sheet. */
export const Paper: Story = { args: { surface: "paper" } };

/** Wrapper and Column layout: the heading inside the Wrapper is in the list; column headings are not. */
export const WrapperAndLayout: Story = { args: { html: BLOCKS } };

/**
 * The Table of contents in the page margin: the text column is centered, and the strip is
 * in the margin to its left. Narrow the window: when the margin becomes narrower than the
 * strip, the Table of contents hides itself.
 */
export const Margin: Story = {
  render: (args) => <MarginScreen {...args} />,
};

function MarginScreen({ html, surface }: ScreenProps) {
  const view = useRef<HTMLDivElement>(null);
  return (
    <div className="relative mx-auto max-w-[640px]">
      <div className="absolute top-0 right-full mr-8 h-full">
        <div className="sticky top-[calc(var(--topbar-h,0px)+16px)]">
          <RichTextToc target={view} />
        </div>
      </div>
      <RichTextView ref={view} html={html} surface={surface} />
    </div>
  );
}

/** Editor in `readOnly`: the Table of contents takes headings from its Document, as the View does. */
export const ReadOnlyEditor: Story = {
  render: (args) => <EditorScreen {...args} />,
};

/**
 * Editor in edit mode. Add a heading or rename an existing one: the strip and the list
 * rebuild within a moment. Navigating scrolls to the heading but does not move the caret.
 * This mode works, but the contract does not promise it.
 */
export const EditableEditor: Story = {
  render: (args) => <EditorScreen {...args} readOnly={false} />,
};

/** The button above the Editor toggles `readOnly`: the Table of contents works in both modes. */
export const EditorReadOnlyToggle: Story = {
  render: (args) => <EditorScreen {...args} toggle />,
};

/** Editor on a light Paper: the Table of contents stays in the app theme, outside the Paper. */
export const EditorPaper: Story = {
  render: (args) => <EditorScreen {...args} surface="paper" />,
};

/**
 * A field with `maxHeight`: the Document scrolls inside the Editor. The highlight follows
 * that scroll, and navigating scrolls the field, not the page.
 */
export const EditorScrollingField: Story = {
  render: (args) => <EditorScreen {...args} readOnly={false} maxHeight={360} />,
};

/** Floating Toolbar: it appears above the selection and does not get in the way of the Table of contents. */
export const EditorFloatingToolbar: Story = {
  render: (args) => <EditorScreen {...args} readOnly={false} toolbar="floating" />,
};

/** Long Document in a read-only Editor: one stroke per heading, and the list scrolls. */
export const EditorLongDocument: Story = {
  render: (args) => <EditorScreen {...args} html={LONG} />,
};

/**
 * Long Document: each heading gets its own stroke, and the strip is no taller than the
 * window. When there is not enough room, the step between strokes shrinks. The list
 * scrolls, and the current item stays in its visible part.
 */
export const LongDocument: Story = { args: { html: LONG } };

/** Fewer than two headings: there is no Table of contents at all, and the screen column is empty. */
export const SingleHeading: Story = {
  args: { html: "<h2>Only heading</h2>" + paragraph("a short note") },
};

/**
 * A sticky screen header publishes its height to `--topbar-h` (ADR-0016), as `TopBar`
 * does. Navigating puts the heading below the header, not behind it, and a section
 * becomes current once its heading reaches the bottom edge of the header.
 */
export const StickyHeader: Story = {
  render: (args) => <WithTopBar {...args} />,
};

function WithTopBar(props: ScreenProps) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--topbar-h", "56px");
    return () => {
      root.style.removeProperty("--topbar-h");
    };
  }, []);
  return (
    <div>
      <div className="border-line-soft bg-bg-1 text-fg-2 sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex h-14 items-center border-b px-4 text-[13px] font-semibold">
        Application header
      </div>
      <Screen {...props} />
    </div>
  );
}

/**
 * The Document sits in its own scrollable area, and the page has no header. Navigating
 * scrolls only that area: the page stays put, and the heading moves to the top edge of
 * the area (`scroll-margin-top`, ADR-0016).
 */
export const ScrollingAreaWithoutHeader: Story = {
  render: (args) => <ScrollingAreaScreen {...args} />,
};

function ScrollingAreaScreen({ html }: ScreenProps) {
  const view = useRef<HTMLDivElement>(null);
  return (
    <div>
      <div className="flex items-start gap-6">
        <div className="sticky top-4 w-10 shrink-0">
          <RichTextToc target={view} />
        </div>
        {/* The scrollable area is reachable from the keyboard, like the kit's `ScrollArea` (axe `scrollable-region-focusable`). */}
        <div
          data-testid="scroll-area"
          tabIndex={0}
          role="region"
          aria-label="Document"
          className="bg-bg-1 focus-visible:outline-accent-strong max-h-80 min-w-0 flex-1 overflow-y-auto px-4 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <RichTextView ref={view} html={html} className="max-w-[640px]" />
        </div>
      </div>
      {/* The page is taller than the window, so it has room to scroll and any shift would show. */}
      <p className="text-fg-2 mt-6 h-[900px] text-[13px]">The page continues below the area.</p>
    </div>
  );
}
