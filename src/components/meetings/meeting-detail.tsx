"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ArrowLeft,
  Calendar,
  Clock,
  Video,
  Zap,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cn, spring } from "@/lib/utils";
import {
  MEETING_TYPE_LABELS,
  MEETING_TYPE_COLORS,
  MEETING_STATUS_COLORS,
  MEETING_STATUS_LABELS,
} from "@/lib/meetings/meeting-types";
import type { MeetingWithDetails } from "@/lib/meetings/meeting-types";
import { MEETING_STATUS_TRANSITIONS } from "@/lib/meetings/meeting-utils";
import MeetingPrepView from "./meeting-prep-view";
import MeetingLiveView from "./meeting-live-view";
import MeetingRecapView from "./meeting-recap-view";
import type { InferSelectModel } from "drizzle-orm";
import type { profiles } from "@/db/schema";

type Profile = InferSelectModel<typeof profiles>;
type Member = { userId: string; role: string; profile: Profile | null };

type ViewMode = "prep" | "live" | "recap";

type Props = {
  meeting: MeetingWithDetails;
  members: Member[];
  currentUserId: string;
  workspaceSlug: string;
};

function toDatetimeDisplay(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}


export default function MeetingDetail({
  meeting: initial,
  members,
  currentUserId,
  workspaceSlug,
}: Props) {
  const [meeting, setMeeting] = useState<MeetingWithDetails>(initial);
  const [viewMode, setViewMode] = useState<ViewMode>("prep");
  const [statusOpen, setStatusOpen] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(initial.title);
  const statusRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOwner = meeting.ownerId === currentUserId;

  const debounced = useCallback(
    (patch: Partial<MeetingWithDetails>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/meetings/${meeting.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          });
          if (!res.ok) throw new Error();
        } catch {
          toast.error("Error al guardar cambios");
        }
      }, 800);
    },
    [meeting.id]
  );

  const handleMeetingUpdate = useCallback(
    (patch: Partial<MeetingWithDetails>) => {
      setMeeting((prev) => ({ ...prev, ...patch }));
    },
    []
  );

  const handleStatusChange = async (transition: { action: string; label: string; nextStatus: string }) => {
    setStatusOpen(false);
    const newStatus = transition.nextStatus;
    const prev = meeting;
    setMeeting((m) => ({ ...m, status: newStatus as MeetingWithDetails["status"] }));
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: transition.action }),
      });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { meeting: MeetingWithDetails; warning?: string };
      setMeeting((m) => ({ ...m, ...body.meeting }));
      toast.success(`Estado: ${MEETING_STATUS_LABELS[newStatus]}`);
      if (body.warning) toast.warning(body.warning);
      // Auto-switch view on status change
      if (newStatus === "in_progress") setViewMode("live");
      if (newStatus === "completed") setViewMode("recap");
    } catch {
      setMeeting(prev);
      toast.error("Error al cambiar estado");
    }
  };

  const commitTitle = async () => {
    setTitleEditing(false);
    if (titleDraft.trim() && titleDraft !== meeting.title) {
      setMeeting((m) => ({ ...m, title: titleDraft.trim() }));
      debounced({ title: titleDraft.trim() });
    } else {
      setTitleDraft(meeting.title);
    }
  };

  const availableTransitions: { action: string; label: string; nextStatus: string }[] = MEETING_STATUS_TRANSITIONS[meeting.status] ?? [];
  const typeLabel = MEETING_TYPE_LABELS[meeting.type] ?? meeting.type;
  const typeColor = MEETING_TYPE_COLORS[meeting.type] ?? MEETING_TYPE_COLORS["custom"]!;
  const statusColor = MEETING_STATUS_COLORS[meeting.status] ?? MEETING_STATUS_COLORS["draft"]!;
  const statusLabel = MEETING_STATUS_LABELS[meeting.status] ?? meeting.status;

  const VIEW_MODES: { key: ViewMode; label: string; icon: React.ElementType }[] = [
    { key: "prep", label: "Prep", icon: Calendar },
    { key: "live", label: "Live", icon: Zap },
    { key: "recap", label: "Recap", icon: CheckCircle2 },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className={cn(
          "flex flex-col gap-2 px-5 py-4 border-b border-border flex-shrink-0",
          viewMode === "live" && "bg-yellow-500/5 border-yellow-500/20"
        )}
      >
        {/* Top row: back + view switch */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href={`/app/${workspaceSlug}/projects/${meeting.projectId}/meetings`}
              className="text-text-subtle hover:text-text-muted transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0",
                typeColor
              )}
            >
              {typeLabel}
            </span>
          </div>

          {/* View switch */}
          <div className="flex items-center gap-0.5 bg-surface rounded-lg p-0.5 border border-border flex-shrink-0">
            {VIEW_MODES.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  viewMode === key
                    ? "bg-background text-text shadow-sm"
                    : "text-text-muted hover:text-text"
                )}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Title row */}
        <div className="flex items-start gap-3">
          {titleEditing && isOwner ? (
            <input
              ref={titleRef}
              value={titleDraft}
              autoFocus
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") {
                  setTitleDraft(meeting.title);
                  setTitleEditing(false);
                }
              }}
              className="text-lg font-semibold bg-transparent outline-none border-b border-accent/40 flex-1 pb-0.5"
            />
          ) : (
            <h1
              className={cn(
                "text-lg font-semibold flex-1 leading-snug",
                isOwner && "cursor-pointer hover:text-accent transition-colors"
              )}
              onDoubleClick={() => isOwner && setTitleEditing(true)}
            >
              {meeting.title}
            </h1>
          )}

          {/* Status badge + transition */}
          <div ref={statusRef} className="relative flex-shrink-0">
            <button
              onClick={() => setStatusOpen((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium transition-colors",
                statusColor
              )}
            >
              {statusLabel}
              {availableTransitions.length > 0 && (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
            <AnimatePresence>
              {statusOpen && availableTransitions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={spring}
                  className="absolute top-full right-0 mt-1.5 bg-surface border border-border rounded-xl shadow-3 z-50 overflow-hidden w-40"
                >
                  {availableTransitions.map((t) => (
                    <button
                      key={t.action}
                      onClick={() => handleStatusChange(t)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-surface-2 transition-colors"
                    >
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full border font-medium",
                          MEETING_STATUS_COLORS[t.nextStatus]
                        )}
                      >
                        {t.label}
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4 flex-wrap">
          {meeting.scheduledAt && (
            <div className="flex items-center gap-1 text-xs text-text-subtle">
              <Calendar className="w-3 h-3" />
              {toDatetimeDisplay(meeting.scheduledAt)}
            </div>
          )}
          <div className="flex items-center gap-1 text-xs text-text-subtle">
            <Clock className="w-3 h-3" />
            {meeting.durationMin} min
          </div>
          {meeting.meetingUrl && (
            <a
              href={meeting.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-accent hover:underline"
            >
              <Video className="w-3 h-3" />
              Unirse
            </a>
          )}
          {meeting.timezone && (
            <span className="text-xs text-text-subtle">{meeting.timezone}</span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          {viewMode === "prep" && (
            <motion.div
              key="prep"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 overflow-hidden flex flex-col"
            >
              <MeetingPrepView
                meeting={meeting}
                members={members}
                currentUserId={currentUserId}
                onMeetingUpdate={handleMeetingUpdate}
              />
            </motion.div>
          )}

          {viewMode === "live" && (
            <motion.div
              key="live"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 overflow-hidden flex flex-col"
            >
              <MeetingLiveView
                meeting={meeting}
                currentUserId={currentUserId}
                onExit={() => setViewMode("recap")}
              />
            </motion.div>
          )}

          {viewMode === "recap" && (
            <motion.div
              key="recap"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 overflow-y-auto"
            >
              <MeetingRecapView
                meeting={meeting}
                currentUserId={currentUserId}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
