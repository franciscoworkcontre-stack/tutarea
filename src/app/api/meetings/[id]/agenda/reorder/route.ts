import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, meetingAgendaItems, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

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

  const body = (await request.json()) as { items: Array<{ id: string; orderIdx: number }> };
  const { items } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items array is required" }, { status: 400 });
  }

  // Bulk update each item's orderIdx
  await Promise.all(
    items.map(({ id: itemId, orderIdx }) =>
      db
        .update(meetingAgendaItems)
        .set({ orderIdx, updatedAt: new Date() })
        .where(
          and(
            eq(meetingAgendaItems.id, itemId),
            eq(meetingAgendaItems.meetingId, id)
          )
        )
    )
  );

  const updated = await db.query.meetingAgendaItems.findMany({
    where: eq(meetingAgendaItems.meetingId, id),
    orderBy: (items, { asc }) => [asc(items.orderIdx)],
  });

  return NextResponse.json({ agendaItems: updated });
}
