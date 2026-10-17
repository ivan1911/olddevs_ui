"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "../../../components/actions/Button.js";
import { Toggle } from "../../../components/actions/Toggle.js";
import { Checkbox } from "../../../components/inputs/Checkbox.js";
import { TextControl } from "../../../components/inputs/TextControl.js";
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from "../../../icons.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { cn } from "../../../lib/cn.js";
import { GLASS_PANEL_CLASS } from "../../styles/glass.js";
import type { SearchOptions } from "./searchMatch.js";
import { cancelRevealMatch, registerSearchOverlays, scheduleRevealMatch } from "./revealMatch.js";
import { searchState } from "./searchPlugin.js";

const NO_OPTIONS: SearchOptions = { matchCase: false, wholeWord: false, regex: false };
const FLAGS = ["matchCase", "wholeWord", "regex"] as const;

export interface SearchPanelProps {
  editor: Editor;
  /**
   * The focus request: every opening (the button, `Mod+F`, `Mod+Alt+F`, the Handle)
   * brings a new `token`, and the panel sets the focus again. Pressing `Mod+F` again
   * while the panel is open selects the text of the search field.
   */
  focus: { token: number; replace: boolean; query: string };
  onClose: () => void;
  className?: string;
}

/**
 * The "Find and replace" panel: non-modal, in the corner of the field. The search state
 * is in the engine's plugin (`searchPlugin.ts`); the panel holds only what the author
 * typed and sends commands.
 *
 * NON-MODAL, WITHOUT A FOCUS TRAP: the author searches, edits what was found in the
 * Document and returns to the search field, as in Google Docs. Escape from any of its
 * fields closes the panel and puts the caret on the current match.
 *
 * Loaded lazily, on the first opening (`RichTextEditor.tsx`): the fields, the checkboxes
 * and the toggle are not part of the Editor's start bundle, while the highlight plugin is
 * small and is part of it.
 */
export function SearchPanel({ editor, focus, onClose, className }: SearchPanelProps) {
  const messages = useMessages().editor;
  /*
    The panel's query and checkboxes mirror the search in the engine: on opening, the panel
    takes what the engine already has (the starting checkboxes are Tool options, and the query
    is there if the screen set it with a command), and later it picks up the same kind of
    changes made from outside.
  */
  const [query, setQuery] = useState(() => focus.query || searchState(editor.state)?.query || "");
  const [replacement, setReplacement] = useState("");
  const [options, setOptions] = useState(() => searchState(editor.state)?.options ?? NO_OPTIONS);
  const searchRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const errorId = useId();

  const search = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const state = searchState(current.state);
      return {
        current: state?.current ?? -1,
        total: state?.total ?? 0,
        // Search finds formulas but does not replace them: if only formulas are left, there is
        // nothing to replace.
        replaceable: state?.matches.some((match) => !match.formula) ?? false,
        error: state?.error,
        engineQuery: state?.query ?? "",
        engineOptions: state?.options ?? NO_OPTIONS,
        editable: current.isEditable,
      };
    },
  });

  // A new opening: the text selected in the Document goes into the field.
  useEffect(() => {
    if (focus.query) setQuery(focus.query);
  }, [focus.token, focus.query]);
  /*
    The focus and the selection of the field's text happen once per opening, and when the new
    query is already in the field: otherwise `select()` would select the old text, and the
    value change would immediately drop the selection. The author's typing in the field does
    not reach this code: the opening itself has already been handled.
  */
  const handled = useRef(-1);
  useLayoutEffect(() => {
    if (handled.current === focus.token) return;
    if (focus.query && query !== focus.query) return;
    handled.current = focus.token;
    const field = focus.replace && replaceRef.current ? replaceRef.current : searchRef.current;
    field?.focus();
    field?.select();
  }, [focus.token, focus.query, focus.replace, query]);

  /*
    Scroll the current match into view (`revealMatch.ts`): ProseMirror does not scroll by
    itself while the focus is in the search field. This happens a frame later, once the panel
    is laid out and its edge can be accounted for. The panel and its sticky parent (the
    Editor's Toolbar) lie over the Document: a match under them does not count as visible.
  */
  const reveal = () => scheduleRevealMatch(editor);
  // Tool commands reveal a match the same way and step around this same panel.
  useEffect(() => {
    const unregister = registerSearchOverlays(editor, () => [
      panelRef.current,
      panelRef.current?.parentElement,
    ]);
    return () => {
      unregister();
      cancelRevealMatch(editor);
    };
  }, [editor]);

  useEffect(() => {
    editor.commands.setSearch(query, options);
    // Already while typing, not only on Enter. The Document's selection is left alone:
    // the focus is in the search field, and typing must not move it.
    reveal();
    // `reveal` is a new function on every render, but it reads only the refs and `editor`.
  }, [editor, query, options]);

  /*
    The query and the checkboxes set in the engine around the panel (the `setQuery` command)
    show up in the fields. The check against the engine is live, not against the `search`
    snapshot: the effect above has already pushed what was typed in this same commit, and a
    stale snapshot would roll it back.
  */
  useEffect(() => {
    const live = searchState(editor.state);
    if (!live) return;
    if (live.query !== query) setQuery(live.query);
    if (FLAGS.some((flag) => live.options[flag] !== options[flag])) setOptions(live.options);
    // Only when the search changes in the engine. Typing in the fields reaches the engine
    // through the effect above.
  }, [search.engineQuery, search.engineOptions]);

  const step = (direction: 1 | -1) => {
    editor.commands.searchStep(direction);
    reveal();
  };
  // The replaced match goes away and the next one becomes current, so that is the one to reveal.
  const replaceOne = () => {
    editor.commands.replaceMatch(replacement);
    reveal();
  };

  // `RichTextEditor` (`closeSearch`) puts the caret on the match and the focus into the Document.
  const close = onClose;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };

  const toggle = (key: keyof SearchOptions) => (checked: boolean) =>
    setOptions((previous) => ({ ...previous, [key]: checked }));

  const hasMatches = search.total > 0;
  const counter = hasMatches ? `${search.current + 1} / ${search.total}` : "0 / 0";
  const status =
    query === "" || search.error
      ? ""
      : hasMatches
        ? messages.searchCount({ current: search.current + 1, total: search.total })
        : messages.searchNoMatches;

  return (
    <section
      ref={panelRef}
      role="search"
      aria-label={messages.searchPanel}
      onKeyDown={onKeyDown}
      className={cn(
        GLASS_PANEL_CLASS,
        "border-line flex flex-col gap-2 rounded-md border p-3 shadow-[var(--shadow-2)]",
        className
      )}
    >
      <div className="flex items-center gap-1">
        <span aria-hidden="true" className="text-fg-2 mr-auto text-xs tabular-nums">
          {counter}
        </span>
        <div role="status" className="sr-only">
          {status}
        </div>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label={messages.searchPrevious}
          icon={<ChevronUpIcon size={16} aria-hidden />}
          disabled={!hasMatches}
          onClick={() => step(-1)}
        />
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label={messages.searchNext}
          icon={<ChevronDownIcon size={16} aria-hidden />}
          disabled={!hasMatches}
          onClick={() => step(1)}
        />
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label={messages.searchClose}
          icon={<CloseIcon size={16} aria-hidden />}
          onClick={close}
        />
      </div>

      <TextControl
        ref={searchRef}
        size="sm"
        aria-label={messages.searchField}
        placeholder={messages.searchField}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-invalid={search.error ? true : undefined}
        aria-describedby={search.error ? errorId : undefined}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          step(event.shiftKey ? -1 : 1);
        }}
      />
      {search.error && (
        <p id={errorId} className="text-danger text-xs">
          {messages.searchInvalid}
        </p>
      )}

      {search.editable && (
        <TextControl
          ref={replaceRef}
          size="sm"
          aria-label={messages.replaceField}
          placeholder={messages.replaceField}
          value={replacement}
          onChange={(event) => setReplacement(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            replaceOne();
          }}
        />
      )}

      <div className="flex flex-col gap-1.5 py-1">
        <Checkbox size="sm" checked={options.matchCase} onCheckedChange={toggle("matchCase")}>
          {messages.searchMatchCase}
        </Checkbox>
        <Checkbox size="sm" checked={options.wholeWord} onCheckedChange={toggle("wholeWord")}>
          {messages.searchWholeWord}
        </Checkbox>
        <div className="flex items-center justify-between gap-2">
          <span aria-hidden="true" className="text-fg-1 text-xs">
            {messages.searchRegex}
          </span>
          <Toggle
            label={messages.searchRegex}
            checked={options.regex}
            onCheckedChange={toggle("regex")}
          />
        </div>
      </div>

      {search.editable && (
        <div className="flex justify-end gap-2">
          <Button variant="soft" size="sm" disabled={!search.replaceable} onClick={replaceOne}>
            {messages.replaceOne}
          </Button>
          <Button
            variant="soft"
            size="sm"
            disabled={!search.replaceable}
            onClick={() => editor.commands.replaceAllMatches(replacement)}
          >
            {messages.replaceAll}
          </Button>
        </div>
      )}
    </section>
  );
}
