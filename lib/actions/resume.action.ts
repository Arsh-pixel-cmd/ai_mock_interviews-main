"use server";

import zlib from "zlib";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai/ai-provider";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-this-alias, @typescript-eslint/no-unused-vars */
/**
 * Minimal spec-compliant DOMMatrix polyfill for pdfjs-dist in Node.js / Vercel serverless.
 * Implements every mutable method pdfjs-dist v5 calls:
 *   scaleSelf, translateSelf, invertSelf, multiplySelf, preMultiplySelf, getTransform
 */
if (typeof (globalThis as any).DOMMatrix === "undefined") {
  class DOMMatrixPolyfill {
    // 2-D properties
    a: number; b: number; c: number; d: number; e: number; f: number;
    // 4×4 aliases
    m11: number; m12: number; m13: number; m14: number;
    m21: number; m22: number; m23: number; m24: number;
    m31: number; m32: number; m33: number; m34: number;
    m41: number; m42: number; m43: number; m44: number;

    constructor(init?: string | number[]) {
      // Identity
      this.m11 = 1; this.m12 = 0; this.m13 = 0; this.m14 = 0;
      this.m21 = 0; this.m22 = 1; this.m23 = 0; this.m24 = 0;
      this.m31 = 0; this.m32 = 0; this.m33 = 1; this.m34 = 0;
      this.m41 = 0; this.m42 = 0; this.m43 = 0; this.m44 = 1;
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
      if (Array.isArray(init)) {
        if (init.length === 6) {
          this.a = this.m11 = init[0]; this.b = this.m12 = init[1];
          this.c = this.m21 = init[2]; this.d = this.m22 = init[3];
          this.e = this.m41 = init[4]; this.f = this.m42 = init[5];
        } else if (init.length === 16) {
          [this.m11,this.m12,this.m13,this.m14,this.m21,this.m22,this.m23,this.m24,
           this.m31,this.m32,this.m33,this.m34,this.m41,this.m42,this.m43,this.m44] = init;
          this.a = this.m11; this.b = this.m12; this.c = this.m21; this.d = this.m22;
          this.e = this.m41; this.f = this.m42;
        }
      }
    }

    private _sync2d() {
      this.a = this.m11; this.b = this.m12; this.c = this.m21; this.d = this.m22;
      this.e = this.m41; this.f = this.m42;
    }

    /** Multiply this × other, store result in this */
    multiplySelf(other: DOMMatrixPolyfill): DOMMatrixPolyfill {
      const a = this, b = other;
      const m11 = a.m11*b.m11 + a.m12*b.m21 + a.m13*b.m31 + a.m14*b.m41;
      const m12 = a.m11*b.m12 + a.m12*b.m22 + a.m13*b.m32 + a.m14*b.m42;
      const m13 = a.m11*b.m13 + a.m12*b.m23 + a.m13*b.m33 + a.m14*b.m43;
      const m14 = a.m11*b.m14 + a.m12*b.m24 + a.m13*b.m34 + a.m14*b.m44;
      const m21 = a.m21*b.m11 + a.m22*b.m21 + a.m23*b.m31 + a.m24*b.m41;
      const m22 = a.m21*b.m12 + a.m22*b.m22 + a.m23*b.m32 + a.m24*b.m42;
      const m23 = a.m21*b.m13 + a.m22*b.m23 + a.m23*b.m33 + a.m24*b.m43;
      const m24 = a.m21*b.m14 + a.m22*b.m24 + a.m23*b.m34 + a.m24*b.m44;
      const m31 = a.m31*b.m11 + a.m32*b.m21 + a.m33*b.m31 + a.m34*b.m41;
      const m32 = a.m31*b.m12 + a.m32*b.m22 + a.m33*b.m32 + a.m34*b.m42;
      const m33 = a.m31*b.m13 + a.m32*b.m23 + a.m33*b.m33 + a.m34*b.m43;
      const m34 = a.m31*b.m14 + a.m32*b.m24 + a.m33*b.m34 + a.m34*b.m44;
      const m41 = a.m41*b.m11 + a.m42*b.m21 + a.m43*b.m31 + a.m44*b.m41;
      const m42 = a.m41*b.m12 + a.m42*b.m22 + a.m43*b.m32 + a.m44*b.m42;
      const m43 = a.m41*b.m13 + a.m42*b.m23 + a.m43*b.m33 + a.m44*b.m43;
      const m44 = a.m41*b.m14 + a.m42*b.m24 + a.m43*b.m34 + a.m44*b.m44;
      this.m11=m11; this.m12=m12; this.m13=m13; this.m14=m14;
      this.m21=m21; this.m22=m22; this.m23=m23; this.m24=m24;
      this.m31=m31; this.m32=m32; this.m33=m33; this.m34=m34;
      this.m41=m41; this.m42=m42; this.m43=m43; this.m44=m44;
      this._sync2d();
      return this;
    }

    /** Multiply other × this, store result in this */
    preMultiplySelf(other: DOMMatrixPolyfill): DOMMatrixPolyfill {
      const b = this;
      const a = other;
      const m11 = a.m11*b.m11 + a.m12*b.m21 + a.m13*b.m31 + a.m14*b.m41;
      const m12 = a.m11*b.m12 + a.m12*b.m22 + a.m13*b.m32 + a.m14*b.m42;
      const m13 = a.m11*b.m13 + a.m12*b.m23 + a.m13*b.m33 + a.m14*b.m43;
      const m14 = a.m11*b.m14 + a.m12*b.m24 + a.m13*b.m34 + a.m14*b.m44;
      const m21 = a.m21*b.m11 + a.m22*b.m21 + a.m23*b.m31 + a.m24*b.m41;
      const m22 = a.m21*b.m12 + a.m22*b.m22 + a.m23*b.m32 + a.m24*b.m42;
      const m23 = a.m21*b.m13 + a.m22*b.m23 + a.m23*b.m33 + a.m24*b.m43;
      const m24 = a.m21*b.m14 + a.m22*b.m24 + a.m23*b.m34 + a.m24*b.m44;
      const m31 = a.m31*b.m11 + a.m32*b.m21 + a.m33*b.m31 + a.m34*b.m41;
      const m32 = a.m31*b.m12 + a.m32*b.m22 + a.m33*b.m32 + a.m34*b.m42;
      const m33 = a.m31*b.m13 + a.m32*b.m23 + a.m33*b.m33 + a.m34*b.m43;
      const m34 = a.m31*b.m14 + a.m32*b.m24 + a.m33*b.m34 + a.m34*b.m44;
      const m41 = a.m41*b.m11 + a.m42*b.m21 + a.m43*b.m31 + a.m44*b.m41;
      const m42 = a.m41*b.m12 + a.m42*b.m22 + a.m43*b.m32 + a.m44*b.m42;
      const m43 = a.m41*b.m13 + a.m42*b.m23 + a.m43*b.m33 + a.m44*b.m43;
      const m44 = a.m41*b.m14 + a.m42*b.m24 + a.m43*b.m34 + a.m44*b.m44;
      this.m11=m11; this.m12=m12; this.m13=m13; this.m14=m14;
      this.m21=m21; this.m22=m22; this.m23=m23; this.m24=m24;
      this.m31=m31; this.m32=m32; this.m33=m33; this.m34=m34;
      this.m41=m41; this.m42=m42; this.m43=m43; this.m44=m44;
      this._sync2d();
      return this;
    }

    scaleSelf(sx: number = 1, sy?: number, _sz?: number, _ox?: number, _oy?: number, _oz?: number): DOMMatrixPolyfill {
      if (sy === undefined) sy = sx;
      const s = new DOMMatrixPolyfill([sx, 0, 0, sy, 0, 0]);
      return this.multiplySelf(s);
    }

    translateSelf(tx: number = 0, ty: number = 0, _tz: number = 0): DOMMatrixPolyfill {
      const t = new DOMMatrixPolyfill([1, 0, 0, 1, tx, ty]);
      return this.multiplySelf(t);
    }

    scale(sx: number = 1, sy?: number): DOMMatrixPolyfill {
      const r = new DOMMatrixPolyfill([this.m11,this.m12,this.m13,this.m14,this.m21,this.m22,this.m23,this.m24,
        this.m31,this.m32,this.m33,this.m34,this.m41,this.m42,this.m43,this.m44]);
      return r.scaleSelf(sx, sy);
    }

    translate(tx: number = 0, ty: number = 0): DOMMatrixPolyfill {
      const r = new DOMMatrixPolyfill([this.m11,this.m12,this.m13,this.m14,this.m21,this.m22,this.m23,this.m24,
        this.m31,this.m32,this.m33,this.m34,this.m41,this.m42,this.m43,this.m44]);
      return r.translateSelf(tx, ty);
    }

    invertSelf(): DOMMatrixPolyfill {
      const me = this;
      const a=me.m11,b=me.m12,c=me.m21,d=me.m22,e=me.m41,f=me.m42;
      const det = a*d - b*c;
      if (det === 0) {
        this.m11=NaN;this.m12=NaN;this.m21=NaN;this.m22=NaN;this.m41=NaN;this.m42=NaN;
        this._sync2d();
        return this;
      }
      this.m11 = d/det; this.m12 = -b/det;
      this.m21 = -c/det; this.m22 = a/det;
      this.m41 = (c*f - d*e)/det;
      this.m42 = (b*e - a*f)/det;
      this._sync2d();
      return this;
    }

    getTransform(): DOMMatrixPolyfill {
      return new DOMMatrixPolyfill([this.a, this.b, this.c, this.d, this.e, this.f]);
    }
  }
  (globalThis as any).DOMMatrix = DOMMatrixPolyfill;
}
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-this-alias, @typescript-eslint/no-unused-vars */

// Import pdf-parse AFTER the polyfill is installed
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require("pdf-parse") as typeof import("pdf-parse");

const detailedAnalysisSchema = z.object({
  overallMatchScore: z.number().describe("Overall JD match percentage (0-100)"),
  atsScore: z.number().describe("ATS Friendliness score out of 10"),
  isAtsFriendly: z.boolean().describe("Whether the resume passes standard ATS parsing filters"),
  atsSummary: z.string().describe("Concise explanation of ATS compatibility and formatting health"),
  targetRoleMatch: z.object({
    targetRole: z.string().describe("Target role analyzed"),
    detectedRole: z.string().describe("Candidate current/detected role from resume"),
    alignmentScore: z.number().describe("Role alignment percentage 0-100"),
    roleFeedback: z.string().describe("Feedback on role fit and seniority match"),
  }),
  missingKeywords: z.array(
    z.object({
      keyword: z.string().describe("Missing keyword or skill from JD"),
      category: z.string().describe("technical, soft-skills, domain, or tools"),
      priority: z.enum(["critical", "important", "bonus"]),
      whyNeeded: z.string().describe("Why this keyword is critical for this JD"),
    })
  ).describe("Key terms, tools, or titles found in the JD but absent or weak in the resume"),
  matchingKeywords: z.array(z.string()).describe("Keywords found in both JD and resume"),
  flawsAndFixes: z.array(
    z.object({
      category: z.string().describe("Category: impact, formatting, brevity, skills, contact, action verbs, or metrics"),
      flaw: z.string().describe("Specific weakness or flaw detected in the resume"),
      suggestion: z.string().describe("Actionable fix to resolve this flaw"),
      exampleRewrite: z.string().describe("Concrete before/after bullet rewrite example, or empty string if not applicable"),
    })
  ).describe("List of flaws, weak action verbs, lack of metrics, or formatting risks"),
  quantifiableImpactScore: z.number().describe("Score evaluating metrics, percentages, dollar values vs passive duties (0-10)"),
  actionVerbScore: z.number().describe("Strength of bullet point action verbs (0-10)"),
  verdict: z.enum(["Strong Match", "Moderate Match", "Needs Optimization", "High Risk of Rejection"]),
  shortlistProbability: z.number().describe("Estimated likelihood of getting past recruiter ATS screening (0-100%)"),
  keyRecommendations: z.array(z.string()).describe("Top 3-5 immediate steps candidate should take"),
  suggestedLatexCode: z.string().describe("Empty string; complete LaTeX document is generated via plain text generator"),
});

/**
 * No-op — DOMMatrix polyfill is now installed at module scope above.
 * Kept as a call-site so the rest of the code doesn't change.
 */
function ensurePdfWorker() {
  // polyfill already applied at top of module
}

/**
 * Robust fallback PDF text stream extractor for environments where worker threads fail
 */
function fallbackExtractPdfText(buffer: Buffer): string {
  const textChunks: string[] = [];
  const content = buffer.toString("binary");
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(content)) !== null) {
    const rawStream = Buffer.from(match[1], "binary");
    let decompressed = "";
    try {
      decompressed = zlib.inflateSync(rawStream).toString("latin1");
    } catch {
      try {
        decompressed = zlib.unzipSync(rawStream).toString("latin1");
      } catch {
        decompressed = rawStream.toString("latin1");
      }
    }

    // Capture strings inside parentheses with text-showing operators Tj, ', "
    const tjMatches = decompressed.matchAll(/\(([^)]+)\)\s*(?:Tj|'|")/g);
    for (const m of tjMatches) {
      textChunks.push(m[1]);
    }

    // Capture arrays with TJ operator: [ (foo) -10 (bar) ] TJ
    const tjArrayMatches = decompressed.matchAll(/\[([\s\S]*?)\]\s*TJ/g);
    for (const m of tjArrayMatches) {
      const inner = m[1];
      const parts = inner.matchAll(/\(([^)]+)\)/g);
      for (const p of parts) {
        textChunks.push(p[1]);
      }
    }
  }

  // Also match uncompressed text blocks if any
  if (textChunks.length === 0) {
    const directMatches = content.matchAll(/\(([^)]{2,})\)\s*(?:Tj|'|")/g);
    for (const m of directMatches) {
      textChunks.push(m[1]);
    }
  }

  return textChunks
    .join(" ")
    .replace(/\\([()\\])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts raw text from an uploaded resume file or directly supplied text
 */
async function extractResumeText(file?: File | null, rawText?: string): Promise<string> {
  if (rawText && rawText.trim().length > 30) {
    return rawText.trim();
  }

  if (!file) {
    throw new Error("No resume file or text provided.");
  }

  const fileType = file.type;
  const fileName = file.name.toLowerCase();

  if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Try PDFParse with configured worker
    try {
      ensurePdfWorker();
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      const parsedText = textResult.text?.trim();

      if (parsedText && parsedText.length >= 20) {
        return parsedText;
      }
    } catch (parseError) {
      console.warn("PDFParse worker error, falling back to stream extractor:", parseError);
    }

    // 2. Fallback to native PDF stream extractor
    try {
      const fallbackText = fallbackExtractPdfText(buffer);
      if (fallbackText && fallbackText.length >= 20) {
        return fallbackText;
      }
    } catch (fallbackError) {
      console.warn("Fallback extractor error:", fallbackError);
    }

    throw new Error(
      "Could not extract readable text from the uploaded PDF. Please make sure the PDF has selectable text (not an image-only scan) or use the 'Paste Text Instead' option."
    );
  }

  // Plain text or markdown file
  return await file.text();
}

/**
 * Deep Resume Analyzer based on Job Description (JD)
 * Evaluates ATS compatibility, missing keywords, flaws, quantifiable metrics, and generates optimized LaTeX
 */
export async function analyzeResumeWithJD(formData: FormData): Promise<{
  success: boolean;
  analysis?: DetailedResumeAnalysis;
  extractedResumeText?: string;
  error?: string;
}> {
  try {
    const file = formData.get("resume") as File | null;
    const rawResumeText = formData.get("resumeText") as string | null;
    const jobDescription = (formData.get("jobDescription") as string) || "";
    const targetRole = (formData.get("targetRole") as string) || "Software Engineer / Professional";

    const resumeText = await extractResumeText(file, rawResumeText || undefined);

    if (!resumeText || resumeText.length < 30) {
      return {
        success: false,
        error: "Please provide a valid resume file (PDF) or paste your resume content.",
      };
    }

    const jdText = jobDescription.trim().length > 20
      ? jobDescription.trim()
      : `Role: ${targetRole}. Looking for a capable, proactive engineer with modern software development skills, strong technical fundamentals, teamwork, and clean coding practices.`;

    const { object } = await generateObject({
      model: getModel(),
      schema: detailedAnalysisSchema,
      temperature: 0,
      maxOutputTokens: 10000,
      prompt: `
You are an elite Tech Recruiter, ATS (Applicant Tracking System) Specialist, and Career Coach.
Analyze the candidate's resume strictly against the provided Job Description (JD).

=== TARGET ROLE ===
${targetRole}

=== JOB DESCRIPTION (JD) ===
${jdText}

=== CANDIDATE RESUME ===
${resumeText}

=== INSTRUCTIONS & STRICT DETERMINISTIC SCORING RULES ===
Evaluate objectively and deterministically without randomness so that the same input yields identical, repeatable results:

1. overallMatchScore (0 to 100):
   - Count matchingKeywords (skills, tools, methodologies present in both JD and Resume).
   - Count missingKeywords (skills, tools, or requirements in the JD that are missing or weak in the resume).
   - Calculate strictly: Math.round((matchingKeywords.length / Math.max(1, matchingKeywords.length + missingKeywords.length)) * 100).

2. atsScore (0 to 10):
   - Evaluate standard chronological headings (Education, Experience, Skills), clear contact info, clean formatting without tables/images.
   - Start at 10 and deduct 1 point per detected structural/formatting risk. Minimum 1, maximum 10.
   - Set isAtsFriendly = true if atsScore >= 7, otherwise false.

3. quantifiableImpactScore (0 to 10):
   - Evaluate presence of quantifiable metrics (%, $, latency, scale, user count) in experience bullets:
     * > 75% bullets with metrics: 9-10
     * 50-75% bullets with metrics: 7-8
     * 25-49% bullets with metrics: 5-6
     * < 25% bullets with metrics: 2-4
     * No metrics at all: 1

4. actionVerbScore (0 to 10):
   - Evaluate strength of bullet-starting action verbs (Engineered, Architected, Spearheaded, Automated vs Managed, Worked on, Handled):
     * > 80% strong action verbs: 9-10
     * 60-80% strong verbs: 7-8
     * 40-59% strong verbs: 5-6
     * < 40% strong verbs: 2-4

5. shortlistProbability (0 to 100%):
   - MUST be computed using this EXACT weighted formula:
     shortlistProbability = Math.round(
       (overallMatchScore * 0.40) +
       ((atsScore * 10) * 0.20) +
       ((quantifiableImpactScore * 10) * 0.25) +
       ((actionVerbScore * 10) * 0.15)
     )

6. verdict:
   - "Strong Match": shortlistProbability >= 75
   - "Moderate Match": shortlistProbability >= 50 and < 75
   - "Needs Optimization": shortlistProbability >= 30 and < 50
   - "High Risk of Rejection": shortlistProbability < 30

7. missingKeywords:
   - Identify up to 6-8 most critical missing keywords or tools from the JD. Keep whyNeeded concise (1 sentence).
   - priority MUST be exactly "critical", "important", or "bonus".

8. flawsAndFixes:
   - Identify up to 3-4 specific flaws with concrete before/after bullet rewrites. Keep suggestion concise (1 sentence).

9. keyRecommendations:
   - Provide top 3-4 immediate steps candidate should take (1 sentence each).

10. Return an empty string ("") for suggestedLatexCode.
      `,
    });

    // Enforce deterministic scoring using configurable weights (Open/Closed Principle)
    const { calculateShortlistProbability, determineVerdict } = await import("@/lib/utils/scoring");

    const deterministicShortlist = calculateShortlistProbability({
      overallMatchScore: object.overallMatchScore,
      atsScore: object.atsScore,
      quantifiableImpactScore: object.quantifiableImpactScore,
      actionVerbScore: object.actionVerbScore,
    });

    object.shortlistProbability = deterministicShortlist;
    object.verdict = determineVerdict(deterministicShortlist);

    // LaTeX is generated on-demand when the user opens LaTeX Studio (faster analysis)
    const finalAnalysis: DetailedResumeAnalysis = {
      ...object,
      suggestedLatexCode: "",
    };

    return {
      success: true,
      analysis: finalAnalysis,
      extractedResumeText: resumeText,
    };
  } catch (error: unknown) {
    console.error("Error analyzing resume with JD:", error);
    const message = error instanceof Error ? error.message : "Failed to analyze resume against the job description. Please check your inputs.";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Regenerate or refine LaTeX resume with specific user instructions or added keywords.
 * Produces standard Jake's Resume / Overleaf ATS format with 100% compilation & preview accuracy.
 */
export async function generateCustomLatexResume({
  currentLatex,
  jobDescription,
  missingKeywords,
  instructions,
}: {
  currentLatex?: string;
  jobDescription?: string;
  missingKeywords?: string[];
  instructions?: string;
}): Promise<{ success: boolean; latex?: string; error?: string }> {
  try {
    const prompt = `
You are an expert LaTeX resume designer and ATS optimization specialist.
Task: Generate or improve a full, production-ready, ATS-friendly LaTeX resume document using the standard Jake's Resume / Overleaf structure.

${currentLatex ? `=== CURRENT LATEX CODE ===\n${currentLatex}\n` : ""}
${jobDescription ? `=== TARGET JOB DESCRIPTION ===\n${jobDescription}\n` : ""}
${missingKeywords && missingKeywords.length > 0 ? `=== KEYWORDS TO INTEGRATE ===\n${missingKeywords.join(", ")}\n` : ""}
${instructions ? `=== SPECIFIC USER INSTRUCTIONS & CANDIDATE DATA ===\n${instructions}\n` : ""}

CRITICAL FORMATTING REQUIREMENTS:
- Return ONLY valid, compilable LaTeX code starting with \\documentclass[letterpaper,11pt]{article} and ending with \\end{document}.
- Do NOT output any markdown backticks or fences like \`\`\`latex. Output raw LaTeX only.
- Use standard packages: latexsym, fullpage, titlesec, enumitem, hyperref, tabularx.
- Keep margins clean: 0.5 inch.
- Use the standard Jake's Resume ATS template structure:
  1. Header:
     \\begin{center}
       \\textbf{\\Huge \\scshape <Candidate Actual Name>} \\\\ \\vspace{1pt}
       \\small <Phone> $|$ \\href{mailto:<Email>}{\\underline{<Email>}} $|$ \\href{<LinkedIn URL>}{\\underline{<LinkedIn>}} $|$ \\href{<GitHub URL>}{\\underline{<GitHub>}}
     \\end{center}
  2. Sections using \\section{Title}:
     \\section{Education}
     \\section{Technical Skills}
     \\section{Experience}
     \\section{Projects}
  3. Entry headings:
     \\item \\textbf{<Job Title or Degree>} $|$ {<Company or University>} \\hfill {<Dates>}
     Followed by \\begin{itemize} ... \\end{itemize} of impact-driven bullet points.
  4. Skills formatting:
     \\item \\textbf{Languages}{: Python, TypeScript, ...} \\\\
     \\item \\textbf{Frameworks \\& Tools}{: React, Next.js, ...}
- Extract and use the CANDIDATE'S ACTUAL NAME, CONTACT DETAILS, WORK HISTORY, AND EDUCATION from the provided resume text. Do NOT use placeholder names like "Alex Morgan" or "John Doe" unless no candidate details were provided.
`;

    const { text } = await generateText({
      model: getModel(),
      temperature: 0,
      maxOutputTokens: 10000,
      prompt,
    });

    // Clean up any markdown fences and extract cleanly from \documentclass to \end{document}
    let cleanLatex = text.trim();
    const docStart = cleanLatex.indexOf("\\documentclass");
    const docEnd = cleanLatex.lastIndexOf("\\end{document}");
    if (docStart !== -1 && docEnd !== -1) {
      cleanLatex = cleanLatex.slice(docStart, docEnd + "\\end{document}".length);
    } else if (cleanLatex.startsWith("```latex")) {
      cleanLatex = cleanLatex.replace(/^```latex\n?/, "").replace(/\n?```$/, "");
    } else if (cleanLatex.startsWith("```")) {
      cleanLatex = cleanLatex.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }

    return { success: true, latex: cleanLatex.trim() };
  } catch (error: unknown) {
    console.error("Error generating custom LaTeX:", error);
    const message = error instanceof Error ? error.message : "Failed to generate customized LaTeX resume.";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Direct server action to convert any uploaded resume PDF or text to compilable LaTeX
 */
export async function convertResumeToLatexAction(formData: FormData): Promise<{
  success: boolean;
  latex?: string;
  error?: string;
}> {
  try {
    const file = formData.get("resume") as File | null;
    const rawResumeText = formData.get("resumeText") as string | null;
    const targetRole = (formData.get("targetRole") as string) || "Software Engineer / Professional";
    const jobDescription = (formData.get("jobDescription") as string) || "";

    const resumeText = await extractResumeText(file, rawResumeText || undefined);

    if (!resumeText || resumeText.length < 30) {
      return {
        success: false,
        error: "Please provide a valid resume file (PDF) or text to convert.",
      };
    }

    return await generateCustomLatexResume({
      jobDescription,
      instructions: `Candidate Resume Text:\n${resumeText.slice(0, 10000)}\n\nTarget Role: ${targetRole}. Convert this resume into a complete, clean, ATS-optimized 1-page LaTeX resume with candidate's actual details.`,
    });
  } catch (error: unknown) {
    console.error("Error converting resume to LaTeX:", error);
    const message = error instanceof Error ? error.message : "Failed to convert resume to LaTeX format.";
    return {
      success: false,
      error: message,
    };
  }
}


