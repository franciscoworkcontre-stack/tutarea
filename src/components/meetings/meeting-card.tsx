"use client";

import Link from "next/link";
import { Calendar, Clock, CheckSquare } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import {
  MEETING_TYPE_LABELS,
  MEETING_TYPE_COLORS,
  MEETING_STATUS_COLORS,
  MEETING_STATUS_LABELS,
} from "@/lib/meetings/meeting-types";
import type { MeetingWithDetails } from "@/lib/meetings/meeting-types";

type Props = {
  meeting: MeetingWithDetails;
  workspaceSlug: string;
  projectId: string;
};

function formatDateRelative(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const daysDiff = Math.floor(
    (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  const timeStr = new Intl.DateTimeFormat("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

  if (daysDiff === 0) return `Hoy ${timeStr}`;
  if (daysDiff === 1) return `Mañana ${timeStr}`;
  if (daysDiff === -1) return `Ayer ${timeStr}`;

  return new Intl.DateTimeFormat("es-CL", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

const AVATAR_COLORS = [
  "bg-blue-500/20 text-blue-400",
  "bg-purple-500/20 text-purple-400",
  "bg-green-500/20 text-green-400",
  "bg-orange-500/20 text-orange-400",
  "bg-pink-500/20 text-pink-400",
  "bg-cyan-500/20 text-cyan-400",
];

export default function MeetingCard({
  meeting,
  workspaceSlug,
  projectId,
}: Props) {
  const typeLabel =
    MEETING_TYPE_LABELS[meeting.type] ?? meeting.type;
  const typeColor =
    MEETING_TYPE_COLORS[meeting.type] ?? MEETING_TYPE_COLORS["custom"]!;
  const statusColor =
    MEETING_STATUS_COLORS[meeting.status] ?? MEETING_STATUS_COLORS["draft"]!;
  const statusLabel =
    MEETING_STATUS_LABELS[meeting.status] ?? meeting.status;

  const visibleAttendees = meeting.attendees.slice(0, 4);
  const extraCount = Math.max(0, meeting.attendees.length - 4);

  const completedAgendaItems = meeting.agendaItems.filter(
    (i) => !i.parentItemId
  ).length;
  const totalAgendaItems = meeting.agendaItems.filter(
    (i) => !i.parentItemId
  ).length;

  return (
    <Link
      href={`/app/${workspaceSlug}/projects/${projectId}/meetings/${meeting.id}`}
      className="group flex flex-col gap-2.5 p-4 rounded-xl border border-border bg-background hover:border-border-strong hover:shadow-2 transition-all"
    >
      {/* Top row: type badge + status badge */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "text-xs px-2 py-0.5 rounded-full border font-medium",
            typeColor
          )}
        >
          {typeLabel}
        </span>
        <span
          className={cn(
            "text-xs px-2 py-0.5 rounded-full border font-medium",
            statusColor
          )}
        >
          {statusLabel}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium leading-snug group-hover:text-accent transition-colors line-clamp-1">
        {meeting.title}
      </h3>

      {/* Objective */}
      {meeting.objective && (
        <p className="text-xs text-text-muted line-clamp-1">
          {meeting.objective}
        </p>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-3 flex-wrap">
        {meeting.scheduledAt && (
          <div className="flex items-center gap-1 text-xs text-text-subtle">
            <Calendar className="w-3 h-3" />
            <span>{formatDateRelative(meeting.scheduledAt)}</span>
          </div>
        )}
        <div className="flex items-center gap-1 text-xs text-text-subtle">
          <Clock className="w-3 h-3" />
          <span>{meeting.durationMin} min</span>
        </div>
        {totalAgendaItems > 0 && (
          <div className="flex items-center gap-1 text-xs text-text-subtle">
            <CheckSquare className="w-3 h-3" />
            <span>
              {completedAgendaItems}/{totalAgendaItems} items
            </span>
          </div>
        )}
      </div>

      {/* Attendees row */}
      {meeting.attendees.length > 0 && (
        <div className="flex items-center gap-1 mt-0.5">
          {visibleAttendees.map((a, idx) => (
            <div
              key={a.id}
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold border border-background -ml-1 first:ml-0",
                AVATAR_COLORS[idx % AVATAR_COLORS.length]
              )}
              title={a.userId}
            >
              {getInitials(a.userId.slice(0, 4))}
            </div>
          ))}
          {extraCount > 0 && (
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold bg-surface-2 text-text-subtle border border-background -ml-1">
              +{extraCount}
            </div>
          )}
        </div>
      )}
    </Link>
  );
}
