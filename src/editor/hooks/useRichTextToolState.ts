"use client";

import type { Editor } from "@tiptap/react";
import { useCallback, useRef, useSyncExternalStore, type RefObject } from "react";
import { toolSignals, watchHandleEditor } from "../core/handleWatchers.js";
import { toolOptions } from "../core/toolDescriptor.js";
import type { RichTextTools } from "../core/toolOptions.js";
import type { RichTextEditorHandle } from "../RichTextEditor.js";
import { blockSelectionSnapshot } from "../features/blockSelection/blockSelectionSnapshot.js";
import { focusModeEnabled } from "../features/focus/focusModeState.js";
import { footnotesSnapshot } from "../features/footnotes/footnotesSnapshot.js";
import { invisibleCharactersSnapshot } from "../features/invisibleCharacters/invisibleCharactersSnapshot.js";
import { languageSnapshot } from "../features/language/languageSnapshot.js";
import { searchSnapshot } from "../features/search/searchSnapshot.js";
import { tocSnapshot } from "../features/toc/tocSnapshot.js";

/**
 * The state of a Tool by name: the type comes from the `RichTextTools` map. A name that is
 * not in the map gives `unknown`: typing is optional, and a Tool without an entry in the map
 * does not break the build.
 */
export type RichTextToolState<Name extends string> = Name extends keyof RichTextTools
  ? RichTextTools[Name] extends { state: infer State }
    ? State
    : unknown
  : unknown;

/** The snapshot of a built-in Tool; `null` means the Tool is not in the engine. */
const SNAPSHOTS = new Map<string, (editor: Editor, ref: object) => unknown>([
  [
    "search",
    (editor, ref) => {
      const { tools, searchOpen } = toolSignals(ref);
      return tools?.has("search") ? searchSnapshot(editor, searchOpen === true) : null;
    },
  ],
  [
    "toc",
    (editor, ref) => {
      const { tools, tocAt } = toolSignals(ref);
      const options = tools && toolOptions(tools, "toc");
      return options && tocSnapshot(editor, options, tocAt);
    },
  ],
  [
    "footnotes",
    (editor, ref) => (toolSignals(ref).tools?.has("footnotes") ? footnotesSnapshot(editor) : null),
  ],
  [
    "invisibleCharacters",
    (editor, ref) =>
      toolSignals(ref).tools?.has("invisibleCharacters")
        ? invisibleCharactersSnapshot(editor)
        : null,
  ],
  [
    "blockSelection",
    (editor, ref) =>
      toolSignals(ref).tools?.has("blockSelection") ? blockSelectionSnapshot(editor) : null,
  ],
  [
    "fullscreen",
    (_editor, ref) => {
      const { tools, fullscreenOpen } = toolSignals(ref);
      return tools?.has("fullscreen") ? { open: fullscreenOpen === true } : null;
    },
  ],
  [
    "focus",
    (editor, ref) =>
      toolSignals(ref).tools?.has("focus") ? { enabled: focusModeEnabled(editor) } : null,
  ],
  [
    "language",
    (editor, ref) => (toolSignals(ref).tools?.has("language") ? languageSnapshot(editor) : null),
  ],
]);

/** A plain object: an object literal or `Object.create(null)`, not a class instance. */
function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

/**
 * Equality for snapshots. Only plain data is compared by value: primitives, arrays and plain
 * objects. Everything else (`Date`, `Map`, `Set`, class instances) is compared by reference.
 * They have no own keys by which a difference could be seen, so any two of them would count as
 * "equal by value", and the screen would silently never update. A new instance is a new snapshot.
 */
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (!Array.isArray(a) && !(isPlainObject(a) && isPlainObject(b))) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => key in right && sameValue(left[key], right[key]))
  );
}

/**
 * The state of a built-in Tool for the screen's own use: "3 of 12" in the Status bar from Find,
 * and external navigation from the Table of contents headings. The name is a Tool from the
 * `tools` set, and the snapshot type comes from the `RichTextTools` map: `search` gives
 * `SearchToolState`, `toc` gives `TocToolState`, and `invisibleCharacters` gives
 * `InvisibleCharactersToolState` (`{ visible }`), and `language` gives `LanguageToolState` (`{ current, primary }`).
 *
 * RE-RENDERS ONLY ON A SNAPSHOT CHANGE. The snapshot is recomputed on every engine transaction
 * and on kit signals that the engine does not have: opening and closing the Find panel, a change
 * of the current Table of contents section on scroll. The screen re-renders when the result has
 * become different. Plain data (primitives, arrays, plain objects) is compared by value, as in
 * `useRichTextEditorState`; `Date`, `Map`, `Set` and class instances are compared by reference.
 * So typing that does not change the snapshot does not touch the screen. A slice from `selector`
 * is compared the same way: `(state) => state.total` subscribes the screen to a single number.
 *
 * `null` is returned before mount and in the screen's first render, on the server, and when the
 * Tool is not in the `tools` set: the presets do not include `toc`, and it is enabled by name
 * or by the `tool("toc")` entry. The selector is not called on `null`. The same `ref` is passed to
 * `RichTextEditor`.
 *
 * The snapshot is data without DOM nodes or ProseMirror positions, and there is no need to modify it.
 * The hook is not part of the starting graph of `RichTextEditor`: its cost falls only on the screen
 * that imported it.
 *
 * @example
 * const ref = useRef<RichTextEditorHandle>(null);
 * const total = useRichTextToolState(ref, "search", (state) => state.total);
 * const headings = useRichTextToolState(ref, "toc", (state) => state.headings);
 */
export function useRichTextToolState<Name extends string>(
  ref: RefObject<RichTextEditorHandle | null>,
  name: Name
): RichTextToolState<Name> | null;
export function useRichTextToolState<Name extends string, Slice>(
  ref: RefObject<RichTextEditorHandle | null>,
  name: Name,
  selector: (state: RichTextToolState<Name>) => Slice
): Slice | null;
export function useRichTextToolState(
  ref: RefObject<RichTextEditorHandle | null>,
  name: string,
  selector?: (state: never) => unknown
): unknown {
  const last = useRef<{ value: unknown } | null>(null);

  const subscribe = useCallback(
    (listener: () => void) => {
      // Engine transactions are watched on the current engine; when it changes, the listener is moved over.
      let followed: Editor | null = null;
      const follow = () => {
        followed?.off("transaction", listener);
        const editor = ref.current?.editor ?? null;
        followed = editor && !editor.isDestroyed ? editor : null;
        followed?.on("transaction", listener);
      };
      follow();
      const stop = watchHandleEditor(ref, () => {
        follow();
        listener();
      });
      return () => {
        stop();
        followed?.off("transaction", listener);
      };
    },
    [ref]
  );

  const read = (): unknown => {
    const editor = ref.current?.editor;
    // A custom Tool's own state is the `state` function from this Editor's set; a built-in one is the table.
    const own = toolSignals(ref).tools?.descriptors.find((entry) => entry.name === name)?.state;
    const snapshot =
      editor && !editor.isDestroyed
        ? ((own ? own(editor) : SNAPSHOTS.get(name)?.(editor, ref)) ?? null)
        : null;
    const value = snapshot === null || !selector ? snapshot : selector(snapshot as never);
    // Keep the previous reference while the value is the same: otherwise React sees a new snapshot on every render.
    if (last.current && sameValue(last.current.value, value)) return last.current.value;
    last.current = { value };
    return value;
  };

  return useSyncExternalStore(subscribe, read, () => null);
}
