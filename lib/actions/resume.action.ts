"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import pdf from "pdf-parse";
import { z } from "zod";

const resumeAnalysisSchema = z.object({
  score: z.number().describe("Score out of 10"),
  isAtsFriendly: z.boolean().describe("Whether the resume is ATS friendly"),
  improvements: z.array(z.string()).describe("List of improvements"),
});

export async function analyzeResume(formData: FormData) {
  const file = formData.get("resume") as File;

  if (!file) {
    throw new Error("No file uploaded");
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const data = await pdf(buffer);
    const text = data.text;

    const { object } = await generateObject({
      model: google("gemini-2.0-flash-001"),
      schema: resumeAnalysisSchema,
      prompt: `
        Analyze this resume for ATS (Applicant Tracking System) friendliness.
        Resume Text:
        ${text}

        Provide:
        1. A score out of 10 based on content, formatting (inferred from text structure), and keywords.
        2. Whether it is considered ATS friendly (simple structure, standard headings).
        3. A list of specific improvements to increase the score and ATS compatibility.
      `,
    });

    return { success: true, analysis: object };
  } catch (error) {
    console.error("Error analyzing resume:", error);
    return { success: false, error: "Failed to analyze resume" };
  }
}
