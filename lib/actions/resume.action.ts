"use server";

import { generateObject, generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { PDFParse } from "pdf-parse";
import { z } from "zod";

const resumeAnalysisSchema = z.object({
  score: z.number().describe("Score out of 10"),
  isAtsFriendly: z.boolean().describe("Whether the resume is ATS friendly"),
  improvements: z.array(z.string()).describe("List of improvements"),
});

const detailedAnalysisSchema = z.object({
  overallMatchScore: z.number().min(0).max(100).describe("Overall JD match percentage (0-100)"),
  atsScore: z.number().min(0).max(10).describe("ATS Friendliness score out of 10"),
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
      category: z.enum(["technical", "soft-skills", "domain", "tools"]),
      priority: z.enum(["critical", "important", "bonus"]),
      whyNeeded: z.string().describe("Why this keyword is critical for this JD"),
    })
  ).describe("Key terms, tools, or titles found in the JD but absent or weak in the resume"),
  matchingKeywords: z.array(z.string()).describe("Keywords found in both JD and resume"),
  flawsAndFixes: z.array(
    z.object({
      category: z.enum(["impact", "formatting", "brevity", "skills", "contact"]),
      flaw: z.string().describe("Specific weakness or flaw detected in the resume"),
      suggestion: z.string().describe("Actionable fix to resolve this flaw"),
      exampleRewrite: z.string().optional().describe("Concrete before/after bullet rewrite example"),
    })
  ).describe("List of flaws, weak action verbs, lack of metrics, or formatting risks"),
  quantifiableImpactScore: z.number().min(0).max(10).describe("Score evaluating metrics, percentages, dollar values vs passive duties"),
  actionVerbScore: z.number().min(0).max(10).describe("Strength of bullet point action verbs"),
  verdict: z.enum(["Strong Match", "Moderate Match", "Needs Optimization", "High Risk of Rejection"]),
  shortlistProbability: z.number().min(0).max(100).describe("Estimated likelihood of getting past recruiter ATS screening (0-100%)"),
  keyRecommendations: z.array(z.string()).describe("Top 3-5 immediate steps candidate should take"),
  suggestedLatexCode: z.string().describe("Complete, clean, standard LaTeX resume document incorporating the candidate's info and weaving in the missing keywords cleanly into bullet points using standard modern tech resume structure"),
});

// Default fallback LaTeX resume template
export const DEFAULT_LATEX_TEMPLATE = `\\documentclass[letterpaper,11pt]{article}

\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}

\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

\\begin{document}

%----------HEADING----------
\\begin{center}
    \\textbf{\\Huge \\scshape Alex Morgan} \\\\ \\vspace{1pt}
    \\small +1 (555) 019-2834 $|$ \\href{mailto:alex.morgan@email.com}{\\underline{alex.morgan@email.com}} $|$ 
    \\href{https://linkedin.com/in/alexmorgan}{\\underline{linkedin.com/in/alexmorgan}} $|$
    \\href{https://github.com/alexmorgan}{\\underline{github.com/alexmorgan}}
\\end{center}

%-----------EDUCATION-----------
\\section{Education}
  \\begin{itemize}[leftmargin=0.15in, label={}]
    \\item
      \\textbf{University of California, Berkeley}{ -- B.S. in Computer Science} \\hfill {Aug 2020 -- May 2024} \\\\
      Relevant Coursework: Data Structures, Algorithms, Distributed Systems, Database Systems, Web Architecture
  \\end{itemize}

%-----------TECHNICAL SKILLS-----------
\\section{Technical Skills}
 \\begin{itemize}[leftmargin=0.15in, label={}]
    \\small{\\item{
     \\textbf{Languages}{: TypeScript, JavaScript, Python, SQL, HTML5, CSS3} \\\\
     \\textbf{Frameworks \\& Libraries}{: React.js, Next.js, Node.js, Express, Tailwind CSS, Redux} \\\\
     \\textbf{Developer Tools}{: Git, GitHub Actions, Docker, AWS (S3, Lambda), Vercel, Postman} \\\\
     \\textbf{Databases \\& Cloud}{: PostgreSQL, MongoDB, Redis, Cloudflare D1}
    }}
 \\end{itemize}

%-----------EXPERIENCE-----------
\\section{Experience}
  \\begin{itemize}[leftmargin=0.15in, label={}]
    \\item
      \\textbf{Software Engineer Intern} $|$ {TechCorp Solutions} \\hfill {Jun 2023 -- Aug 2023}
      \\begin{itemize}
        \\item Engineered responsive front-end components using React and TypeScript, increasing user session engagement by 28\\%.
        \\item Optimized RESTful API endpoints and reduced database query latency by 42\\% across high-traffic microservices.
        \\item Implemented automated CI/CD pipelines with GitHub Actions, cutting release deployment cycles from 45 to 12 minutes.
      \\end{itemize}
  \\end{itemize}

%-----------PROJECTS-----------
\\section{Projects}
  \\begin{itemize}[leftmargin=0.15in, label={}]
    \\item
      \\textbf{AI Mock Interview Platform} $|$ \\emph{Next.js, TypeScript, Groq AI, Tailwind CSS} \\hfill {Jan 2024 -- Present}
      \\begin{itemize}
        \\item Architected real-time conversational voice interview agent using WebRTC and speech recognition with sub-second latency.
        \\item Designed automated feedback scoring engine delivering detailed category rubrics and ATS resume evaluations.
      \\end{itemize}
  \\end{itemize}

\\end{document}`;

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
    const parser = new PDFParse({ data: arrayBuffer });
    const textResult = await parser.getText();
    const parsedText = textResult.text?.trim();

    if (!parsedText || parsedText.length < 20) {
      throw new Error(
        "Could not extract readable text from the uploaded PDF. Please make sure the PDF is not an image-only scan or copy-paste your resume text."
      );
    }
    return parsedText;
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
      model: groq("llama-3.3-70b-versatile"),
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
      model: groq("llama-3.3-70b-versatile"),
      schema: detailedAnalysisSchema,
      prompt: `
You are an elite Tech Recruiter, ATS (Applicant Tracking System) Specialist, and Career Coach.
Analyze the candidate's resume strictly against the provided Job Description (JD).

=== TARGET ROLE ===
${targetRole}

=== JOB DESCRIPTION (JD) ===
${jdText}

=== CANDIDATE RESUME ===
${resumeText}

=== INSTRUCTIONS ===
1. Analyze how well the resume matches the JD (overallMatchScore from 0 to 100).
2. Evaluate ATS friendliness (atsScore 0 to 10). Check if standard headings, no weird tables/graphics, simple text parsing work.
3. Identify all critical MISSING KEYWORDS and technologies from the JD that the candidate did NOT explicitly mention. Categorize them (technical, soft-skills, domain, tools) with priority.
4. List MATCHING KEYWORDS already present.
5. Identify RESUME FLAWS: weak action verbs (e.g. "responsible for", "helped"), lack of quantifiable impact (missing % numbers, scale, revenue, latency improvements), formatting risks, or fluff. Provide concrete before-and-after rewrite examples for each flaw!
6. Calculate quantifiableImpactScore (0-10) and actionVerbScore (0-10).
7. Calculate shortlistProbability (0-100%) reflecting real-world chances of passing both automated ATS and the hiring manager's 6-second scan.
8. Generate suggestedLatexCode: Write a COMPLETE, compile-ready LaTeX document (using standard packages like hyperref, enumitem, titlesec) in clean Jake's Resume / Overleaf style. Populate it with the candidate's real experience, education, and skills from the resume, BUT rewrite weak bullets with high-impact action verbs + metrics and weave in the missing keywords naturally so it scores 95%+ on this JD!
Do NOT use markdown code fences in the suggestedLatexCode field; return raw LaTeX string.
      `,
    });

    return {
      success: true,
      analysis: object,
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
 * Regenerate or refine LaTeX resume with specific user instructions or added keywords
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
Task: Generate or improve a full, production-ready, ATS-friendly LaTeX resume document.

${currentLatex ? `=== CURRENT LATEX CODE ===\n${currentLatex}\n` : ""}
${jobDescription ? `=== TARGET JOB DESCRIPTION ===\n${jobDescription}\n` : ""}
${missingKeywords && missingKeywords.length > 0 ? `=== KEYWORDS TO INTEGRATE ===\n${missingKeywords.join(", ")}\n` : ""}
${instructions ? `=== SPECIFIC USER INSTRUCTIONS ===\n${instructions}\n` : ""}

REQUIREMENTS:
- Return ONLY valid, compilable LaTeX code.
- No markdown formatting, no backticks, no markdown fences like \`\`\`latex.
- Use standard packages: article, latexsym, fullpage, titlesec, enumitem, hyperref, tabularx.
- Keep margins clean and consistent (0.5 inch).
- Use professional bullet points with strong action verbs and quantifiable results.
- Ensure the LaTeX code starts with \\documentclass and ends with \\end{document}.
`;

    const { text } = await generateText({
      model: groq("llama-3.3-70b-versatile"),
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

