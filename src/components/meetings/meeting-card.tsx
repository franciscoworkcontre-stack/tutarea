"use client";

import Link from "next/link";
import { Calendar, Clock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Meeting, MeetingAttendee } from "@/lib/meetings/meeting-utils";

type Props = {
  meeting: Meeting & { attendees?: MeetingAttendee[] };
  workspaceSlug: string;
  projectId: string;
  onClick?: () => void;
};

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  draft:       { label: "Borrador",    className: "bg-surface-2 text-text-muted border-border" },
  scheduled:   { label: "Programada",  className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  in_progress: { label: "En curso",    className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  completed:   { label: "Completada",  className: "bg-green-500/10 text-green-400 border-green-500/20" },
  cancelled:   { label: "Cancelada",   className: "bg-red-500/10 text-red-400 border-red-500/20" },
};

function formatDateTime(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-CL", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function MeetingCard({ meeting, workspaceSlug, projectId, onClick }: Props) {
  const status = STATUS_STYLES[meeting.status] ?? STATUS_STYLES["draft"]!;

  return (
    <Link
      href={`/app/${workspaceSlug}/projects/${projectId}/meetings/${meeting.id}`}
      onClick={onClick}
      className="group flex flex-col gap-2 p-4 rounded-xl border border-border bg-background hover:border-border-strong hover:shadow-2 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium leading-snug group-hover:text-accent transition-colors line-clamp-1 flex-1 min-w-0">
          {meeting.title}
        </h3>
        <span
          className={cn(
            "flex-shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium",
            status?.className
          )}
        >
          {status?.label}
        </span>
      </div>

      {meeting.objective && (
        <p className="text-xs text-text-muted line-clamp-1">{meeting.objective}</p>
      )}

      <div className="flex items-center gap-3 mt-1">
        {meeting.scheduledAt && (
          <div className="flex items-center gap-1 text-xs text-text-subtle">
            <Calendar className="w-3.5 h-3.5" />
            {formatDateTime(meeting.scheduledAt)}
          </div>
        )}
        <div className="flex items-center gap-1 text-xs text-text-subtle">
          <Clock className="w-3.5 h-3.5" />
          {meeting.durationMin} min
        </div>
        {meeting.attendees && meeting.attendees.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-text-subtle">
            <Users className="w-3.5 h-3.5" />
            {meeting.attendees.length}
          </div>
        )}
      </div>
    </Link>
  );
}
