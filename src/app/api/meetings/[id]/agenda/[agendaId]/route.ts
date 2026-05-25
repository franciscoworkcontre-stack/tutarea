import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, meetingAgendaItems, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; agendaId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, agendaId } = await params;

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

  const agendaItem = await db.query.meetingAgendaItems.findFirst({
    where: and(
      eq(meetingAgendaItems.id, agendaId),
      eq(meetingAgendaItems.meetingId, id)
    ),
  });
  if (!agendaItem) return NextResponse.json({ error: "Agenda item not found" }, { status: 404 });

  return NextResponse.json({ agendaItem });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; agendaId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, agendaId } = await params;

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

  const agendaItem = await db.query.meetingAgendaItems.findFirst({
    where: and(
      eq(meetingAgendaItems.id, agendaId),
      eq(meetingAgendaItems.meetingId, id)
    ),
  });
  if (!agendaItem) return NextResponse.json({ error: "Agenda item not found" }, { status: 404 });

  const body = (await request.json()) as Partial<{
    title: string;
    ownerId: string;
    durationMin: number;
    itemType: string;
    notesMd: string;
    orderIdx: number;
  }>;

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (body.title !== undefined) updateData["title"] = body.title;
  if (body.ownerId !== undefined) updateData["ownerId"] = body.ownerId;
  if (body.durationMin !== undefined) updateData["durationMin"] = body.durationMin;
  if (body.itemType !== undefined) updateData["itemType"] = body.itemType;
  if (body.notesMd !== undefined) updateData["notesMd"] = body.notesMd;
  if (body.orderIdx !== undefined) updateData["orderIdx"] = body.orderIdx;

  const [updated] = await db
    .update(meetingAgendaItems)
    .set(updateData)
    .where(eq(meetingAgendaItems.id, agendaId))
    .returning();

  return NextResponse.json({ agendaItem: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; agendaId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, agendaId } = await params;

  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

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

  const agendaItem = await db.query.meetingAgendaItems.findFirst({
    where: and(
      eq(meetingAgendaItems.id, agendaId),
      eq(meetingAgendaItems.meetingId, id)
    ),
  });
  if (!agendaItem) return NextResponse.json({ error: "Agenda item not found" }, { status: 404 });

  // Check for children
  const children = await db.query.meetingAgendaItems.findMany({
    where: eq(meetingAgendaItems.parentItemId, agendaId),
  });

  if (children.length > 0 && !force) {
    return NextResponse.json(
      {
        error: "This agenda item has sub-items. Add ?force=true to delete it along with all its children.",
        childCount: children.length,
      },
      { status: 400 }
    );
  }

  // Delete children first (if force), then the item itself
  if (children.length > 0) {
    await db.delete(meetingAgendaItems).where(eq(meetingAgendaItems.parentItemId, agendaId));
  }

  await db.delete(meetingAgendaItems).where(eq(meetingAgendaItems.id, agendaId));

  return NextResponse.json({ success: true });
}
