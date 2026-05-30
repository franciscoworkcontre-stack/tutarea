import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, meetingAttendees, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; attendeeId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, attendeeId } = await params;

  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, meeting.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [attendee] = await db.select().from(meetingAttendees).where(and(
    eq(meetingAttendees.id, attendeeId),
    eq(meetingAttendees.meetingId, id)
  )).limit(1);
  if (!attendee) return NextResponse.json({ error: "Attendee not found" }, { status: 404 });

  // Only the attendee themselves can update their pre-read completion
  if (attendee.userId !== user.id) {
    return NextResponse.json({ error: "You can only update your own pre-read completion" }, { status: 403 });
  }

  const body = (await request.json()) as { attachmentId: string; completed: boolean };
  const { attachmentId, completed } = body;

  if (!attachmentId || typeof completed !== "boolean") {
    return NextResponse.json({ error: "attachmentId and completed are required" }, { status: 400 });
  }

  const existing = (attendee.preReadCompletionJsonb as Record<string, boolean>) ?? {};
  const merged = { ...existing, [attachmentId]: completed };

  const [updated] = await db
    .update(meetingAttendees)
    .set({ preReadCompletionJsonb: merged })
    .where(eq(meetingAttendees.id, attendeeId))
    .returning();

  return NextResponse.json({ attendee: updated });
}
