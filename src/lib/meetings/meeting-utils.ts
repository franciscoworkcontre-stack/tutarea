import type { InferSelectModel } from "drizzle-orm";
import type { meetings, meetingAttendees, meetingAgendaItems } from "@/db/schema";

export type Meeting = InferSelectModel<typeof meetings>;
export type MeetingAttendee = InferSelectModel<typeof meetingAttendees>;
export type AgendaItem = InferSelectModel<typeof meetingAgendaItems>;

export const MEETING_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransition(from: string, to: string): boolean {
  return MEETING_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getMeetingDuration(scheduledAt: Date | null, durationMin: number): { start: Date | null; end: Date | null } {
  if (!scheduledAt) return { start: null, end: null };
  const end = new Date(scheduledAt.getTime() + durationMin * 60 * 1000);
  return { start: scheduledAt, end };
}

export function getTotalAgendaDuration(items: AgendaItem[]): number {
  return items.filter(i => !i.parentItemId).reduce((acc, i) => acc + (i.durationMin ?? 0), 0);
}
