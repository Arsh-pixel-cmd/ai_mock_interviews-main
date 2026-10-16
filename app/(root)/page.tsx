import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import InterviewCard from "@/components/InterviewCard";

import { getCurrentUser } from "@/lib/actions/auth.action";
import {
  getInterviewsByUserId,
  getLatestInterviews,
} from "@/lib/actions/general.action";

async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [userInterviews, allInterview] = await Promise.all([
    getInterviewsByUserId(user.id),
    getLatestInterviews({ userId: user.id }),
  ]);

  const hasPastInterviews = Boolean(userInterviews && userInterviews.length > 0);
  const hasUpcomingInterviews = Boolean(allInterview && allInterview.length > 0);

  return (
    <>
      <section className="card-cta">
        <div className="flex flex-col gap-6 max-w-lg">
          <h2>Get Interview-Ready with AI-Powered Practice & Feedback</h2>
          <p className="text-lg">
            Practice real interview questions & get instant feedback
          </p>

          <Button asChild className="btn-primary max-sm:w-full">
            <Link href="/interview">Start an Interview</Link>
          </Button>
        </div>

        <Image
          src="/robot.png"
          alt="robo-dude"
          width={400}
          height={400}
          className="max-sm:hidden"
        />
      </section>

      {/* Prominent Resume Analyzer & LaTeX Studio Banner */}
      <section className="card-border w-full mt-8">
        <div className="card dark-gradient p-8 sm:p-10 flex flex-col lg:flex-row items-center justify-between gap-8 relative overflow-hidden">
          {/* Subtle glowing background orb */}
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-primary-200/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col gap-5 max-w-2xl z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-200/10 border border-primary-200/30 text-xs font-bold text-primary-200 uppercase tracking-wider w-fit">
              <span className="w-2 h-2 rounded-full bg-primary-200 animate-pulse" />
              New Feature • AI Resume Intelligence & LaTeX Studio
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
              Beat the ATS & Tailor Your Resume to Any Job Description
            </h2>

            <p className="text-sm sm:text-base text-light-100 leading-relaxed">
              Upload your resume and paste any target JD to detect missing keywords, uncover formatting flaws, see your shortlist probability, and edit in an authentic Leaflet-style LaTeX editor with live A4 preview and 1-click PDF export.
            </p>

            {/* Feature Pills */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-light-400">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-dark-200 border border-white/5 text-white">
                <span className="text-success-100 font-bold">✓</span> ATS Compatibility Score
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-dark-200 border border-white/5 text-white">
                <span className="text-success-100 font-bold">✓</span> Missing Keyword Gap Analysis
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-dark-200 border border-white/5 text-white">
                <span className="text-primary-200 font-bold">LaTeX</span> Leaflet Live Editor
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-dark-200 border border-white/5 text-white">
                <span className="text-primary-200 font-bold">PDF</span> Vector A4 Export
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button asChild className="btn-primary px-6 py-3 text-sm">
                <Link href="/resume-analyzer">
                  Analyze Resume Now →
                </Link>
              </Button>
              <Button asChild className="btn-secondary px-6 py-3 text-sm">
                <Link href="/resume-analyzer">
                  Open LaTeX Studio
                </Link>
              </Button>
            </div>
          </div>

          {/* Graphical Mockup / Visual badge card */}
          <div className="w-full lg:w-72 flex flex-col gap-3 p-5 rounded-2xl bg-dark-200/80 border border-white/10 shadow-2xl z-10 shrink-0">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 text-xs">
              <span className="font-semibold text-white">Recruiter ATS Check</span>
              <span className="px-2 py-0.5 rounded-full bg-success-100/20 text-success-100 text-[10px] font-bold">
                Ready to Shortlist
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs">
                <span className="text-light-400">Shortlist Likelihood</span>
                <span className="text-white font-bold">94%</span>
              </div>
              <div className="w-full h-1.5 bg-dark-300 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary-200 to-success-100 rounded-full w-[94%]" />
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-2 text-[11px] text-light-100">
              <div className="flex items-center justify-between">
                <span>ATS Parsing</span>
                <span className="text-success-100 font-semibold">10/10 Score</span>
              </div>
              <div className="flex items-center justify-between">
                <span>JD Keyword Match</span>
                <span className="text-primary-200 font-semibold">92% Matched</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Format</span>
                <span className="text-white font-semibold">LaTeX A4 Clean</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-6 mt-8">
        <h2>Your Interviews</h2>

        <div className="interviews-section">
          {hasPastInterviews ? (
            userInterviews?.map((interview) => (
              <InterviewCard
                key={interview.id}
                userId={user.id}
                interviewId={interview.id}
                role={interview.role}
                type={interview.type}
                techstack={interview.techstack}
                createdAt={interview.createdAt}
              />
            ))
          ) : (
            <p>You haven&apos;t taken any interviews yet</p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-6 mt-8">
        <h2>Take Interviews</h2>

        <div className="interviews-section">
          {hasUpcomingInterviews ? (
            allInterview?.map((interview) => (
              <InterviewCard
                key={interview.id}
                userId={user.id}
                interviewId={interview.id}
                role={interview.role}
                type={interview.type}
                techstack={interview.techstack}
                createdAt={interview.createdAt}
              />
            ))
          ) : (
            <p>There are no interviews available</p>
          )}
        </div>
      </section>
    </>
  );
}

export default Home;
