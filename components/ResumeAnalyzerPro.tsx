"use client";

import { useState, useTransition } from "react";
import {
  Upload,
  FileText,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Briefcase,
  Layers,
  ArrowRight,
  RefreshCw,
  Copy,
  ChevronDown,
  ChevronUp,
  Sliders,
  FileCode,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  ListFilter,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import LatexEditor from "@/components/LatexEditor";
import { analyzeResumeWithJD, convertResumeToLatexAction } from "@/lib/actions/resume.action";
import { DEFAULT_LATEX_TEMPLATE } from "@/constants";

interface ResumeAnalyzerProProps {
  initialRole?: string;
  initialJobDescription?: string;
  defaultTab?: "analyze" | "latex";
}

// Sample job descriptions for quick testing & instant delight
const SAMPLE_JDS = [
  {
    role: "Full Stack Engineer",
    description: `We are looking for a Senior Full Stack Engineer proficient in Next.js, React, TypeScript, and Node.js.
Requirements:
- 3+ years building scalable modern web applications.
- Deep experience with SQL/PostgreSQL, database query optimization, and REST/GraphQL APIs.
- Familiarity with Cloudflare Workers/D1, Docker containerization, and AWS serverless architecture.
- Demonstrated experience collaborating in Agile teams, automated CI/CD pipelines, and writing unit/integration tests with Jest.
- Strong knowledge of web performance, caching with Redis, and web security best practices.`,
  },
  {
    role: "Frontend Developer",
    description: `Seeking a talented Frontend Developer passionate about fluid UI/UX, micro-animations, and clean component architecture.
Key Requirements:
- Expert in React 19, TypeScript, Tailwind CSS, and Next.js App Router.
- Experience with state management, accessibility (a11y), responsive design, and cross-browser testing.
- Track record of optimizing Web Vitals (LCP, FID, CLS) and client-side rendering performance.
- Collaboration with Figma UI designers and integrating AI/Vapi/LLM endpoints.`,
  },
  {
    role: "AI / Machine Learning Engineer",
    description: `Join our AI team to build real-time conversational agents and intelligent document pipelines.
Requirements:
- Hands-on experience with Python, PyTorch, LangChain, Vercel AI SDK, and modern LLM APIs (Groq, OpenAI, Gemini).
- Experience building RAG (Retrieval-Augmented Generation) with vector embeddings (Pinecone/pgvector).
- Knowledge of prompt engineering, model evaluation, fine-tuning, and low-latency inference streaming.
- Solid backend API development with FastAPI/Node.js and Docker deployment.`,
  },
];

export default function ResumeAnalyzerPro({
  initialRole = "",
  initialJobDescription = "",
  defaultTab = "analyze",
}: ResumeAnalyzerProProps) {
  const [activeTab, setActiveTab] = useState<"analyze" | "latex">(defaultTab);
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [useTextMode, setUseTextMode] = useState(false);
  const [targetRole, setTargetRole] = useState(initialRole || "Full Stack Developer");
  const [jobDescription, setJobDescription] = useState(initialJobDescription);
  const [analysis, setAnalysis] = useState<DetailedResumeAnalysis | null>(null);
  const [latexCode, setLatexCode] = useState<string>(DEFAULT_LATEX_TEMPLATE);
  const [expandedFlawIdx, setExpandedFlawIdx] = useState<number | null>(null);
  const [keywordFilter, setKeywordFilter] = useState<"all" | "critical" | "important" | "bonus">("all");
  const [copiedKeyword, setCopiedKeyword] = useState<string | null>(null);
  const [latexConverting, setLatexConverting] = useState(false);

  const [isPending, startTransition] = useTransition();

  // Handle PDF file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (!selected.name.toLowerCase().endsWith(".pdf") && selected.type !== "application/pdf") {
        toast.error("Please upload a PDF document.");
        return;
      }
      setFile(selected);
      toast.success(`Loaded: ${selected.name}`);
    }
  };

  // Run deep JD & ATS analysis
  const handleAnalyze = () => {
    if (!file && (!resumeText || resumeText.trim().length < 30)) {
      toast.error("Please upload a resume PDF or paste your resume text.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      if (file) {
        formData.append("resume", file);
      }
      if (resumeText) {
        formData.append("resumeText", resumeText);
      }
      formData.append("jobDescription", jobDescription);
      formData.append("targetRole", targetRole);

      const res = await analyzeResumeWithJD(formData);

      if (res.success && res.analysis) {
        setAnalysis(res.analysis);
        if (res.analysis.suggestedLatexCode) {
          setLatexCode(res.analysis.suggestedLatexCode);
        }
        toast.success("Resume analysis complete!");
      } else {
        toast.error(res.error || "Analysis failed. Please try again.");
      }
    });
  };

  // Open LaTeX Studio & guarantee automatic conversion from uploaded resume if not already done
  const handleOpenLatexStudio = () => {
    setActiveTab("latex");

    // If analysis already pre-generated customized LaTeX, ensure it's loaded
    if (analysis?.suggestedLatexCode) {
      setLatexCode(analysis.suggestedLatexCode);
      return;
    }

    // If user has uploaded a file or entered text, but latexCode is still the default template, convert automatically
    if (
      (file || (resumeText && resumeText.trim().length >= 30)) &&
      latexCode === DEFAULT_LATEX_TEMPLATE
    ) {
      setLatexConverting(true);
      startTransition(async () => {
        const formData = new FormData();
        if (file) formData.append("resume", file);
        if (resumeText) formData.append("resumeText", resumeText);
        formData.append("targetRole", targetRole);
        formData.append("jobDescription", jobDescription);

        try {
          const res = await convertResumeToLatexAction(formData);
          if (res.success && res.latex) {
            setLatexCode(res.latex);
            toast.success("Resume successfully converted to LaTeX!");
          } else {
            toast.error(res.error || "Could not convert resume automatically. Paste LaTeX code manually in the editor.");
          }
        } catch {
          toast.error("Conversion failed. You can paste your LaTeX code manually in the editor.");
        } finally {
          setLatexConverting(false);
        }
      });
    }
  };

  // Filter missing keywords
  const filteredKeywords = analysis?.missingKeywords.filter((k) => {
    if (keywordFilter === "all") return true;
    return k.priority === keywordFilter;
  });

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Tab Switcher Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-2 bg-dark-200/80 rounded-2xl border border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-2 p-1 bg-dark-300 rounded-xl">
          <button
            onClick={() => setActiveTab("analyze")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "analyze"
                ? "bg-primary-200 text-dark-100 shadow-md font-bold"
                : "text-light-100 hover:text-white"
            }`}
          >
            <Briefcase size={16} /> 1. ATS & JD Analyzer
          </button>
          <button
            onClick={handleOpenLatexStudio}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "latex"
                ? "bg-primary-200 text-dark-100 shadow-md font-bold"
                : "text-light-100 hover:text-white"
            }`}
          >
            <FileCode size={16} /> 2. LaTeX Studio & PDF Export
            {(analysis?.suggestedLatexCode || latexCode !== DEFAULT_LATEX_TEMPLATE) && (
              <span className="w-2 h-2 rounded-full bg-success-100 animate-pulse" />
            )}
          </button>
        </div>

        {analysis && (
          <div className="flex items-center gap-3 pr-2">
            <span className="text-xs text-light-400">Shortlist Probability:</span>
            <span className="text-sm font-bold text-success-100 px-3 py-1 rounded-full bg-success-100/10 border border-success-100/30">
              {analysis.shortlistProbability}%
            </span>
          </div>
        )}
      </div>

      {/* TAB 1: ATS & JD ANALYZER */}
      {activeTab === "analyze" && (
        <div className="flex flex-col gap-8">
          {/* Input Section Card */}
          <div className="card-border w-full">
            <div className="card dark-gradient p-6 sm:p-8 flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="text-primary-200" size={26} />
                  AI Resume & Job Description Matcher
                </h2>
                <p className="text-sm text-light-100">
                  Upload your candidate resume and specify the target Job Description to detect
                  critical missing keywords, ATS formatting flaws, and calculate your recruiter
                  shortlist probability.
                </p>
              </div>

              {/* Grid: Resume Input (Left) + Job Description (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LEFT: Resume Upload / Text */}
                <div className="flex flex-col gap-4 p-5 rounded-2xl bg-dark-200/50 border border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                      <FileText size={16} className="text-primary-200" />
                      Candidate Resume
                    </span>
                    <button
                      onClick={() => setUseTextMode(!useTextMode)}
                      className="text-xs text-primary-200 hover:underline"
                    >
                      {useTextMode ? "Switch to PDF Upload" : "Paste Text Instead"}
                    </button>
                  </div>

                  {!useTextMode ? (
                    <div className="flex flex-col gap-3">
                      <label
                        htmlFor="resume-pro-upload"
                        className="flex flex-col items-center justify-center min-h-[180px] p-6 border-2 border-dashed border-white/20 hover:border-primary-200/60 rounded-2xl cursor-pointer bg-dark-300/40 hover:bg-dark-300/70 transition-all text-center group"
                      >
                        <Upload
                          size={32}
                          className="text-light-400 group-hover:text-primary-200 mb-2 transition-colors"
                        />
                        <span className="text-sm font-medium text-white">
                          {file ? file.name : "Drop resume PDF here or click to browse"}
                        </span>
                        <span className="text-xs text-light-400 mt-1">
                          Standard PDF files supported (Max 10MB)
                        </span>
                      </label>
                      <input
                        id="resume-pro-upload"
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      {file && (
                        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-dark-300 text-xs">
                          <span className="text-success-100 font-medium truncate max-w-[260px]">
                            ✓ {file.name} ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                          <button
                            onClick={() => setFile(null)}
                            className="text-light-400 hover:text-destructive-100 text-xs"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <textarea
                      value={resumeText}
                      onChange={(e) => setResumeText(e.target.value)}
                      placeholder="Paste your plain text resume or work experience here..."
                      rows={7}
                      className="w-full p-4 rounded-xl bg-dark-300 border border-white/10 text-xs text-light-100 focus:outline-none focus:border-primary-200 font-mono resize-none"
                    />
                  )}

                  {/* Target Role Field */}
                  <div className="flex flex-col gap-1.5 mt-1">
                    <label className="text-xs font-semibold text-light-100">Target Role Title</label>
                    <input
                      type="text"
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      placeholder="e.g. Senior Frontend Developer"
                      className="px-4 py-2.5 rounded-xl bg-dark-300 border border-white/10 text-xs text-white focus:outline-none focus:border-primary-200"
                    />
                  </div>
                </div>

                {/* RIGHT: Job Description */}
                <div className="flex flex-col gap-4 p-5 rounded-2xl bg-dark-200/50 border border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                      <Briefcase size={16} className="text-primary-200" />
                      Job Description (JD)
                    </span>
                    <span className="text-[11px] text-light-400">Quick load sample:</span>
                  </div>

                  {/* Quick sample JD buttons */}
                  <div className="flex flex-wrap gap-1.5">
                    {SAMPLE_JDS.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setTargetRole(s.role);
                          setJobDescription(s.description);
                          toast.info(`Loaded sample JD: ${s.role}`);
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-dark-300 hover:bg-primary-200/20 hover:text-primary-200 text-light-100 border border-white/5 transition-colors"
                      >
                        {s.role}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the target job description, qualifications, and tech stack here..."
                    rows={8}
                    className="w-full p-4 rounded-xl bg-dark-300 border border-white/10 text-xs text-light-100 focus:outline-none focus:border-primary-200 resize-none font-sans"
                  />
                </div>
              </div>

              {/* Action Button */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-white/5">
                <p className="text-xs text-light-400">
                  Powered by Groq AI (Llama 3.3 70B) • Multi-factor ATS rubric evaluation
                </p>

                <Button
                  onClick={handleAnalyze}
                  disabled={isPending || (!file && (!resumeText || resumeText.length < 30))}
                  className="btn-primary w-full sm:w-auto px-8 py-3 text-sm flex items-center justify-center gap-2 shadow-xl shadow-primary-200/20"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Scanning ATS & Keywords...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Analyze Resume & Check ATS Match
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Analysis Results Section */}
          {analysis && (
            <div className="flex flex-col gap-8 animate-fadeIn">
              {/* TOP HERO METRICS CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Shortlist Probability */}
                <div className="p-6 rounded-2xl bg-dark-200/90 border border-white/10 flex flex-col gap-2 relative overflow-hidden">
                  <span className="text-xs font-semibold text-light-400 uppercase tracking-wider">
                    Shortlist Chance
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-white">
                      {analysis.shortlistProbability}%
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        analysis.shortlistProbability >= 75
                          ? "bg-success-100/20 text-success-100"
                          : analysis.shortlistProbability >= 50
                          ? "bg-yellow-500/20 text-yellow-300"
                          : "bg-destructive-100/20 text-destructive-100"
                      }`}
                    >
                      {analysis.verdict}
                    </span>
                  </div>
                  <p className="text-xs text-light-400 mt-1">
                    Chance of passing automated ATS filters & initial recruiter review
                  </p>
                </div>

                {/* 2. ATS Compatibility */}
                <div className="p-6 rounded-2xl bg-dark-200/90 border border-white/10 flex flex-col gap-2">
                  <span className="text-xs font-semibold text-light-400 uppercase tracking-wider">
                    ATS Friendliness
                  </span>
                  <div className="flex items-center gap-2">
                    {analysis.isAtsFriendly ? (
                      <div className="flex items-center gap-1.5 text-success-100 font-bold text-xl">
                        <ShieldCheck size={24} /> ATS Friendly
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-destructive-100 font-bold text-xl">
                        <ShieldAlert size={24} /> Formatting Risk
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-light-400 mt-1">
                    Score: <strong className="text-white">{analysis.atsScore}/10</strong> •{" "}
                    {analysis.atsSummary}
                  </p>
                </div>

                {/* 3. JD Match Score */}
                <div className="p-6 rounded-2xl bg-dark-200/90 border border-white/10 flex flex-col gap-2">
                  <span className="text-xs font-semibold text-light-400 uppercase tracking-wider">
                    JD Match Score
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-primary-200">
                      {analysis.overallMatchScore}%
                    </span>
                  </div>
                  <p className="text-xs text-light-400 mt-1">
                    Alignment with skills, responsibilities, and seniority in the JD
                  </p>
                </div>

                {/* 4. Action & Impact Score */}
                <div className="p-6 rounded-2xl bg-dark-200/90 border border-white/10 flex flex-col gap-2">
                  <span className="text-xs font-semibold text-light-400 uppercase tracking-wider">
                    Impact & Metrics
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-white">
                      {analysis.quantifiableImpactScore}
                      <span className="text-sm font-normal text-light-400">/10</span>
                    </span>
                    <span className="text-xs text-light-400">
                      (Verbs: {analysis.actionVerbScore}/10)
                    </span>
                  </div>
                  <p className="text-xs text-light-400 mt-1">
                    Presence of quantifiable outcomes (%, $, latency) vs passive duties
                  </p>
                </div>
              </div>

              {/* Callout to open in LaTeX studio */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-primary-200/20 via-primary-200/10 to-transparent border border-primary-200/30">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-primary-200/20 text-primary-200">
                    <FileCode size={24} />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">
                      Ready to fix flaws and achieve a 95%+ shortlist score?
                    </h4>
                    <p className="text-xs text-light-100">
                      Groq AI generated an ATS-optimized LaTeX resume for you with missing keywords
                      integrated.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleOpenLatexStudio}
                  className="btn-primary flex items-center gap-2 whitespace-nowrap text-xs"
                >
                  Edit in LaTeX Studio & Export PDF <ArrowRight size={14} />
                </Button>
              </div>

              {/* SECTION: MISSING KEYWORDS (CRITICAL REQUIREMENT) */}
              <div className="flex flex-col gap-4 p-6 rounded-2xl bg-dark-200/90 border border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <AlertTriangle size={20} className="text-yellow-400" />
                      Missing Keywords & Required Skills ({analysis.missingKeywords.length})
                    </h3>
                    <p className="text-xs text-light-400">
                      These keywords appear in the JD but are missing or underrepresented on your
                      resume. Click any keyword to copy it or insert into LaTeX.
                    </p>
                  </div>

                  {/* Priority Filters */}
                  <div className="flex items-center gap-1 bg-dark-300 p-1 rounded-xl text-xs">
                    {(["all", "critical", "important", "bonus"] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setKeywordFilter(filter)}
                        className={`px-2.5 py-1 rounded-lg capitalize font-medium transition-all ${
                          keywordFilter === filter
                            ? "bg-primary-200 text-dark-100 font-bold"
                            : "text-light-100 hover:text-white"
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Keyword Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                  {filteredKeywords?.map((kw, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl bg-dark-300/80 border border-white/5 hover:border-primary-200/40 transition-all flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-sm text-white">{kw.keyword}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            kw.priority === "critical"
                              ? "bg-destructive-100/20 text-destructive-100"
                              : kw.priority === "important"
                              ? "bg-yellow-500/20 text-yellow-300"
                              : "bg-primary-200/20 text-primary-200"
                          }`}
                        >
                          {kw.priority}
                        </span>
                      </div>

                      <p className="text-xs text-light-400 leading-snug">{kw.whyNeeded}</p>

                      <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
                        <span className="text-light-600 capitalize">{kw.category}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(kw.keyword);
                            setCopiedKeyword(kw.keyword);
                            toast.success(`Copied "${kw.keyword}"`);
                            setTimeout(() => setCopiedKeyword(null), 1500);
                          }}
                          className="flex items-center gap-1 text-primary-200 hover:underline"
                        >
                          {copiedKeyword === kw.keyword ? (
                            <>
                              <Check size={11} className="text-success-100" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy size={11} /> Copy
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Matching Keywords List */}
                {analysis.matchingKeywords.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/5 flex flex-col gap-2">
                    <span className="text-xs font-semibold text-success-100 flex items-center gap-1.5">
                      <CheckCircle size={14} /> Already Matched in Your Resume (
                      {analysis.matchingKeywords.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.matchingKeywords.map((m, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 text-xs rounded-md bg-success-100/10 text-success-100 border border-success-100/20"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION: FLAWS & ACTIONABLE REWRITES */}
              <div className="flex flex-col gap-4 p-6 rounded-2xl bg-dark-200/90 border border-white/10">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <XCircle size={20} className="text-destructive-100" />
                    Detected Resume Flaws & Actionable Rewrites ({analysis.flawsAndFixes.length})
                  </h3>
                  <p className="text-xs text-light-400">
                    Specific weaknesses in formatting, impact metrics, and action verbs with concrete
                    rewrites to fix them.
                  </p>
                </div>

                <div className="flex flex-col gap-3 mt-2">
                  {analysis.flawsAndFixes.map((flaw, idx) => {
                    const isExpanded = expandedFlawIdx === idx;
                    return (
                      <div
                        key={idx}
                        className="rounded-xl bg-dark-300/80 border border-white/5 overflow-hidden transition-all"
                      >
                        <button
                          onClick={() => setExpandedFlawIdx(isExpanded ? null : idx)}
                          className="w-full p-4 text-left flex items-center justify-between gap-4 hover:bg-dark-300 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-dark-200 text-light-400">
                              {flaw.category}
                            </span>
                            <span className="text-sm font-semibold text-white">{flaw.flaw}</span>
                          </div>
                          {isExpanded ? (
                            <ChevronUp size={18} className="text-light-400 shrink-0" />
                          ) : (
                            <ChevronDown size={18} className="text-light-400 shrink-0" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="p-4 pt-0 border-t border-white/5 flex flex-col gap-3 text-xs">
                            <div className="p-3 rounded-lg bg-dark-100/70 border border-white/5">
                              <span className="font-bold text-primary-200 block mb-1">
                                Recommendation:
                              </span>
                              <p className="text-light-100 leading-relaxed">{flaw.suggestion}</p>
                            </div>

                            {flaw.exampleRewrite && flaw.exampleRewrite.trim().length > 0 && (
                              <div className="p-3 rounded-lg bg-success-100/10 border border-success-100/20">
                                <span className="font-bold text-success-100 block mb-1">
                                  High-Impact Before/After Rewrite:
                                </span>
                                <p className="font-mono text-light-100 leading-relaxed">
                                  {flaw.exampleRewrite}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Key Recommendations Checklist */}
              {analysis.keyRecommendations.length > 0 && (
                <div className="p-6 rounded-2xl bg-dark-200/90 border border-white/10 flex flex-col gap-3">
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <Sparkles size={18} className="text-primary-200" />
                    Top Recommendations to Shortlist Your Resume:
                  </h4>
                  <ul className="space-y-2 mt-1">
                    {analysis.keyRecommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-light-100">
                        <span className="flex-center w-5 h-5 rounded-full bg-primary-200/20 text-primary-200 font-bold text-[11px] shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LATEX STUDIO & PDF EXPORT */}
      {activeTab === "latex" && (
        <div className="flex flex-col gap-4 animate-fadeIn relative">
          {/* Loading overlay while converting resume to LaTeX */}
          {latexConverting && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-dark-100/90 backdrop-blur-sm rounded-2xl">
              <div className="flex flex-col items-center gap-5">
                {/* Animated document icon */}
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-200/30 to-primary-200/5 border border-primary-200/30 flex items-center justify-center animate-pulse">
                    <FileCode size={36} className="text-primary-200" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-dark-200 border-2 border-primary-200/50 flex items-center justify-center">
                    <Loader2 size={16} className="text-primary-200 animate-spin" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-lg">Converting Resume to LaTeX</p>
                  <p className="text-light-400 text-sm mt-1 max-w-xs">
                    AI is analyzing your resume and generating ATS-optimized LaTeX code...
                  </p>
                </div>
                {/* Progress bar animation */}
                <div className="w-64 h-1.5 bg-dark-300 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary-200 to-light-100 rounded-full animate-progress" />
                </div>
              </div>
            </div>
          )}
          <LatexEditor
            initialLatex={latexCode}
            missingKeywords={analysis?.missingKeywords || []}
            jobDescription={jobDescription}
            targetRole={targetRole}
            onLatexChange={setLatexCode}
          />
        </div>
      )}
    </div>
  );
}
