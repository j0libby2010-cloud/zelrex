"use client";
import React from "react";

/**
 * ZELREX CHAT RENDERER
 * 
 * A complete markdown-to-React renderer designed for dark-theme chat interfaces.
 * Handles everything Claude/Sonnet outputs: headers, bold, italic, bullets,
 * numbered lists, tables, code blocks, links, dividers, and nested formatting.
 * 
 * Works with the Typewriter component for real-time rendering during streaming.
 */
export function formatMessage(content: string): React.ReactNode[] {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let codeBlock: { lines: string[]; lang: string } | null = null;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // ─── Code block ``` ─────────────────────────────────────────
    if (trimmed.startsWith("```")) {
      if (codeBlock === null) {
        const lang = trimmed.slice(3).trim();
        codeBlock = { lines: [], lang };
        i++;
        continue;
      } else {
        elements.push(
          <div key={`cb-${i}`} className="my-4 rounded-xl overflow-hidden border border-white/[0.08]">
            {codeBlock.lang && (
              <div className="px-4 py-2 bg-white/[0.04] border-b border-white/[0.06] text-[11px] font-mono text-white/40 uppercase tracking-wider">
                {codeBlock.lang}
              </div>
            )}
            <pre className="p-4 overflow-x-auto bg-white/[0.02] text-[13px] leading-[1.7] text-white/75 font-mono">
              <code>{codeBlock.lines.join("\n")}</code>
            </pre>
          </div>
        );
        codeBlock = null;
        i++;
        continue;
      }
    }
    if (codeBlock !== null) {
      codeBlock.lines.push(line);
      i++;
      continue;
    }

    // ─── Table detection ────────────────────────────────────────
    if (trimmed.includes("|") && trimmed.startsWith("|")) {
      const tableLines: string[] = [trimmed];
      let j = i + 1;
      while (j < lines.length && lines[j].trim().startsWith("|")) {
        tableLines.push(lines[j].trim());
        j++;
      }
      if (tableLines.length >= 2) {
        elements.push(renderTable(tableLines, i));
        i = j;
        continue;
      }
    }

    // ─── Divider --- or === or *** ──────────────────────────────
    if (/^[-=*]{3,}\s*$/.test(trimmed)) {
      elements.push(
        <div key={`hr-${i}`} className="my-8">
          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
        </div>
      );
      i++;
      continue;
    }

    // ─── Empty line ─────────────────────────────────────────────
    if (trimmed === "") {
      i++;
      continue;
    }

    // ─── Headers (check longest match first) ────────────────────
    const h4Match = trimmed.match(/^####\s+(.+)/);
    if (h4Match) {
      elements.push(
        <h4 key={`h4-${i}`} className="mt-4 mb-1.5 text-[14.5px] font-semibold text-white/90">
          {renderInline(h4Match[1])}
        </h4>
      );
      i++;
      continue;
    }

    const h3Match = trimmed.match(/^###\s+(.+)/);
    if (h3Match) {
      elements.push(
        <h3 key={`h3-${i}`} className="mt-6 mb-2 text-[15.5px] font-semibold tracking-tight text-white/95">
          {renderInline(h3Match[1])}
        </h3>
      );
      i++;
      continue;
    }

    const h2Match = trimmed.match(/^##\s+(.+)/);
    if (h2Match) {
      elements.push(
        <div key={`h2-${i}`} className="mt-8 mb-3">
          <h2 className="text-[17px] font-bold tracking-tight text-white leading-snug">
            {renderInline(h2Match[1])}
          </h2>
          <div className="mt-2 h-px bg-white/[0.08]" />
        </div>
      );
      i++;
      continue;
    }

    const h1Match = trimmed.match(/^#\s+(.+)/);
    if (h1Match) {
      elements.push(
        <h1 key={`h1-${i}`} className="mt-8 mb-3 text-[20px] font-bold tracking-tight text-white leading-snug">
          {renderInline(h1Match[1])}
        </h1>
      );
      i++;
      continue;
    }

    // ─── Bullet points (- or * at start of line) ────────────────
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      const bullets: string[] = [bulletMatch[1]];
      let j = i + 1;
      while (j < lines.length) {
        const bm = lines[j].trim().match(/^[-*]\s+(.+)/);
        if (bm) {
          bullets.push(bm[1]);
          j++;
        } else break;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-3 space-y-1.5">
          {bullets.map((b, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-[15px] leading-[1.75] text-white/80">
              <span className="mt-[11px] h-[4px] w-[4px] shrink-0 rounded-full bg-white/30" />
              <span className="flex-1">{renderInline(b)}</span>
            </li>
          ))}
        </ul>
      );
      i = j;
      continue;
    }

    // ─── Numbered list ──────────────────────────────────────────
    const numMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
    if (numMatch) {
      const items: { num: string; text: string }[] = [{ num: numMatch[1], text: numMatch[2] }];
      let j = i + 1;
      while (j < lines.length) {
        const nm = lines[j].trim().match(/^(\d+)[.)]\s+(.+)/);
        if (nm) {
          items.push({ num: nm[1], text: nm[2] });
          j++;
        } else break;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-3 space-y-1.5">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-[15px] leading-[1.75] text-white/80">
              <span className="mt-[1px] shrink-0 text-white/35 font-medium text-[14px] tabular-nums min-w-[20px] text-right">
                {item.num}.
              </span>
              <span className="flex-1">{renderInline(item.text)}</span>
            </li>
          ))}
        </ol>
      );
      i = j;
      continue;
    }

    // ─── Blockquote > ───────────────────────────────────────────
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [trimmed.replace(/^>\s*/, "")];
      let j = i + 1;
      while (j < lines.length && lines[j].trim().startsWith(">")) {
        quoteLines.push(lines[j].trim().replace(/^>\s*/, ""));
        j++;
      }
      elements.push(
        <blockquote
          key={`bq-${i}`}
          className="my-4 border-l-2 border-white/15 pl-4 text-[14.5px] leading-[1.75] text-white/55 italic"
        >
          {quoteLines.map((ql, idx) => (
            <p key={idx} className="my-1">{renderInline(ql)}</p>
          ))}
        </blockquote>
      );
      i = j;
      continue;
    }

    // ─── Regular paragraph ──────────────────────────────────────
    elements.push(
      <p key={`p-${i}`} className="my-2 text-[15px] leading-[1.8] text-white/80">
        {renderInline(trimmed)}
      </p>
    );
    i++;
  }

  // Unclosed code block
  if (codeBlock !== null && codeBlock.lines.length > 0) {
    elements.push(
      <div key="cb-unclosed" className="my-4 rounded-xl overflow-hidden border border-white/[0.08]">
        <pre className="p-4 overflow-x-auto bg-white/[0.02] text-[13px] leading-[1.7] text-white/75 font-mono">
          <code>{codeBlock.lines.join("\n")}</code>
        </pre>
      </div>
    );
  }

  return elements;
}

// ═══════════════════════════════════════════════════════════════════════
// TABLE RENDERER
// ═══════════════════════════════════════════════════════════════════════

function renderTable(lines: string[], keyBase: number): React.ReactNode {
  const parseRow = (line: string) =>
    line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

  const hasSeparator =
    lines.length >= 2 && /^[\s|:-]+$/.test(lines[1]);

  const headerCells = parseRow(lines[0]);
  const dataStartIdx = hasSeparator ? 2 : 1;
  const dataRows = lines.slice(dataStartIdx).map(parseRow);

  return (
    <div key={`tbl-${keyBase}`} className="my-5 overflow-x-auto rounded-xl border border-white/[0.08]">
      <table className="w-full text-[13.5px]">
        {hasSeparator && (
          <thead>
            <tr className="border-b border-white/[0.08] bg-white/[0.03]">
              {headerCells.map((cell, ci) => (
                <th
                  key={ci}
                  className="px-4 py-2.5 text-left text-[12px] font-semibold text-white/50 uppercase tracking-wider"
                >
                  {renderInline(cell)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {(hasSeparator ? dataRows : [headerCells, ...dataRows]).map(
            (row, ri) => (
              <tr
                key={ri}
                className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="px-4 py-2.5 text-white/70 leading-relaxed"
                  >
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// INLINE RENDERER
// ═══════════════════════════════════════════════════════════════════════

function renderInline(text: string): React.ReactNode {
  if (!text) return null;

  const tokens: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    let earliestIdx = remaining.length;
    let matchType: string | null = null;
    let matchData: any = null;

    // Bold **text**
    const boldIdx = remaining.indexOf("**");
    if (boldIdx !== -1) {
      const endBold = remaining.indexOf("**", boldIdx + 2);
      if (endBold !== -1 && boldIdx < earliestIdx) {
        earliestIdx = boldIdx;
        matchType = "bold";
        matchData = { end: endBold + 2, content: remaining.slice(boldIdx + 2, endBold) };
      }
    }

    // Italic *text* (single asterisk, not double)
    if (matchType !== "bold" || earliestIdx > 0) {
      const italicRegex = /(?<!\*)\*(?!\*|\s)(.+?)(?<!\*|\s)\*(?!\*)/;
      const italicMatch = remaining.match(italicRegex);
      if (italicMatch && italicMatch.index !== undefined && italicMatch.index < earliestIdx) {
        earliestIdx = italicMatch.index;
        matchType = "italic";
        matchData = { end: italicMatch.index + italicMatch[0].length, content: italicMatch[1] };
      }
    }

    // Inline code `text`
    const codeIdx = remaining.indexOf("`");
    if (codeIdx !== -1 && codeIdx < earliestIdx) {
      const endCode = remaining.indexOf("`", codeIdx + 1);
      if (endCode !== -1) {
        earliestIdx = codeIdx;
        matchType = "code";
        matchData = { end: endCode + 1, content: remaining.slice(codeIdx + 1, endCode) };
      }
    }

    // Markdown link [text](url)
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/;
    const linkMatch = remaining.match(linkRegex);
    if (linkMatch && linkMatch.index !== undefined && linkMatch.index < earliestIdx) {
      earliestIdx = linkMatch.index;
      matchType = "link";
      matchData = { end: linkMatch.index + linkMatch[0].length, text: linkMatch[1], url: linkMatch[2] };
    }

    // Bare URL (only if not already caught by link pattern)
    if (matchType !== "link") {
      const urlRegex = /https?:\/\/[^\s)>\]]+/;
      const urlMatch = remaining.match(urlRegex);
      if (urlMatch && urlMatch.index !== undefined && urlMatch.index < earliestIdx) {
        earliestIdx = urlMatch.index;
        matchType = "url";
        matchData = { end: urlMatch.index + urlMatch[0].length, url: urlMatch[0] };
      }
    }

    // No match — push rest
    if (matchType === null) {
      tokens.push(<React.Fragment key={key++}>{remaining}</React.Fragment>);
      break;
    }

    // Text before match
    if (earliestIdx > 0) {
      tokens.push(<React.Fragment key={key++}>{remaining.slice(0, earliestIdx)}</React.Fragment>);
    }

    switch (matchType) {
      case "bold": {
        const actionPhrases = ["build my website", "connect stripe", "deploy", "go live", "evaluate my market"];
        const isAction = actionPhrases.some(p => matchData.content.toLowerCase() === p);
        if (isAction) {
          tokens.push(
            <button
              key={key++}
              onClick={() => {
                // Find the chat input and set its value, then trigger send
                const input = document.querySelector('textarea') as HTMLTextAreaElement | null;
                if (input) {
                  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
                  nativeInputValueSetter?.call(input, matchData.content);
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  // Find and click the send button
                  setTimeout(() => {
                    const sendBtn = input.closest('div')?.parentElement?.querySelector('button[aria-label="Send"]') as HTMLButtonElement | null;
                    if (sendBtn) sendBtn.click();
                  }, 50);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[13px] font-semibold cursor-pointer transition-all duration-150"
              style={{
                background: 'rgba(74,144,255,0.12)',
                border: '1px solid rgba(74,144,255,0.25)',
                color: '#6B9FFF',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(74,144,255,0.2)'; e.currentTarget.style.borderColor = 'rgba(74,144,255,0.4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(74,144,255,0.12)'; e.currentTarget.style.borderColor = 'rgba(74,144,255,0.25)'; }}
            >
              {matchData.content} →
            </button>
          );
        } else {
          tokens.push(
            <strong key={key++} className="font-semibold text-white">
              {renderInline(matchData.content)}
            </strong>
          );
        }
        remaining = remaining.slice(matchData.end);
        continue;
      }

      case "italic":
        tokens.push(
          <em key={key++} className="italic text-white/65">
            {renderInline(matchData.content)}
          </em>
        );
        remaining = remaining.slice(matchData.end);
        continue;

      case "code":
        tokens.push(
          <code
            key={key++}
            className="rounded-md bg-white/[0.07] px-1.5 py-[2px] text-[13px] font-mono text-[#A5B4FC]"
          >
            {matchData.content}
          </code>
        );
        remaining = remaining.slice(matchData.end);
        continue;

      case "link":
        tokens.push(
          <a
            key={key++}
            href={matchData.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#6B9FFF] underline decoration-[#6B9FFF]/25 underline-offset-2 hover:decoration-[#6B9FFF]/60 transition-colors"
          >
            {matchData.text}
          </a>
        );
        remaining = remaining.slice(matchData.end);
        continue;

      case "url":
        tokens.push(
          <a
            key={key++}
            href={matchData.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#6B9FFF] underline decoration-[#6B9FFF]/25 underline-offset-2 hover:decoration-[#6B9FFF]/60 transition-colors break-all"
          >
            {matchData.url}
          </a>
        );
        remaining = remaining.slice(matchData.end);
        continue;
    }
  }

  return <>{tokens}</>;
}
