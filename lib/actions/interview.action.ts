"use server";

import { generateText } from "ai";
import { revalidatePath } from "next/cache";

import { query, queryFirst, execute } from "@/lib/db";
import { getModel } from "@/lib/ai/ai-provider";
import { getInterviewCoverImage } from "@/lib/utils";
import { parseJsonField, parseJsonArray } from "@/lib/utils/parse-json";

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Row Parser ──────────────────────────────────────────────────────────────

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
    techstack: parseJsonField<string[]>(row.techstack),
    questions: parseJsonField<string[]>(row.questions),
  };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getInterviewById(id: string): Promise<Interview | null> {
  const row = await queryFirst<RawInterviewRow>("SELECT * FROM interviews WHERE id = ? LIMIT 1", [id]);
  if (!row) return null;
  return parseInterviewRow(row);
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

// ─── Interview Creation (Factory Method) ─────────────────────────────────────

/** Default fallback questions when AI generation fails */
const FALLBACK_QUESTIONS = (techstack: string[], role: string): string[] => [
  `Can you introduce yourself and describe your experience working with ${techstack.slice(0, 3).join(", ")} as a ${role}?`,
  `What is one of the most challenging technical problems you solved recently, and how did you approach the architectural trade-offs?`,
  `How do you ensure performance, code quality, and test coverage in your applications?`,
  `Can you explain how state management and asynchronous data flow work in your typical project setup?`,
  `Tell me about a time you had a technical disagreement with a team member and how you resolved it constructively.`,
];

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
        model: getModel(),
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
        questions = parseJsonArray(text);
      } catch {
        questions = FALLBACK_QUESTIONS(techstackArray, role);
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
  } catch (error: unknown) {
    console.error("Error creating interview:", error);
    const message = error instanceof Error ? error.message : "Failed to generate interview";
    return { success: false, error: message };
  }
}

// ─── Interview Deletion ──────────────────────────────────────────────────────

export async function deleteInterview(
  interviewId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await execute("DELETE FROM feedback WHERE interviewId = ? AND userId = ?", [interviewId, userId]);
    await execute("DELETE FROM interviews WHERE id = ? AND userId = ?", [interviewId, userId]);

    revalidatePath("/");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error deleting interview:", error);
    const message = error instanceof Error ? error.message : "Failed to delete interview";
    return { success: false, error: message };
  }
}
