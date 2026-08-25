"use client";

import { useState, useMemo } from "react";

interface RichContentProps {
  content: string;
}

/**
 * Renders rich Markdown blog content with:
 * - Table of Contents (auto-extracted from headers)
 * - Code blocks with copy button
 * - Callout boxes (tip, warning, note)
 * - Tables
 * - Numbered step lists
 * - Resource links
 */
export function RichContent({ content }: RichContentProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Parse content into segments
  const segments = useMemo(() => parseContent(content), [content]);

  // Extract TOC from content
  const toc = useMemo(() => extractTOC(content), [content]);

  const copyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="rich-content">
      {/* Table of Contents */}
      {toc.length > 0 && (
        <nav className="mb-8 p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <span className="text-base">📑</span> Table of Contents
          </h2>
          <ul className="space-y-1.5">
            {toc.map((item, i) => (
              <li key={i} style={{ paddingLeft: `${(item.level - 1) * 16}px` }}>
                <a
                  href={`#${slugify(item.text)}`}
                  className="text-sm text-[var(--accent-primary)] hover:underline transition-colors"
                >
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Rendered content */}
      {segments.map((seg, i) => (
        <ContentSegment key={i} segment={seg} copiedCode={copiedCode} copyCode={copyCode} />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CONTENT PARSER
// ═══════════════════════════════════════════════════════════════

type Segment =
  | { type: "h1"; text: string; id: string }
  | { type: "h2"; text: string; id: string }
  | { type: "h3"; text: string; id: string }
  | { type: "h4"; text: string; id: string }
  | { type: "paragraph"; text: string }
  | { type: "code"; language: string; code: string; id: string }
  | { type: "callout"; variant: "tip" | "warning" | "note" | "pro"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "orderedList"; items: string[] }
  | { type: "unorderedList"; items: string[] }
  | { type: "hr" }
  | { type: "blockquote"; text: string };

function parseContent(content: string): Segment[] {
  const lines = content.split("\n");
  const segments: Segment[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code blocks
    if (line.trim().startsWith("```")) {
      const lang = line.trim().replace("```", "").trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      segments.push({
        type: "code",
        language: lang || "text",
        code: codeLines.join("\n"),
        id: `code-${segments.length}`,
      });
      i++;
      continue;
    }

    // Headers
    if (line.startsWith("# ") && !line.startsWith("## ")) {
      segments.push({ type: "h1", text: line.replace(/^#\s+/, ""), id: slugify(line.replace(/^#\s+/, "")) });
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      segments.push({ type: "h2", text: line.replace(/^##\s+/, ""), id: slugify(line.replace(/^##\s+/, "")) });
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      segments.push({ type: "h3", text: line.replace(/^###\s+/, ""), id: slugify(line.replace(/^###\s+/, "")) });
      i++;
      continue;
    }
    if (line.startsWith("#### ")) {
      segments.push({ type: "h4", text: line.replace(/^####\s+/, ""), id: slugify(line.replace(/^####\s+/, "")) });
      i++;
      continue;
    }

    // Horizontal rule
    if (line.trim() === "---") {
      segments.push({ type: "hr" });
      i++;
      continue;
    }

    // Callout boxes
    if (line.startsWith("> ")) {
      const calloutLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        calloutLines.push(lines[i].replace(/^>\s*/, ""));
        i++;
      }
      const calloutText = calloutLines.join("\n");

      let variant: "tip" | "warning" | "note" | "pro" = "note";
      if (calloutText.includes("💡") || calloutText.toLowerCase().includes("tip")) variant = "tip";
      if (calloutText.includes("⚠️") || calloutText.toLowerCase().includes("warning")) variant = "warning";
      if (calloutText.includes("🚀") || calloutText.toLowerCase().includes("pro tip")) variant = "pro";

      segments.push({ type: "callout", variant, text: calloutText.replace(/^[💡⚠️ℹ️🚀]\s*\**(?:Tip|Warning|Note|Pro Tip):\**\s*/i, "").trim() });
      continue;
    }

    // Tables
    if (line.includes("|") && i + 1 < lines.length && lines[i + 1]?.includes("---")) {
      const headers = line.split("|").map((c) => c.trim()).filter(Boolean);
      i += 2; // skip header and separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) {
        rows.push(lines[i].split("|").map((c) => c.trim()).filter(Boolean));
        i++;
      }
      segments.push({ type: "table", headers, rows });
      continue;
    }

    // Ordered lists
    if (/^\d+\.\s/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      segments.push({ type: "orderedList", items });
      continue;
    }

    // Unordered lists
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* "))) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      segments.push({ type: "unorderedList", items });
      continue;
    }

    // Empty lines
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph — collect consecutive non-empty lines
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("#") && !lines[i].startsWith("```") && !lines[i].startsWith("> ") && !lines[i].startsWith("---") && !/^\d+\.\s/.test(lines[i].trim()) && !lines[i].trim().startsWith("- ") && !lines[i].trim().startsWith("* ")) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      segments.push({ type: "paragraph", text: paraLines.join(" ") });
    }
  }

  return segments;
}



// ═══════════════════════════════════════════════════════════════
// TOC EXTRACTOR
// ═══════════════════════════════════════════════════════════════

function extractTOC(content: string): { level: number; text: string }[] {
  const toc: { level: number; text: string }[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const match = line.match(/^(#{2,4})\s+(.+)/);
    if (match) {
      toc.push({
        level: match[1].length,
        text: match[2].replace(/[*_`]/g, ""),
      });
    }
  }

  return toc;
}

// ═══════════════════════════════════════════════════════════════
// CONTENT SEGMENT RENDERER
// ═══════════════════════════════════════════════════════════════

function ContentSegment({
  segment,
  copiedCode,
  copyCode,
}: {
  segment: Segment;
  copiedCode: string | null;
  copyCode: (code: string, id: string) => void;
}) {
  switch (segment.type) {
    case "h1":
      return (
        <h1 id={segment.id} className="text-3xl md:text-4xl font-extrabold text-[var(--text-primary)] mb-6 mt-2">
          {renderInlineMarkdown(segment.text)}
        </h1>
      );

    case "h2":
      return (
        <h2
          id={segment.id}
          className="text-2xl font-bold text-[var(--text-primary)] mb-4 mt-10 pb-2 border-b border-[var(--border-subtle)] scroll-mt-20"
        >
          {renderInlineMarkdown(segment.text)}
        </h2>
      );

    case "h3":
      return (
        <h3
          id={segment.id}
          className="text-xl font-bold text-[var(--text-primary)] mb-3 mt-8 scroll-mt-20"
        >
          {renderInlineMarkdown(segment.text)}
        </h3>
      );

    case "h4":
      return (
        <h4
          id={segment.id}
          className="text-lg font-semibold text-[var(--text-primary)] mb-2 mt-6 scroll-mt-20"
        >
          {renderInlineMarkdown(segment.text)}
        </h4>
      );

    case "paragraph":
      return (
        <p className="text-[var(--text-primary)] leading-relaxed mb-4 text-[15px]">
          {renderInlineMarkdown(segment.text)}
        </p>
      );

    case "code":
      return (
        <div className="my-4 rounded-xl overflow-hidden border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
            <span className="text-xs font-mono text-[var(--text-muted)]">{segment.language}</span>
            <button
              onClick={() => copyCode(segment.code, segment.id)}
              className="text-xs px-2 py-1 rounded-md hover:bg-[var(--bg-surface)] text-[var(--text-muted)] transition-colors"
            >
              {copiedCode === segment.id ? "✅ Copied" : "📋 Copy"}
            </button>
          </div>
          <pre className="p-4 overflow-x-auto bg-[var(--bg-base)] text-sm font-mono text-[var(--text-primary)] leading-relaxed">
            <code>{segment.code}</code>
          </pre>
        </div>
      );

    case "callout":
      return <CalloutBox variant={segment.variant} text={segment.text} />;

    case "table":
      return (
        <div className="my-6 overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--bg-elevated)]">
                {segment.headers.map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left font-semibold text-[var(--text-primary)] border-b border-[var(--border-subtle)]">
                    {renderInlineMarkdown(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {segment.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-[var(--border-subtle)] last:border-b-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-4 py-3 text-[var(--text-primary)]">
                      {renderInlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "orderedList":
      return (
        <ol className="my-4 space-y-2 ml-1">
          {segment.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-[15px] text-[var(--text-primary)]">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center text-xs font-bold mt-0.5">
                {i + 1}
              </span>
              <span className="leading-relaxed">{renderInlineMarkdown(item)}</span>
            </li>
          ))}
        </ol>
      );

    case "unorderedList":
      return (
        <ul className="my-4 space-y-1.5 ml-1">
          {segment.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-[15px] text-[var(--text-primary)]">
              <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] mt-2" />
              <span className="leading-relaxed">{renderInlineMarkdown(item)}</span>
            </li>
          ))}
        </ul>
      );

    case "hr":
      return <hr className="my-8 border-0 h-px bg-gradient-to-r from-transparent via-[var(--border-subtle)] to-transparent" />;

    case "blockquote":
      return (
        <blockquote className="my-4 pl-4 border-l-4 border-[var(--accent-primary)]/30 text-[var(--text-muted)] italic">
          {renderInlineMarkdown(segment.text)}
        </blockquote>
      );

    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// CALLOUT BOX
// ═══════════════════════════════════════════════════════════════

function CalloutBox({ variant, text }: { variant: "tip" | "warning" | "note" | "pro"; text: string }) {
  const styles = {
    tip: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: "💡", label: "Tip" },
    warning: { bg: "bg-amber-500/10", border: "border-amber-500/30", icon: "⚠️", label: "Warning" },
    note: { bg: "bg-blue-500/10", border: "border-blue-500/30", icon: "ℹ️", label: "Note" },
    pro: { bg: "bg-purple-500/10", border: "border-purple-500/30", icon: "🚀", label: "Pro Tip" },
  };
  const s = styles[variant];

  return (
    <div className={`my-4 p-4 rounded-xl ${s.bg} border ${s.border}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span>{s.icon}</span>
        <span className="text-sm font-bold text-[var(--text-primary)]">{s.label}</span>
      </div>
      <p className="text-sm text-[var(--text-primary)] leading-relaxed">
        {renderInlineMarkdown(text)}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// INLINE MARKDOWN RENDERER
// ═══════════════════════════════════════════════════════════════

function renderInlineMarkdown(text: string): React.ReactNode {
  // Simple inline markdown: bold, italic, code, links
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  // Process inline elements
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }

    if (match[1]) {
      // Bold
      parts.push(<strong key={key++} className="font-semibold">{match[2]}</strong>);
    } else if (match[3]) {
      // Italic
      parts.push(<em key={key++}>{match[4]}</em>);
    } else if (match[5]) {
      // Inline code
      parts.push(
        <code key={key++} className="px-1.5 py-0.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm font-mono">
          {match[6]}
        </code>
      );
    } else if (match[7]) {
      // Link
      parts.push(
        <a
          key={key++}
          href={match[9]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent-primary)] hover:underline"
        >
          {match[8]}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : text;
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
