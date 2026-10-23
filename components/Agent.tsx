"use client";

import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  PhoneOff,
  Sparkles,
  Volume2,
  Send,
  Loader2,
  CheckCircle2,
  Radio,
  Ear,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  createFeedback,
  getConversationalInterviewReply,
  generateAndCreateInterview,
  transcribeAudio,
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

  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false); // AI is speaking
  const [isUserSpeaking, setIsUserSpeaking] = useState(false); // Candidate mic active
  const [isThinking, setIsThinking] = useState(false); // AI analyzing answer
  const [isTranscribing, setIsTranscribing] = useState(false); // Whisper transcribing
  const [lastMessage, setLastMessage] = useState<string>("");
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [manualInput, setManualInput] = useState<string>("");
  const [micVolume, setMicVolume] = useState<number>(0);

  // Audio Context & Hardware Stream Refs
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Hardware MediaRecorder for Groq Whisper Fail-safe Backup
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Speech Recognition & TTS Refs
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const currentSpokenTextRef = useRef<string>("");
  const isSpeakingRef = useRef<boolean>(false);
  const isThinkingRef = useRef<boolean>(false);
  const messagesRef = useRef<SavedMessage[]>([]);
  const callStatusRef = useRef<CallStatus>(CallStatus.INACTIVE);
  const recognitionRestartLockRef = useRef<boolean>(false);
  const restartSpeechRecognitionRef = useRef<() => void>(() => {});

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    isThinkingRef.current = isThinking;
  }, [isThinking]);

  useEffect(() => {
    messagesRef.current = messages;
    if (messages.length > 0) {
      setLastMessage(messages[messages.length - 1].content);
    }
  }, [messages]);

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, []);

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

  // Stop all audio output, microphone listeners, and recorders
  const stopAllAudio = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    activeUtteranceRef.current = null;
    setIsSpeaking(false);
    setIsUserSpeaking(false);
    setIsThinking(false);
    setIsTranscribing(false);
    isSpeakingRef.current = false;
    isThinkingRef.current = false;
    setLiveTranscript("");
    currentSpokenTextRef.current = "";
    setMicVolume(0);
  }, []);

  // Start Hardware MediaRecorder Session
  const startRecordingAudioChunks = useCallback(() => {
    if (!mediaStreamRef.current) return;
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      audioChunksRef.current = [];

      let options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options = { mimeType: "audio/webm;codecs=opus" };
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        options = { mimeType: "audio/webm" };
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        options = { mimeType: "audio/mp4" };
      }

      const recorder = new MediaRecorder(mediaStreamRef.current, options);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      recorder.start(250); // Record chunks every 250ms
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.warn("Could not start MediaRecorder:", err);
    }
  }, []);

  // Speak text using SpeechSynthesis with Chrome garbage-collection protection
  const speakText = useCallback(
    (text: string, onEnd?: () => void) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        onEnd?.();
        return;
      }

      window.speechSynthesis.cancel();
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
        speechTimeoutRef.current = null;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      activeUtteranceRef.current = utterance; // Prevent GC in Chrome

      const voice = getNaturalVoice();
      if (voice) utterance.voice = voice;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      let hasEnded = false;
      const finishSpeech = () => {
        if (hasEnded) return;
        hasEnded = true;
        if (speechTimeoutRef.current) {
          clearTimeout(speechTimeoutRef.current);
          speechTimeoutRef.current = null;
        }
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        activeUtteranceRef.current = null;
        // After AI finishes speaking, ALWAYS restart speech recognition + recording
        if (callStatusRef.current === CallStatus.ACTIVE) {
          startRecordingAudioChunks();
          restartSpeechRecognitionRef.current();
        }
        onEnd?.();
      };

      utterance.onstart = () => {
        setIsSpeaking(true);
        isSpeakingRef.current = true;
      };

      utterance.onend = () => {
        finishSpeech();
      };

      utterance.onerror = (e) => {
        console.warn("Speech synthesis notice:", e);
        finishSpeech();
      };

      // Safety timeout in case browser drops onend
      const safeDuration = Math.max(2500, (text.length / 12) * 1000 + 2000);
      speechTimeoutRef.current = setTimeout(() => {
        if (isSpeakingRef.current) {
          finishSpeech();
        }
      }, safeDuration);

      window.speechSynthesis.speak(utterance);
    },
    [getNaturalVoice]
  );

  // Submit candidate answer turn to Groq AI
  const handleUserAnswerTurn = useCallback(
    async (candidateText: string) => {
      const cleanAnswer = candidateText.trim();
      if (!cleanAnswer || callStatusRef.current !== CallStatus.ACTIVE) return;

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      currentSpokenTextRef.current = "";
      setLiveTranscript("");
      setIsUserSpeaking(false);
      setIsThinking(true);
      isThinkingRef.current = true;

      const updatedHistory: SavedMessage[] = [
        ...messagesRef.current,
        { role: "user", content: cleanAnswer },
      ];
      setMessages(updatedHistory);

      // Handle interview generation via voice (type === "generate")
      if (type === "generate") {
        try {
          const res = await generateAndCreateInterview({
            role: cleanAnswer.length > 4 ? cleanAnswer : "Full Stack Developer",
            type: "Mixed",
            level: "Mid-Level",
            techstack: ["React", "TypeScript", "Node.js"],
            amount: 5,
            userId: userId || "",
          });

          if (res.success && res.interviewId) {
            const wrapUp =
              "Awesome! I've set up your tailored mock interview session. Transferring you to your interview room now!";
            speakText(wrapUp, () => {
              router.push(`/interview/${res.interviewId}`);
            });
            return;
          }
        } catch (err) {
          console.error("Error generating interview via voice:", err);
        }
      }

      // Handle interview conversation (type === "interview")
      try {
        const { reply, isCompleted } = await getConversationalInterviewReply({
          role,
          questions,
          transcript: updatedHistory,
          userName,
        });

        setIsThinking(false);
        isThinkingRef.current = false;

        const newMessages: SavedMessage[] = [
          ...updatedHistory,
          { role: "assistant", content: reply },
        ];
        setMessages(newMessages);

        // Speak reply out loud - recognition + recording restart is handled automatically by finishSpeech
        speakText(reply, () => {
          if (isCompleted) {
            handleDisconnect(newMessages);
          } else {
            // Clear transcript for fresh candidate answer
            currentSpokenTextRef.current = "";
            setLiveTranscript("");
          }
        });
      } catch (error) {
        console.error("Error in AI response:", error);
        setIsThinking(false);
        isThinkingRef.current = false;
        const fallback =
          "Thank you for sharing your thoughts. Let's move on to the next question.";
        speakText(fallback, () => {
          currentSpokenTextRef.current = "";
          setLiveTranscript("");
        });
      }
    },
    [questions, role, userName, speakText, type, userId, router, startRecordingAudioChunks]
  );

  // Safely (re)start browser SpeechRecognition - can be called any number of times
  const restartSpeechRecognition = useCallback(() => {
    if (typeof window === "undefined") return;
    if (recognitionRestartLockRef.current) return;
    recognitionRestartLockRef.current = true;

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      recognitionRestartLockRef.current = false;
      return;
    }

    // Tear down previous instance completely
    if (recognitionRef.current) {
      try { recognitionRef.current.onend = null; } catch {}
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }

    setTimeout(() => {
      recognitionRestartLockRef.current = false;
      if (callStatusRef.current !== CallStatus.ACTIVE) return;
      if (isSpeakingRef.current || isThinkingRef.current) return;

      try {
        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          console.log("[SpeechRecognition] started");
        };

        recognition.onresult = (event: any) => {
          // If candidate speaks while AI was talking, interrupt the AI
          if (isSpeakingRef.current) {
            if (typeof window !== "undefined" && "speechSynthesis" in window) {
              window.speechSynthesis.cancel();
            }
            setIsSpeaking(false);
            isSpeakingRef.current = false;
          }

          // Collect all spoken text from session
          let fullTranscript = "";
          for (let i = 0; i < event.results.length; i++) {
            fullTranscript += event.results[i][0].transcript + " ";
          }
          fullTranscript = fullTranscript.trim();

          if (fullTranscript) {
            currentSpokenTextRef.current = fullTranscript;
            setLiveTranscript(fullTranscript);
            setIsUserSpeaking(true);
          }

          // Silence detection: after candidate stops talking for 5s, auto-submit
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }
          silenceTimerRef.current = setTimeout(() => {
            const finalCandidateText = currentSpokenTextRef.current.trim();
            if (
              finalCandidateText.length > 3 &&
              !isSpeakingRef.current &&
              !isThinkingRef.current
            ) {
              handleUserAnswerTurn(finalCandidateText);
            }
          }, 5000);
        };

        recognition.onerror = (event: any) => {
          if (event.error === "no-speech" || event.error === "aborted") return;
          console.warn("[SpeechRecognition] error:", event.error);
        };

        recognition.onend = () => {
          console.log("[SpeechRecognition] ended, will auto-restart");
          setIsUserSpeaking(false);
          // Auto-restart after delay unless AI is speaking or we're done
          setTimeout(() => {
            if (
              callStatusRef.current === CallStatus.ACTIVE &&
              !isSpeakingRef.current &&
              !isThinkingRef.current &&
              !recognitionRestartLockRef.current
            ) {
              try {
                recognition.start();
                console.log("[SpeechRecognition] restarted via onend");
              } catch (e) {
                console.warn("[SpeechRecognition] restart failed, creating fresh instance");
                restartSpeechRecognition();
              }
            }
          }, 400);
        };

        recognition.start();
        recognitionRef.current = recognition;
        console.log("[SpeechRecognition] fresh instance started");
      } catch (err) {
        console.warn("Could not start speech recognition:", err);
      }
    }, 350);
  }, [handleUserAnswerTurn]);

  // Keep the ref in sync so speakText (defined before restartSpeechRecognition) can call it
  useEffect(() => {
    restartSpeechRecognitionRef.current = restartSpeechRecognition;
  }, [restartSpeechRecognition]);

  // Handle saving feedback and redirecting
  const handleGenerateFeedback = useCallback(
    async (finalMessages: SavedMessage[]) => {
      toast.info("Generating comprehensive performance rubric & question-by-question breakdown...");
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
    setLiveTranscript("");
    currentSpokenTextRef.current = "";

    try {
      // 1. Acquire microphone stream and KEEP it active throughout the call
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        // 2. Attach Web Audio API to measure vocal volume
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          analyserRef.current = analyser;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const measureMicLevel = () => {
            if (callStatusRef.current !== CallStatus.ACTIVE && callStatusRef.current !== CallStatus.CONNECTING) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;
            const level = Math.min(100, Math.round((avg / 128) * 100));
            setMicVolume(level);
            if (level > 12 && !isSpeakingRef.current) {
              setIsUserSpeaking(true);
            }
            animFrameRef.current = requestAnimationFrame(measureMicLevel);
          };
          animFrameRef.current = requestAnimationFrame(measureMicLevel);
        }
      }
    } catch (micErr) {
      console.warn("Microphone access notice:", micErr);
      toast.warning("Could not access microphone directly. You can still type responses during the call.");
    }

    setCallStatus(CallStatus.ACTIVE);
    callStatusRef.current = CallStatus.ACTIVE;

    // 3. Start hardware audio recording immediately (recognition starts after greeting)
    startRecordingAudioChunks();

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

    // Speak initial greeting - recognition + recording will auto-restart when speech ends
    speakText(greeting);
  };

  // Handle Disconnect
  const handleDisconnect = (finalMsgList?: SavedMessage[]) => {
    const listToSave = finalMsgList || messagesRef.current;
    stopAllAudio();
    setCallStatus(CallStatus.FINISHED);

    if (listToSave.length > 1 && interviewId && userId) {
      handleGenerateFeedback(listToSave);
    } else {
      toast.info("Interview session ended.");
    }
  };

  // Submit answer manually (via button or text) with Groq Whisper failover
  const handleSubmitCurrentAnswer = async () => {
    // Cancel any pending silence auto-submit
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    let textToSend = manualInput.trim() || liveTranscript.trim() || currentSpokenTextRef.current.trim();

    // If Web Speech API didn't pick up text, transcribe with Groq Whisper from audio chunks!
    if (!textToSend && audioChunksRef.current.length > 0) {
      try {
        setIsTranscribing(true);

        // Stop current recorder to flush final data
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
          // Wait briefly for ondataavailable to flush
          await new Promise((r) => setTimeout(r, 200));
        }

        const mimeType = mediaRecorderRef.current?.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log("[Whisper Fallback] Blob size:", audioBlob.size, "type:", mimeType, "chunks:", audioChunksRef.current.length);

        if (audioBlob.size > 500) {
          const formData = new FormData();
          const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
          formData.append("file", audioBlob, `answer.${ext}`);
          const { text, error } = await transcribeAudio(formData);
          if (text) {
            textToSend = text;
            console.log("[Whisper Fallback] Transcribed:", text);
          } else if (error) {
            console.warn("Whisper transcription notice:", error);
          }
        }
      } catch (err) {
        console.warn("Failover transcription error:", err);
      } finally {
        setIsTranscribing(false);
      }
    }

    if (!textToSend) {
      toast.warning("No speech or text detected yet. Please speak clearly into your mic or type an answer below!");
      // Restart recording + recognition for another attempt
      startRecordingAudioChunks();
      restartSpeechRecognitionRef.current();
      return;
    }

    setManualInput("");
    handleUserAnswerTurn(textToSend);
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn">
      {/* Main Call View */}
      <div className="call-view">
        {/* AI Interviewer Card */}
        <div
          className={cn(
            "card-interviewer transition-all relative overflow-hidden duration-300",
            isSpeaking && "border-primary-200 shadow-xl shadow-primary-200/20 ring-2 ring-primary-200/30",
            isThinking && "border-primary-100/60 shadow-lg shadow-primary-100/10",
            !isSpeaking && !isThinking && callStatus === CallStatus.ACTIVE && "border-emerald-500/30"
          )}
        >
          {/* Real-time Status Badge */}
          <div className="absolute top-4 left-4 flex items-center gap-2 text-xs z-10">
            {isThinking ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-200/20 border border-primary-200/40 text-primary-200 font-semibold animate-pulse shadow-sm">
                <Loader2 size={13} className="animate-spin" />
                AI Analyzing Answer...
              </span>
            ) : isSpeaking ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success-100/20 border border-success-100/40 text-success-100 font-semibold animate-pulse shadow-sm">
                <Volume2 size={13} />
                Interviewer Speaking
              </span>
            ) : callStatus === CallStatus.ACTIVE ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-dark-300/80 border border-white/10 text-primary-100 font-medium">
                <Ear size={13} className="text-primary-200 animate-pulse" />
                Listening to you...
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-dark-300 text-light-400">
                <Radio size={12} />
                Ready to Call
              </span>
            )}
          </div>

          {/* Avatar with dynamic glowing rings */}
          <div className="avatar relative">
            <Image
              src="/ai-avatar.png"
              alt="AI Interviewer"
              width={65}
              height={54}
              className="object-cover relative z-10"
              priority
            />
            {isSpeaking && (
              <span className="absolute -inset-2 rounded-full bg-primary-200/30 animate-ping pointer-events-none" />
            )}
            {isThinking && (
              <span className="absolute -inset-1 rounded-full bg-primary-100/40 animate-pulse pointer-events-none" />
            )}
          </div>

          <div className="flex flex-col items-center gap-1 mt-3">
            <h3 className="!text-xl font-bold text-white tracking-wide">AI Interviewer</h3>
            <p className="text-xs text-light-400">
              {role ? `${role} Technical Lead` : "Interviewer"}
            </p>

            {/* Dynamic Voice Wave Equalizer */}
            {isSpeaking && (
              <div className="flex items-center gap-1 h-6 mt-3 px-3 py-1 rounded-full bg-primary-200/10 border border-primary-200/20">
                <span className="w-1 bg-primary-200 rounded-full animate-[pulse_0.4s_ease-in-out_infinite] h-3" />
                <span className="w-1 bg-primary-200 rounded-full animate-[pulse_0.6s_ease-in-out_infinite_0.1s] h-5" />
                <span className="w-1 bg-primary-200 rounded-full animate-[pulse_0.35s_ease-in-out_infinite_0.2s] h-6" />
                <span className="w-1 bg-primary-200 rounded-full animate-[pulse_0.5s_ease-in-out_infinite_0.15s] h-4" />
                <span className="w-1 bg-primary-200 rounded-full animate-[pulse_0.7s_ease-in-out_infinite_0.25s] h-5" />
                <span className="w-1 bg-primary-200 rounded-full animate-[pulse_0.4s_ease-in-out_infinite_0.3s] h-2" />
              </div>
            )}
          </div>
        </div>

        {/* User Profile Card */}
        <div
          className={cn(
            "card-border transition-all duration-300",
            (isUserSpeaking || micVolume > 15) &&
              "border-success-100 shadow-xl shadow-success-100/20 ring-2 ring-success-100/30"
          )}
        >
          <div className="card-content relative overflow-hidden">
            {/* User Microphone Status Badge */}
            <div className="absolute top-4 right-4 flex items-center gap-1.5 text-xs z-10">
              {isUserSpeaking || micVolume > 15 ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success-100/20 border border-success-100/40 text-success-100 font-semibold animate-pulse shadow-sm">
                  <Mic size={13} className="animate-bounce" />
                  Mic Active • Speaking ({micVolume}%)
                </span>
              ) : callStatus === CallStatus.ACTIVE ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-dark-300/80 border border-white/10 text-light-400">
                  <Mic size={12} className="text-light-400" />
                  Mic On • Speak Freely
                </span>
              ) : null}
            </div>

            {/* Candidate Avatar */}
            <div className="relative">
              <Image
                src="/user-avatar.png"
                alt="Candidate"
                width={120}
                height={120}
                className="rounded-full object-cover size-[120px] border-2 border-white/10 relative z-10"
              />
              {(isUserSpeaking || micVolume > 15) && (
                <span className="absolute -inset-2 rounded-full bg-success-100/30 animate-ping pointer-events-none" />
              )}
            </div>

            <div className="flex flex-col items-center gap-1 mt-3">
              <h3 className="!text-xl font-bold text-white tracking-wide">{userName}</h3>
              <p className="text-xs text-light-400">Candidate</p>

              {/* Dynamic User Microphone Audio Waves */}
              {(isUserSpeaking || micVolume > 10) && (
                <div className="flex items-center gap-1 h-6 mt-3 px-3 py-1 rounded-full bg-success-100/10 border border-success-100/20">
                  <span className="w-1 bg-success-100 rounded-full animate-[pulse_0.4s_ease-in-out_infinite] h-2" />
                  <span className="w-1 bg-success-100 rounded-full animate-[pulse_0.3s_ease-in-out_infinite_0.1s] h-5" />
                  <span className="w-1 bg-success-100 rounded-full animate-[pulse_0.5s_ease-in-out_infinite_0.2s] h-6" />
                  <span className="w-1 bg-success-100 rounded-full animate-[pulse_0.35s_ease-in-out_infinite_0.15s] h-4" />
                  <span className="w-1 bg-success-100 rounded-full animate-[pulse_0.6s_ease-in-out_infinite_0.25s] h-5" />
                  <span className="w-1 bg-success-100 rounded-full animate-[pulse_0.45s_ease-in-out_infinite_0.3s] h-3" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live Dialogue & Subtitle Stream */}
      {(lastMessage || liveTranscript || isThinking || isTranscribing) && (
        <div className="transcript-border w-full">
          <div className="transcript flex flex-col gap-3 min-h-20 py-4 px-6 text-left">
            {/* Interviewer's Last Statement */}
            {lastMessage && (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider font-bold text-primary-200/80">
                  AI Interviewer
                </span>
                <p
                  key={lastMessage}
                  className="text-base sm:text-lg text-white font-medium leading-relaxed animate-fadeIn"
                >
                  {lastMessage}
                </p>
              </div>
            )}

            {/* Candidate's Live Real-Time Speech Subtitles */}
            {liveTranscript && (
              <div className="flex flex-col gap-1 pt-2 border-t border-white/10">
                <span className="text-[11px] uppercase tracking-wider font-bold text-success-100">
                  You (Live Speaking)
                </span>
                <p className="text-sm sm:text-base text-success-100 font-normal italic flex items-center gap-1.5">
                  <span>"{liveTranscript}"</span>
                  <span className="inline-block w-1.5 h-4 bg-success-100 animate-pulse" />
                </p>
              </div>
            )}

            {/* Transcribing Indicator */}
            {isTranscribing && (
              <div className="flex items-center gap-2 pt-2 border-t border-white/10 text-xs text-primary-200 animate-pulse">
                <Loader2 size={13} className="animate-spin" />
                <span>Transcribing your audio with Groq Whisper...</span>
              </div>
            )}

            {/* Thinking Status Indicator */}
            {isThinking && (
              <div className="flex items-center gap-2 pt-2 border-t border-white/10 text-xs text-primary-200 animate-pulse">
                <Loader2 size={13} className="animate-spin" />
                <span>AI is reviewing your answer and preparing the next question...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interactive Controls Bar */}
      <div className="w-full flex flex-col items-center gap-4 mt-2">
        {callStatus !== CallStatus.ACTIVE ? (
          <div className="flex flex-col items-center gap-2">
            <button
              className="relative btn-call flex items-center justify-center gap-2 min-w-44 py-3.5 text-base"
              onClick={handleCall}
              disabled={callStatus === CallStatus.CONNECTING}
            >
              <span
                className={cn(
                  "absolute animate-ping rounded-full opacity-75",
                  callStatus !== CallStatus.CONNECTING && "hidden"
                )}
              />
              <span className="relative flex items-center gap-2 font-bold">
                <Sparkles size={18} />
                {callStatus === CallStatus.CONNECTING
                  ? "Connecting..."
                  : "Start Voice Call"}
              </span>
            </button>
            <p className="text-xs text-light-400">
              Interactive voice conversation • Listens, acknowledges & guides you through each question
            </p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xl">
            {/* Quick Answer Submit Button */}
            <Button
              type="button"
              onClick={handleSubmitCurrentAnswer}
              disabled={isThinking || isTranscribing}
              className="btn-primary flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary-200/20"
            >
              {isTranscribing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Transcribing Voice...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  Done Answering →
                </>
              )}
            </Button>

            {/* End Call Button */}
            <button
              className="btn-disconnect flex items-center justify-center gap-2 text-sm py-3 px-6"
              onClick={() => handleDisconnect()}
            >
              <PhoneOff size={16} />
              End Interview
            </button>
          </div>
        )}

        {/* Optional Manual Text Answer Input during active call */}
        {callStatus === CallStatus.ACTIVE && (
          <div className="flex items-center gap-2 w-full max-w-xl pt-1">
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
              className="flex-1 px-4 py-2.5 rounded-xl bg-dark-200 border border-white/10 text-xs sm:text-sm text-white placeholder:text-light-400 focus:outline-none focus:border-primary-200 transition-colors"
            />
            <Button
              size="sm"
              onClick={handleSubmitCurrentAnswer}
              disabled={!manualInput.trim() || isThinking || isTranscribing}
              className="btn-secondary text-xs px-4 py-2.5"
            >
              <Send size={14} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Agent;
