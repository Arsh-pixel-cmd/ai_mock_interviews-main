"use server";

import { generateObject } from "ai";

import { query, queryFirst, execute } from "@/lib/db";
import { feedbackSchema } from "@/constants";
import { getModel } from "@/lib/ai/ai-provider";
import { parseJsonField } from "@/lib/utils/parse-json";

// ─── Types ───────────────────────────────────────────────────────────────────

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
  questionReviews?: string | Feedback["questionReviews"];
}

// ─── Row Parser ──────────────────────────────────────────────────────────────

function parseFeedbackRow(row: RawFeedbackRow): Feedback {
  let parsedQuestionReviews: QuestionReview[] = [];
  let cleanedAssessment = row.finalAssessment || "";

  if (row.questionReviews) {
    try {
      parsedQuestionReviews = parseJsonField<QuestionReview[]>(row.questionReviews);
    } catch { /* gracefully ignore */ }
  } else if (cleanedAssessment.includes("<!--QUESTION_REVIEWS-->")) {
    const parts = cleanedAssessment.split("<!--QUESTION_REVIEWS-->");
    cleanedAssessment = parts[0].trim();
    try {
      parsedQuestionReviews = JSON.parse(parts[1].trim());
    } catch { /* gracefully ignore */ }
  }

  return {
    id: row.id,
    interviewId: row.interviewId,
    userId: row.userId,
    totalScore: Number(row.totalScore),
    finalAssessment: cleanedAssessment,
    createdAt: row.createdAt,
    categoryScores: parseJsonField(row.categoryScores),
    strengths: parseJsonField(row.strengths),
    areasForImprovement: parseJsonField(row.areasForImprovement),
    questionReviews: parsedQuestionReviews,
  };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

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

// ─── Feedback Generation ─────────────────────────────────────────────────────

export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId } = params;

  try {
    const interviewRow = await queryFirst<{
      role: string;
      questions: string | string[];
    }>(
      "SELECT role, questions FROM interviews WHERE id = ? LIMIT 1",
      [interviewId]
    );

    const formattedTranscript = transcript
      .map(
        (sentence: { role: string; content: string }) =>
          `- ${sentence.role === "assistant" ? "Interviewer" : "Candidate"}: ${sentence.content}\n`
      )
      .join("");

    const plannedQuestions = interviewRow
      ? parseJsonField<string[]>(interviewRow.questions)
      : [];

    const { object } = await generateObject({
      model: getModel(),
      schema: feedbackSchema,
      prompt: `
        You are a seasoned Principal Engineer and Technical Hiring Manager conducting a deep evaluation of a mock interview.
        Role: ${interviewRow?.role || "Software Engineer"}
        Planned Questions: ${JSON.stringify(plannedQuestions)}
        
        Transcript of the Conversation:
        ${formattedTranscript || "Candidate completed the session with limited recorded transcript."}

        Evaluation Instructions:
        1. Score the candidate from 0 to 100 overall and in each of the 5 categories (Communication, Technical Knowledge, Problem Solving, Cultural Fit, Confidence & Clarity).
        2. Provide clear, honest strengths and areas for improvement.
        3. Write a comprehensive final assessment summary.
        4. QUESTION-BY-QUESTION REVIEW (CRITICAL):
           For every interview question discussed in the transcript (or planned questions):
           - "questionNumber": 1, 2, 3...
           - "question": The exact question text.
           - "candidateAnswer": The exact or summarized answer the candidate actually gave. If the candidate was vague, skipped, or only gave a few words, accurately reflect what they said.
           - "score": 0 to 100 for this specific answer.
           - "feedback": Honest, rigorous feedback on their response.
           - "whatWasGood": What the candidate explained well or correctly.
           - "whatWasMissing": Specific technical gaps, missing edge cases, architectural trade-offs, or best practices they omitted.
           - "idealAnswer": The definitive, comprehensive, correct model answer showing how a senior engineer should answer with best practices, design patterns, and concrete examples.
        `,
      system:
        "You are an expert technical interviewer providing rigorous, actionable interview evaluation reports with question-by-question candidate answer reviews and model answers.",
    });

    const targetFeedbackId = feedbackId || crypto.randomUUID();
    const createdAt = new Date().toISOString();

    // 1. Try inserting with questionReviews column first
    let inserted = false;
    try {
      await execute(
        `INSERT INTO feedback (id, interviewId, userId, totalScore, categoryScores, strengths, areasForImprovement, finalAssessment, questionReviews, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           totalScore = excluded.totalScore,
           categoryScores = excluded.categoryScores,
           strengths = excluded.strengths,
           areasForImprovement = excluded.areasForImprovement,
           finalAssessment = excluded.finalAssessment,
           questionReviews = excluded.questionReviews`,
        [
          targetFeedbackId,
          interviewId,
          userId,
          object.totalScore,
          JSON.stringify(object.categoryScores),
          JSON.stringify(object.strengths),
          JSON.stringify(object.areasForImprovement),
          object.finalAssessment,
          JSON.stringify(object.questionReviews || []),
          createdAt,
        ]
      );
      inserted = true;
    } catch (insertError: unknown) {
      const msg = insertError instanceof Error ? insertError.message : String(insertError);
      console.warn("Direct insert with questionReviews failed, falling back:", msg);
    }

    // 2. Fail-safe fallback: Embed questionReviews into finalAssessment
    if (!inserted) {
      const combinedAssessment = `${object.finalAssessment}\n\n<!--QUESTION_REVIEWS-->\n${JSON.stringify(object.questionReviews || [])}`;
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
          combinedAssessment,
          createdAt,
        ]
      );
    }

    // Update interview status to finalized
    await execute("UPDATE interviews SET finalized = 1 WHERE id = ?", [interviewId]);

    return { success: true, feedbackId: targetFeedbackId };
  } catch (error) {
    console.error("Error saving feedback:", error);
    return { success: false };
  }
}
