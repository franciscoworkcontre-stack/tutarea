import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, meetingAttendees, meetingAgendaItems, workspaceMembers } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { canTransition } from "@/lib/meetings/meeting-utils";

export async function GET(
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

  // Check workspace membership
  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, meeting.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [attendees, agendaItems] = await Promise.all([
    db.query.meetingAttendees.findMany({
      where: eq(meetingAttendees.meetingId, id),
    }),
    db.query.meetingAgendaItems.findMany({
      where: eq(meetingAgendaItems.meetingId, id),
      orderBy: [asc(meetingAgendaItems.orderIdx)],
    }),
  ]);

  return NextResponse.json({ meeting, attendees, agendaItems });
}

export async function PUT(
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

  // Check workspace membership
  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, meeting.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as Partial<{
    title: string;
    objective: string;
    status: string;
    scheduledAt: string;
    durationMin: number;
    location: string;
    meetingUrl: string;
    briefingMd: string;
    recapMd: string;
  }>;

  // Validate status transition if status is being updated
  if (body.status !== undefined && body.status !== meeting.status) {
    if (!canTransition(meeting.status, body.status)) {
      return NextResponse.json(
        { error: `Cannot transition from '${meeting.status}' to '${body.status}'` },
        { status: 422 }
      );
    }
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (body.title !== undefined) updateData["title"] = body.title;
  if (body.objective !== undefined) updateData["objective"] = body.objective;
  if (body.status !== undefined) updateData["status"] = body.status;
  if (body.scheduledAt !== undefined) updateData["scheduledAt"] = body.scheduledAt ? new Date(body.scheduledAt) : null;
  if (body.durationMin !== undefined) updateData["durationMin"] = body.durationMin;
  if (body.location !== undefined) updateData["location"] = body.location;
  if (body.meetingUrl !== undefined) updateData["meetingUrl"] = body.meetingUrl;
  if (body.briefingMd !== undefined) updateData["briefingMd"] = body.briefingMd;
  if (body.recapMd !== undefined) updateData["recapMd"] = body.recapMd;

  const [updated] = await db
    .update(meetings)
    .set(updateData)
    .where(eq(meetings.id, id))
    .returning();

  return NextResponse.json({ meeting: updated });
}

export async function DELETE(
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

  // Check workspace membership
  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, meeting.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(meetings).where(eq(meetings.id, id));

  return NextResponse.json({ success: true });
}
