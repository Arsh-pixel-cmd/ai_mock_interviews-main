"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deleteInterview } from "@/lib/actions/general.action";

interface DeleteInterviewButtonProps {
  interviewId: string;
  userId: string;
  role: string;
}

export default function DeleteInterviewButton({
  interviewId,
  userId,
  role,
}: DeleteInterviewButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Are you sure you want to delete the ${role} interview?`)) {
      return;
    }

    try {
      setIsDeleting(true);
      const res = await deleteInterview(interviewId, userId);
      if (res.success) {
        toast.success("Interview removed successfully");
      } else {
        toast.error(res.error || "Failed to delete interview");
      }
    } catch {
      toast.error("An error occurred while deleting the interview");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      title="Delete interview"
      className="p-1.5 rounded-lg text-light-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
    >
      {isDeleting ? (
        <Loader2 size={16} className="animate-spin text-red-400" />
      ) : (
        <Trash2 size={16} />
      )}
    </button>
  );
}
