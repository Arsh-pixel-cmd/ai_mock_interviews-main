"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import dayjs from "dayjs";
import { useReactToPrint } from "react-to-print";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button"; 
import ResumeAnalyzer from "@/components/ResumeAnalyzer";

interface FeedbackContentProps {
  feedback: Feedback;
  interview: Interview;
  feedbackId: string;
}

const FeedbackContent = ({ feedback, interview, feedbackId }: FeedbackContentProps) => {
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
        </div>
      </div>

      <div className="my-8 print:hidden">
        <ResumeAnalyzer />
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
