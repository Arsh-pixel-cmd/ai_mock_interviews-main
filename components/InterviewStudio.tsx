"use client";

import { useState } from "react";
import {
  Sparkles,
  Loader2,
  Briefcase,
  Layers,
  Target,
  HelpCircle,
  Check,
  Mic,
  SlidersHorizontal,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Agent from "@/components/Agent";
import { useInterviewForm } from "@/hooks/useInterviewForm";
import { ROLE_PRESETS, POPULAR_TECHS } from "@/constants/interview-config";

interface InterviewStudioProps {
  user: {
    id: string;
    name: string;
    profileURL?: string;
  };
}

export default function InterviewStudio({ user }: InterviewStudioProps) {
  const [activeTab, setActiveTab] = useState<"custom" | "voice">("custom");

  const {
    loading,
    role,
    level,
    type,
    techstack,
    customTechInput,
    amount,
    setRole,
    setLevel,
    setType,
    setCustomTechInput,
    setAmount,
    toggleTech,
    addCustomTech,
    handleKeyDownTech,
    handleCreate,
  } = useInterviewForm({ userId: user.id });

  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto py-4">
      {/* Page Title & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Interview Studio
          </h2>
          <p className="text-xs sm:text-sm text-light-400 mt-1">
            Configure your mock interview session or generate one via voice interaction.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-dark-200 border border-white/10 w-fit">
          <button
            onClick={() => setActiveTab("custom")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "custom"
                ? "bg-primary-200 text-dark-100 shadow"
                : "text-light-400 hover:text-white"
            }`}
          >
            <SlidersHorizontal size={14} />
            Quick Setup
          </button>
          <button
            onClick={() => setActiveTab("voice")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "voice"
                ? "bg-primary-200 text-dark-100 shadow"
                : "text-light-400 hover:text-white"
            }`}
          >
            <Mic size={14} />
            Voice Setup
          </button>
        </div>
      </div>

      {activeTab === "custom" ? (
        <div className="card-border w-full">
          <div className="card dark-gradient p-6 sm:p-10 flex flex-col gap-8">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary-200/10 border border-primary-200/20 flex items-center justify-center text-primary-200">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  Customize Interview Parameters
                </h3>
                <p className="text-xs text-light-400">
                  Select your target job details to generate realistic scenario questions.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="flex flex-col gap-6">
              {/* Target Role */}
              <div className="flex flex-col gap-2.5">
                <label className="text-xs font-semibold text-light-100 flex items-center gap-1.5">
                  <Briefcase size={14} className="text-primary-200" />
                  Target Role
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Senior Full Stack Engineer"
                  className="w-full px-4 py-3 rounded-xl bg-dark-200 border border-white/10 text-white text-sm focus:outline-none focus:border-primary-200 transition-colors"
                  required
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  {ROLE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRole(preset)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                        role === preset
                          ? "bg-primary-200/20 border-primary-200 text-primary-200 font-semibold"
                          : "bg-dark-300/50 border-white/5 text-light-300 hover:text-white hover:border-white/20"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Experience Level & Focus */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-light-100 flex items-center gap-1.5">
                    <Layers size={14} className="text-primary-200" />
                    Experience Level
                  </label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-dark-200 border border-white/10 text-white text-sm focus:outline-none focus:border-primary-200 transition-colors"
                  >
                    <option value="Junior">Junior (0-2 years)</option>
                    <option value="Mid-Level">Mid-Level (3-5 years)</option>
                    <option value="Senior">Senior (5-8 years)</option>
                    <option value="Lead / Principal">Lead / Staff (8+ years)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-light-100 flex items-center gap-1.5">
                    <Target size={14} className="text-primary-200" />
                    Question Focus
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-dark-200 border border-white/10 text-white text-sm focus:outline-none focus:border-primary-200 transition-colors"
                  >
                    <option value="Technical">Technical (Coding & Architecture)</option>
                    <option value="Behavioral">Behavioral (Leadership & STAR)</option>
                    <option value="Mixed">Mixed (Technical + Behavioral)</option>
                  </select>
                </div>
              </div>

              {/* Number of Questions */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-light-100 flex items-center gap-1.5">
                    <HelpCircle size={14} className="text-primary-200" />
                    Number of Interview Questions
                  </label>
                  <span className="text-xs text-primary-200 font-bold">
                    {amount} Questions
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[3, 5, 7].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setAmount(num)}
                      className={`py-2.5 text-xs font-semibold rounded-xl border transition-all ${
                        amount === num
                          ? "bg-primary-200 text-dark-100 border-primary-200 font-bold"
                          : "bg-dark-200 border-white/10 text-light-100 hover:border-white/20"
                      }`}
                    >
                      {num} Questions
                    </button>
                  ))}
                </div>
              </div>

              {/* Tech Stack Chips */}
              <div className="flex flex-col gap-2.5">
                <label className="text-xs font-semibold text-light-100">
                  Tech Stack & Tools ({techstack.length} selected)
                </label>
                <div className="flex flex-wrap gap-2 p-3 bg-dark-200/50 rounded-xl border border-white/5 max-h-36 overflow-y-auto">
                  {POPULAR_TECHS.map((tech) => {
                    const isSelected = techstack.includes(tech);
                    return (
                      <button
                        key={tech}
                        type="button"
                        onClick={() => toggleTech(tech)}
                        className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all ${
                          isSelected
                            ? "bg-primary-200/20 border-primary-200 text-primary-200 font-semibold"
                            : "bg-dark-300 border-white/5 text-light-300 hover:text-white"
                        }`}
                      >
                        {isSelected && <Check size={12} />}
                        {tech}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={customTechInput}
                    onChange={(e) => setCustomTechInput(e.target.value)}
                    onKeyDown={handleKeyDownTech}
                    placeholder="Add custom technology (e.g. Kubernetes, Rust, GraphQL)..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-dark-200 border border-white/10 text-white text-xs focus:outline-none focus:border-primary-200"
                  />
                  <button
                    type="button"
                    onClick={addCustomTech}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-dark-300 border border-white/10 text-white hover:bg-white/10"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Launch Button */}
              <div className="pt-4 border-t border-white/10 flex justify-end">
                <Button
                  type="submit"
                  disabled={loading}
                  className="btn-primary min-w-[200px] py-3 text-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" />
                      Generating Interview...
                    </>
                  ) : (
                    <>
                      Launch Mock Interview
                      <ArrowRight size={16} className="ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="p-4 rounded-xl bg-dark-200/70 border border-white/10 text-xs text-light-300 flex items-center gap-2">
            <Mic size={16} className="text-primary-200 shrink-0" />
            <span>
              Voice Setup: Click Call below to discuss your preferred job role and questions with the voice assistant.
            </span>
          </div>

          <Agent
            userName={user.name}
            userId={user.id}
            profileImage={user.profileURL}
            type="generate"
          />
        </div>
      )}
    </div>
  );
}
