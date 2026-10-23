"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import dayjs from "dayjs";
import { useReactToPrint } from "react-to-print";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button"; 
import ResumeAnalyzerPro from "@/components/ResumeAnalyzerPro";

interface FeedbackContentProps {
  feedback: Feedback;
  interview: Interview;
  feedbackId?: string;
}

const FeedbackContent = ({ feedback, interview }: FeedbackContentProps) => {
  const contentRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = useReactToPrint({
    contentRef: contentRef,
    documentTitle: `Feedback - ${interview.role}`,
  });

  return (
    <section className="section-feedback">
      <div className="flex justify-end mb-4">
        <Button onClick={() => handlePrint()} className="btn-secondary gap-2">
          <Download size={18} /> Download PDF
        </Button>
      </div>

      <div ref={contentRef} className="p-8 bg-dark-100 rounded-2xl print:bg-white print:text-black print:p-0">
        <div className="flex flex-col gap-8">
          <div className="flex flex-row justify-center">
            <h1 className="text-4xl font-semibold text-center">
              Feedback on the Interview <br />
              <span className="capitalize text-primary-200 print:text-black">{interview.role}</span> Interview
            </h1>
          </div>

          <div className="flex flex-row justify-center ">
            <div className="flex flex-row gap-5">
              {/* Overall Impression */}
              <div className="flex flex-row gap-2 items-center">
                <Image src="/star.svg" width={22} height={22} alt="star" className="print:hidden"/>
                <p className="text-xl">
                  Overall Impression:{" "}
                  <span className="text-primary-200 font-bold text-2xl print:text-black">
                    {feedback?.totalScore}
                  </span>
                  /100
                </p>
              </div>

              {/* Date */}
              <div className="flex flex-row gap-2 items-center">
                <Image src="/calendar.svg" width={22} height={22} alt="calendar" className="print:hidden"/>
                <p className="text-light-100 print:text-gray-600">
                  {feedback?.createdAt
                    ? dayjs(feedback.createdAt).format("MMM D, YYYY h:mm A")
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>

          <hr className="border-gray-700 print:border-gray-300" />

          <p className="text-lg leading-relaxed">{feedback?.finalAssessment}</p>

          {/* Interview Breakdown */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold">Breakdown of the Interview:</h2>
            {feedback?.categoryScores?.map((category, index) => (
              <div key={index} className="bg-dark-200 p-4 rounded-xl print:bg-gray-100 print:border">
                <p className="font-bold text-lg mb-1">
                  {index + 1}. {category.name} ({category.score}/100)
                </p>
                <p className="text-light-100 print:text-black">{category.comment}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex flex-col gap-3">
              <h3 className="text-xl font-bold text-success-100 print:text-green-700">Strengths</h3>
              <ul className="list-disc list-inside space-y-2">
                {feedback?.strengths?.map((strength, index) => (
                  <li key={index} className="text-light-100 print:text-black">{strength}</li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-xl font-bold text-destructive-100 print:text-red-700">Areas for Improvement</h3>
              <ul className="list-disc list-inside space-y-2">
                {feedback?.areasForImprovement?.map((area, index) => (
                  <li key={index} className="text-light-100 print:text-black">{area}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Question-by-Question Detailed Review & Model Answers */}
          {feedback?.questionReviews && feedback.questionReviews.length > 0 && (
            <div className="flex flex-col gap-6 pt-6 border-t border-gray-700 print:border-gray-300">
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wider font-bold text-primary-200 print:text-black">
                  Detailed Answer Review • Candidate vs Model Answer
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-white print:text-black">
                  Question-by-Question Breakdown
                </h2>
                <p className="text-sm text-light-400 print:text-gray-600">
                  Compare the exact answers you gave during the mock interview against industry-standard senior model answers.
                </p>
              </div>

              <div className="flex flex-col gap-6">
                {feedback.questionReviews.map((review, idx) => {
                  const scoreColor =
                    review.score >= 80
                      ? "text-success-100 border-success-100/30 bg-success-100/10"
                      : review.score >= 60
                      ? "text-primary-200 border-primary-200/30 bg-primary-200/10"
                      : "text-destructive-100 border-destructive-100/30 bg-destructive-100/10";

                  return (
                    <div
                      key={idx}
                      className="p-6 rounded-2xl bg-dark-200/90 border border-white/10 print:bg-white print:border-gray-300 flex flex-col gap-5 shadow-lg"
                    >
                      {/* Question Header & Score */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10 print:border-gray-200">
                        <div className="flex items-start gap-3">
                          <span className="size-7 rounded-lg bg-primary-200/20 text-primary-200 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5 print:bg-gray-200 print:text-black">
                            Q{review.questionNumber || idx + 1}
                          </span>
                          <h3 className="!text-lg font-bold text-white print:text-black leading-snug">
                            {review.question}
                          </h3>
                        </div>

                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold border w-fit shrink-0 ${scoreColor}`}
                        >
                          Score: {review.score}/100
                        </span>
                      </div>

                      {/* Candidate's Spoken Answer */}
                      <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-dark-300/80 border border-white/5 print:bg-gray-50 print:border-gray-200">
                        <div className="flex items-center gap-2 text-xs font-semibold text-light-400 print:text-gray-600">
                          <span>Your Answer During The Interview</span>
                        </div>
                        <p className="text-sm text-white print:text-black italic leading-relaxed">
                          "{review.candidateAnswer || "No verbal response recorded for this question."}"
                        </p>
                      </div>

                      {/* Critique Two-Column Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* What was good */}
                        <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-success-100/5 border border-success-100/20 print:border-green-300">
                          <span className="text-xs font-bold text-success-100 print:text-green-700 flex items-center gap-1.5">
                            ✓ What You Did Well
                          </span>
                          <p className="text-xs text-light-100 print:text-black leading-relaxed">
                            {review.whatWasGood || "Addressed the basic premise of the question."}
                          </p>
                        </div>

                        {/* What was missing */}
                        <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-destructive-100/5 border border-destructive-100/20 print:border-red-300">
                          <span className="text-xs font-bold text-destructive-100 print:text-red-700 flex items-center gap-1.5">
                            ✗ Gaps & What Was Missing
                          </span>
                          <p className="text-xs text-light-100 print:text-black leading-relaxed">
                            {review.whatWasMissing || "Could provide deeper architectural context and concrete trade-offs."}
                          </p>
                        </div>
                      </div>

                      {/* Correct Ideal Model Answer */}
                      <div className="flex flex-col gap-2 p-4 rounded-xl bg-primary-200/5 border border-primary-200/30 print:bg-gray-50 print:border-gray-300">
                        <div className="flex items-center gap-2 text-xs font-bold text-primary-200 print:text-black">
                          <span>★ Correct Senior-Level Model Answer</span>
                        </div>
                        <p className="text-xs sm:text-sm text-light-100 print:text-black leading-relaxed">
                          {review.idealAnswer}
                        </p>
                      </div>

                      {/* Evaluator Notes */}
                      {review.feedback && (
                        <div className="text-xs text-light-400 print:text-gray-600 pt-1">
                          <span className="font-semibold text-light-300 print:text-black">Evaluator Note: </span>
                          {review.feedback}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="my-8 print:hidden flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-200/10 text-primary-200 border border-primary-200/20 text-xs font-semibold w-fit">
            Next Step • Resume Shortlisting Check
          </div>
          <h2 className="text-2xl font-bold text-white">
            Can Your Resume Pass the Recruiter Screening for this Role?
          </h2>
          <p className="text-sm text-light-100">
            Upload your resume and analyze it directly against this {interview.role} position and tech stack ({interview.techstack?.join(", ") || "General"}). Detect missing keywords and edit in LaTeX to guarantee shortlisting!
          </p>
        </div>

        <ResumeAnalyzerPro
          initialRole={interview.role}
          initialJobDescription={`Role: ${interview.role} (${interview.level} Level)\nRequired Tech Stack: ${interview.techstack?.join(", ") || "Full Stack"}\nInterview Topics Tested: ${interview.questions?.slice(0, 4).join("; ") || "Core principles, system design, coding"}`}
        />
      </div>

      <div className="buttons print:hidden">
        <Button className="btn-secondary flex-1">
          <Link href="/" className="flex w-full justify-center">
            <p className="text-sm font-semibold text-primary-200 text-center">
              Back to dashboard
            </p>
          </Link>
        </Button>

        <Button className="btn-primary flex-1">
          <Link
            href={`/interview/${interview.id}`}
            className="flex w-full justify-center"
          >
            <p className="text-sm font-semibold text-black text-center">
              Retake Interview
            </p>
          </Link>
        </Button>
      </div>
    </section>
  );
};

export default FeedbackContent;
