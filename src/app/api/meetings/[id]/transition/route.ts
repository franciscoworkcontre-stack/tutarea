import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, meetingAttendees, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type MeetingStatus = "draft" | "scheduled" | "in_progress" | "completed" | "cancelled" | "archived";
type Action = "schedule" | "start" | "complete" | "cancel" | "archive";

const TRANSITIONS: Record<Action, { from: MeetingStatus[]; to: MeetingStatus }> = {
  schedule: { from: ["draft"], to: "scheduled" },
  start: { from: ["scheduled"], to: "in_progress" },
  complete: { from: ["in_progress"], to: "completed" },
  cancel: { from: ["draft", "scheduled", "in_progress", "completed"], to: "cancelled" },
  archive: { from: ["completed"], to: "archived" },
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const meeting = await db.query.meetings.findFirst({
    where: eq(meetings.id, id),
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, meeting.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as { action: Action };
  const { action } = body;

  if (!action || !TRANSITIONS[action]) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const transition = TRANSITIONS[action];
  if (!transition.from.includes(meeting.status as MeetingStatus)) {
    return NextResponse.json(
      { error: `Cannot '${action}' from status '${meeting.status}'` },
      { status: 422 }
    );
  }

  // draft→scheduled: require ownerId set
  if (action === "schedule") {
    if (!meeting.ownerId) {
      return NextResponse.json({ error: "ownerId must be set before scheduling" }, { status: 422 });
    }
  }

  const [updated] = await db
    .update(meetings)
    .set({ status: transition.to, updatedAt: new Date() })
    .where(eq(meetings.id, id))
    .returning();

  const response: { meeting: typeof updated; warning?: string } = { meeting: updated };

  // Check for >8 decision_maker attendees on schedule transition
  if (action === "schedule") {
    const attendees = await db.query.meetingAttendees.findMany({
      where: eq(meetingAttendees.meetingId, id),
    });
    const decisionMakers = attendees.filter((a) => a.role === "decision_maker");
    if (decisionMakers.length > 8) {
      response.warning = `Meeting has ${decisionMakers.length} decision makers (>8). Consider reducing for effective decision-making.`;
    }
  }

  return NextResponse.json(response);
}
