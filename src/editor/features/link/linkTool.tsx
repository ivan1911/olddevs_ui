"use client";

import { LinkIcon } from "../../../icons.js";
import { RichLink } from "./link.js";
import { LinkForm } from "./LinkPopover.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";

/**
 * Ссылка на описании Инструмента (ADR-0058, п. 10.4) — проверка
 * кнопки, Меню выделения и сочетания на той же форме, что у своего
 * Инструмента.
 *
 * Кнопка не ставит Метку сама, а открывает поповер адреса — и щелчком, и
 * `Mod+K`. `aria-pressed` — каретка в ссылке: поповер тогда правит её адрес.
 * Привилегии кита: группа «Ссылка» справочника сочетаний и рамка поповера у
 * выделения, а не у кнопки (`LinkPopover.tsx` — почему).
 */
export const LINK_TOOL: ToolDescriptor = {
  name: "link",
  engine: () => [RichLink],
  kitTags: ["a"],
  buttons: [
    {
      id: "link",
      label: ({ messages }) => messages.link,
      icon: LinkIcon,
      can: () => true,
      isActive: (editor) => editor.isActive("link"),
      selectionMenu: true,
      shortcut: ["mod", "K"],
      shortcutGroup: "link",
      popover: ({ editor, close }) => <LinkForm editor={editor} onDone={close} />,
      popoverFrame: { anchor: "selection", className: "w-80 p-3" },
    },
  ],
};
