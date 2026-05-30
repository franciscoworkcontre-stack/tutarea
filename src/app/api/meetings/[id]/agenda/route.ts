import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, meetingAgendaItems, workspaceMembers } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

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

  const agendaItems = await db.select().from(meetingAgendaItems).where(eq(meetingAgendaItems.meetingId, id)).orderBy(asc(meetingAgendaItems.orderIdx));

  return NextResponse.json({ agendaItems });
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

  // Check workspace membership
  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, meeting.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as {
    title: string;
    ownerId?: string;
    durationMin?: number;
    itemType?: string;
    notesMd?: string;
    parentItemId?: string;
  };

  if (!body.title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // Calculate orderIdx = max(siblings) + 1
  // Get all items for this meeting to find max sibling orderIdx
  const siblings = await db.select().from(meetingAgendaItems).where(eq(meetingAgendaItems.meetingId, id));

  const filteredSiblings = siblings.filter(s =>
    body.parentItemId
      ? s.parentItemId === body.parentItemId
      : s.parentItemId === null
  );

  const maxOrderIdx = filteredSiblings.reduce((max, s) => Math.max(max, s.orderIdx), -1);
  const nextOrderIdx = maxOrderIdx + 1;

  const [agendaItem] = await db
    .insert(meetingAgendaItems)
    .values({
      meetingId: id,
      title: body.title,
      ownerId: body.ownerId ?? null,
      durationMin: body.durationMin ?? null,
      itemType: (body.itemType as "discussion" | "decision" | "update" | "brainstorm" | "qa") ?? "discussion",
      notesMd: body.notesMd ?? null,
      parentItemId: body.parentItemId ?? null,
      orderIdx: nextOrderIdx,
    })
    .returning();

  return NextResponse.json({ agendaItem }, { status: 201 });
}
