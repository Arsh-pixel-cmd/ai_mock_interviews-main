"use client";

import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  MicOff,
  PhoneOff,
  Sparkles,
  Volume2,
  Send,
  Loader2,
  CheckCircle2,
  Radio,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { vapi } from "@/lib/vapi.sdk";
import {
  createFeedback,
  getConversationalInterviewReply,
  generateAndCreateInterview,
} from "@/lib/actions/general.action";
import { Button } from "@/components/ui/button";

enum CallStatus {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED",
}

interface SavedMessage {
  role: "user" | "system" | "assistant";
  content: string;
}

const Agent = ({
  userName,
  userId,
  interviewId,
  feedbackId,
  type,
  questions = [],
  role = "Software Engineer",
}: AgentProps) => {
  const router = useRouter();

  // Engine state: 'native' (Free Browser STT/TTS + Groq) vs 'vapi'
  const hasValidVapiToken = Boolean(
    process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN &&
      process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN !== "your_vapi_public_web_token" &&
      process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID &&
      process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID !== "your_vapi_workflow_id"
  );
  const [engine, setEngine] = useState<"native" | "vapi">("native");

  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false); // AI speaking
  const [isUserSpeaking, setIsUserSpeaking] = useState(false); // User mic active
  const [isThinking, setIsThinking] = useState(false); // Groq processing turn
  const [lastMessage, setLastMessage] = useState<string>("");
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [manualInput, setManualInput] = useState<string>("");
  const [isMuted, setIsMuted] = useState(false);

  // References for Native Voice Engine
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const messagesRef = useRef<SavedMessage[]>([]);
  const callStatusRef = useRef<CallStatus>(CallStatus.INACTIVE);
  const currentAnswerBufferRef = useRef<string>("");

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    messagesRef.current = messages;
    if (messages.length > 0) {
      setLastMessage(messages[messages.length - 1].content);
    }
  }, [messages]);

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  // Pick natural English voice from browser
  const getNaturalVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (typeof window === "undefined" || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const preferred = voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Natural") ||
          v.name.includes("Google") ||
          v.name.includes("Samantha") ||
          v.name.includes("Jenny") ||
          v.name.includes("Guy") ||
          v.name.includes("Karen") ||
          v.name.includes("Ava"))
    );
    return (
      preferred ||
      voices.find((v) => v.lang.startsWith("en")) ||
      voices[0] ||
      null
    );
  }, []);

  // Native Text-to-Speech
  const speakText = useCallback(
    (text: string, onEnd?: () => void) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        onEnd?.();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = getNaturalVoice();
      if (voice) utterance.voice = voice;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setIsSpeaking(true);
        isSpeakingRef.current = true;
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        onEnd?.();
      };

      utterance.onerror = (e) => {
        console.warn("TTS Utterance error:", e);
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        onEnd?.();
      };

      window.speechSynthesis.speak(utterance);
    },
    [getNaturalVoice]
  );

  // Stop all voice output and input
  const stopAllAudio = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }
    setIsSpeaking(false);
    setIsUserSpeaking(false);
    setIsThinking(false);
    setInterimTranscript("");
  }, []);

  // Process candidate answer turn with Groq AI
  const handleUserAnswerTurn = useCallback(
    async (candidateText: string) => {
      const cleanAnswer = candidateText.trim();
      if (!cleanAnswer || callStatusRef.current !== CallStatus.ACTIVE) return;

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      currentAnswerBufferRef.current = "";
      setInterimTranscript("");
      setIsUserSpeaking(false);

      const updatedHistory: SavedMessage[] = [
        ...messagesRef.current,
        { role: "user", content: cleanAnswer },
      ];
      setMessages(updatedHistory);
      setIsThinking(true);

      // Handle type === "generate" (Interview creation via voice)
      if (type === "generate") {
        try {
          const res = await generateAndCreateInterview({
            role: cleanAnswer.length > 5 ? cleanAnswer : "Full Stack Developer",
            type: "Mixed",
            level: "Mid-Level",
            techstack: ["React", "TypeScript", "Node.js"],
            amount: 5,
            userId: userId || "",
          });

          if (res.success && res.interviewId) {
            const wrapUp =
              "Great! I have generated your customized mock interview based on your request. Transporting you to your interview room now!";
            speakText(wrapUp, () => {
              router.push(`/interview/${res.interviewId}`);
            });
            return;
          }
        } catch (err) {
          console.error(err);
        }
      }

      // Handle type === "interview"
      try {
        const { reply, isCompleted } = await getConversationalInterviewReply({
          role,
          questions,
          transcript: updatedHistory,
          userName,
        });

        setIsThinking(false);

        const newMessages: SavedMessage[] = [
          ...updatedHistory,
          { role: "assistant", content: reply },
        ];
        setMessages(newMessages);

        // Speak reply out loud
        speakText(reply, () => {
          if (isCompleted) {
            // Conclude call smoothly
            handleDisconnect(newMessages);
          } else {
            // Restart speech recognition cleanly for next turn
            startSpeechRecognition();
          }
        });
      } catch (error) {
        console.error("Error getting Groq reply:", error);
        setIsThinking(false);
        const fallback =
          "Thank you for your answer. Let's proceed to the next question.";
        speakText(fallback, () => startSpeechRecognition());
      }
    },
    [questions, role, userName, speakText, type, userId, router]
  );

  // Initialize & Start Speech Recognition
  const startSpeechRecognition = useCallback(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      toast.error(
        "Voice speech recognition is not supported in this browser. You can still type your answers below!"
      );
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsUserSpeaking(false);
      };

      recognition.onresult = (event: any) => {
        // If AI is currently speaking and user talks, interrupt AI!
        if (isSpeakingRef.current) {
          if (typeof window !== "undefined" && "speechSynthesis" in window) {
            window.speechSynthesis.cancel();
          }
          setIsSpeaking(false);
          isSpeakingRef.current = false;
        }

        setIsUserSpeaking(true);

        let interim = "";
        let finalChunk = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPiece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalChunk += transcriptPiece + " ";
          } else {
            interim += transcriptPiece;
          }
        }

        if (finalChunk) {
          currentAnswerBufferRef.current = (
            currentAnswerBufferRef.current +
            " " +
            finalChunk
          ).trim();
          setInterimTranscript(currentAnswerBufferRef.current);
        } else if (interim) {
          setInterimTranscript(
            (currentAnswerBufferRef.current + " " + interim).trim()
          );
        }

        // Reset silence timer: when user pauses for 1.6s, send turn
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        silenceTimerRef.current = setTimeout(() => {
          const completeText = currentAnswerBufferRef.current.trim();
          if (completeText.length > 2) {
            handleUserAnswerTurn(completeText);
          }
        }, 1600);
      };

      recognition.onerror = (event: any) => {
        if (event.error === "no-speech") return;
        console.warn("Speech recognition notice:", event.error);
      };

      recognition.onend = () => {
        setIsUserSpeaking(false);
        // Automatically restart listening if call is active and AI isn't speaking
        if (
          callStatusRef.current === CallStatus.ACTIVE &&
          !isSpeakingRef.current
        ) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn("Could not start speech recognition:", err);
    }
  }, [handleUserAnswerTurn]);

  // Vapi Event Listeners (used only if Vapi engine is active)
  useEffect(() => {
    if (engine !== "vapi") return;

    const onCallStart = () => setCallStatus(CallStatus.ACTIVE);
    const onCallEnd = () => setCallStatus(CallStatus.FINISHED);
    const onMessage = (message: any) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
        setMessages((prev) => [
          ...prev,
          { role: message.role, content: message.transcript },
        ]);
      }
    };
    const onSpeechStart = () => setIsSpeaking(true);
    const onSpeechEnd = () => setIsSpeaking(false);
    const onError = (error: Error) => {
      console.error("Vapi Error, auto-falling back to Native Engine:", error);
      toast.error("Vapi connection failed. Switching to Free Native Engine!");
      setEngine("native");
      setCallStatus(CallStatus.INACTIVE);
    };

    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("message", onMessage);
    vapi.on("speech-start", onSpeechStart);
    vapi.on("speech-end", onSpeechEnd);
    vapi.on("error", onError);

    return () => {
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", onCallEnd);
      vapi.off("message", onMessage);
      vapi.off("speech-start", onSpeechStart);
      vapi.off("speech-end", onSpeechEnd);
      vapi.off("error", onError);
    };
  }, [engine]);

  // Handle saving feedback and redirecting
  const handleGenerateFeedback = useCallback(
    async (finalMessages: SavedMessage[]) => {
      toast.info("Generating comprehensive performance rubric & scoring...");
      const { success, feedbackId: id } = await createFeedback({
        interviewId: interviewId!,
        userId: userId!,
        transcript: finalMessages,
        feedbackId,
      });

      if (success && id) {
        toast.success("Feedback ready!");
        router.push(`/interview/${interviewId}/feedback`);
      } else {
        toast.error("Error saving feedback");
        router.push("/");
      }
    },
    [feedbackId, interviewId, router, userId]
  );

  // Handle Start Call
  const handleCall = async () => {
    setCallStatus(CallStatus.CONNECTING);
    setMessages([]);
    setInterimTranscript("");
    currentAnswerBufferRef.current = "";

    // If using Vapi
    if (engine === "vapi") {
      try {
        if (type === "generate") {
          await vapi.start(process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID!, {
            variableValues: { username: userName, userid: userId },
          });
        } else {
          let formattedQuestions = (questions || [])
            .map((q) => `- ${q}`)
            .join("\n");
          await vapi.start(process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID!, {
            variableValues: { questions: formattedQuestions },
          });
        }
      } catch (err) {
        console.error("Vapi start failed, using Native engine instead", err);
        toast.error("Vapi unavailable. Launching Free Native Engine!");
        setEngine("native");
        launchNativeCall();
      }
      return;
    }

    // Launch Free Native Engine
    launchNativeCall();
  };

  const launchNativeCall = () => {
    setCallStatus(CallStatus.ACTIVE);

    const firstQuestion =
      questions && questions.length > 0
        ? questions[0]
        : "Could you please introduce yourself and walk me through your recent projects?";

    const greeting =
      type === "generate"
        ? `Hello ${userName}! I'm your PrepWise voice interview assistant. What role and tech stack would you like to practice today?`
        : `Hello ${userName}! Welcome to your mock interview for the ${role} position. Let's begin with our first question: ${firstQuestion}`;

    const initialMessages: SavedMessage[] = [
      { role: "assistant", content: greeting },
    ];
    setMessages(initialMessages);

    // Speak initial greeting out loud, then start listening
    speakText(greeting, () => {
      startSpeechRecognition();
    });
  };

  // Handle Disconnect
  const handleDisconnect = (finalMsgList?: SavedMessage[]) => {
    const listToSave = finalMsgList || messagesRef.current;
    stopAllAudio();
    setCallStatus(CallStatus.FINISHED);

    if (engine === "vapi") {
      try {
        vapi.stop();
      } catch {}
    }

    if (listToSave.length > 1 && interviewId && userId) {
      handleGenerateFeedback(listToSave);
    } else {
      toast.info("Interview session ended.");
    }
  };

  // Submit answer manually (via button or text)
  const handleSubmitCurrentAnswer = () => {
    const textToSend = manualInput.trim() || interimTranscript.trim();
    if (!textToSend) {
      toast.warning("Please speak or type an answer first!");
      return;
    }
    setManualInput("");
    handleUserAnswerTurn(textToSend);
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Engine & Status Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-dark-200/60 border border-white/5 backdrop-blur-sm text-xs">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-success-100 animate-pulse" />
          <span className="text-white font-medium">
            {engine === "native"
              ? "Free Native Voice Agent (Browser + Groq AI)"
              : "Vapi AI WebRTC Agent"}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-primary-200/10 text-primary-200 text-[10px] font-semibold">
            Sub-400ms Uptime
          </span>
        </div>

        {/* Engine switcher if Vapi token exists */}
        {hasValidVapiToken && callStatus === CallStatus.INACTIVE && (
          <button
            onClick={() =>
              setEngine((prev) => (prev === "native" ? "vapi" : "native"))
            }
            className="text-[11px] text-light-400 hover:text-white transition-colors underline"
          >
            Switch to {engine === "native" ? "Vapi" : "Native"}
          </button>
        )}
      </div>

      {/* Main Call View */}
      <div className="call-view">
        {/* AI Interviewer Card */}
        <div
          className={cn(
            "card-interviewer transition-all relative overflow-hidden",
            isSpeaking && "border-primary-200 shadow-lg shadow-primary-200/10"
          )}
        >
          {/* Status Indicator */}
          <div className="absolute top-4 left-4 flex items-center gap-2 text-xs">
            {isThinking ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-200/20 text-primary-200 font-semibold animate-pulse">
                <Loader2 size={12} className="animate-spin" />
                Thinking...
              </span>
            ) : isSpeaking ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success-100/20 text-success-100 font-semibold">
                <Volume2 size={12} className="animate-pulse" />
                Speaking
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-dark-300 text-light-400">
                <Radio size={12} />
                Listening
              </span>
            )}
          </div>

          <div className="avatar">
            <Image
              src="/ai-avatar.png"
              alt="Interviewer"
              width={65}
              height={54}
              className="object-cover"
            />
            {isSpeaking && <span className="animate-speak" />}
          </div>

          <div className="flex flex-col items-center gap-1 mt-3">
            <h3 className="!text-xl font-bold text-white">AI Interviewer</h3>
            <p className="text-xs text-light-400">
              {role ? `${role} Evaluator` : "Technical Lead"}
            </p>

            {/* Voice Wave Animation */}
            {isSpeaking && (
              <div className="flex items-center gap-1 h-5 mt-2">
                <span className="w-1 bg-primary-200 rounded-full animate-[pulse_0.5s_ease-in-out_infinite] h-3" />
                <span className="w-1 bg-primary-200 rounded-full animate-[pulse_0.35s_ease-in-out_infinite_0.1s] h-5" />
                <span className="w-1 bg-primary-200 rounded-full animate-[pulse_0.6s_ease-in-out_infinite_0.2s] h-6" />
                <span className="w-1 bg-primary-200 rounded-full animate-[pulse_0.4s_ease-in-out_infinite_0.15s] h-4" />
                <span className="w-1 bg-primary-200 rounded-full animate-[pulse_0.5s_ease-in-out_infinite_0.25s] h-2" />
              </div>
            )}
          </div>
        </div>

        {/* User Profile Card */}
        <div
          className={cn(
            "card-border transition-all",
            isUserSpeaking &&
              "border-success-100 shadow-lg shadow-success-100/10"
          )}
        >
          <div className="card-content relative">
            {/* User Mic Activity */}
            <div className="absolute top-4 right-4 flex items-center gap-1.5 text-xs">
              {isUserSpeaking && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success-100/20 text-success-100 font-semibold">
                  <Mic size={12} className="animate-bounce" />
                  Your Mic Active
                </span>
              )}
            </div>

            <Image
              src="/user-avatar.png"
              alt="Candidate"
              width={120}
              height={120}
              className="rounded-full object-cover size-[120px] border-2 border-white/10"
            />
            <div className="flex flex-col items-center gap-1 mt-3">
              <h3 className="!text-xl font-bold text-white">{userName}</h3>
              <p className="text-xs text-light-400">Candidate</p>

              {/* User Voice Waves */}
              {isUserSpeaking && (
                <div className="flex items-center gap-1 h-5 mt-2">
                  <span className="w-1 bg-success-100 rounded-full animate-[pulse_0.4s_ease-in-out_infinite] h-2" />
                  <span className="w-1 bg-success-100 rounded-full animate-[pulse_0.3s_ease-in-out_infinite_0.1s] h-5" />
                  <span className="w-1 bg-success-100 rounded-full animate-[pulse_0.5s_ease-in-out_infinite_0.2s] h-6" />
                  <span className="w-1 bg-success-100 rounded-full animate-[pulse_0.35s_ease-in-out_infinite_0.15s] h-4" />
                  <span className="w-1 bg-success-100 rounded-full animate-[pulse_0.45s_ease-in-out_infinite_0.25s] h-3" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live Transcript & Real-Time Speech Display */}
      {(lastMessage || interimTranscript) && (
        <div className="transcript-border w-full">
          <div className="transcript flex flex-col gap-2 min-h-16 py-4 px-6 text-left">
            {lastMessage && (
              <p
                key={lastMessage}
                className={cn(
                  "text-base sm:text-lg text-white font-medium leading-relaxed transition-opacity duration-300",
                  "animate-fadeIn"
                )}
              >
                {lastMessage}
              </p>
            )}

            {/* Live interim user speech preview */}
            {interimTranscript && (
              <div className="flex items-start gap-2 pt-2 border-t border-white/5 text-xs sm:text-sm text-primary-200/90 italic">
                <span className="font-semibold not-italic text-light-400 shrink-0">
                  You are saying:
                </span>
                <span>{interimTranscript}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interactive Controls Bar */}
      <div className="w-full flex flex-col items-center gap-4">
        {callStatus !== CallStatus.ACTIVE ? (
          <div className="flex flex-col items-center gap-2">
            <button
              className="relative btn-call flex items-center justify-center gap-2 min-w-36"
              onClick={handleCall}
              disabled={callStatus === CallStatus.CONNECTING}
            >
              <span
                className={cn(
                  "absolute animate-ping rounded-full opacity-75",
                  callStatus !== CallStatus.CONNECTING && "hidden"
                )}
              />
              <span className="relative flex items-center gap-2">
                <Sparkles size={16} />
                {callStatus === CallStatus.CONNECTING
                  ? "Connecting..."
                  : "Start Voice Call"}
              </span>
            </button>
            <p className="text-[11px] text-light-400">
              100% Free Voice Agent • Speaks aloud & listens to your answers
            </p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xl">
            {/* Quick Answer Submit Button */}
            <Button
              type="button"
              onClick={handleSubmitCurrentAnswer}
              disabled={isThinking}
              className="btn-primary flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 size={15} />
              Done Answering →
            </Button>

            {/* End Call Button */}
            <button
              className="btn-disconnect flex items-center justify-center gap-1.5 text-xs py-2.5 px-6"
              onClick={() => handleDisconnect()}
            >
              <PhoneOff size={15} />
              End Interview
            </button>
          </div>
        )}

        {/* Optional Manual Text Answer Input during active call */}
        {callStatus === CallStatus.ACTIVE && (
          <div className="flex items-center gap-2 w-full max-w-xl pt-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmitCurrentAnswer();
                }
              }}
              placeholder="Or type your response here and press Enter..."
              className="flex-1 px-4 py-2 rounded-xl bg-dark-200 border border-white/10 text-xs text-white placeholder:text-light-400 focus:outline-none focus:border-primary-200"
            />
            <Button
              size="sm"
              onClick={handleSubmitCurrentAnswer}
              disabled={!manualInput.trim() || isThinking}
              className="btn-secondary text-xs px-3"
            >
              <Send size={13} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Agent;

