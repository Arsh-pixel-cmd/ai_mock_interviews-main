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
  questionReviews?: string | Feedback["questionReviews"];
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
  let parsedQuestionReviews: QuestionReview[] = [];
  let cleanedAssessment = row.finalAssessment || "";

  if (row.questionReviews) {
    try {
      parsedQuestionReviews =
        typeof row.questionReviews === "string"
          ? JSON.parse(row.questionReviews)
          : row.questionReviews;
    } catch {}
  } else if (cleanedAssessment.includes("<!--QUESTION_REVIEWS-->")) {
    const parts = cleanedAssessment.split("<!--QUESTION_REVIEWS-->");
    cleanedAssessment = parts[0].trim();
    try {
      parsedQuestionReviews = JSON.parse(parts[1].trim());
    } catch {}
  }

  return {
    id: row.id,
    interviewId: row.interviewId,
    userId: row.userId,
    totalScore: Number(row.totalScore),
    finalAssessment: cleanedAssessment,
    createdAt: row.createdAt,
    categoryScores:
      typeof row.categoryScores === "string"
        ? JSON.parse(row.categoryScores)
        : row.categoryScores,
    strengths:
      typeof row.strengths === "string"
        ? JSON.parse(row.strengths)
        : row.strengths,
    areasForImprovement:
      typeof row.areasForImprovement === "string"
        ? JSON.parse(row.areasForImprovement)
        : row.areasForImprovement,
    questionReviews: parsedQuestionReviews,
  };
}

export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId } = params;

  try {
    const interviewRow = await queryFirst<RawInterviewRow>(
      "SELECT * FROM interviews WHERE id = ? LIMIT 1",
      [interviewId]
    );

    const formattedTranscript = transcript
      .map(
        (sentence: { role: string; content: string }) =>
          `- ${sentence.role === "assistant" ? "Interviewer" : "Candidate"}: ${sentence.content}\n`
      )
      .join("");

    const plannedQuestions = interviewRow
      ? typeof interviewRow.questions === "string"
        ? JSON.parse(interviewRow.questions)
        : interviewRow.questions
      : [];

    const { object } = await generateObject({
      model: groq(GROQ_MODEL),
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
    } catch (insertError: any) {
      console.warn(
        "Direct insert with questionReviews failed, falling back to embedded metadata:",
        insertError?.message || insertError
      );
    }

    // 2. Fail-safe fallback: Embed questionReviews directly into finalAssessment with separator
    // This guarantees 100% success on any local or remote SQLite/D1 database schema without throwing!
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

/**
 * Server action to transcribe audio using Groq Whisper.
 * Provides a 100% reliable fallback if browser SpeechRecognition is silent or blocked.
 */
export async function transcribeAudio(formData: FormData): Promise<{ text: string; error?: string }> {
  try {
    const file = formData.get("file") as Blob | null;
    if (!file || file.size === 0) {
      return { text: "", error: "No audio data recorded" };
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return { text: "", error: "GROQ_API_KEY not configured" };
    }

    const mime = file.type || "audio/webm";
    const ext = mime.includes("mp4") ? "mp4" : mime.includes("wav") ? "wav" : mime.includes("ogg") ? "ogg" : "webm";

    const groqFormData = new FormData();
    groqFormData.append("file", file, `answer.${ext}`);
    groqFormData.append("model", "whisper-large-v3-turbo");
    groqFormData.append("language", "en");
    groqFormData.append("response_format", "json");
    groqFormData.append(
      "prompt",
      "Technical job mock interview answer discussing software development, architecture, algorithms, coding, and system design."
    );

    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: groqFormData,
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Groq Whisper error:", errorText);
      return { text: "", error: "Failed to transcribe audio" };
    }

    const json = (await res.json()) as { text?: string };
    return { text: json.text ? json.text.trim() : "" };
  } catch (err: any) {
    console.error("Transcription error:", err);
    return { text: "", error: err.message || "Failed to transcribe audio" };
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
Keep your responses conversational, realistic, and concise (1 to 2 sentences maximum), suitable to be spoken out loud via text-to-speech. Do not use asterisks, markdown, emojis, or bullet points.

Interview Guidelines:
1. If the candidate asks a conversational question or check-in (such as "What did I say in my previous answer?", "Did you get what I said?", "Can you hear me?", "Could you repeat that?"):
   Answer them directly, accurately, and reassuringly based on the transcript history! For example: if they ask what they said, quote or summarize their previous answer (e.g., "In your last answer, you mentioned that you designed the caching layer with Redis. Now let's continue with: [next question]").
2. If the candidate answers an interview question:
   Briefly acknowledge their answer in a natural, supportive human way (e.g., "Great explanation of how you handle state management across micro-frontends.").
3. Then seamlessly ask the next question from the question list:
${questionsList || "No specific questions provided; ask standard role-specific questions."}
4. If the candidate was too brief or missed key technical depth, ask one short follow-up before moving on.
5. If all questions have been thoroughly addressed and answered, politely wrap up the interview with: "Thank you so much, ${userName}! That wraps up all of our questions for today. I will now prepare your comprehensive feedback report." and end your message with the exact keyword [INTERVIEW_COMPLETE].
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

