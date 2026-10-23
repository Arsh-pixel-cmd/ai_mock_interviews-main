"use server";

/**
 * Transcribes audio using Groq Whisper API.
 * Used as a fallback when browser Web Speech API fails.
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
  } catch (err: unknown) {
    console.error("Transcription error:", err);
    const message = err instanceof Error ? err.message : "Failed to transcribe audio";
    return { text: "", error: message };
  }
}
