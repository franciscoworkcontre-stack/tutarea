import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, meetingAttendees, meetingAgendaItems, tasks, workspaceMembers } from "@/db/schema";
import { eq, and, isNotNull, asc } from "drizzle-orm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, meeting.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Get current attendees to avoid duplicates
  const currentAttendees = await db.select().from(meetingAttendees).where(eq(meetingAttendees.meetingId, id));
  const currentAttendeeUserIds = new Set(currentAttendees.map((a) => a.userId));

  // Get tasks in the project that have assignees
  const projectTasks = await db.select().from(tasks).where(and(
    eq(tasks.projectId, meeting.projectId),
    isNotNull(tasks.assigneeId)
  ));

  // Count tasks per assignee for relevance scoring
  const assigneeCounts = new Map<string, number>();
  for (const task of projectTasks) {
    if (task.assigneeId) {
      assigneeCounts.set(task.assigneeId, (assigneeCounts.get(task.assigneeId) ?? 0) + 1);
    }
  }

  // Also consider agenda item owners if any
  const agendaItems = await db.select().from(meetingAgendaItems).where(and(
    eq(meetingAgendaItems.meetingId, id),
    isNotNull(meetingAgendaItems.ownerId)
  )).orderBy(asc(meetingAgendaItems.orderIdx));

  // Add agenda owners to suggestion pool with higher weight
  const agendaOwnerIds = new Set(agendaItems.map((a) => a.ownerId).filter(Boolean) as string[]);
  for (const ownerId of agendaOwnerIds) {
    assigneeCounts.set(ownerId, (assigneeCounts.get(ownerId) ?? 0) + 5); // boost for agenda ownership
  }

  // Build suggestions: users with project tasks, not already attending
  const suggestions = Array.from(assigneeCounts.entries())
    .filter(([userId]) => !currentAttendeeUserIds.has(userId))
    .sort(([, a], [, b]) => b - a) // sort by relevance descending
    .slice(0, 10) // max 10 suggestions
    .map(([userId, score]) => ({
      userId,
      relevanceScore: score,
      reason: agendaOwnerIds.has(userId)
        ? "Owns an agenda item"
        : `Has ${score} task${score !== 1 ? "s" : ""} in this project`,
    }));

  return NextResponse.json({ suggestions });
}
