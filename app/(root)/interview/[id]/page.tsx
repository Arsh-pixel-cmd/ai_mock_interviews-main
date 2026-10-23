import Image from "next/image";
import { redirect } from "next/navigation";

import Agent from "@/components/Agent";
import { getInterviewCoverImage } from "@/lib/utils";

import {
  getFeedbackByInterviewId,
  getInterviewById,
} from "@/lib/actions/general.action";
import { getCurrentUser } from "@/lib/actions/auth.action";
import DisplayTechIcons from "@/components/DisplayTechIcons";

const InterviewDetails = async ({ params }: RouteParams) => {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const interview = await getInterviewById(id);
  if (!interview) redirect("/");

  const feedback = await getFeedbackByInterviewId({
    interviewId: id,
    userId: user.id,
  });

  const coverSrc = getInterviewCoverImage(
    interview.role,
    interview.techstack,
    interview.coverImage
  );
  const isRemote = coverSrc.startsWith("http");

  return (
    <>
      <div className="flex flex-row gap-4 justify-between">
        <div className="flex flex-row gap-4 items-center max-sm:flex-col">
          <div className="flex flex-row gap-4 items-center">
            <div className="size-10 rounded-xl bg-dark-200 border border-white/10 flex items-center justify-center p-1.5 overflow-hidden">
              <Image
                src={coverSrc}
                alt={`${interview.role} cover`}
                width={28}
                height={28}
                unoptimized={isRemote}
                className="object-contain size-full"
              />
            </div>
            <h3 className="capitalize">{interview.role} Interview</h3>
          </div>

          <DisplayTechIcons techStack={interview.techstack} />
        </div>

        <p className="bg-dark-200 px-4 py-2 rounded-lg h-fit">
          {interview.type}
        </p>
      </div>

      <Agent
        userName={user.name}
        userId={user.id}
        interviewId={id}
        type="interview"
        questions={interview.questions}
        feedbackId={feedback?.id}
        role={interview.role}
      />
    </>
  );
};

export default InterviewDetails;
