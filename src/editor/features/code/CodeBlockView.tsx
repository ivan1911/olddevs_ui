"use client";

import { NodeViewContent, NodeViewWrapper, type Editor, type NodeViewProps } from "@tiptap/react";
import { useEffect, useRef, useSyncExternalStore, type Key, type KeyboardEvent } from "react";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuSection,
  MenuTrigger,
} from "../../../components/overlays/Menu.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { ChevronDownIcon } from "../../../icons.js";
import type { RichCodeBlockOptions } from "./codeBlock.js";
import { CodeCopyButton } from "./CodeCopyButton.js";
import { CODE_BLOCK_CLASS, CODE_HEADER_CLASS, CODE_LABEL_CLASS } from "./codeHeader.js";
import {
  CODE_LANGUAGES,
  codeLanguage,
  normalizeCodeLanguage,
  type CodeLanguageId,
} from "./codeLanguages.js";
import { GLASS_MENU_CLASS } from "../../styles/glass.js";

/** Attribute of the Block's language button: `Alt+F10` finds the button in the Block's DOM by it. */
export const CODE_LANGUAGE_TRIGGER = "data-code-language-trigger";

/** Attribute of the "Copy" button: arrow keys and `Alt+F10` move between the header buttons by it. */
export const CODE_COPY_TRIGGER = "data-code-copy-trigger";

/**
 * Change the language of the Block at `pos` in one transaction, so it is a single undo step.
 * The step changes only the attribute (`AttrStep`) and does not touch the text, so the history
 * does not merge it with the typing before it: `Mod+Z` restores the language and the code stays
 * (guarded by `tests/rich-text-editor-code-block.test.tsx`).
 */
function setCodeLanguage(editor: Editor, pos: number, language: CodeLanguageId | null) {
  editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, "language", language));
}

/** Key of the "Plain text" item in the menu: a Block without a language has no name to show. */
const PLAIN_KEY = "plain";

/*
  react-aria sets `aria-haspopup="true"` on the menu trigger; the explicit `menu` matches
  the "Table" menu in the Toolbar.
*/
const HAS_POPUP_MENU = { "aria-haspopup": "menu" } as object;

/**
 * Whether the Document can be edited, read from the `contenteditable` attribute of the root.
 *
 * WHY NOT `editor.isEditable` ONCE. `readOnly` and `disabled` change on the fly through
 * `setEditable` without a transaction, and the node view re-renders only when the node itself
 * changes: the button would stay next to a field that can no longer be edited. ProseMirror mirrors
 * the mode in the root's `contenteditable`, so that is what we watch.
 */
function useEditable(editor: Editor): boolean {
  return useSyncExternalStore(
    (notify) => {
      const observer = new MutationObserver(notify);
      observer.observe(editor.view.dom, {
        attributes: true,
        attributeFilter: ["contenteditable"],
      });
      return () => observer.disconnect();
    },
    () => editor.isEditable,
    () => false
  );
}

/**
 * The code Block in the Editor: a header with the language on the left and "Copy" on the
 * right, with the code below it.
 *
 * THE HEADER IS BLOCK CHROME (`contentEditable={false}`): ProseMirror puts no caret into it and
 * does not take its text for the Block's content; selection and copying of the Document do not
 * capture it (`select-none`). The bar sits in the flow, not over the code: the first line never
 * runs under the buttons, however long it is.
 *
 * The language is the kit's `Menu`: the ADR-0041 overlay stack, the arrows, `Escape` and the
 * radio group with the chosen language come from it. The name is "Language: Python", so the
 * language is announced on the button itself, without opening the menu. A choice changes the
 * language in one undo step and returns focus to the code.
 *
 * "COPY" IS AVAILABLE IN ANY MODE, with both `readOnly` and `disabled`: the code cannot be
 * edited, but it can be copied. `node.textContent` is copied, that is the Block's text as typed,
 * without the highlight tokens (they are Decorations) and without the trailing line break, which
 * the node does not hold (ADR-0039: the text is copied, not the DOM).
 *
 * KEYBOARD. Both buttons are outside the Tab order (`tabindex="-1"`): otherwise every code Block
 * would add two stops between the field and the next form element. The entry point is `Alt+F10`
 * from the Block (`codeBlock.ts`) to the language; `Alt+F10` or the Right arrow moves on to
 * "Copy"; the Left arrow goes back; `Alt+F10` from "Copy" goes to the Toolbar. `Escape` from
 * either button returns focus to the code, and the caret stays where it was. A read-only Editor
 * does not take focus into the text, so `Alt+F10` from the Block is unreachable there, and "Copy"
 * stays in the normal Tab order.
 *
 * Read-only and disabled fields show a label instead of the language button: there is nothing
 * to change, but the language of the code is still worth stating. A Block without a language has
 * no label: "Plain text" is a catalog string, and it is needed by the menu button, not by a label.
 * `RichTextView` behaves the same way, where there is no catalog at all.
 */
export function CodeBlockView({ editor, node, getPos, extension }: NodeViewProps) {
  const messages = useMessages().editor;
  const editable = useEditable(editor);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const language = codeLanguage(normalizeCodeLanguage(node.attrs.language));
  const label = language?.label ?? messages.codeLanguagePlain;
  const options = extension.options as RichCodeBlockOptions;

  // The `tabIndex` and `aria-keyshortcuts` props are not accepted by the RAC button, so they are
  // set as attributes, the way `ImageToolbar` removes an extra stop from a plugin node.
  useEffect(() => {
    triggerRef.current?.setAttribute("tabindex", "-1");
    triggerRef.current?.setAttribute("aria-keyshortcuts", "Alt+F10");
  }, [editable]);

  /*
    The header's Escape means "back to the code", and the kit's dialog around the Editor must not
    get it. Radix listens for Escape on the document in the capture phase, that is before the
    header's `onKeyDown`: inside a `Dialog` or `Drawer`, leaving the header would close the window
    as soon as the language menu disappeared. The capture listener on `window` runs before the
    document's one; `preventDefault` tells the Radix layer not to close, and bubbling is not
    stopped, so `onKeyDown` below still returns focus to the code. This applies only while editing:
    without a caret there is nothing to return to, and Escape from "Copy" stays with the window.
  */
  useEffect(() => {
    const header = headerRef.current;
    const view = header?.ownerDocument.defaultView;
    if (!header || !view) return;
    const keepLayer = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || !editor.isEditable) return;
      if (event.target instanceof Node && header.contains(event.target)) event.preventDefault();
    };
    view.addEventListener("keydown", keepLayer, true);
    return () => view.removeEventListener("keydown", keepLayer, true);
  }, [editor]);

  const choose = (key: Key) => {
    const pos = getPos();
    if (pos === undefined || !editor.isEditable) return;
    const id = key === PLAIN_KEY ? null : normalizeCodeLanguage(String(key));
    if (id !== normalizeCodeLanguage(node.attrs.language)) setCodeLanguage(editor, pos, id);
    /*
      Focus goes to the code via a timer: after a choice react-aria returns focus to the button,
      and focus set right away would go back to it. `view.focus()` puts the caret back where it
      was before the button.
    */
    setTimeout(() => {
      if (!editor.isDestroyed) editor.view.focus();
    }, 0);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // The menu is in a portal, but React events bubble through it too, so the menu's own keys
    // (its `Escape`) do not apply here. The tooltip is in a portal as well.
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const onLanguage = target === triggerRef.current;
    const onCopy = target.hasAttribute(CODE_COPY_TRIGGER);
    if (!onLanguage && !onCopy) return;
    const copy = headerRef.current?.querySelector<HTMLElement>(`[${CODE_COPY_TRIGGER}]`);
    if (event.key === "Escape") {
      event.preventDefault();
      editor.view.focus();
    } else if (event.key === "F10" && event.altKey) {
      event.preventDefault();
      if (onLanguage && copy) copy.focus();
      else options.focusToolbar();
    } else if (event.key === "ArrowRight" && onLanguage && copy) {
      event.preventDefault();
      copy.focus();
    } else if (event.key === "ArrowLeft" && onCopy && triggerRef.current) {
      event.preventDefault();
      triggerRef.current.focus();
    }
  };

  return (
    <NodeViewWrapper className={CODE_BLOCK_CLASS}>
      <div
        ref={headerRef}
        contentEditable={false}
        className={CODE_HEADER_CLASS}
        data-code-header=""
        onKeyDown={onKeyDown}
      >
        {editable ? (
          <MenuTrigger>
            <MenuButton
              ref={triggerRef}
              variant="ghost"
              size="sm"
              aria-label={messages.codeLanguage({ current: label })}
              className="h-6 px-1.5 font-sans text-xs"
              {...{ [CODE_LANGUAGE_TRIGGER]: "" }}
              {...HAS_POPUP_MENU}
            >
              {/* The label and the chevron in one row: `MenuButton` wraps its children in a single `span`. */}
              <span className="inline-flex items-center gap-1">
                {label}
                <ChevronDownIcon size={12} aria-hidden />
              </span>
            </MenuButton>
            {/* react-aria takes the menu's name from the button (`aria-labelledby`): "Language: Python". */}
            <Menu className={GLASS_MENU_CLASS} placement="bottom start" onAction={choose}>
              <MenuSection selectionMode="single" selectedKeys={[language?.id ?? PLAIN_KEY]}>
                <MenuItem id={PLAIN_KEY} textValue={messages.codeLanguagePlain}>
                  {messages.codeLanguagePlain}
                </MenuItem>
                {CODE_LANGUAGES.map(({ id, label: name }) => (
                  <MenuItem key={id} id={id} textValue={name}>
                    {name}
                  </MenuItem>
                ))}
              </MenuSection>
            </Menu>
          </MenuTrigger>
        ) : (
          <span className={CODE_LABEL_CLASS}>{language?.label}</span>
        )}
        <CodeCopyButton
          code={node.textContent}
          // Out of the Tab order while the Editor is editable: `Alt+F10` leads here. Without a caret
          // (read-only, disabled) there is no other way to reach the button.
          tabIndex={editable ? -1 : undefined}
          {...{ [CODE_COPY_TRIGGER]: "" }}
        />
      </div>
      <pre>
        <NodeViewContent<"code">
          as="code"
          className={language ? `language-${language.id}` : undefined}
        />
      </pre>
    </NodeViewWrapper>
  );
}
