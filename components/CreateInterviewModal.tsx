"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, Loader2, X, Check, Briefcase, Layers, Target, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateAndCreateInterview } from "@/lib/actions/general.action";

interface CreateInterviewModalProps {
  userId: string;
  triggerText?: string;
  className?: string;
  variant?: "primary" | "secondary" | "outline";
  showIcon?: boolean;
}

const ROLE_PRESETS = [
  "Full Stack Developer",
  "Frontend Engineer (React)",
  "Backend Engineer (Node/Go)",
  "DevOps & Cloud Engineer",
  "System Architect",
  "Data Engineer",
];

const POPULAR_TECHS = [
  "React",
  "TypeScript",
  "Next.js",
  "Node.js",
  "Python",
  "PostgreSQL",
  "Docker",
  "AWS",
  "Tailwind CSS",
  "GraphQL",
  "Redis",
  "Go",
];

export default function CreateInterviewModal({
  userId,
  triggerText = "New Interview",
  className = "",
  variant = "primary",
  showIcon = true,
}: CreateInterviewModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states
  const [role, setRole] = useState("Full Stack Developer");
  const [level, setLevel] = useState("Mid-Level");
  const [type, setType] = useState("Technical");
  const [techstack, setTechstack] = useState<string[]>([
    "React",
    "TypeScript",
    "Node.js",
  ]);
  const [customTechInput, setCustomTechInput] = useState("");
  const [amount, setAmount] = useState(5);

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
        setIsOpen(false);
        router.push(`/interview/${res.interviewId}`);
      } else {
        toast.error(res.error || "Failed to create interview");
        setLoading(false);
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred while creating the interview");
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className={
          variant === "primary"
            ? `btn-primary ${className}`
            : variant === "secondary"
            ? `btn-secondary ${className}`
            : `border border-white/20 hover:bg-white/10 text-white ${className}`
        }
      >
        {showIcon && <Plus size={16} className="mr-1.5" />}
        {triggerText}
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div
            className="card-border w-full max-w-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card dark-gradient p-6 sm:p-8 flex flex-col gap-6 relative">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary-200/10 border border-primary-200/20 text-xs font-semibold text-primary-200 w-fit">
                    <Sparkles size={12} />
                    Custom Mock Interview
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white">
                    Set Up Your Mock Interview
                  </h3>
                  <p className="text-xs sm:text-sm text-light-400">
                    Choose your target role and skills to generate tailored interview questions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => !loading && setIsOpen(false)}
                  className="p-1 rounded-lg text-light-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreate} className="flex flex-col gap-5">
                {/* Target Role */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-light-100 flex items-center gap-1.5">
                    <Briefcase size={14} className="text-primary-200" />
                    Target Role
                  </label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Senior Frontend Engineer"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-dark-200 border border-white/10 text-white text-sm focus:outline-none focus:border-primary-200 transition-colors"
                    required
                  />
                  {/* Role Presets */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {ROLE_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRole(preset)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                          role === preset
                            ? "bg-primary-200/20 border-primary-200 text-primary-200 font-medium"
                            : "bg-dark-300/40 border-white/5 text-light-400 hover:text-white hover:border-white/20"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Level & Question Focus */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Experience Level */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-light-100 flex items-center gap-1.5">
                      <Layers size={14} className="text-primary-200" />
                      Experience Level
                    </label>
                    <select
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-dark-200 border border-white/10 text-white text-sm focus:outline-none focus:border-primary-200 transition-colors"
                    >
                      <option value="Junior">Junior (0-2 years)</option>
                      <option value="Mid-Level">Mid-Level (3-5 years)</option>
                      <option value="Senior">Senior (5-8 years)</option>
                      <option value="Lead / Principal">Lead / Staff (8+ years)</option>
                    </select>
                  </div>

                  {/* Interview Type / Focus */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-light-100 flex items-center gap-1.5">
                      <Target size={14} className="text-primary-200" />
                      Question Focus
                    </label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-dark-200 border border-white/10 text-white text-sm focus:outline-none focus:border-primary-200 transition-colors"
                    >
                      <option value="Technical">Technical (Coding & Architecture)</option>
                      <option value="Behavioral">Behavioral (Leadership & STAR)</option>
                      <option value="Mixed">Mixed (Technical + Behavioral)</option>
                    </select>
                  </div>
                </div>

                {/* Question Amount */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-light-100 flex items-center gap-1.5">
                      <HelpCircle size={14} className="text-primary-200" />
                      Number of Questions
                    </label>
                    <span className="text-xs text-primary-200 font-bold">
                      {amount} Questions
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {[3, 5, 7].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setAmount(num)}
                        className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all ${
                          amount === num
                            ? "bg-primary-200 text-dark-100 border-primary-200"
                            : "bg-dark-200 border-white/10 text-light-100 hover:border-white/20"
                        }`}
                      >
                        {num} Questions
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tech Stack Chips */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-light-100">
                    Tech Stack & Tools ({techstack.length} selected)
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-dark-200/50 rounded-xl border border-white/5">
                    {POPULAR_TECHS.map((tech) => {
                      const isSelected = techstack.includes(tech);
                      return (
                        <button
                          key={tech}
                          type="button"
                          onClick={() => toggleTech(tech)}
                          className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-all ${
                            isSelected
                              ? "bg-primary-200/20 border-primary-200 text-primary-200 font-medium"
                              : "bg-dark-300 border-white/5 text-light-300 hover:text-white"
                          }`}
                        >
                          {isSelected && <Check size={12} />}
                          {tech}
                        </button>
                      );
                    })}
                  </div>

                  {/* Add Custom Tech Input */}
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={customTechInput}
                      onChange={(e) => setCustomTechInput(e.target.value)}
                      onKeyDown={handleKeyDownTech}
                      placeholder="Add another technology (e.g. Kubernetes, Rust)..."
                      className="flex-1 px-3 py-1.5 rounded-lg bg-dark-200 border border-white/10 text-white text-xs focus:outline-none focus:border-primary-200"
                    />
                    <button
                      type="button"
                      onClick={addCustomTech}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-dark-300 border border-white/10 text-white hover:bg-white/10"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                  <Button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    disabled={loading}
                    variant="outline"
                    className="border-white/10 text-light-300 hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="btn-primary min-w-[160px]"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin mr-2" />
                        Generating...
                      </>
                    ) : (
                      "Launch Interview →"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
