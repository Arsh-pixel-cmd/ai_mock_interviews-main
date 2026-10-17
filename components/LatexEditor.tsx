"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { useReactToPrint } from "react-to-print";
import {
  Download,
  Copy,
  FileCode,
  FileText,
  RotateCcw,
  Sparkles,
  Maximize2,
  Columns,
  Eye,
  Code2,
  ZoomIn,
  ZoomOut,
  Plus,
  Bold,
  List,
  Check,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { LatexPreview } from "@/components/LatexPreview";
import { generateCustomLatexResume } from "@/lib/actions/resume.action";
import { DEFAULT_LATEX_TEMPLATE } from "@/constants";

interface LatexEditorProps {
  initialLatex?: string;
  missingKeywords?: MissingKeyword[];
  jobDescription?: string;
  targetRole?: string;
  onLatexChange?: (latex: string) => void;
}

export default function LatexEditor({
  initialLatex = DEFAULT_LATEX_TEMPLATE,
  missingKeywords = [],
  jobDescription = "",
  targetRole = "",
  onLatexChange,
}: LatexEditorProps) {
  const [latexCode, setLatexCode] = useState<string>(initialLatex || DEFAULT_LATEX_TEMPLATE);
  const [viewMode, setViewMode] = useState<"split" | "code" | "preview">("split");
  const [zoom, setZoom] = useState<number>(0.95);
  const [copied, setCopied] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showAiModal, setShowAiModal] = useState(false);
  const [isPendingAi, startAiTransition] = useTransition();

  const printRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync latexCode when initialLatex updates from parent
  useEffect(() => {
    if (initialLatex) {
      setLatexCode(initialLatex);
    }
  }, [initialLatex]);

  const handleCodeChange = (newCode: string) => {
    setLatexCode(newCode);
    if (onLatexChange) {
      onLatexChange(newCode);
    }
  };

  // React-to-print hook for 1-click A4 PDF export
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${targetRole ? targetRole.replace(/\s+/g, "_") : "Resume"}_ATS_Optimized`,
  });

  // Copy LaTeX code to clipboard
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(latexCode);
      setCopied(true);
      toast.success("LaTeX code copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy code");
    }
  };

  // Download .tex file
  const handleDownloadTex = () => {
    const blob = new Blob([latexCode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "resume.tex";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Downloaded resume.tex");
  };

  // Download plain text representation
  const handleDownloadTxt = () => {
    const cleanText = latexCode
      .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{[^}]*\})?/g, " ")
      .replace(/[{}]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const blob = new Blob([cleanText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "resume_text.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Downloaded plain text resume");
  };

  // Insert snippet at textarea cursor position
  const insertSnippet = (snippet: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = latexCode.substring(0, start);
    const after = latexCode.substring(end);

    const updated = before + snippet + after;
    setLatexCode(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + snippet.length, start + snippet.length);
    }, 50);
  };

  // Quick insert missing keyword into the LaTeX code
  const insertKeyword = (kw: string) => {
    insertSnippet(kw);
    toast.info(`Inserted "${kw}" at cursor position`);
  };

  // AI-powered LaTeX refinement
  const handleAiRefine = () => {
    if (!aiPrompt && missingKeywords.length === 0) {
      toast.error("Please enter instructions or select keywords to integrate.");
      return;
    }

    startAiTransition(async () => {
      const res = await generateCustomLatexResume({
        currentLatex: latexCode,
        jobDescription,
        missingKeywords: missingKeywords.map((k) => k.keyword),
        instructions: aiPrompt || "Enhance bullet points with high-impact metrics and weave in missing keywords naturally.",
      });

      if (res.success && res.latex) {
        setLatexCode(res.latex);
        setShowAiModal(false);
        setAiPrompt("");
        toast.success("LaTeX resume updated with AI optimizations!");
      } else {
        toast.error(res.error || "Failed to refine LaTeX code.");
      }
    });
  };

  // Calculate line numbers for editor
  const lineCount = latexCode.split("\n").length;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Top Studio Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-dark-200/90 rounded-2xl border border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary-200/10 text-primary-200 border border-primary-200/20">
            <FileCode size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              LaTeX Resume Studio
              <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-primary-200/20 text-primary-200 border border-primary-200/30">
                Leaflet Mode
              </span>
            </h3>
            <p className="text-xs text-light-400">
              Live compilable LaTeX with instant A4 preview & 100% ATS-parseable PDF export
            </p>
          </div>
        </div>

        {/* View Mode & Export Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-dark-300 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setViewMode("split")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "split"
                  ? "bg-primary-200 text-dark-100 font-bold shadow-sm"
                  : "text-light-100 hover:text-white"
              }`}
            >
              <Columns size={14} /> Split
            </button>
            <button
              onClick={() => setViewMode("code")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "code"
                  ? "bg-primary-200 text-dark-100 font-bold shadow-sm"
                  : "text-light-100 hover:text-white"
              }`}
            >
              <Code2 size={14} /> Code
            </button>
            <button
              onClick={() => setViewMode("preview")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "preview"
                  ? "bg-primary-200 text-dark-100 font-bold shadow-sm"
                  : "text-light-100 hover:text-white"
              }`}
            >
              <Eye size={14} /> Preview
            </button>
          </div>

          {/* AI Refine Button */}
          <Button
            onClick={() => setShowAiModal(true)}
            variant="outline"
            className="h-9 px-3 rounded-xl border-primary-200/40 bg-primary-200/10 text-primary-200 hover:bg-primary-200/20 text-xs gap-1.5 font-semibold"
          >
            <Sparkles size={14} /> AI Tailor
          </Button>

          {/* Download PDF Button */}
          <Button
            onClick={() => handlePrint()}
            className="h-9 px-4 rounded-xl bg-gradient-to-r from-primary-200 to-light-100 text-dark-100 font-bold hover:opacity-90 text-xs gap-1.5 shadow-lg shadow-primary-200/10"
          >
            <Download size={14} /> Export PDF
          </Button>

          {/* More actions menu */}
          <Button
            onClick={handleDownloadTex}
            variant="ghost"
            size="sm"
            className="h-9 px-2.5 rounded-xl text-light-100 hover:text-white hover:bg-dark-300 text-xs gap-1"
            title="Download .tex file"
          >
            <FileCode size={14} /> .tex
          </Button>
          <Button
            onClick={handleCopyCode}
            variant="ghost"
            size="sm"
            className="h-9 px-2.5 rounded-xl text-light-100 hover:text-white hover:bg-dark-300 text-xs gap-1"
            title="Copy LaTeX Code"
          >
            {copied ? <Check size={14} className="text-success-100" /> : <Copy size={14} />}
          </Button>
        </div>
      </div>

      {/* Missing Keywords Quick-Insert Bar (if any keywords exist) */}
      {missingKeywords.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-dark-200/60 rounded-xl border border-white/5 overflow-x-auto">
          <span className="text-xs font-semibold text-primary-200 whitespace-nowrap flex items-center gap-1">
            <Sparkles size={13} /> Click to insert JD keywords:
          </span>
          <div className="flex items-center gap-1.5 flex-nowrap">
            {missingKeywords.map((kw, idx) => (
              <button
                key={idx}
                onClick={() => insertKeyword(kw.keyword)}
                className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-dark-300 hover:bg-primary-200/20 hover:text-primary-200 text-light-100 border border-white/10 hover:border-primary-200/40 transition-colors whitespace-nowrap cursor-pointer"
                title={`Priority: ${kw.priority} • Click to insert into code`}
              >
                <Plus size={11} /> {kw.keyword}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Dual-Pane Studio Body */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[680px]">
        {/* LEFT: LaTeX Code Editor */}
        {(viewMode === "split" || viewMode === "code") && (
          <div
            className={`flex flex-col bg-dark-100 rounded-2xl border border-white/10 overflow-hidden shadow-xl ${
              viewMode === "code" ? "lg:col-span-2" : ""
            }`}
          >
            {/* Editor Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-dark-200 border-b border-white/5">
              <div className="flex items-center gap-1">
                <span className="text-xs font-mono font-semibold text-light-400">resume.tex</span>
                <span className="text-[10px] text-light-600 px-1.5 py-0.5 rounded bg-dark-300">
                  {lineCount} lines
                </span>
              </div>

              {/* Code Snippet Quick Buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => insertSnippet("\n\\section{New Section}\n  \\begin{itemize}[leftmargin=0.15in, label={}]\n    \\item Item text here\n  \\end{itemize}\n")}
                  className="px-2 py-1 text-[11px] rounded bg-dark-300 hover:bg-dark-100 text-light-100 hover:text-white transition-colors"
                  title="Insert Section"
                >
                  + Section
                </button>
                <button
                  onClick={() => insertSnippet("\n      \\item ")}
                  className="px-2 py-1 text-[11px] rounded bg-dark-300 hover:bg-dark-100 text-light-100 hover:text-white transition-colors flex items-center gap-1"
                  title="Insert Item"
                >
                  <List size={11} /> Item
                </button>
                <button
                  onClick={() => insertSnippet("\\textbf{Bold Text}")}
                  className="px-2 py-1 text-[11px] rounded bg-dark-300 hover:bg-dark-100 text-light-100 hover:text-white transition-colors flex items-center gap-1"
                  title="Insert Bold"
                >
                  <Bold size={11} /> Bold
                </button>
                <button
                  onClick={() => insertSnippet(" \\hfill ")}
                  className="px-2 py-1 text-[11px] rounded bg-dark-300 hover:bg-dark-100 text-light-100 hover:text-white transition-colors text-[10px]"
                  title="Insert right align space (e.g. for dates)"
                >
                  \hfill
                </button>
                <button
                  onClick={() => {
                    if (confirm("Reset to default standard ATS LaTeX template?")) {
                      setLatexCode(DEFAULT_LATEX_TEMPLATE);
                    }
                  }}
                  className="p-1 text-light-400 hover:text-destructive-100 rounded hover:bg-dark-300 transition-colors"
                  title="Reset to Template"
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            </div>

            {/* Code Input Area with Line Numbers */}
            <div className="relative flex flex-1 h-[600px] overflow-hidden font-mono text-xs">
              {/* Line Numbers column */}
              <div
                aria-hidden="true"
                className="select-none py-3 px-3 bg-dark-200/50 text-light-600 text-right font-mono border-r border-white/5 overflow-hidden w-12 shrink-0 leading-[1.625rem]"
              >
                {Array.from({ length: Math.min(lineCount, 300) }, (_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={latexCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                spellCheck={false}
                placeholder="Enter or paste your LaTeX code here..."
                className="w-full h-full p-3 bg-transparent text-light-100 font-mono text-xs leading-[1.625rem] resize-none focus:outline-none selection:bg-primary-200/30 selection:text-white overflow-y-auto whitespace-pre tab-[2]"
              />
            </div>
          </div>
        )}

        {/* RIGHT: Live A4 Resume Render Preview */}
        {(viewMode === "split" || viewMode === "preview") && (
          <div
            className={`flex flex-col bg-dark-200/40 rounded-2xl border border-white/10 overflow-hidden shadow-xl ${
              viewMode === "preview" ? "lg:col-span-2" : ""
            }`}
          >
            {/* Preview Toolbar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-dark-200 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Eye size={14} className="text-success-100" /> Live Document Preview
                </span>
                <span className="text-[10px] text-light-400 px-2 py-0.5 rounded-full bg-dark-300 border border-white/5">
                  A4 Standard (210 × 297mm)
                </span>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1.5 bg-dark-300 px-2 py-1 rounded-lg border border-white/5">
                <button
                  onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.05).toFixed(2))))}
                  className="text-light-100 hover:text-white p-0.5"
                  title="Zoom Out"
                >
                  <ZoomOut size={13} />
                </button>
                <span className="text-[11px] font-mono text-light-100 w-10 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.05).toFixed(2))))}
                  className="text-light-100 hover:text-white p-0.5"
                  title="Zoom In"
                >
                  <ZoomIn size={13} />
                </button>
                <button
                  onClick={() => setZoom(0.95)}
                  className="text-[10px] text-light-400 hover:text-white ml-1 px-1 rounded bg-dark-200"
                  title="Reset Zoom"
                >
                  Fit
                </button>
              </div>
            </div>

            {/* Scrollable Canvas for A4 Paper */}
            <div className="flex-1 max-h-[620px] overflow-y-auto overflow-x-auto p-4 bg-neutral-900/80 flex justify-center">
              <LatexPreview ref={printRef} latex={latexCode} zoom={zoom} />
            </div>
          </div>
        )}
      </div>

      {/* AI Tailoring Modal / Drawer */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg p-6 bg-dark-200 rounded-3xl border border-primary-200/30 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary-200/15 text-primary-200">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">AI LaTeX Resume Tailor</h4>
                  <p className="text-xs text-light-400">
                    Provide instructions to optimize or rewrite your LaTeX resume
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="text-light-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            {missingKeywords.length > 0 && (
              <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-dark-300 border border-white/5">
                <span className="text-xs font-semibold text-primary-200">
                  Keywords to integrate ({missingKeywords.length}):
                </span>
                <p className="text-xs text-light-100">
                  {missingKeywords.map((k) => k.keyword).join(", ")}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-light-100">
                Custom Refinement Prompt (Optional):
              </label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. Focus on quantifiable metrics for my React experience, add Docker and AWS under skills, and make the summary more concise..."
                rows={4}
                className="w-full p-3 rounded-xl bg-dark-100 border border-white/10 text-xs text-light-100 focus:outline-none focus:border-primary-200"
              />
            </div>

            <div className="flex items-center justify-end gap-3 mt-2">
              <Button
                variant="ghost"
                onClick={() => setShowAiModal(false)}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAiRefine}
                disabled={isPendingAi}
                className="btn-primary text-xs flex items-center gap-2"
              >
                {isPendingAi ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Optimizing with Groq AI...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Apply AI Enhancements
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
