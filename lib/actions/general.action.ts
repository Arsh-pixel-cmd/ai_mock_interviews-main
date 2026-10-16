"use server";

import { generateObject } from "ai";
import { groq } from "@ai-sdk/groq";

import { query, queryFirst, execute } from "@/lib/db";
import { feedbackSchema, GROQ_MODEL } from "@/constants";

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
