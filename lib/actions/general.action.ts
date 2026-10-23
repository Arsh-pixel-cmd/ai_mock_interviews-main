/**
 * Barrel file — re-exports all domain-specific server actions for backward compatibility.
 *
 * New code should import directly from the specific module:
 *   import { createFeedback } from "@/lib/actions/feedback.action";
 *   import { getInterviewById } from "@/lib/actions/interview.action";
 *   import { transcribeAudio } from "@/lib/actions/transcription.action";
 *   import { getConversationalInterviewReply } from "@/lib/actions/conversation.action";
 */

// ─── Interview Actions ───────────────────────────────────────────────────────
export {
  getInterviewById,
  getLatestInterviews,
  getInterviewsByUserId,
  generateAndCreateInterview,
  deleteInterview,
} from "@/lib/actions/interview.action";

// ─── Feedback Actions ────────────────────────────────────────────────────────
export {
  getFeedbackByInterviewId,
  createFeedback,
} from "@/lib/actions/feedback.action";

// ─── Transcription Actions ───────────────────────────────────────────────────
export { transcribeAudio } from "@/lib/actions/transcription.action";

// ─── Conversation Actions ────────────────────────────────────────────────────
export { getConversationalInterviewReply } from "@/lib/actions/conversation.action";
