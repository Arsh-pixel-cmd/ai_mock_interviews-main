"use server";

import { generateObject, generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { revalidatePath } from "next/cache";

import { query, queryFirst, execute } from "@/lib/db";
import { feedbackSchema, GROQ_MODEL } from "@/constants";
import { getInterviewCoverImage } from "@/lib/utils";

interface RawInterviewRow {
  id: string;
  role: string;
  type: string;
  level: string;
  userId: string;
  finalized: number | boolean;
  coverImage?: string;
  createdAt: string;
  techstack: string | string[];
  questions: string | string[];
}

interface RawFeedbackRow {
  id: string;
  interviewId: string;
  userId: string;
  totalScore: number;
  finalAssessment: string;
  createdAt: string;
  categoryScores: string | Feedback["categoryScores"];
  strengths: string | string[];
  areasForImprovement: string | string[];
}

function parseInterviewRow(row: RawInterviewRow): Interview {
  return {
    id: row.id,
    role: row.role,
    type: row.type,
    level: row.level,
    userId: row.userId,
    finalized: Boolean(row.finalized),
    coverImage: row.coverImage,
    createdAt: row.createdAt,
    techstack: typeof row.techstack === "string" ? JSON.parse(row.techstack) : row.techstack,
    questions: typeof row.questions === "string" ? JSON.parse(row.questions) : row.questions,
  };
}

function parseFeedbackRow(row: RawFeedbackRow): Feedback {
  return {
    id: row.id,
    interviewId: row.interviewId,
    userId: row.userId,
    totalScore: Number(row.totalScore),
    finalAssessment: row.finalAssessment,
    createdAt: row.createdAt,
    categoryScores: typeof row.categoryScores === "string" ? JSON.parse(row.categoryScores) : row.categoryScores,
    strengths: typeof row.strengths === "string" ? JSON.parse(row.strengths) : row.strengths,
    areasForImprovement: typeof row.areasForImprovement === "string" ? JSON.parse(row.areasForImprovement) : row.areasForImprovement,
  };
}

export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId } = params;

  try {
    const formattedTranscript = transcript
      .map(
        (sentence: { role: string; content: string }) =>
          `- ${sentence.role}: ${sentence.content}\n`
      )
      .join("");

    const { object } = await generateObject({
      model: groq(GROQ_MODEL),
      schema: feedbackSchema,
      prompt: `
        You are an AI interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories. Be thorough and detailed in your analysis. Don't be lenient with the candidate. If there are mistakes or areas for improvement, point them out.
        Transcript:
        ${formattedTranscript}

        Please score the candidate from 0 to 100 in the following areas. Do not add categories other than the ones provided:
        - **Communication Skills**: Clarity, articulation, structured responses.
        - **Technical Knowledge**: Understanding of key concepts for the role.
        - **Problem-Solving**: Ability to analyze problems and propose solutions.
        - **Cultural & Role Fit**: Alignment with company values and job role.
        - **Confidence & Clarity**: Confidence in responses, engagement, and clarity.
        `,
      system:
        "You are a professional interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories",
    });

    const targetFeedbackId = feedbackId || crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await execute(
      `INSERT INTO feedback (id, interviewId, userId, totalScore, categoryScores, strengths, areasForImprovement, finalAssessment, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         totalScore = excluded.totalScore,
         categoryScores = excluded.categoryScores,
         strengths = excluded.strengths,
         areasForImprovement = excluded.areasForImprovement,
         finalAssessment = excluded.finalAssessment`,
      [
        targetFeedbackId,
        interviewId,
        userId,
        object.totalScore,
        JSON.stringify(object.categoryScores),
        JSON.stringify(object.strengths),
        JSON.stringify(object.areasForImprovement),
        object.finalAssessment,
        createdAt,
      ]
    );

    // Update interview status to finalized
    await execute("UPDATE interviews SET finalized = 1 WHERE id = ?", [interviewId]);

    return { success: true, feedbackId: targetFeedbackId };
  } catch (error) {
    console.error("Error saving feedback:", error);
    return { success: false };
  }
}

export async function getInterviewById(id: string): Promise<Interview | null> {
  const row = await queryFirst<RawInterviewRow>("SELECT * FROM interviews WHERE id = ? LIMIT 1", [id]);
  if (!row) return null;
  return parseInterviewRow(row);
}

export async function getFeedbackByInterviewId(
  params: GetFeedbackByInterviewIdParams
): Promise<Feedback | null> {
  const { interviewId, userId } = params;

  const row = await queryFirst<RawFeedbackRow>(
    "SELECT * FROM feedback WHERE interviewId = ? AND userId = ? LIMIT 1",
    [interviewId, userId]
  );

  if (!row) return null;
  return parseFeedbackRow(row);
}

export async function getLatestInterviews(
  params: GetLatestInterviewsParams
): Promise<Interview[] | null> {
  const { userId, limit = 20 } = params;

  const rows = await query<RawInterviewRow>(
    "SELECT * FROM interviews WHERE finalized = 1 AND userId != ? ORDER BY createdAt DESC LIMIT ?",
    [userId, limit]
  );

  return rows.map(parseInterviewRow);
}

export async function getInterviewsByUserId(
  userId: string
): Promise<Interview[] | null> {
  const rows = await query<RawInterviewRow>(
    "SELECT * FROM interviews WHERE userId = ? ORDER BY createdAt DESC",
    [userId]
  );

  return rows.map(parseInterviewRow);
}

export async function generateAndCreateInterview(params: {
  role: string;
  type?: string;
  level?: string;
  techstack: string[] | string;
  amount?: number;
  userId: string;
  customQuestions?: string[];
}): Promise<{ success: boolean; interviewId?: string; error?: string }> {
  try {
    const { role, type = "Technical", level = "Mid-Level", amount = 5, userId } = params;

    if (!role || !userId) {
      return { success: false, error: "Role and User ID are required" };
    }

    const techstackArray: string[] = Array.isArray(params.techstack)
      ? params.techstack
      : typeof params.techstack === "string"
      ? (params.techstack as string).split(",").map((s) => s.trim()).filter(Boolean)
      : ["JavaScript", "React"];

    let questions: string[] = [];

    if (params.customQuestions && params.customQuestions.length > 0) {
      questions = params.customQuestions;
    } else {
      const { text } = await generateText({
        model: groq(GROQ_MODEL),
        prompt: `You are an expert technical interviewer preparing questions for a candidate interview.
Role: ${role}
Seniority Level: ${level}
Tech Stack: ${techstackArray.join(", ")}
Interview Focus: ${type}
Question Count: ${amount}

Return ONLY a valid JSON array of questions without markdown formatting or code blocks.
Example format:
["Can you describe a challenging project you built using ${techstackArray[0] || 'your core stack'}?", "How do you handle edge cases and performance bottlenecks?"]
`,
      });

      try {
        questions = JSON.parse(text);
      } catch {
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          questions = JSON.parse(match[0]);
        } else {
          questions = [
            `Can you introduce yourself and describe your experience working with ${techstackArray.slice(0, 3).join(", ")} as a ${role}?`,
            `What is one of the most challenging technical problems you solved recently, and how did you approach the architectural trade-offs?`,
            `How do you ensure performance, code quality, and test coverage in your applications?`,
            `Can you explain how state management and asynchronous data flow work in your typical project setup?`,
            `Tell me about a time you had a technical disagreement with a team member and how you resolved it constructively.`,
          ];
        }
      }
    }

    const interviewId = crypto.randomUUID();
    const coverImage = getInterviewCoverImage(role, techstackArray);
    const createdAt = new Date().toISOString();

    await execute(
      "INSERT INTO interviews (id, role, type, level, techstack, questions, userId, finalized, coverImage, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
      [
        interviewId,
        role,
        type,
        level,
        JSON.stringify(techstackArray),
        JSON.stringify(questions),
        userId,
        coverImage,
        createdAt,
      ]
    );

    revalidatePath("/");
    revalidatePath("/interview");

    return { success: true, interviewId };
  } catch (error: any) {
    console.error("Error creating interview:", error);
    return { success: false, error: error.message || "Failed to generate interview" };
  }
}

export async function deleteInterview(
  interviewId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await execute("DELETE FROM feedback WHERE interviewId = ? AND userId = ?", [interviewId, userId]);
    await execute("DELETE FROM interviews WHERE id = ? AND userId = ?", [interviewId, userId]);

    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting interview:", error);
    return { success: false, error: error.message || "Failed to delete interview" };
  }
}

export async function getConversationalInterviewReply(params: {
  role?: string;
  questions?: string[];
  transcript: { role: string; content: string }[];
  userName?: string;
}): Promise<{ reply: string; isCompleted: boolean }> {
  const { role = "Candidate", questions = [], transcript = [], userName = "Candidate" } = params;

  try {
    const formattedTranscript = transcript
      .map((m) => `${m.role === "assistant" ? "Interviewer" : "Candidate"}: ${m.content}`)
      .join("\n");

    const questionsList = questions.map((q, idx) => `${idx + 1}. ${q}`).join("\n");

    const { text } = await generateText({
      model: groq(GROQ_MODEL),
      system: `You are an expert, professional, warm technical interviewer conducting a live voice mock interview for the role of ${role} with candidate ${userName}.
Keep your responses conversational, realistic, and concise (1 to 3 sentences maximum), suitable to be spoken out loud via text-to-speech. Do not use asterisks, markdown, emojis, or bullet points.

Interview Guidelines:
1. Briefly acknowledge what the candidate just said in a natural human way (e.g., "Good explanation of how you handle cache invalidation.").
2. Keep the interview moving forward by asking the next logical question from the question list:
${questionsList || "No specific questions provided; ask standard role-specific questions."}
3. If the candidate was too brief or missed the core point, ask one short follow-up before moving on.
4. If all questions have been thoroughly addressed and answered, politely wrap up the interview with: "Thank you so much, ${userName}! That wraps up all of our questions for today. I will now prepare your comprehensive feedback report." and end your message with the exact keyword [INTERVIEW_COMPLETE].
`,
      prompt: `Here is the current interview transcript so far:
${formattedTranscript}

Generate the interviewer's next spoken response:`,
    });

    const isCompleted = text.includes("[INTERVIEW_COMPLETE]");
    const cleanedReply = text.replace(/\[INTERVIEW_COMPLETE\]/g, "").trim();

    return {
      reply: cleanedReply || "Thank you. Let's move on to the next question.",
      isCompleted,
    };
  } catch (error: any) {
    console.error("Error in conversational reply:", error);
    // Graceful fallback question
    const userAnswersCount = transcript.filter((m) => m.role === "user").length;
    const nextQ = questions[userAnswersCount] || questions[questions.length - 1];
    return {
      reply: nextQ ? `Thank you. Next question: ${nextQ}` : "Thank you for your responses. Let's conclude the interview and view your feedback.",
      isCompleted: userAnswersCount >= questions.length,
    };
  }
}

