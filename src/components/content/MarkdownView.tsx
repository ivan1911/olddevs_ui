"use client";

import { createContext, useContext, type ReactNode } from "react";
import Markdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { CodeView } from "./CodeView.js";
import { Link } from "./Link.js";

export interface MarkdownViewProps {
  /** Untrusted Markdown text. Raw HTML is not rendered. */
  content: string;
  /** Indicates a growing answer; incomplete syntax stays literal in either mode. */
  streaming?: boolean;
  className?: string;
  /** Trusted display nodes inside CodeView; copying always uses the plain code string. */
  renderCode?: (code: string, language: string | undefined) => ReactNode;
}

function safeUrl(value: string): string {
  const url = value.trim();
  if (
    [...url].some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127) ||
    url.startsWith("//") ||
    url.includes("\\")
  )
    return "";
  let decoded: string;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    return "";
  }
  if (
    [...decoded].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
    decoded.includes("\\") ||
    decoded.startsWith("//")
  )
    return "";
  const decodedScheme = /^([a-z][a-z\d+.-]*):/i.exec(decoded);
  if (decodedScheme && !/^(https?|mailto)$/i.test(decodedScheme[1]!)) return "";
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(url);
  return !scheme || /^(https?|mailto)$/i.test(scheme[1]!) ? url : "";
}

const RenderCodeContext = createContext<MarkdownViewProps["renderCode"]>(undefined);

function MarkdownCode({ node }: ExtraProps) {
  const renderCode = useContext(RenderCodeContext);
  const codeNode = node?.children.find(
    (child) => child.type === "element" && child.tagName === "code"
  );
  if (codeNode?.type !== "element") return null;
  const text = codeNode.children
    .map((child) => (child.type === "text" ? child.value : ""))
    .join("");
  // mdast-to-hast appends one presentation LF, including for an incomplete fence.
  // Removing exactly that LF preserves intentional blank lines in semantic code.
  const code = text.endsWith("\n") ? text.slice(0, -1) : text;
  const languageClass = Array.isArray(codeNode.properties.className)
    ? codeNode.properties.className.find((value) => String(value).startsWith("language-"))
    : undefined;
  const language = languageClass ? String(languageClass).slice(9) : undefined;
  return (
    <CodeView code={code} title={language} copyable>
      {renderCode?.(code, language)}
    </CodeView>
  );
}

function MarkdownImage({ alt }: { alt?: string }) {
  const messages = useMessages().markdownView;
  return <span>{alt ? messages.image({ alt }) : messages.imageWithoutAlt}</span>;
}

function MarkdownTable({ children }: { children?: ReactNode }) {
  const messages = useMessages().markdownView;
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={messages.table}
      className="my-3 max-w-full overflow-x-auto"
    >
      <table className="border-line w-full border-collapse border text-sm [overflow-wrap:normal]">
        {children}
      </table>
    </div>
  );
}

// Stable element components keep code actions mounted when content or highlighting changes.
const COMPONENTS: Components = {
  pre: MarkdownCode,
  img: MarkdownImage,
  table: MarkdownTable,
  a: ({ href, children }) => (href ? <Link href={href}>{children}</Link> : <span>{children}</span>),
  code: ({ children }) => (
    <code className="bg-bg-2 rounded-sm px-1 font-mono text-[13px]">{children}</code>
  ),
};
const REMARK_PLUGINS = [remarkGfm];

/** Read Markdown without an agent runtime or a syntax-highlighting dependency (ADR-0085). */
export function MarkdownView({
  content,
  streaming = false,
  className,
  renderCode,
}: MarkdownViewProps) {
  return (
    <RenderCodeContext.Provider value={renderCode}>
      <div
        data-streaming={streaming || undefined}
        className={cn(
          "text-fg-0 min-w-0 text-sm leading-6 [overflow-wrap:anywhere]",
          "[&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:ps-6 [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:ps-6",
          "[&_blockquote]:border-line [&_blockquote]:text-fg-2 [&_blockquote]:my-3 [&_blockquote]:border-s-2 [&_blockquote]:ps-4",
          "[&_th]:border-line [&_th]:bg-bg-2 [&_th]:border [&_th]:px-3 [&_th]:py-2 [&_th]:text-start [&_th]:font-semibold",
          "[&_td]:border-line [&_hr]:border-line [&_hr]:my-4 [&_td]:border [&_td]:px-3 [&_td]:py-2",
          "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          className
        )}
      >
        <Markdown
          remarkPlugins={REMARK_PLUGINS}
          skipHtml
          urlTransform={safeUrl}
          components={COMPONENTS}
        >
          {content}
        </Markdown>
      </div>
    </RenderCodeContext.Provider>
  );
}
