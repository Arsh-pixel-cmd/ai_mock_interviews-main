"use client";

import React, { forwardRef, useMemo } from "react";

interface LatexPreviewProps {
  latex: string;
  zoom?: number;
}

interface ParsedEntry {
  type: "entry" | "line";
  left: string;
  right: string;
  subtitle?: string;
  subRight?: string;
  bullets: string[];
}

interface ParsedSection {
  title: string;
  entries: ParsedEntry[];
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

type InlineToken =
  | { type: "text"; value: string }
  | { type: "href"; url: string; children: InlineToken[] }
  | { type: "bold"; children: InlineToken[] }
  | { type: "italic"; children: InlineToken[] }
  | { type: "underline"; children: InlineToken[] }
  | { type: "code"; value: string }
  | { type: "pipe" }
  | { type: "newline" };

/**
 * Tokenizes inline LaTeX formatting with full balanced-brace handling
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
        .replace(/\\(?:\s+|$)/g, " ")
        .replace(/\\(?:small|footnotesize|large|Large|LARGE|Huge|huge|scshape|itshape|bfseries|noindent|centering)\b/g, "");

      if (cleaned) {
        tokens.push({ type: "text", value: cleaned });
      }
      currentText = "";
    }
  };

  while (i < clean.length) {
    // 1. \href{url}{label}
    if (clean.startsWith("\\href", i)) {
      const firstBraceIdx = clean.indexOf("{", i);
      if (firstBraceIdx !== -1 && firstBraceIdx <= i + 6) {
        const urlPart = getBalancedBraceContent(clean, firstBraceIdx);
        if (urlPart) {
          const secondBraceIdx = clean.indexOf("{", urlPart.endIndex + 1);
          if (secondBraceIdx !== -1 && secondBraceIdx <= urlPart.endIndex + 4) {
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
        }
      }
    }

    // 2. \url{url}
    if (clean.startsWith("\\url", i)) {
      const braceIdx = clean.indexOf("{", i);
      if (braceIdx !== -1 && braceIdx <= i + 5) {
        const part = getBalancedBraceContent(clean, braceIdx);
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
    }

    // 3. \textbf{...}
    if (clean.startsWith("\\textbf", i)) {
      const braceIdx = clean.indexOf("{", i);
      if (braceIdx !== -1 && braceIdx <= i + 8) {
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
    }

    // 4. \textit{...} or \emph{...}
    if (clean.startsWith("\\textit", i) || clean.startsWith("\\emph", i)) {
      const braceIdx = clean.indexOf("{", i);
      if (braceIdx !== -1 && braceIdx <= i + 8) {
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
    }

    // 5. \underline{...}
    if (clean.startsWith("\\underline", i)) {
      const braceIdx = clean.indexOf("{", i);
      if (braceIdx !== -1 && braceIdx <= i + 11) {
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
    }

    // 6. \texttt{...}
    if (clean.startsWith("\\texttt", i)) {
      const braceIdx = clean.indexOf("{", i);
      if (braceIdx !== -1 && braceIdx <= i + 8) {
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

    // 8. Line breaks \\
    if (clean.startsWith("\\\\", i)) {
      flushText();
      tokens.push({ type: "newline" });
      i += 2;
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
      case "text":
        return <span key={key}>{token.value}</span>;
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
 * Parses raw section LaTeX content into structured entries with header (left/right) and sub-bullets
 */
function parseSectionContent(rawContent: string): ParsedEntry[] {
  // Strip comments and normalize macros
  let text = rawContent.replace(/^[ \t]*%.*$/gm, "").trim();

  // Normalize standard Overleaf / Jake's resume macros
  text = text
    .replace(/\\resumeSubHeadingListStart/g, "\\begin{itemize}")
    .replace(/\\resumeSubHeadingListEnd/g, "\\end{itemize}")
    .replace(/\\resumeItemListStart/g, "\\begin{itemize}")
    .replace(/\\resumeItemListEnd/g, "\\end{itemize}")
    .replace(/\\resumeItem\{/g, "\\item ")
    .replace(
      /\\resumeSubheading\{([^}]+)\}\{([^}]+)\}\{([^}]+)\}\{([^}]+)\}/g,
      "\\item \\textbf{$1} $|$ {$3} \\hfill {$2} -- {$4}"
    )
    .replace(/\\resumeProjectHeading\{([^}]+)\}\{([^}]+)\}/g, "\\item $1 \\hfill {$2}");

  const entries: ParsedEntry[] = [];

  // Check for tabular environments (e.g. tabular* or tabular)
  const tabularRegex = /\\begin\{tabular\*?\}(?:\{[^}]*\})*([\s\S]*?)\\end\{tabular\*?\}/g;
  let tabMatch: RegExpExecArray | null;
  let hasTabular = false;

  while ((tabMatch = tabularRegex.exec(text)) !== null) {
    hasTabular = true;
    const rows = tabMatch[1].split(/\\\\/).map((r) => r.trim()).filter((r) => r.length > 0);
    for (const row of rows) {
      const cols = row.split("&").map((c) => c.trim());
      if (cols.length >= 2) {
        entries.push({
          type: "entry",
          left: cols[0],
          right: cols[1],
          bullets: [],
        });
      } else if (cols.length === 1) {
        entries.push({
          type: "line",
          left: cols[0],
          right: "",
          bullets: [],
        });
      }
    }
  }
  if (hasTabular) return entries;

  // Environment-aware itemize scanner
  const tokenRegex = /(\\begin\{itemize\}(?:\[[^\]]*\])?|\\end\{itemize\}|\\item\b)/g;
  const tokens: { type: "begin" | "end" | "item" | "text"; value?: string }[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = tokenRegex.exec(text)) !== null) {
    if (m.index > lastIdx) {
      const slice = text.slice(lastIdx, m.index);
      if (slice.trim()) {
        tokens.push({ type: "text", value: slice });
      }
    }
    const val = m[1];
    if (val.startsWith("\\begin{itemize}")) {
      tokens.push({ type: "begin" });
    } else if (val === "\\end{itemize}") {
      tokens.push({ type: "end" });
    } else if (val === "\\item") {
      tokens.push({ type: "item" });
    }
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) {
    const rest = text.slice(lastIdx);
    if (rest.trim()) {
      tokens.push({ type: "text", value: rest });
    }
  }

  let depth = 0;
  let currentEntry: ParsedEntry | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.type === "begin") {
      depth++;
    } else if (tok.type === "end") {
      depth = Math.max(0, depth - 1);
    } else if (tok.type === "item") {
      // Gather text until next control token
      let itemText = "";
      while (i + 1 < tokens.length && tokens[i + 1].type === "text") {
        itemText += tokens[i + 1].value;
        i++;
      }
      itemText = itemText.trim();

      if (depth <= 1) {
        // Top-level entry (Job, Degree, or Skill group)
        let left = itemText;
        let right = "";
        if (itemText.includes("\\hfill")) {
          const parts = itemText.split("\\hfill");
          left = parts[0].trim();
          right = parts.slice(1).join(" ").trim();
        }

        currentEntry = {
          type: "entry",
          left,
          right,
          bullets: [],
        };
        entries.push(currentEntry);
      } else {
        // Sub-bullet under current entry
        if (!currentEntry) {
          currentEntry = { type: "entry", left: "", right: "", bullets: [] };
          entries.push(currentEntry);
        }
        if (itemText) {
          currentEntry.bullets.push(itemText);
        }
      }
    } else if (tok.type === "text" && tok.value) {
      const val = tok.value.trim();
      if (!val) continue;

      // Handle lines split by \\
      const lines = val.split(/\\\\/).map((l) => l.trim()).filter((l) => l.length > 0);
      for (const line of lines) {
        const cleanLine = line
          .replace(/^\\small\{|^\\item\{|^\\item\s*/g, "")
          .replace(/\}$/g, "")
          .trim();
        if (!cleanLine || cleanLine === "}" || cleanLine === "}}") continue;

        let left = cleanLine;
        let right = "";
        if (cleanLine.includes("\\hfill")) {
          const parts = cleanLine.split("\\hfill");
          left = parts[0].trim();
          right = parts.slice(1).join(" ").trim();
        }

        if (currentEntry && !currentEntry.left && currentEntry.bullets.length === 0) {
          currentEntry.left = left;
          currentEntry.right = right;
        } else {
          entries.push({
            type: "line",
            left,
            right,
            bullets: [],
          });
        }
      }
    }
  }

  // Filter out any purely empty entries
  return entries.filter((e) => {
    const hasLeft = cleanLatexText(e.left).length > 0;
    const hasBullets = e.bullets.length > 0;
    return hasLeft || hasBullets;
  });
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
      .split(/\\\\/)
      .map((l) => l.replace(/\\vspace\{[^}]*\}/g, "").trim())
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
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && (l.includes("@") || l.includes("href") || l.includes("http") || /\d{3}/.test(l)));
    if (candidateLines.length > 0) {
      contactLines = candidateLines;
    }
  }

  // 4. Extract Sections
  // Matches \section{...}, \section*{...}, \begin{rSection}{...}, \subsection{...}, \cvsection{...}
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
        entries: parseSectionContent(content),
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
      entries: parseSectionContent(content),
    });
  }

  // Fallback: If no \section tags were found in the document, treat the body as a single structured section
  if (sections.length === 0 && body.trim()) {
    const cleanBody = body.replace(/\\begin\{center\}[\s\S]*?\\end\{center\}/, "").trim();
    if (cleanBody) {
      sections.push({
        title: "Resume Details",
        entries: parseSectionContent(cleanBody),
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
  ({ latex, zoom = 1 }, ref) => {
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
      <div className="flex justify-center overflow-x-auto p-4 max-sm:p-1">
        {/* Printable & Screen A4 Container */}
        <div
          ref={ref}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
          }}
          className="print-resume-sheet relative w-[210mm] min-h-[297mm] bg-white text-gray-950 font-serif px-[18mm] py-[16mm] shadow-2xl rounded-sm transition-transform duration-150 select-text print:shadow-none print:m-0 print:p-[12mm] print:w-full print:min-h-0 print:transform-none leading-normal"
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

                {/* Section Content Entries */}
                <div className="space-y-2">
                  {section.entries.map((entry, eIdx) => {
                    const hasRight = Boolean(entry.right && entry.right.trim().length > 0);

                    return (
                      <div key={eIdx} className="flex flex-col">
                        {/* Entry Header: Left (Title/Role) and Right (Dates/Location) */}
                        {hasRight ? (
                          <div className="flex justify-between items-baseline text-xs text-gray-950">
                            <div className="font-semibold">{renderInlineLatex(entry.left)}</div>
                            <div className="text-right text-[11px] font-normal text-gray-600 whitespace-nowrap ml-2 font-mono">
                              {renderInlineLatex(entry.right)}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-900 leading-snug">
                            {renderInlineLatex(entry.left)}
                          </div>
                        )}

                        {/* Optional Subtitle Row */}
                        {entry.subtitle && (
                          <div className="flex justify-between items-baseline text-[11px] text-gray-700 italic">
                            <div>{renderInlineLatex(entry.subtitle)}</div>
                            {entry.subRight && (
                              <div className="text-right text-[10px] text-gray-500">
                                {renderInlineLatex(entry.subRight)}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Sub-Bullets List */}
                        {entry.bullets && entry.bullets.length > 0 && (
                          <ul className="list-disc ml-4 mt-1 space-y-0.5 text-[11px] text-gray-800 leading-relaxed">
                            {entry.bullets.map((bullet, bIdx) => (
                              <li key={bIdx} className="pl-0.5">
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
