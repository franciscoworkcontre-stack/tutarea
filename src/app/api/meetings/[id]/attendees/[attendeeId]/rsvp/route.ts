import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, meetingAttendees, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type RsvpValue = "accepted" | "declined" | "tentative" | "no-response";

export async function PATCH(
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

  // Only the attendee themselves can update their RSVP
  if (attendee.userId !== user.id) {
    return NextResponse.json({ error: "You can only update your own RSVP" }, { status: 403 });
  }

  const body = (await request.json()) as { rsvp: RsvpValue };
  const { rsvp } = body;

  const validRsvps: RsvpValue[] = ["accepted", "declined", "tentative", "no-response"];
  if (!rsvp || !validRsvps.includes(rsvp)) {
    return NextResponse.json({ error: "Invalid rsvp value" }, { status: 400 });
  }

  // Map "no-response" to "pending" for the DB enum, or store as-is if schema supports it
  // The DB uses attendeeRsvpEnum: pending | accepted | declined | tentative
  const dbRsvp = rsvp === "no-response" ? "pending" : rsvp;

  const [updated] = await db
    .update(meetingAttendees)
    .set({ rsvp: dbRsvp as "pending" | "accepted" | "declined" | "tentative" })
    .where(eq(meetingAttendees.id, attendeeId))
    .returning();

  return NextResponse.json({ attendee: updated });
}
