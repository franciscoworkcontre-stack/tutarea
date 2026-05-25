import type { InferSelectModel } from "drizzle-orm";
import type {
  meetings,
  meetingAttendees,
  meetingAgendaItems,
  meetingAttachments,
  meetingNotes,
  meetingPreQuestions,
} from "@/db/schema";

export type Meeting = InferSelectModel<typeof meetings>;
export type MeetingAttendee = InferSelectModel<typeof meetingAttendees>;
export type AgendaItem = InferSelectModel<typeof meetingAgendaItems>;
export type MeetingAttachment = InferSelectModel<typeof meetingAttachments>;
export type MeetingNote = InferSelectModel<typeof meetingNotes>;
export type PreQuestion = InferSelectModel<typeof meetingPreQuestions>;

export type MeetingWithDetails = Meeting & {
  attendees: MeetingAttendee[];
  agendaItems: AgendaItem[];
  attachments: MeetingAttachment[];
  notes: MeetingNote[];
  preQuestions: PreQuestion[];
};

export const MEETING_TYPE_LABELS: Record<string, string> = {
  "1-on-1": "1:1",
  "team-sync": "Team Sync",
  decision: "Decision",
  brainstorm: "Brainstorm",
  review: "Review",
  retro: "Retro",
  kickoff: "Kickoff",
  custom: "Custom",
};

export const MEETING_TYPE_COLORS: Record<string, string> = {
  "1-on-1": "bg-pink-500/10 text-pink-400 border-pink-500/20",
  "team-sync": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  decision: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  brainstorm: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  review: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  retro: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  kickoff: "bg-green-500/10 text-green-400 border-green-500/20",
  custom: "bg-surface-2 text-text-muted border-border",
};

export const MEETING_STATUS_COLORS: Record<string, string> = {
  draft: "bg-surface-2 text-text-muted border-border",
  scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  in_progress: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  completed: "bg-green-500/10 text-green-400 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  archived: "bg-surface-2 text-text-subtle border-border",
};

export const MEETING_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  scheduled: "Programada",
  in_progress: "En curso",
  completed: "Completada",
  cancelled: "Cancelada",
  archived: "Archivada",
};

export const MEETING_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  archived: [],
};

export function canTransition(from: string, to: string): boolean {
  return MEETING_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getTotalAgendaDuration(items: AgendaItem[]): number {
  return items
    .filter((i) => !i.parentItemId)
    .reduce((acc, i) => acc + (i.durationMin ?? 0), 0);
}
