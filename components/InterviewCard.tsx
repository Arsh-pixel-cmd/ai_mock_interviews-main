import dayjs from "dayjs";
import Link from "next/link";
import Image from "next/image";
import { Play, RotateCcw, FileText } from "lucide-react";

import { Button } from "./ui/button";
import DisplayTechIcons from "./DisplayTechIcons";
import DeleteInterviewButton from "./DeleteInterviewButton";

import { cn, getInterviewCoverImage } from "@/lib/utils";
import { getFeedbackByInterviewId } from "@/lib/actions/general.action";

const InterviewCard = async ({
  interviewId,
  userId,
  role,
  type,
  techstack,
  createdAt,
  coverImage,
}: InterviewCardProps) => {
  const feedback =
    userId && interviewId
      ? await getFeedbackByInterviewId({
          interviewId,
          userId,
        })
      : null;

  const normalizedType = /mix/gi.test(type) ? "Mixed" : type;

  const badgeColor =
    {
      Behavioral: "bg-blue-600/30 text-blue-300 border-blue-500/30",
      Mixed: "bg-purple-600/30 text-purple-300 border-purple-500/30",
      Technical: "bg-emerald-600/30 text-emerald-300 border-emerald-500/30",
    }[normalizedType] || "bg-light-600/30 text-light-100 border-white/10";

  const formattedDate = dayjs(
    feedback?.createdAt || createdAt || Date.now()
  ).format("MMM D, YYYY");

  const hasFeedback = Boolean(feedback);
  const coverSrc = getInterviewCoverImage(role, techstack, coverImage);
  const isRemote = coverSrc.startsWith("http");

  return (
    <div className="card-border w-full min-h-[380px] flex flex-col group">
      <div className="card-interview flex-1 flex flex-col justify-between">
        <div>
          {/* Header Row: Type Badge + Delete action */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <span
              className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-sm",
                badgeColor
              )}
            >
              {normalizedType}
            </span>

            {userId && interviewId && (
              <DeleteInterviewButton
                interviewId={interviewId}
                userId={userId}
                role={role}
              />
            )}
          </div>

          {/* Dynamic Cover Image & Role */}
          <div className="flex items-center gap-4">
            <div className="relative size-16 rounded-2xl bg-dark-200/90 border border-white/10 shrink-0 flex items-center justify-center p-2.5 overflow-hidden shadow-inner group-hover:border-primary-200/40 transition-colors">
              <Image
                src={coverSrc}
                alt={`${role} cover`}
                width={48}
                height={48}
                unoptimized={isRemote}
                className="object-contain size-full max-h-11 max-w-11"
              />
            </div>
            <div className="flex flex-col min-w-0">
              <h3 className="capitalize text-lg font-bold text-white truncate">
                {role}
              </h3>
              <p className="text-xs text-light-400 capitalize">
                Mock Interview Session
              </p>
            </div>
          </div>

          {/* Date & Score */}
          <div className="flex flex-row gap-5 mt-4 text-xs text-light-400">
            <div className="flex flex-row gap-2 items-center">
              <Image
                src="/calendar.svg"
                width={16}
                height={16}
                alt="calendar"
                className="opacity-70"
              />
              <p>{formattedDate}</p>
            </div>

            <div className="flex flex-row gap-2 items-center">
              <Image
                src="/star.svg"
                width={16}
                height={16}
                alt="star"
                className="opacity-70"
              />
              <p className={hasFeedback ? "text-primary-200 font-bold" : ""}>
                {hasFeedback ? `${feedback?.totalScore}/100` : "Not evaluated yet"}
              </p>
            </div>
          </div>

          {/* Feedback assessment or invitation text */}
          <p className="text-xs sm:text-sm text-light-100 line-clamp-3 mt-4 leading-relaxed">
            {feedback?.finalAssessment ||
              "Ready to practice! Start your mock interview to receive detailed performance metrics and rubric scoring."}
          </p>
        </div>

        {/* Footer: Tech Stack and Action Buttons */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6 border-t border-white/10 mt-6">
          <DisplayTechIcons techStack={techstack} />

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {hasFeedback ? (
              <>
                <Button asChild size="sm" className="btn-secondary text-xs px-3">
                  <Link href={`/interview/${interviewId}`}>
                    <RotateCcw size={13} className="mr-1" />
                    Retake
                  </Link>
                </Button>
                <Button asChild size="sm" className="btn-primary text-xs px-3 flex-1 sm:flex-initial">
                  <Link href={`/interview/${interviewId}/feedback`}>
                    <FileText size={13} className="mr-1" />
                    Feedback
                  </Link>
                </Button>
              </>
            ) : (
              <Button asChild size="sm" className="btn-primary text-xs px-4 w-full sm:w-auto">
                <Link href={`/interview/${interviewId}`}>
                  <Play size={13} className="mr-1.5 fill-current" />
                  Start Interview
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewCard;
