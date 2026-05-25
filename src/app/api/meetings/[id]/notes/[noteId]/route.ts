import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, meetingNotes, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, noteId } = await params;

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

  const note = await db.query.meetingNotes.findFirst({
    where: and(
      eq(meetingNotes.id, noteId),
      eq(meetingNotes.meetingId, id)
    ),
  });
  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });

  const body = (await request.json()) as Partial<{
    contentMd: string;
    noteType: string;
    agendaItemId: string | null;
    assigneeId: string | null;
    dueDate: string | null;
  }>;

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.contentMd !== undefined) updateData.contentMd = body.contentMd;
  if (body.noteType !== undefined) updateData.noteType = body.noteType;
  if (body.agendaItemId !== undefined) updateData.agendaItemId = body.agendaItemId;
  if (body.assigneeId !== undefined) updateData.assigneeId = body.assigneeId;
  if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;

  const [updated] = await db
    .update(meetingNotes)
    .set(updateData)
    .where(eq(meetingNotes.id, noteId))
    .returning();

  return NextResponse.json({ note: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, noteId } = await params;

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

  const note = await db.query.meetingNotes.findFirst({
    where: and(
      eq(meetingNotes.id, noteId),
      eq(meetingNotes.meetingId, id)
    ),
  });
  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });

  await db.delete(meetingNotes).where(eq(meetingNotes.id, noteId));

  return NextResponse.json({ success: true });
}
