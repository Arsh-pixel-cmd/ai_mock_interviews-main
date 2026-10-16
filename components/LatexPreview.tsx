"use client";

import React, { forwardRef, useMemo } from "react";

interface LatexPreviewProps {
  latex: string;
  zoom?: number;
}

interface ParsedSection {
  title: string;
  content: string;
}

/**
 * Cleanly unescapes common LaTeX special characters
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
    .replace(/\\textbf\{([^}]*)\}/g, "$1")
    .replace(/\\emph\{([^}]*)\}/g, "$1")
    .replace(/\\textit\{([^}]*)\}/g, "$1")
    .replace(/\\underline\{([^}]*)\}/g, "$1")
    .replace(/\\small\{([^}]*)\}/g, "$1")
    .replace(/\\large\{([^}]*)\}/g, "$1")
    .replace(/\\scshape\s*/g, "")
    .replace(/\\vspace\{[^}]*\}/g, "")
    .replace(/\\hspace\{[^}]*\}/g, " ")
    .replace(/\\hfill/g, " ")
    .replace(/\\\\/g, " ")
    .trim();
}

/**
 * Parses inline LaTeX formatting like \textbf{}, \emph{}, \href{}, etc. into React elements
 */
function renderInlineLatex(text: string): React.ReactNode[] {
  if (!text) return [];

  // Remove LaTeX comments
  const cleanLine = text.replace(/(^|[^\\])%.*$/, "$1").trim();
  if (!cleanLine) return [];

  // Split on inline patterns: \textbf{...}, \href{url}{text}, \emph{...}, \textit{...}, \underline{...}, \hfill, \\
  const tokens: React.ReactNode[] = [];
  let remaining = cleanLine;
  let keyIndex = 0;

  while (remaining.length > 0) {
    // 1. \href{url}{label}
    const hrefMatch = remaining.match(/\\href\{([^}]+)\}\{([^}]+)\}/);
    // 2. \textbf{content}
    const boldMatch = remaining.match(/\\textbf\{([^}]+)\}/);
    // 3. \emph{content} or \textit{content}
    const italicMatch = remaining.match(/\\(?:emph|textit)\{([^}]+)\}/);
    // 4. \underline{content}
    const underlineMatch = remaining.match(/\\underline\{([^}]+)\}/);
    // 5. \hfill
    const hfillMatch = remaining.match(/\\hfill/);
    // 6. \\
    const newlineMatch = remaining.match(/\\\\/);

    // Find the earliest match
    const matches = [
      { type: "href", match: hrefMatch },
      { type: "bold", match: boldMatch },
      { type: "italic", match: italicMatch },
      { type: "underline", match: underlineMatch },
      { type: "hfill", match: hfillMatch },
      { type: "newline", match: newlineMatch },
    ]
      .filter((m) => m.match && m.match.index !== undefined)
      .sort((a, b) => (a.match!.index ?? 0) - (b.match!.index ?? 0));

    if (matches.length === 0) {
      // No more tags, push remainder
      tokens.push(cleanLatexText(remaining));
      break;
    }

    const first = matches[0];
    const matchIndex = first.match!.index ?? 0;

    // Push text before match
    if (matchIndex > 0) {
      tokens.push(cleanLatexText(remaining.slice(0, matchIndex)));
    }

    // Process matched tag
    if (first.type === "href") {
      const url = first.match![1];
      const label = cleanLatexText(first.match![2]);
      tokens.push(
        <a
          key={`href-${keyIndex++}`}
          href={url.startsWith("http") || url.startsWith("mailto:") ? url : `https://${url}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-700 hover:underline"
        >
          {label}
        </a>
      );
      remaining = remaining.slice(matchIndex + first.match![0].length);
    } else if (first.type === "bold") {
      tokens.push(
        <strong key={`bold-${keyIndex++}`} className="font-bold text-gray-950">
          {cleanLatexText(first.match![1])}
        </strong>
      );
      remaining = remaining.slice(matchIndex + first.match![0].length);
    } else if (first.type === "italic") {
      tokens.push(
        <em key={`italic-${keyIndex++}`} className="italic text-gray-800">
          {cleanLatexText(first.match![1])}
        </em>
      );
      remaining = remaining.slice(matchIndex + first.match![0].length);
    } else if (first.type === "underline") {
      tokens.push(
        <span key={`underline-${keyIndex++}`} className="underline">
          {cleanLatexText(first.match![1])}
        </span>
      );
      remaining = remaining.slice(matchIndex + first.match![0].length);
    } else if (first.type === "hfill") {
      tokens.push(
        <span key={`hfill-${keyIndex++}`} className="ml-auto inline-block text-right font-medium text-gray-600">
          {/* spacer */}
        </span>
      );
      remaining = remaining.slice(matchIndex + first.match![0].length);
    } else if (first.type === "newline") {
      tokens.push(<br key={`nl-${keyIndex++}`} />);
      remaining = remaining.slice(matchIndex + first.match![0].length);
    } else {
      break;
    }
  }

  return tokens;
}

/**
 * LatexPreview Component: Renders an authentic, crisp A4-dimension LaTeX resume
 * with standard Jake's Resume / Overleaf styling, perfect for ATS and PDF printing.
 */
export const LatexPreview = forwardRef<HTMLDivElement, LatexPreviewProps>(
  ({ latex, zoom = 1 }, ref) => {
    // Parse the LaTeX string into structured parts
    const parsedData = useMemo(() => {
      if (!latex) return null;

      // Extract Header / Name block
      let name = "Alex Morgan";
      let contactLine = "";

      const centerMatch = latex.match(/\\begin\{center\}([\s\S]*?)\\end\{center\}/);
      if (centerMatch) {
        const centerContent = centerMatch[1];
        // Look for \textbf{\Huge \scshape ...} or similar
        const nameMatch = centerContent.match(/\\textbf\{(?:\\[a-zA-Z]+\s*)*([^}]+)\}/);
        if (nameMatch) {
          name = cleanLatexText(nameMatch[1]);
        }

        // Contact info lines
        const lines = centerContent.split(/\\\\/);
        if (lines.length > 1) {
          contactLine = lines.slice(1).join(" ").trim();
        }
      }

      // Extract Sections (\section{Title} ... next \section or \end{document})
      const sections: ParsedSection[] = [];
      const sectionRegex = /\\section\{([^}]+)\}([\s\S]*?)(?=(\\section\{|\\end\{document\}|$))/g;
      let match: RegExpExecArray | null;

      while ((match = sectionRegex.exec(latex)) !== null) {
        sections.push({
          title: match[1].trim(),
          content: match[2].trim(),
        });
      }

      return {
        name,
        contactLine,
        sections,
      };
    }, [latex]);

    if (!parsedData) {
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
          className="print-resume-sheet relative w-[210mm] min-h-[297mm] bg-white text-black font-sans px-[18mm] py-[16mm] shadow-2xl rounded-sm transition-transform duration-150 select-text print:shadow-none print:m-0 print:p-[12mm] print:w-full print:min-h-0 print:transform-none"
        >
          {/* Header */}
          <header className="mb-4 text-center border-b border-transparent">
            <h1 className="text-2xl font-bold uppercase tracking-wider text-gray-950 font-serif">
              {parsedData.name}
            </h1>
            {parsedData.contactLine && (
              <div className="mt-1 text-xs text-gray-700 flex flex-wrap justify-center items-center gap-x-2 gap-y-1">
                {renderInlineLatex(parsedData.contactLine)}
              </div>
            )}
          </header>

          {/* Sections */}
          <main className="flex flex-col gap-3.5 text-xs text-gray-900 leading-relaxed">
            {parsedData.sections.map((section, idx) => (
              <section key={idx} className="flex flex-col">
                {/* Section Heading with subtle horizontal rule */}
                <div className="border-b border-gray-400 pb-0.5 mb-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-950 font-serif">
                    {section.title}
                  </h2>
                </div>

                {/* Section Content */}
                <div className="space-y-2">
                  {renderSectionContent(section.content)}
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

/**
 * Parses items, sub-items, dates, and titles inside a section's LaTeX content
 */
function renderSectionContent(rawContent: string) {
  // Split on top-level items
  // Look for items inside itemize blocks
  const items = rawContent
    .split(/\\item\s+/)
    .map((item) => item.trim())
    .filter((item) => {
      const clean = item.replace(/\\begin\{itemize\}[^}]*\}|\\end\{itemize\}|\\small\{/g, "").trim();
      return clean.length > 0;
    });

  if (items.length === 0) {
    // If no \item tags, render line by line
    const lines = rawContent.split(/\n+/).filter((l) => l.trim().length > 0);
    return lines.map((line, i) => (
      <div key={i} className="text-gray-800">
        {renderInlineLatex(line)}
      </div>
    ));
  }

  return items.map((itemText, idx) => {
    // Check if this item has nested itemize (e.g., experience bullets)
    const subItemizeMatch = itemText.match(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/);

    let headerPart = itemText;
    let bullets: string[] = [];

    if (subItemizeMatch) {
      headerPart = itemText.slice(0, subItemizeMatch.index).trim();
      bullets = subItemizeMatch[1]
        .split(/\\item\s+/)
        .map((b) => b.trim())
        .filter((b) => b.length > 0);
    }

    // Check if headerPart contains date alignment via \hfill
    const hasHfill = headerPart.includes("\\hfill");
    let leftSide = headerPart;
    let rightSide = "";

    if (hasHfill) {
      const parts = headerPart.split("\\hfill");
      leftSide = parts[0].trim();
      rightSide = parts.slice(1).join(" ").trim();
    }

    return (
      <div key={idx} className="flex flex-col">
        {/* Entry Header (Company/Role or Degree/School + Dates) */}
        {hasHfill ? (
          <div className="flex justify-between items-baseline text-xs font-semibold text-gray-950">
            <div>{renderInlineLatex(leftSide)}</div>
            <div className="text-right text-[11px] font-normal text-gray-600 whitespace-nowrap ml-2">
              {renderInlineLatex(rightSide)}
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-900">{renderInlineLatex(headerPart)}</div>
        )}

        {/* Bullets */}
        {bullets.length > 0 && (
          <ul className="list-disc ml-4 mt-1 space-y-0.5 text-[11px] text-gray-800 leading-snug">
            {bullets.map((b, bIdx) => (
              <li key={bIdx} className="pl-0.5">
                {renderInlineLatex(b)}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  });
}
