"use client";

import { useState } from "react";
import { BookOpen, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { MeetingAttachment } from "@/lib/meetings/meeting-types";

type Props = {
  meetingId: string;
  attendeeId: string;
  attachments: MeetingAttachment[];
  completionMap?: Record<string, boolean>;
};

export default function PreReadChecklist({
  meetingId,
  attendeeId,
  attachments,
  completionMap: initial = {},
}: Props) {
  const required = attachments.filter((a) => a.preReadRequired);
  const [completion, setCompletion] =
    useState<Record<string, boolean>>(initial);

  const completed = required.filter((a) => completion[a.id]).length;
  const progress = required.length > 0 ? (completed / required.length) * 100 : 0;

  const handleToggle = async (attachmentId: string) => {
    const current = completion[attachmentId] ?? false;
    const next = !current;
    setCompletion((prev) => ({ ...prev, [attachmentId]: next }));
    try {
      await fetch(
        `/api/meetings/${meetingId}/attendees/${attendeeId}/pre-read`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attachmentId, completed: next }),
        }
      );
    } catch {
      setCompletion((prev) => ({ ...prev, [attachmentId]: current }));
      toast.error("Error al guardar");
    }
  };

  if (required.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-xs font-medium text-text-muted">Pre-reads</span>
        </div>
        <span className="text-xs text-text-subtle">
          {completed}/{required.length} completados
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-surface-2 rounded-full h-1.5">
        <div
          className={cn(
            "h-1.5 rounded-full transition-all",
            progress === 100 ? "bg-green-500" : "bg-accent"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Items */}
      <div className="flex flex-col gap-1">
        {required.map((a) => {
          const done = completion[a.id] ?? false;
          return (
            <button
              key={a.id}
              onClick={() => handleToggle(a.id)}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-surface/50 transition-colors text-left"
            >
              <div
                className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors",
                  done
                    ? "bg-green-500 border-green-500"
                    : "border-border bg-background"
                )}
              >
                {done && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
              <span
                className={cn(
                  "text-xs truncate transition-colors",
                  done && "line-through text-text-subtle"
                )}
              >
                {a.externalUrl
                  ? a.title || a.externalUrl.replace(/^https?:\/\//, "")
                  : a.title}
              </span>
            </button>
          );
        })}
      </div>

      {progress === 100 && (
        <p className="text-xs text-green-400 flex items-center gap-1">
          <Check className="w-3 h-3" />
          Todos los pre-reads completados
        </p>
      )}
    </div>
  );
}
