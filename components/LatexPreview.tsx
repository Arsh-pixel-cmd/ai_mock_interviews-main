"use client";

import React, { forwardRef, useMemo } from "react";

interface LatexPreviewProps {
  latex: string;
  zoom?: number;
  editable?: boolean;
}

export type ParsedItem =
  | {
      type: "table";
      alignments?: ("left" | "right" | "center")[];
      rows: string[][];
    }
  | {
      type: "entry";
      left: string;
      right?: string;
      subtitle?: string;
      subRight?: string;
      bullets: string[];
    }
  | {
      type: "bullet_list";
      bullets: string[];
    }
  | {
      type: "line";
      left: string;
      right?: string;
    };

export interface ParsedSection {
  title: string;
  items: ParsedItem[];
}

/**
 * Extracts balanced brace contents starting at startIndex (where str[startIndex] === '{')
 */
function getBalancedBraceContent(str: string, startIndex: number): { content: string; endIndex: number } | null {
  if (str[startIndex] !== "{") return null;
  let depth = 0;
  for (let i = startIndex; i < str.length; i++) {
    if (str[i] === "{" && (i === 0 || str[i - 1] !== "\\")) {
      depth++;
    } else if (str[i] === "}" && (i === 0 || str[i - 1] !== "\\")) {
      depth--;
      if (depth === 0) {
        return { content: str.slice(startIndex + 1, i), endIndex: i };
      }
    }
  }
  return null;
}

/**
 * Cleanly unescapes common LaTeX special characters and strips layout macros
 */
function cleanLatexText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\\%/g, "%")
    .replace(/\\&/g, "&")
    .replace(/\\\$/g, "$")
    .replace(/\\#/g, "#")
    .replace(/\\_/g, "_")
    .replace(/\\\{/g, "{")
    .replace(/\\\}/g, "}")
    .replace(/\\~/g, "~")
    .replace(/---/g, "—")
    .replace(/--/g, "–")
    .replace(/\$\|\$/g, "|")
    .replace(/\$\s*\\mid\s*\$/g, "|")
    .replace(/\\textbar/g, "|")
    .replace(/\\textbullet|\$\\bullet\$/g, "•")
    .replace(/\\([a-zA-Z]+)\*?(?:\[[^\]]*\])?(?:\{[^}]*\})?/g, (match, cmd) => {
      if (
        [
          "vspace",
          "hspace",
          "setlength",
          "addtolength",
          "pagestyle",
          "thispagestyle",
          "titleformat",
          "titlespacing",
          "color",
          "textcolor",
          "urlstyle",
          "tabcolsep",
          "scshape",
          "itshape",
          "bfseries",
          "centering",
          "raggedright",
          "raggedbottom",
          "raggedleft",
          "noindent",
          "titlerule",
          "hrule",
          "rule",
          "small",
          "footnotesize",
          "scriptsize",
          "large",
          "Large",
          "LARGE",
          "huge",
          "Huge",
          "normalsize",
        ].includes(cmd)
      ) {
        return "";
      }
      return match;
    })
    .replace(/\\(?:\s+|$)/g, " ")
    .replace(/[{}]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Strips vertical/horizontal spacing and layout annotations that should not appear in resume text
 */
function cleanLayoutSpaces(str: string): string {
  if (!str) return "";
  return str
    .replace(/\\(?:vspace|hspace)\*?(?:\s*\[[^\]]*\])?\s*\{[^}]*\}/g, "")
    .replace(/\\(?:vspace|hspace)\*?(?:\s*\[[^\]]*\])?/g, "")
    .replace(/\\(?:smallskip|medskip|bigskip|noindent)\b/g, "")
    .trim();
}

type InlineToken =
  | { type: "text"; value: string; superscript?: boolean; subscript?: boolean }
  | { type: "href"; url: string; children: InlineToken[] }
  | { type: "bold"; children: InlineToken[] }
  | { type: "italic"; children: InlineToken[] }
  | { type: "underline"; children: InlineToken[] }
  | { type: "code"; value: string }
  | { type: "pipe" }
  | { type: "newline" };

/**
 * Tokenizes inline LaTeX formatting with full balanced-brace handling,
 * multi-line href support, font weight, math superscripts, and spacing removal.
 */
function tokenizeInlineLatex(text: string): InlineToken[] {
  if (!text) return [];

  // Remove comment lines
  const clean = text.replace(/^[ \t]*%.*$/gm, "").trim();
  const tokens: InlineToken[] = [];
  let i = 0;
  let currentText = "";

  const flushText = () => {
    if (currentText) {
      // Process escaped chars & symbols in text
      const cleaned = currentText
        .replace(/\\%/g, "%")
        .replace(/\\&/g, "&")
        .replace(/\\\$/g, "$")
        .replace(/\\#/g, "#")
        .replace(/\\_/g, "_")
        .replace(/\\\{/g, "{")
        .replace(/\\\}/g, "}")
        .replace(/\\~/g, "~")
        .replace(/---/g, "—")
        .replace(/--/g, "–")
        .replace(/\\textbullet|\$\\bullet\$/g, "•")
        .replace(/\\([,;:!])/g, " ")
        .replace(/\\quad|\\qquad|\\enspace/g, " ")
        .replace(
          /\\(?:small|footnotesize|scriptsize|large|Large|LARGE|Huge|huge|scshape|itshape|bfseries|noindent|centering|raggedright|raggedbottom|raggedleft)\b/g,
          ""
        )
        .replace(/\\(?:vspace|hspace)\*?(?:\s*\[[^\]]*\])?\s*\{[^}]*\}/g, "")
        .replace(/\\(?:vspace|hspace)\*?(?:\s*\[[^\]]*\])?/g, "")
        .replace(/\\(?:\s+|$)/g, " ")
        .replace(/[{}]/g, "")
        .replace(/\\\s*/g, " ");

      if (cleaned.length > 0) {
        tokens.push({ type: "text", value: cleaned });
      }
      currentText = "";
    }
  };

  while (i < clean.length) {
    // 0. Layout macros to strip with arguments: \vspace{...}, \hspace{...}
    const layoutMatch = clean.slice(i).match(/^\\(?:vspace|hspace)\*?(?:\s*\[[^\]]*\])?\s*\{[^}]*\}/);
    if (layoutMatch) {
      flushText();
      i += layoutMatch[0].length;
      continue;
    }

    // 1. \href{url}{label} - supports any whitespace/newlines between href, {url}, and {label}
    const hrefMatch = clean.slice(i).match(/^\\href\s*\{/);
    if (hrefMatch) {
      const firstBraceIdx = i + hrefMatch[0].length - 1;
      const urlPart = getBalancedBraceContent(clean, firstBraceIdx);
      if (urlPart) {
        // Look ahead for optional whitespace/newlines followed by second '{'
        const afterUrl = clean.slice(urlPart.endIndex + 1);
        const nextBraceMatch = afterUrl.match(/^\s*\{/);
        if (nextBraceMatch) {
          const secondBraceIdx = urlPart.endIndex + 1 + nextBraceMatch[0].length - 1;
          const labelPart = getBalancedBraceContent(clean, secondBraceIdx);
          if (labelPart) {
            flushText();
            tokens.push({
              type: "href",
              url: urlPart.content.trim(),
              children: tokenizeInlineLatex(labelPart.content),
            });
            i = labelPart.endIndex + 1;
            continue;
          }
        }
        // Fallback: single argument \href{url}
        flushText();
        tokens.push({
          type: "href",
          url: urlPart.content.trim(),
          children: [{ type: "text", value: urlPart.content.trim() }],
        });
        i = urlPart.endIndex + 1;
        continue;
      }
    }

    // 2. \url{url}
    const urlMatch = clean.slice(i).match(/^\\url\s*\{/);
    if (urlMatch) {
      const firstBraceIdx = i + urlMatch[0].length - 1;
      const part = getBalancedBraceContent(clean, firstBraceIdx);
      if (part) {
        flushText();
        tokens.push({
          type: "href",
          url: part.content.trim(),
          children: [{ type: "text", value: part.content.trim() }],
        });
        i = part.endIndex + 1;
        continue;
      }
    }

    // 3. \textbf{...}
    const boldMatch = clean.slice(i).match(/^\\textbf\s*\{/);
    if (boldMatch) {
      const braceIdx = i + boldMatch[0].length - 1;
      const part = getBalancedBraceContent(clean, braceIdx);
      if (part) {
        flushText();
        tokens.push({
          type: "bold",
          children: tokenizeInlineLatex(part.content),
        });
        i = part.endIndex + 1;
        continue;
      }
    }

    // 4. \textit{...} or \emph{...}
    const italicMatch = clean.slice(i).match(/^\\(?:textit|emph)\s*\{/);
    if (italicMatch) {
      const braceIdx = i + italicMatch[0].length - 1;
      const part = getBalancedBraceContent(clean, braceIdx);
      if (part) {
        flushText();
        tokens.push({
          type: "italic",
          children: tokenizeInlineLatex(part.content),
        });
        i = part.endIndex + 1;
        continue;
      }
    }

    // 5. \underline{...}
    const underMatch = clean.slice(i).match(/^\\underline\s*\{/);
    if (underMatch) {
      const braceIdx = i + underMatch[0].length - 1;
      const part = getBalancedBraceContent(clean, braceIdx);
      if (part) {
        flushText();
        tokens.push({
          type: "underline",
          children: tokenizeInlineLatex(part.content),
        });
        i = part.endIndex + 1;
        continue;
      }
    }

    // 6. \texttt{...}
    const codeMatch = clean.slice(i).match(/^\\texttt\s*\{/);
    if (codeMatch) {
      const braceIdx = i + codeMatch[0].length - 1;
      const part = getBalancedBraceContent(clean, braceIdx);
      if (part) {
        flushText();
        tokens.push({
          type: "code",
          value: part.content,
        });
        i = part.endIndex + 1;
        continue;
      }
    }

    // 6b. \textsuperscript{...} and \textsubscript{...}
    if (clean.startsWith("\\textsuperscript", i) || clean.startsWith("\\textsubscript", i)) {
      const isSup = clean.startsWith("\\textsuperscript", i);
      const cmdLen = isSup ? 16 : 14;
      const afterCmd = clean.slice(i + cmdLen);
      const braceIdx = afterCmd.indexOf("{");
      if (braceIdx !== -1 && braceIdx <= 2) {
        const part = getBalancedBraceContent(clean, i + cmdLen + braceIdx);
        if (part) {
          flushText();
          tokens.push({
            type: "text",
            value: part.content,
            superscript: isSup,
            subscript: !isSup,
          });
          i = part.endIndex + 1;
          continue;
        }
      } else {
        const wordMatch = afterCmd.match(/^\s*([a-zA-Z0-9]+)/);
        if (wordMatch) {
          flushText();
          tokens.push({
            type: "text",
            value: wordMatch[1],
            superscript: isSup,
            subscript: !isSup,
          });
          i += cmdLen + wordMatch[0].length;
          continue;
        }
      }
    }

    // 6c. Math mode superscripts/subscripts: $^{th}$ or $_{...}$ or ^{th}
    const mathSupSub = clean.slice(i).match(/^(\$?[\^_]\{([^}]+)\}\$?|\$?[\^_]([a-zA-Z0-9]+)\$?)/);
    if (mathSupSub) {
      flushText();
      const isSup = mathSupSub[0].includes("^");
      const val = (mathSupSub[2] || mathSupSub[3] || "").replace(/\\text\{([^}]+)\}/, "$1");
      tokens.push({
        type: "text",
        value: val,
        superscript: isSup,
        subscript: !isSup,
      });
      i += mathSupSub[0].length;
      continue;
    }

    // 7. Pipe separators ($|$, $\mid$, \textbar, |)
    if (
      clean.startsWith("$|$", i) ||
      clean.startsWith("$\\mid$", i) ||
      clean.startsWith("\\textbar", i)
    ) {
      flushText();
      tokens.push({ type: "pipe" });
      i += clean.startsWith("\\textbar", i) ? 8 : clean.startsWith("$\\mid$", i) ? 6 : 3;
      continue;
    }

    // 8. Line breaks \\ (with optional [Xpt] spacing)
    if (clean.startsWith("\\\\", i)) {
      flushText();
      tokens.push({ type: "newline" });
      i += 2;
      const afterBreak = clean.slice(i).match(/^\s*\[[^\]]*\]/);
      if (afterBreak) {
        i += afterBreak[0].length;
      }
      continue;
    }

    // 9. Handle bare brace groups {content} — recursively tokenize inner content
    if (clean[i] === "{") {
      const part = getBalancedBraceContent(clean, i);
      if (part) {
        flushText();
        const innerTokens = tokenizeInlineLatex(part.content);
        tokens.push(...innerTokens);
        i = part.endIndex + 1;
        continue;
      }
    }

    // 10. Skip stray closing braces
    if (clean[i] === "}") {
      flushText();
      i++;
      continue;
    }

    // Append char
    currentText += clean[i];
    i++;
  }

  flushText();
  return tokens;
}

/**
 * Converts inline tokens to React JSX nodes
 */
function renderTokensToReact(tokens: InlineToken[], keyPrefix = "tok"): React.ReactNode[] {
  return tokens.map((token, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (token.type) {
      case "text": {
        if (token.superscript) return <sup key={key} className="text-[0.7em]">{token.value}</sup>;
        if (token.subscript) return <sub key={key} className="text-[0.7em]">{token.value}</sub>;
        return <span key={key}>{token.value}</span>;
      }
      case "bold":
        return (
          <strong key={key} className="font-bold text-gray-950 font-serif">
            {renderTokensToReact(token.children, `${key}-b`)}
          </strong>
        );
      case "italic":
        return (
          <em key={key} className="italic text-gray-800">
            {renderTokensToReact(token.children, `${key}-i`)}
          </em>
        );
      case "underline":
        return (
          <span key={key} className="underline decoration-gray-400 underline-offset-2">
            {renderTokensToReact(token.children, `${key}-u`)}
          </span>
        );
      case "code":
        return (
          <code key={key} className="font-mono text-[10px] bg-gray-100 px-1 py-0.5 rounded text-gray-800">
            {token.value}
          </code>
        );
      case "href": {
        const url = token.url.startsWith("http") || token.url.startsWith("mailto:")
          ? token.url
          : `https://${token.url}`;
        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 hover:text-blue-900 hover:underline transition-colors cursor-pointer"
          >
            {renderTokensToReact(token.children, `${key}-a`)}
          </a>
        );
      }
      case "pipe":
        return (
          <span key={key} className="mx-1.5 text-gray-400 font-light select-none">
            |
          </span>
        );
      case "newline":
        return <br key={key} />;
      default:
        return null;
    }
  });
}

function renderInlineLatex(text: string): React.ReactNode {
  if (!text) return null;
  const tokens = tokenizeInlineLatex(text);
  return renderTokensToReact(tokens);
}

/**
 * Extracts all table environments (tabular, tabular*, tabularx, tabulary)
 */
function extractTables(content: string) {
  const tableRegex = /\\begin\{(tabular[xy*]?)\}([\s\S]*?)\\end\{\1\}/g;
  const tables: {
    fullMatch: string;
    startIndex: number;
    endIndex: number;
    alignments: ("left" | "right" | "center")[];
    rows: string[][];
  }[] = [];
  let m: RegExpExecArray | null;

  while ((m = tableRegex.exec(content)) !== null) {
    const full = m[0];
    const bodyAndArgs = m[2];

    // Find the column spec: in tabular{spec}, or tabularx{\textwidth}{spec}
    let p = 0;
    const braceGroups: string[] = [];
    while (p < bodyAndArgs.length) {
      while (p < bodyAndArgs.length && /\s/.test(bodyAndArgs[p])) p++;
      if (bodyAndArgs[p] === "{") {
        const bg = getBalancedBraceContent(bodyAndArgs, p);
        if (bg) {
          braceGroups.push(bg.content);
          p = bg.endIndex + 1;
          continue;
        }
      }
      break;
    }

    const colSpecRaw = braceGroups.length > 0 ? braceGroups[braceGroups.length - 1] : "";
    const tableBody = bodyAndArgs.slice(p);

    // Parse colSpec to determine column alignments
    const alignments: ("left" | "right" | "center")[] = [];
    const cleanSpec = colSpecRaw.replace(/@\{[^}]*\}/g, "");
    let sIdx = 0;
    while (sIdx < cleanSpec.length) {
      const ch = cleanSpec[sIdx];
      if (ch === "r") {
        alignments.push("right");
        sIdx++;
      } else if (ch === "c") {
        alignments.push("center");
        sIdx++;
      } else if (ch === "l" || ch === "X") {
        alignments.push("left");
        sIdx++;
      } else if (ch === "p" || ch === "m" || ch === "b") {
        alignments.push("left");
        sIdx++;
        if (cleanSpec[sIdx] === "{") {
          const bg = getBalancedBraceContent(cleanSpec, sIdx);
          if (bg) sIdx = bg.endIndex + 1;
        }
      } else {
        sIdx++;
      }
    }

    const rawRows = tableBody
      .split(/\\\\(?:\s*\[[^\]]*\])?/)
      .map((r) => r.trim())
      .filter((r) => {
        const cleaned = r.replace(/\\(?:hline|toprule|midrule|bottomrule|cline\{[^}]*\})/g, "").trim();
        return cleaned.length > 0;
      });

    const parsedRows: string[][] = [];
    for (const rawRow of rawRows) {
      const cleanRow = rawRow.replace(/\\(?:hline|toprule|midrule|bottomrule|cline\{[^}]*\})/g, "").trim();
      if (!cleanRow) continue;
      const cells = cleanRow.split("&").map((c) => c.trim());
      parsedRows.push(cells);
    }

    tables.push({
      fullMatch: full,
      startIndex: m.index,
      endIndex: m.index + full.length,
      alignments,
      rows: parsedRows,
    });
  }
  return tables;
}

/**
 * Parses raw section LaTeX content into structured items:
 * - Table items
 * - Entry items (with left, right, subtitle, subRight, bullets)
 * - Direct bullet list items
 * - Line items (for skills or single notes)
 */
function parseSectionContent(rawContent: string): ParsedItem[] {
  let text = rawContent.replace(/^[ \t]*%.*$/gm, "").trim();

  // Normalize standard Overleaf / Jake's resume macros
  text = text
    .replace(/\\resumeSubHeadingListStart/g, "")
    .replace(/\\resumeSubHeadingListEnd/g, "")
    .replace(/\\resumeItemListStart/g, "\\begin{itemize}")
    .replace(/\\resumeItemListEnd/g, "\\end{itemize}")
    .replace(/\\resumeItem\{/g, "\\item ")
    .replace(
      /\\resumeSubheading\{([^}]+)\}\{([^}]+)\}\{([^}]+)\}\{([^}]+)\}/g,
      "\\textbf{$1} \\hfill {$2}\\\\\n{$3} \\hfill {$4}"
    )
    .replace(/\\resumeProjectHeading\{([^}]+)\}\{([^}]+)\}/g, "$1 \\hfill {$2}");

  const items: ParsedItem[] = [];

  // 1. Extract tables first
  const tables = extractTables(text);
  if (tables.length > 0) {
    let cursor = 0;
    for (const tbl of tables) {
      if (tbl.startIndex > cursor) {
        const preTableText = text.slice(cursor, tbl.startIndex).trim();
        if (preTableText) {
          items.push(...parseNonTableSectionContent(preTableText));
        }
      }
      items.push({
        type: "table",
        alignments: tbl.alignments,
        rows: tbl.rows,
      });
      cursor = tbl.endIndex;
    }
    if (cursor < text.length) {
      const postTableText = text.slice(cursor).trim();
      if (postTableText) {
        items.push(...parseNonTableSectionContent(postTableText));
      }
    }
    return items;
  }

  return parseNonTableSectionContent(text);
}

/**
 * Parses non-table content into entries, bullet lists, or lines
 */
function parseNonTableSectionContent(text: string): ParsedItem[] {
  const items: ParsedItem[] = [];

  // Check if outer text is wrapped in \begin{itemize}[...] where each \item has a nested \begin{itemize} (Jake's resume pattern)
  const outerItemizeMatch = text.match(
    /^\s*\\begin\{itemize\}(?:\[(?:[^\[\]]*|\{[^}]*\})*\])?([\s\S]*)\\end\{itemize\}\s*$/
  );

  if (outerItemizeMatch) {
    const innerContent = outerItemizeMatch[1];
    // Does innerContent contain a nested \begin{itemize}?
    if (innerContent.includes("\\begin{itemize}")) {
      const topLevelEntries = splitOuterItemize(innerContent);
      for (const entry of topLevelEntries) {
        items.push(entry);
      }
      return items;
    }

    // Outer itemize without nested itemize (e.g. Education or Skills in Jake's resume, or Achievements in standard resumes)
    const rawItems = innerContent
      .split(/\\item\b/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // If items are bullet points (e.g. Achievements, Coursework) rather than skill key-values or job entries
    const isSkillsOrKeyVal = rawItems.some((it) =>
      /\\textbf\{[^}]+:\s*\}|\\textbf\{[^}]+\}\s*\{:\s*|\b(?:Languages|Frameworks|Databases|Tools|Developer Tools)\b/i.test(it)
    );
    const hasAnyHfill = rawItems.some((it) => it.includes("\\hfill"));

    if (!isSkillsOrKeyVal && !hasAnyHfill) {
      const bullets = rawItems
        .map((it) => cleanLayoutSpaces(it.replace(/^\\small\{/g, "").replace(/\}[ \t]*$/g, "")))
        .filter((it) => it.length > 0 && it !== "}" && it !== "}}");

      if (bullets.length > 0) {
        items.push({
          type: "bullet_list",
          bullets,
        });
        return items;
      }
    }

    for (const rawItem of rawItems) {
      const cleanItem = rawItem
        .replace(/^\\small\{/g, "")
        .replace(/\}[ \t]*$/g, "")
        .trim();

      const lines = cleanItem
        .split(/\\\\(?:\s*\[[^\]]*\])?/)
        .map((l) => cleanLayoutSpaces(l))
        .filter((l) => l.length > 0 && l !== "}" && l !== "}}");

      if (lines.length > 1) {
        if (lines[0].includes("\\hfill")) {
          // Entry
          let left = lines[0];
          let right = "";
          const parts = lines[0].split("\\hfill");
          left = parts[0].trim();
          right = parts.slice(1).join(" ").trim();

          let subtitle = lines[1].trim();
          let subRight: string | undefined = undefined;
          if (lines[1].includes("\\hfill")) {
            const p2 = lines[1].split("\\hfill");
            subtitle = p2[0].trim();
            subRight = p2.slice(1).join(" ").trim();
          }

          items.push({
            type: "entry",
            left,
            right: right || undefined,
            subtitle: subtitle || undefined,
            subRight: subRight || undefined,
            bullets: lines.slice(2),
          });
        } else {
          // Multiple lines like in Skills
          for (const line of lines) {
            let left = line;
            let right = "";
            if (line.includes("\\hfill")) {
              const p = line.split("\\hfill");
              left = p[0].trim();
              right = p.slice(1).join(" ").trim();
            }
            items.push({
              type: "line",
              left,
              right: right || undefined,
            });
          }
        }
      } else if (lines.length === 1) {
        let left = lines[0];
        let right = "";
        if (lines[0].includes("\\hfill")) {
          const p = lines[0].split("\\hfill");
          left = p[0].trim();
          right = p.slice(1).join(" ").trim();
        }
        items.push({
          type: "line",
          left,
          right: right || undefined,
        });
      }
    }
    return items;
  }

  // Flat pattern (User's resume pattern)
  // Segment by \begin{itemize} ... \end{itemize}
  const itemizeRegex = /\\begin\{itemize\}(?:\[(?:[^\[\]]*|\{[^}]*\})*\])?([\s\S]*?)\\end\{itemize\}/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = itemizeRegex.exec(text)) !== null) {
    const preText = cleanLayoutSpaces(text.slice(lastIndex, match.index));
    const itemizeBody = match[1];

    const rawBullets = itemizeBody
      .split(/\\item\b/)
      .map((it) => it.trim())
      .filter((it) => it.length > 0);

    if (preText) {
      const lines = preText
        .split(/\\\\(?:\s*\[[^\]]*\])?/)
        .map((l) => cleanLayoutSpaces(l))
        .filter((l) => l.length > 0);

      if (lines.length >= 1) {
        let left = lines[0];
        let right = "";
        if (lines[0].includes("\\hfill")) {
          const parts = lines[0].split("\\hfill");
          left = parts[0].trim();
          right = parts.slice(1).join(" ").trim();
        }

        let subtitle: string | undefined = undefined;
        let subRight: string | undefined = undefined;
        if (lines.length >= 2) {
          if (lines[1].includes("\\hfill")) {
            const parts = lines[1].split("\\hfill");
            subtitle = parts[0].trim();
            subRight = parts.slice(1).join(" ").trim();
          } else {
            subtitle = lines[1].trim();
          }
        }

        items.push({
          type: "entry",
          left,
          right: right || undefined,
          subtitle: subtitle || undefined,
          subRight: subRight || undefined,
          bullets: rawBullets,
        });
      }
    } else {
      items.push({
        type: "bullet_list",
        bullets: rawBullets,
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const trailingText = cleanLayoutSpaces(text.slice(lastIndex));
    if (trailingText) {
      const lines = trailingText
        .split(/\\\\(?:\s*\[[^\]]*\])?/)
        .map((l) => cleanLayoutSpaces(l))
        .filter((l) => l.length > 0);

      for (const line of lines) {
        let left = line;
        let right = "";
        if (line.includes("\\hfill")) {
          const parts = line.split("\\hfill");
          left = parts[0].trim();
          right = parts.slice(1).join(" ").trim();
        }
        items.push({
          type: "line",
          left,
          right: right || undefined,
        });
      }
    }
  }

  return items;
}

/**
 * Finds each \item at outer level in a nested itemize, capturing its header and inner \begin{itemize} bullets
 */
function splitOuterItemize(innerContent: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const tokenRegex = /(\\begin\{itemize\}(?:\[(?:[^\[\]]*|\{[^}]*\})*\])?|\\end\{itemize\}|\\item\b)/g;
  let depth = 0;
  let currentItemText = "";
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  const entriesRaw: { header: string; bullets: string[] }[] = [];
  let currentEntryHeader = "";
  let currentEntryBullets: string[] = [];

  while ((m = tokenRegex.exec(innerContent)) !== null) {
    const preceding = innerContent.slice(lastIdx, m.index);
    if (depth === 0) {
      currentEntryHeader += preceding;
    } else {
      currentItemText += preceding;
    }

    const tok = m[1];
    if (tok.startsWith("\\begin{itemize}")) {
      depth++;
      if (depth > 1) currentItemText += tok;
    } else if (tok === "\\end{itemize}") {
      depth--;
      if (depth === 0) {
        // End of inner itemize
        const bullets = currentItemText
          .split(/\\item\b/)
          .map((b) => b.trim())
          .filter((b) => b.length > 0);
        currentEntryBullets = bullets;
        currentItemText = "";
      } else {
        currentItemText += tok;
      }
    } else if (tok === "\\item") {
      if (depth === 0) {
        // New top-level entry starts
        if (currentEntryHeader.trim() || currentEntryBullets.length > 0) {
          entriesRaw.push({ header: currentEntryHeader.trim(), bullets: currentEntryBullets });
          currentEntryHeader = "";
          currentEntryBullets = [];
        }
      } else {
        currentItemText += tok;
      }
    }
    lastIdx = m.index + m[0].length;
  }

  const trailing = innerContent.slice(lastIdx);
  if (depth === 0) {
    currentEntryHeader += trailing;
  }
  if (currentEntryHeader.trim() || currentEntryBullets.length > 0) {
    entriesRaw.push({ header: currentEntryHeader.trim(), bullets: currentEntryBullets });
  }

  for (const raw of entriesRaw) {
    const lines = cleanLayoutSpaces(raw.header)
      .split(/\\\\(?:\s*\[[^\]]*\])?/)
      .map((l) => cleanLayoutSpaces(l))
      .filter((l) => l.length > 0);

    if (lines.length === 0 && raw.bullets.length > 0) {
      items.push({ type: "bullet_list", bullets: raw.bullets });
      continue;
    }

    let left = lines[0] || "";
    let right = "";
    if (lines[0] && lines[0].includes("\\hfill")) {
      const parts = lines[0].split("\\hfill");
      left = parts[0].trim();
      right = parts.slice(1).join(" ").trim();
    }

    let subtitle: string | undefined = undefined;
    let subRight: string | undefined = undefined;
    if (lines.length >= 2) {
      if (lines[1].includes("\\hfill")) {
        const parts = lines[1].split("\\hfill");
        subtitle = parts[0].trim();
        subRight = parts.slice(1).join(" ").trim();
      } else {
        subtitle = lines[1].trim();
      }
    }

    items.push({
      type: "entry",
      left,
      right: right || undefined,
      subtitle: subtitle || undefined,
      subRight: subRight || undefined,
      bullets: raw.bullets,
    });
  }

  return items;
}

/**
 * Parses full LaTeX resume string into structured Header + Sections
 */
function parseLatexResume(latex: string) {
  if (!latex) return null;

  // 1. Remove comments
  const cleanDoc = latex.replace(/^[ \t]*%.*$/gm, "");

  // 2. Extract Document Body (inside \begin{document}...\end{document} if present)
  let body = cleanDoc;
  const docMatch = cleanDoc.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
  if (docMatch) {
    body = docMatch[1];
  }

  // 3. Extract Name & Header Contact Info
  let name = "";
  let contactLines: string[] = [];

  const centerMatch = body.match(/\\begin\{center\}([\s\S]*?)\\end\{center\}/);
  const headerBlock = centerMatch ? centerMatch[1] : body.slice(0, 1500);

  // Name patterns
  const namePatterns = [
    /\\textbf\{(?:\\[a-zA-Z]+\s*)*([^{}\\]+)\}/,
    /\{\\(?:Huge|huge|LARGE|Large|large)\s*(?:\\bfseries\s*|\\textbf\{)?([^{}\\]+)\}?/,
    /\\(?:Huge|huge|LARGE|Large)\s*(?:\\scshape\s*)?([A-Za-z\s.'-]+)(?:\\\\|\n|$)/,
    /\\name\{([^}]+)\}/,
    /\\author\{([^}]+)\}/,
    /\\textbf\{([^}]+)\}/,
  ];

  for (const pat of namePatterns) {
    const m = headerBlock.match(pat);
    if (m && m[1] && m[1].trim().length > 1) {
      name = cleanLatexText(m[1].trim());
      break;
    }
  }

  // Fallback: If no name found in headerBlock, search first 3 lines of body
  if (!name) {
    const firstLines = body.split(/\\\\|\n/).map((l) => cleanLatexText(l)).filter((l) => l.length > 2);
    if (firstLines.length > 0 && !firstLines[0].toLowerCase().includes("section")) {
      name = firstLines[0];
    }
  }

  // Extract contact lines from center block or header
  if (centerMatch) {
    const lines = centerMatch[1]
      .split(/\\\\(?:\s*\[[^\]]*\])?/)
      .map((l) => cleanLayoutSpaces(l))
      .filter((l) => l.length > 0);

    // If first line has the name, the remaining lines are contact info
    if (lines.length > 1) {
      contactLines = lines.slice(1);
    } else if (lines.length === 1 && !lines[0].includes(name)) {
      contactLines = lines;
    }
  } else {
    // Look for lines containing phone, email, or links before the first \section
    const preSectionText = body.split(/\\(?:section|subsection)\*?\{/)[0];
    const candidateLines = preSectionText
      .split(/\\\\|\n/)
      .map((l) => cleanLayoutSpaces(l))
      .filter((l) => l.length > 0 && (l.includes("@") || l.includes("href") || l.includes("http") || /\d{3}/.test(l)));
    if (candidateLines.length > 0) {
      contactLines = candidateLines;
    }
  }

  // 4. Extract Sections
  const sectionSplitRegex = /(?:\\(?:section|subsection)\*?\{([^}]+)\}|\\begin\{rSection\}\{([^}]+)\})/g;

  const sections: ParsedSection[] = [];
  let lastIndex = 0;
  let lastTitle = "";
  let match: RegExpExecArray | null;

  while ((match = sectionSplitRegex.exec(body)) !== null) {
    const rawTitle = match[1] || match[2] || "";
    const title = cleanLatexText(rawTitle);

    if (lastTitle) {
      const content = body.slice(lastIndex, match.index).trim();
      sections.push({
        title: lastTitle,
        items: parseSectionContent(content),
      });
    }

    lastTitle = title;
    lastIndex = match.index + match[0].length;
  }

  if (lastTitle && lastIndex < body.length) {
    const content = body
      .slice(lastIndex)
      .replace(/\\end\{document\}|\\end\{rSection\}/g, "")
      .trim();
    sections.push({
      title: lastTitle,
      items: parseSectionContent(content),
    });
  }

  // Fallback: If no \section tags were found in the document, treat body as a single structured section
  if (sections.length === 0 && body.trim()) {
    const cleanBody = body.replace(/\\begin\{center\}[\s\S]*?\\end\{center\}/, "").trim();
    if (cleanBody) {
      sections.push({
        title: "Resume Details",
        items: parseSectionContent(cleanBody),
      });
    }
  }

  return {
    name: name || "Resume Document",
    contactLines,
    sections,
  };
}

/**
 * LatexPreview Component:
 * Renders an authentic, crisp A4-dimension LaTeX resume
 * with Overleaf / Jake's Resume styling. 100% ATS-parseable and PDF-ready.
 */
export const LatexPreview = forwardRef<HTMLDivElement, LatexPreviewProps>(
  ({ latex, zoom = 1, editable = true }, ref) => {
    const parsedData = useMemo(() => {
      return parseLatexResume(latex);
    }, [latex]);

    if (!parsedData || (!parsedData.name && parsedData.sections.length === 0)) {
      return (
        <div className="flex h-full min-h-[500px] items-center justify-center rounded-xl bg-dark-200/50 p-8 text-light-400">
          No LaTeX code to render. Enter code or analyze a resume to generate preview.
        </div>
      );
    }

    return (
      <div className="flex justify-center w-full">
        {/* Printable & Screen A4 Container */}
        <div
          ref={ref}
          style={{
            zoom: zoom,
          }}
          contentEditable={editable}
          suppressContentEditableWarning={editable}
          className={`print-resume-sheet relative w-[210mm] min-h-[297mm] h-fit bg-white text-gray-950 font-serif px-[18mm] py-[16mm] shadow-2xl rounded-sm transition-all duration-150 select-text print:shadow-none print:m-0 print:p-[12mm] print:w-full print:min-h-0 print:transform-none leading-normal ${
            editable ? "outline-none focus:ring-2 focus:ring-primary-200/50 cursor-text" : ""
          }`}
        >
          {/* Header */}
          <header className="mb-4 text-center">
            <h1 className="text-2xl font-bold uppercase tracking-wider text-gray-950 font-serif">
              {parsedData.name}
            </h1>
            {parsedData.contactLines.length > 0 && (
              <div className="mt-1.5 text-[11px] text-gray-700 font-sans flex flex-col items-center gap-0.5">
                {parsedData.contactLines.map((line, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap justify-center items-center gap-x-1"
                  >
                    {renderInlineLatex(line)}
                  </div>
                ))}
              </div>
            )}
          </header>

          {/* Sections */}
          <main className="flex flex-col gap-3.5 text-xs text-gray-900 leading-relaxed font-sans">
            {parsedData.sections.map((section, idx) => (
              <section key={idx} className="flex flex-col">
                {/* Section Title with horizontal divider rule */}
                <div className="border-b border-gray-400 pb-0.5 mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-950 font-serif">
                    {section.title}
                  </h2>
                </div>

                {/* Section Content Items */}
                <div className="space-y-2">
                  {section.items.map((item, itemIdx) => {
                    // 1. Table Item (tabular, tabularx, tabular*)
                    if (item.type === "table") {
                      return (
                        <div key={itemIdx} className="w-full my-1 overflow-x-auto">
                          <table className="w-full text-[11px] text-gray-900 border-collapse">
                            {item.rows.length > 0 && (
                              <tbody>
                                {item.rows.map((row, rIdx) => {
                                  const isHeader =
                                    rIdx === 0 &&
                                    row.some(
                                      (cell) =>
                                        cell.includes("\\textbf") ||
                                        cell.includes("\\bf") ||
                                        cell.toLowerCase().includes("year") ||
                                        cell.toLowerCase().includes("degree") ||
                                        cell.toLowerCase().includes("role")
                                    );
                                  const CellTag = isHeader ? "th" : "td";

                                  return (
                                    <tr
                                      key={rIdx}
                                      className={`${
                                        isHeader
                                          ? "border-b border-gray-400 font-bold text-gray-950"
                                          : "border-b border-gray-100 last:border-b-0"
                                      }`}
                                    >
                                      {row.map((cell, cIdx) => {
                                        const align =
                                          item.alignments && item.alignments[cIdx]
                                            ? item.alignments[cIdx]
                                            : "left";
                                        const alignClass =
                                          align === "right"
                                            ? "text-right"
                                            : align === "center"
                                            ? "text-center"
                                            : "text-left";

                                        return (
                                          <CellTag
                                            key={cIdx}
                                            className={`py-1 px-1.5 leading-snug ${alignClass} ${
                                              isHeader ? "font-bold text-gray-950 pb-1" : "text-gray-800"
                                            }`}
                                          >
                                            {renderInlineLatex(cell)}
                                          </CellTag>
                                        );
                                      })}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            )}
                          </table>
                        </div>
                      );
                    }

                    // 2. Direct Bullet List Item (e.g. Achievements, Coursework)
                    if (item.type === "bullet_list") {
                      return (
                        <ul
                          key={itemIdx}
                          className="list-disc ml-4 space-y-0.5 text-[11px] !text-gray-900 marker:!text-gray-900 leading-relaxed"
                        >
                          {item.bullets.map((bullet, bIdx) => (
                            <li key={bIdx} className="pl-0.5 !text-gray-900 marker:!text-gray-900">
                              {renderInlineLatex(bullet)}
                            </li>
                          ))}
                        </ul>
                      );
                    }

                    // 3. Line Item (e.g. Skills row or standalone text)
                    if (item.type === "line") {
                      return item.right ? (
                        <div
                          key={itemIdx}
                          className="flex justify-between items-baseline text-xs text-gray-900 gap-2"
                        >
                          <div className="flex-1 min-w-0">{renderInlineLatex(item.left)}</div>
                          <div className="text-right text-[11px] font-normal text-gray-600 whitespace-nowrap flex-shrink-0">
                            {renderInlineLatex(item.right)}
                          </div>
                        </div>
                      ) : (
                        <div key={itemIdx} className="text-xs text-gray-900 leading-snug">
                          {renderInlineLatex(item.left)}
                        </div>
                      );
                    }

                    // 4. Entry Item (Title, Right, Subtitle, SubRight, Bullets)
                    const hasRight = Boolean(item.right && item.right.trim().length > 0);

                    return (
                      <div key={itemIdx} className="flex flex-col">
                        {/* Entry Header: Left (Title/Role) and Right (Dates/Location) */}
                        {hasRight ? (
                          <div className="flex justify-between items-baseline text-xs text-gray-950 gap-2">
                            <div className="font-semibold flex-1 min-w-0">{renderInlineLatex(item.left)}</div>
                            <div className="text-right text-[11px] font-normal text-gray-600 whitespace-nowrap flex-shrink-0 font-mono">
                              {renderInlineLatex(item.right!)}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-950 font-semibold leading-snug">
                            {renderInlineLatex(item.left)}
                          </div>
                        )}

                        {/* Optional Subtitle Row */}
                        {item.subtitle && (
                          <div className="flex justify-between items-baseline text-[11px] text-gray-700 italic">
                            <div>{renderInlineLatex(item.subtitle)}</div>
                            {item.subRight && (
                              <div className="text-right text-[10px] text-gray-500">
                                {renderInlineLatex(item.subRight)}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Sub-Bullets List */}
                        {item.bullets && item.bullets.length > 0 && (
                          <ul className="list-disc ml-4 mt-1 space-y-0.5 text-[11px] !text-gray-900 marker:!text-gray-900 leading-relaxed">
                            {item.bullets.map((bullet, bIdx) => (
                              <li key={bIdx} className="pl-0.5 !text-gray-900 marker:!text-gray-900">
                                {renderInlineLatex(bullet)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </main>
        </div>
      </div>
    );
  }
);

LatexPreview.displayName = "LatexPreview";
