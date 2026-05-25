import type { Meeting, MeetingAttendee, AgendaItem } from "./meeting-types";

export type { Meeting, MeetingAttendee, AgendaItem };

export const MEETING_STATUS_TRANSITIONS: Record<
  string,
  { action: string; label: string; nextStatus: string }[]
> = {
  draft: [{ action: "schedule", label: "Agendar", nextStatus: "scheduled" }],
  scheduled: [{ action: "start", label: "Iniciar", nextStatus: "in_progress" }],
  in_progress: [{ action: "complete", label: "Completar", nextStatus: "completed" }],
  completed: [{ action: "archive", label: "Archivar", nextStatus: "archived" }],
  cancelled: [],
  archived: [],
};

export function canTransition(currentStatus: string, action: string): boolean {
  const transitions = MEETING_STATUS_TRANSITIONS[currentStatus];
  if (!transitions) return false;
  return transitions.some((t) => t.action === action);
}

export function getMeetingDuration(meeting: Meeting): number {
  return meeting.durationMin;
}

export function getTotalAgendaDuration(items: AgendaItem[]): number {
  return items
    .filter((i) => !i.parentItemId)
    .reduce((sum, i) => sum + (i.durationMin ?? 0), 0);
}

export function formatMeetingDate(
  date: Date | string | null,
  locale = "es-CL"
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function getMeetingTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    "1-on-1": "1:1",
    "team-sync": "Team Sync",
    decision: "Decisión",
    brainstorm: "Brainstorm",
    review: "Review",
    retro: "Retro",
    kickoff: "Kickoff",
    custom: "Custom",
  };
  return labels[type] ?? type;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: "bg-surface-2 text-text-muted border-border",
    scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    in_progress: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    completed: "bg-green-500/10 text-green-400 border-green-500/20",
    cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
    archived: "bg-surface-2 text-text-subtle border-border",
  };
  return colors[status] ?? "bg-surface-2 text-text-muted border-border";
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Borrador",
    scheduled: "Programada",
    in_progress: "En curso",
    completed: "Completada",
    cancelled: "Cancelada",
    archived: "Archivada",
  };
  return labels[status] ?? status;
}

export function isOwner(meeting: Meeting, userId: string): boolean {
  return meeting.ownerId === userId || meeting.createdBy === userId;
}

export function getDecisionMakerCount(attendees: MeetingAttendee[]): number {
  return attendees.filter((a) => a.role === "decision_maker").length;
}

export function shouldShowDecisionWarning(attendees: MeetingAttendee[]): boolean {
  return getDecisionMakerCount(attendees) > 8;
}
