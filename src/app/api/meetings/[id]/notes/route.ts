import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, meetingNotes, workspaceMembers } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

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

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, meeting.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const agendaItemId = searchParams.get("agendaItemId");
  const noteType = searchParams.get("noteType");

  const conditions = [eq(meetingNotes.meetingId, id)];
  if (agendaItemId) conditions.push(eq(meetingNotes.agendaItemId, agendaItemId));
  if (noteType) conditions.push(eq(meetingNotes.noteType, noteType));

  const notes = await db.query.meetingNotes.findMany({
    where: and(...conditions),
    orderBy: [asc(meetingNotes.createdAt)],
  });

  return NextResponse.json({ notes });
}

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

  const body = (await request.json()) as {
    agendaItemId?: string;
    noteType: string;
    contentMd: string;
    assigneeId?: string;
    dueDate?: string;
  };

  if (!body.noteType || !body.contentMd) {
    return NextResponse.json({ error: "noteType and contentMd are required" }, { status: 400 });
  }

  const validNoteTypes = ["note", "decision", "action_item"];
  if (!validNoteTypes.includes(body.noteType)) {
    return NextResponse.json({ error: "noteType must be note, decision, or action_item" }, { status: 400 });
  }

  const [note] = await db
    .insert(meetingNotes)
    .values({
      meetingId: id,
      agendaItemId: body.agendaItemId ?? null,
      noteType: body.noteType,
      contentMd: body.contentMd,
      authorId: user.id,
      assigneeId: body.assigneeId ?? null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
    })
    .returning();

  return NextResponse.json({ note }, { status: 201 });
}
