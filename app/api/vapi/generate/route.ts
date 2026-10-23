import { generateText } from "ai";

import { execute } from "@/lib/db";
import { getInterviewCoverImage } from "@/lib/utils";
import { getModel } from "@/lib/ai/ai-provider";

export async function POST(request: Request) {
  const { type, role, level, techstack, amount, userid } = await request.json();

  try {
    const { text: questions } = await generateText({
      model: getModel(),
      prompt: `Prepare questions for a job interview.
        The job role is ${role}.
        The job experience level is ${level}.
        The tech stack used in the job is: ${techstack}.
        The focus between behavioural and technical questions should lean towards: ${type}.
        The amount of questions required is: ${amount}.
        Please return only the questions, without any additional text.
        The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters which might break the voice assistant.
        Return the questions formatted like this:
        ["Question 1", "Question 2", "Question 3"]
        
        Thank you! <3
    `,
    });

    const interviewId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const coverImage = getInterviewCoverImage(role, techstack);
    
    let parsedQuestions: string[] = [];
    try {
      parsedQuestions = JSON.parse(questions);
    } catch {
      const match = questions.match(/\[[\s\S]*\]/);
      if (match) {
        parsedQuestions = JSON.parse(match[0]);
      } else {
        throw new Error("Could not parse generated questions into JSON");
      }
    }

    const techstackArray = typeof techstack === "string" ? techstack.split(",").map((s) => s.trim()) : techstack;

    await execute(
      "INSERT INTO interviews (id, role, type, level, techstack, questions, userId, finalized, coverImage, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
      [
        interviewId,
        role,
        type,
        level,
        JSON.stringify(techstackArray),
        JSON.stringify(parsedQuestions),
        userid,
        coverImage,
        createdAt,
      ]
    );

    return Response.json({ success: true, interviewId }, { status: 200 });
  } catch (error) {
    console.error("Error generating interview:", error);
    return Response.json({ success: false, error: error }, { status: 500 });
  }
}
