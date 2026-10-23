"use server";

import { generateText } from "ai";
import { getModel } from "@/lib/ai/ai-provider";

/**
 * Generates the interviewer's next spoken response in a live voice mock interview.
 * Uses a conversational AI approach with context from the full transcript.
 */
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
      model: getModel(),
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
  } catch (error: unknown) {
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
