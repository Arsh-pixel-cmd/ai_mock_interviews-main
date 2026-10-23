"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { generateAndCreateInterview } from "@/lib/actions/general.action";
import {
  DEFAULT_TECHSTACK,
  DEFAULT_QUESTION_AMOUNT,
} from "@/constants/interview-config";

interface UseInterviewFormOptions {
  userId: string;
  onSuccess?: (interviewId: string) => void;
}

/**
 * Shared hook for interview creation form logic.
 * Eliminates duplication between CreateInterviewModal and InterviewStudio.
 */
export function useInterviewForm({ userId, onSuccess }: UseInterviewFormOptions) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Form states
  const [role, setRole] = useState("Full Stack Developer");
  const [level, setLevel] = useState("Mid-Level");
  const [type, setType] = useState("Technical");
  const [techstack, setTechstack] = useState<string[]>([...DEFAULT_TECHSTACK]);
  const [customTechInput, setCustomTechInput] = useState("");
  const [amount, setAmount] = useState(DEFAULT_QUESTION_AMOUNT);

  const toggleTech = (tech: string) => {
    if (techstack.includes(tech)) {
      setTechstack(techstack.filter((t) => t !== tech));
    } else {
      setTechstack([...techstack, tech]);
    }
  };

  const addCustomTech = () => {
    const trimmed = customTechInput.trim();
    if (!trimmed) return;
    if (!techstack.includes(trimmed)) {
      setTechstack([...techstack, trimmed]);
    }
    setCustomTechInput("");
  };

  const handleKeyDownTech = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addCustomTech();
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role.trim()) {
      toast.error("Please enter a target role");
      return;
    }
    if (techstack.length === 0) {
      toast.error("Please select at least one technology");
      return;
    }

    try {
      setLoading(true);
      toast.info("Generating interview questions tailored to your stack...");

      const res = await generateAndCreateInterview({
        role: role.trim(),
        level,
        type,
        techstack,
        amount,
        userId,
      });

      if (res.success && res.interviewId) {
        toast.success("Interview created! Loading interview room...");
        onSuccess?.(res.interviewId);
        router.push(`/interview/${res.interviewId}`);
      } else {
        toast.error(res.error || "Failed to create interview");
        setLoading(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred while creating the interview";
      toast.error(message);
      setLoading(false);
    }
  };

  return {
    // State
    loading,
    role,
    level,
    type,
    techstack,
    customTechInput,
    amount,
    // Setters
    setRole,
    setLevel,
    setType,
    setTechstack,
    setCustomTechInput,
    setAmount,
    // Handlers
    toggleTech,
    addCustomTech,
    handleKeyDownTech,
    handleCreate,
  };
}
