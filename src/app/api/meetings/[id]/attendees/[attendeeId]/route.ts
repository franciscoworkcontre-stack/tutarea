import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, meetingAttendees, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; attendeeId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, attendeeId } = await params;

  const meeting = await db.query.meetings.findFirst({
    where: eq(meetings.id, id),
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check workspace membership
  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, meeting.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const attendee = await db.query.meetingAttendees.findFirst({
    where: and(
      eq(meetingAttendees.id, attendeeId),
      eq(meetingAttendees.meetingId, id)
    ),
  });
  if (!attendee) return NextResponse.json({ error: "Attendee not found" }, { status: 404 });

  const body = (await request.json()) as Partial<{
    rsvp: string;
    role: string;
    informedAfter: boolean;
  }>;

  const updateData: Record<string, unknown> = {};
  if (body.rsvp !== undefined) updateData["rsvp"] = body.rsvp;
  if (body.role !== undefined) updateData["role"] = body.role;
  if (body.informedAfter !== undefined) updateData["informedAfter"] = body.informedAfter;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(meetingAttendees)
    .set(updateData)
    .where(eq(meetingAttendees.id, attendeeId))
    .returning();

  return NextResponse.json({ attendee: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; attendeeId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, attendeeId } = await params;

  const meeting = await db.query.meetings.findFirst({
    where: eq(meetings.id, id),
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check workspace membership
  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, meeting.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const attendee = await db.query.meetingAttendees.findFirst({
    where: and(
      eq(meetingAttendees.id, attendeeId),
      eq(meetingAttendees.meetingId, id)
    ),
  });
  if (!attendee) return NextResponse.json({ error: "Attendee not found" }, { status: 404 });

  await db.delete(meetingAttendees).where(eq(meetingAttendees.id, attendeeId));

  return NextResponse.json({ success: true });
}
