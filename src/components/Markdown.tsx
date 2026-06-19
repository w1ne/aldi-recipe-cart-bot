import { useMemo } from "react";

// Tiny, dependency-free, XSS-safe markdown renderer for the assistant's short
// prose. Supports the subset the model actually emits: bold, italic, inline
// code, http(s) links, line breaks, and simple bullet lists. We escape the raw
// text FIRST, then inject only our own tags — so user/model content can never
// smuggle HTML.

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string): string {
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)([^*]+?)\*/g, "$1<em>$2</em>")
    .replace(/(^|[^\w_])_(?!\s)([^_]+?)_/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
}

export function mdToHtml(text: string): string {
  const lines = escapeHtml(text).split(/\r?\n/);
  let out = "";
  let inList = false;
  for (const raw of lines) {
    const bullet = raw.match(/^\s*[-*•]\s+(.*)$/);
    if (bullet) {
      if (!inList) {
        out += "<ul>";
        inList = true;
      }
      out += `<li>${inline(bullet[1])}</li>`;
    } else {
      if (inList) {
        out += "</ul>";
        inList = false;
      }
      out += raw.trim() ? `${inline(raw)}<br/>` : "";
    }
  }
  if (inList) out += "</ul>";
  return out.replace(/(<br\/>)+$/, "");
}

export default function Markdown({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => mdToHtml(text), [text]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
