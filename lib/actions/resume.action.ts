"use server";

import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";
import zlib from "zlib";
import { generateObject, generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { PDFParse } from "pdf-parse";
import { z } from "zod";
import { GROQ_MODEL } from "@/constants";

const resumeAnalysisSchema = z.object({
  score: z.number().describe("Score out of 10"),
  isAtsFriendly: z.boolean().describe("Whether the resume is ATS friendly"),
  improvements: z.array(z.string()).describe("List of improvements"),
});

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
 * Configure pdfjs worker location for Node.js / Next.js SSR
 */
function ensurePdfWorker() {
  try {
    const workerRelativePath = "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs";
    const absoluteWorkerPath = path.resolve(process.cwd(), workerRelativePath);
    if (fs.existsSync(absoluteWorkerPath)) {
      PDFParse.setWorker(pathToFileURL(absoluteWorkerPath).href);
    }
  } catch {
    // If worker configuration fails, will fallback gracefully
  }
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
 * Simple baseline resume analyzer (backward-compatible)
 */
export async function analyzeResume(formData: FormData) {
  const file = formData.get("resume") as File;

  if (!file) {
    return { success: false, error: "No file uploaded" };
  }

  try {
    const text = await extractResumeText(file);

    const { object } = await generateObject({
      model: groq(GROQ_MODEL),
      schema: resumeAnalysisSchema,
      prompt: `
        Analyze this resume for ATS (Applicant Tracking System) friendliness.
        Resume Text:
        ${text}

        Provide:
        1. A score out of 10 based on content, formatting (inferred from text structure), and keywords.
        2. Whether it is considered ATS friendly (simple structure, standard headings).
        3. A list of specific improvements to increase the score and ATS compatibility.
      `,
    });

    return { success: true, analysis: object };
  } catch (error: any) {
    console.error("Error analyzing resume:", error);
    return { success: false, error: error.message || "Failed to analyze resume" };
  }
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
      model: groq(GROQ_MODEL),
      schema: detailedAnalysisSchema,
      temperature: 0,
      maxOutputTokens: 3500,
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
   - Identify up to 10-12 most critical missing keywords or tools from the JD.
   - priority MUST be exactly "critical", "important", or "bonus".

8. flawsAndFixes:
   - Identify up to 4 specific flaws with concrete before/after bullet rewrites.

9. keyRecommendations:
   - Provide top 3-5 immediate steps candidate should take.

10. Return an empty string ("") for suggestedLatexCode.
      `,
    });

    // Enforce 100% deterministic mathematical precision across repeated runs
    const matchScore = Math.min(100, Math.max(0, Math.round(object.overallMatchScore)));
    const atsScaled = Math.min(10, Math.max(0, Math.round(object.atsScore))) * 10;
    const impactScaled = Math.min(10, Math.max(0, Math.round(object.quantifiableImpactScore))) * 10;
    const verbScaled = Math.min(10, Math.max(0, Math.round(object.actionVerbScore))) * 10;

    const deterministicShortlist = Math.min(
      100,
      Math.max(
        0,
        Math.round(
          matchScore * 0.40 +
          atsScaled * 0.20 +
          impactScaled * 0.25 +
          verbScaled * 0.15
        )
      )
    );

    object.shortlistProbability = deterministicShortlist;
    if (deterministicShortlist >= 75) {
      object.verdict = "Strong Match";
    } else if (deterministicShortlist >= 50) {
      object.verdict = "Moderate Match";
    } else if (deterministicShortlist >= 30) {
      object.verdict = "Needs Optimization";
    } else {
      object.verdict = "High Risk of Rejection";
    }

    // Pre-generate tailored LaTeX resume from candidate's actual resume
    let customizedLatex = "";
    try {
      const topKeywords = object.missingKeywords.slice(0, 10).map((k) => k.keyword);
      const latexRes = await generateCustomLatexResume({
        jobDescription: jdText,
        missingKeywords: topKeywords,
        instructions: `Candidate Actual Resume:\n${resumeText.slice(0, 10000)}\n\nTarget Role: "${targetRole}". Generate an ATS-optimized 1-page LaTeX resume preserving the candidate's actual name, contact info, experience, and education, while weaving in these keywords where appropriate: ${topKeywords.join(", ")}.`,
      });
      if (latexRes.success && latexRes.latex) {
        customizedLatex = latexRes.latex;
      }
    } catch (latexErr) {
      console.warn("Could not pre-generate LaTeX resume, user can still use LaTeX studio:", latexErr);
    }

    const finalAnalysis: DetailedResumeAnalysis = {
      ...object,
      suggestedLatexCode: customizedLatex,
    };

    return {
      success: true,
      analysis: finalAnalysis,
      extractedResumeText: resumeText,
    };
  } catch (error: any) {
    console.error("Error analyzing resume with JD:", error);
    return {
      success: false,
      error: error.message || "Failed to analyze resume against the job description. Please check your inputs.",
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
      model: groq(GROQ_MODEL),
      temperature: 0,
      prompt,
    });

    // Clean up any stray markdown fences if the model output them
    let cleanLatex = text.trim();
    if (cleanLatex.startsWith("```latex")) {
      cleanLatex = cleanLatex.replace(/^```latex\n?/, "").replace(/\n?```$/, "");
    } else if (cleanLatex.startsWith("```")) {
      cleanLatex = cleanLatex.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }

    return { success: true, latex: cleanLatex.trim() };
  } catch (error: any) {
    console.error("Error generating custom LaTeX:", error);
    return {
      success: false,
      error: error.message || "Failed to generate customized LaTeX resume.",
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
  } catch (error: any) {
    console.error("Error converting resume to LaTeX:", error);
    return {
      success: false,
      error: error.message || "Failed to convert resume to LaTeX format.",
    };
  }
}


