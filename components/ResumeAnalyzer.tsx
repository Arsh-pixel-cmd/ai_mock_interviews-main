"use client";

import { useState } from "react";
import { Loader2, Upload, CheckCircle, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { analyzeResume } from "@/lib/actions/resume.action";
import { cn } from "@/lib/utils";

interface AnalysisResult {
  score: number;
  isAtsFriendly: boolean;
  improvements: string[];
}

const ResumeAnalyzer = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append("resume", file);

    const response = await analyzeResume(formData);

    if (response.success && response.analysis) {
      setResult(response.analysis);
    } else {
      setError(response.error || "Failed to analyze resume");
    }
    setLoading(false);
  };

  return (
    <div className="card-border w-full">
      <div className="card dark-gradient p-6 flex flex-col gap-6">
        <h2 className="text-2xl font-bold">Resume ATS Analysis</h2>
        
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
              id="resume-upload"
            />
            <label
              htmlFor="resume-upload"
              className="btn-upload flex items-center gap-2 cursor-pointer hover:bg-dark-300 transition-colors"
            >
              <Upload size={20} />
              {file ? file.name : "Upload Resume (PDF)"}
            </label>
            
            <Button
              onClick={handleAnalyze}
              disabled={!file || loading}
              className="btn-primary"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze Resume"
              )}
            </Button>
          </div>
          {error && <p className="text-destructive-100">{error}</p>}
        </div>

        {result && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-center justify-center p-4 bg-dark-200 rounded-xl min-w-[100px]">
                <span className="text-4xl font-bold text-primary-200">{result.score}/10</span>
                <span className="text-sm text-light-100">Score</span>
              </div>

              <div className="flex items-center gap-2 text-lg">
                <span className="text-light-100">ATS Friendly:</span>
                {result.isAtsFriendly ? (
                  <span className="flex items-center gap-1 text-success-100 font-bold">
                    <CheckCircle size={20} /> Yes
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-destructive-100 font-bold">
                    <XCircle size={20} /> No
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold">Improvements needed:</h3>
              <ul className="list-disc list-inside space-y-1">
                {result.improvements.map((imp, i) => (
                  <li key={i} className="text-light-100">{imp}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumeAnalyzer;
