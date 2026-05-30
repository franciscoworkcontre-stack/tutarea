import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, meetingAttendees, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check workspace membership
  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, meeting.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const attendees = await db.select().from(meetingAttendees).where(eq(meetingAttendees.meetingId, id));

  return NextResponse.json({ attendees });
}

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

  // Check workspace membership (requester)
  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, meeting.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as {
    userId: string;
    role?: string;
  };

  if (!body.userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  // Verify that the target userId is a member of the workspace
  const [targetMember] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, meeting.workspaceId),
    eq(workspaceMembers.userId, body.userId)
  )).limit(1);
  if (!targetMember) {
    return NextResponse.json({ error: "User is not a member of this workspace" }, { status: 422 });
  }

  // Check for duplicate attendee
  const [existing] = await db.select().from(meetingAttendees).where(and(
    eq(meetingAttendees.meetingId, id),
    eq(meetingAttendees.userId, body.userId)
  )).limit(1);
  if (existing) {
    return NextResponse.json({ error: "User is already an attendee" }, { status: 409 });
  }

  const [attendee] = await db
    .insert(meetingAttendees)
    .values({
      meetingId: id,
      userId: body.userId,
      role: (body.role as "facilitator" | "scribe" | "decision_maker" | "contributor" | "optional") ?? "contributor",
    })
    .returning();

  return NextResponse.json({ attendee }, { status: 201 });
}
