import { redirect } from "next/navigation";

import {
  getFeedbackByInterviewId,
  getInterviewById,
} from "@/lib/actions/general.action";
import { getCurrentUser } from "@/lib/actions/auth.action";
import FeedbackContent from "@/components/FeedbackContent";

const Feedback = async ({ params }: RouteParams) => {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const interview = await getInterviewById(id);
  if (!interview) redirect("/");

  const feedback = await getFeedbackByInterviewId({
    interviewId: id,
    userId: user.id,
  });

  if (!feedback) {
     return <p className="text-center mt-10">Loading feedback...</p>;
  }

  return (
    <FeedbackContent 
      feedback={feedback} 
      interview={interview} 
      feedbackId={feedback.id} 
    />
  );
};

export default Feedback;
