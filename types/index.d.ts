interface Feedback {
  id: string;
  interviewId: string;
  userId?: string;
  totalScore: number;
  categoryScores: Array<{
    name: string;
    score: number;
    comment: string;
  }>;
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
  createdAt: string;
}

interface Interview {
  id: string;
  role: string;
  level: string;
  questions: string[];
  techstack: string[];
  createdAt: string;
  userId: string;
  type: string;
  finalized: boolean;
  coverImage?: string;
}

interface CreateFeedbackParams {
  interviewId: string;
  userId: string;
  transcript: { role: string; content: string }[];
  feedbackId?: string;
}

interface User {
  name: string;
  email: string;
  id: string;
  profileURL?: string;
}

interface InterviewCardProps {
  interviewId?: string;
  userId?: string;
  role: string;
  type: string;
  techstack: string[];
  createdAt?: string;
  coverImage?: string;
}

interface AgentProps {
  userName: string;
  userId?: string;
  profileImage?: string;
  interviewId?: string;
  feedbackId?: string;
  type: "generate" | "interview";
  questions?: string[];
  role?: string;
}

interface RouteParams {
  params: Promise<Record<string, string>>;
  searchParams: Promise<Record<string, string>>;
}

interface GetFeedbackByInterviewIdParams {
  interviewId: string;
  userId: string;
}

interface GetLatestInterviewsParams {
  userId: string;
  limit?: number;
}

interface SignInParams {
  email: string;
  password: string;
}

interface SignUpParams {
  name: string;
  email: string;
  password: string;
}

type FormType = "sign-in" | "sign-up";

interface InterviewFormProps {
  interviewId: string;
  role: string;
  level: string;
  type: string;
  techstack: string[];
  amount: number;
}

interface TechIconProps {
  techStack: string[];
}

interface MissingKeyword {
  keyword: string;
  category: string;
  priority: "critical" | "important" | "bonus";
  whyNeeded: string;
}

interface ResumeFlaw {
  category: string;
  flaw: string;
  suggestion: string;
  exampleRewrite?: string;
}

interface DetailedResumeAnalysis {
  overallMatchScore: number;
  atsScore: number;
  isAtsFriendly: boolean;
  atsSummary: string;
  targetRoleMatch: {
    targetRole: string;
    detectedRole: string;
    alignmentScore: number;
    roleFeedback: string;
  };
  missingKeywords: MissingKeyword[];
  matchingKeywords: string[];
  flawsAndFixes: ResumeFlaw[];
  quantifiableImpactScore: number;
  actionVerbScore: number;
  verdict: "Strong Match" | "Moderate Match" | "Needs Optimization" | "High Risk of Rejection";
  shortlistProbability: number;
  keyRecommendations: string[];
  suggestedLatexCode: string;
}
