import { redirect } from "next/navigation";
import InterviewStudio from "@/components/InterviewStudio";
import { getCurrentUser } from "@/lib/actions/auth.action";

const Page = async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return <InterviewStudio user={user} />;
};

export default Page;
