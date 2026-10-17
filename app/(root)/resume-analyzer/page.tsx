import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth.action";
import ResumeAnalyzerPro from "@/components/ResumeAnalyzerPro";
import { Sparkles, FileCode, CheckCircle, FileText } from "lucide-react";

export const metadata = {
  title: "Resume & ATS Analyzer with LaTeX Studio | PrepWise",
  description:
    "Analyze your resume against job descriptions, detect ATS formatting flaws & missing keywords, and edit your resume in LaTeX with instant PDF export.",
};

interface ResumeAnalyzerPageProps {
  searchParams: Promise<{
    role?: string;
    jd?: string;
  }>;
}

export default async function ResumeAnalyzerPage({
  searchParams,
}: ResumeAnalyzerPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const resolvedParams = await searchParams;
  const initialRole = resolvedParams?.role || "";
  const initialJobDescription = resolvedParams?.jd || "";

  return (
    <div className="flex flex-col gap-8 w-full max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col gap-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-200/10 text-primary-200 border border-primary-200/20 text-xs font-semibold w-fit">
          <Sparkles size={14} /> Resume Intelligence & Leaflet LaTeX Editor
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Resume ATS Analyzer & <span className="text-primary-200">LaTeX Studio</span>
        </h1>
        <p className="text-sm sm:text-base text-light-100 max-w-3xl leading-relaxed">
          Screen your resume like a recruiter. Compare your profile against any Job Description,
          uncover hidden keyword gaps, eliminate formatting flaws, and edit directly in an authentic
          LaTeX environment with pixel-perfect A4 PDF export.
        </p>

        {/* Feature Highlights Pills */}
        <div className="flex flex-wrap items-center gap-4 mt-2 pt-2 border-t border-white/5 text-xs text-light-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle size={14} className="text-success-100" /> ATS Compatibility Score (/10)
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle size={14} className="text-success-100" /> Missing JD Keywords & Titles
          </span>
          <span className="flex items-center gap-1.5">
            <FileCode size={14} className="text-primary-200" /> Leaflet / Overleaf-Style LaTeX Editor
          </span>
          <span className="flex items-center gap-1.5">
            <FileText size={14} className="text-primary-200" /> 1-Click ATS Vector PDF Export
          </span>
        </div>
      </div>

      {/* Main Analyzer Component */}
      <ResumeAnalyzerPro
        initialRole={initialRole}
        initialJobDescription={initialJobDescription}
      />
    </div>
  );
}
