import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, meetingAttachments, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, attachmentId } = await params;

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

  const attachment = await db.query.meetingAttachments.findFirst({
    where: and(
      eq(meetingAttachments.id, attachmentId),
      eq(meetingAttachments.meetingId, id)
    ),
  });
  if (!attachment) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

  const body = (await request.json()) as Partial<{
    agendaItemId: string | null;
    title: string;
    thumbnailUrl: string | null;
    preReadRequired: boolean;
    aiSummaryMd: string | null;
    externalUrl: string | null;
  }>;

  const updateData: Record<string, unknown> = {};
  if (body.title !== undefined) updateData.title = body.title;
  if (body.agendaItemId !== undefined) updateData.agendaItemId = body.agendaItemId;
  if (body.thumbnailUrl !== undefined) updateData.thumbnailUrl = body.thumbnailUrl;
  if (body.preReadRequired !== undefined) updateData.preReadRequired = body.preReadRequired;
  if (body.aiSummaryMd !== undefined) updateData.aiSummaryMd = body.aiSummaryMd;
  if (body.externalUrl !== undefined) updateData.externalUrl = body.externalUrl;

  const [updated] = await db
    .update(meetingAttachments)
    .set(updateData)
    .where(eq(meetingAttachments.id, attachmentId))
    .returning();

  return NextResponse.json({ attachment: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, attachmentId } = await params;

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

  const attachment = await db.query.meetingAttachments.findFirst({
    where: and(
      eq(meetingAttachments.id, attachmentId),
      eq(meetingAttachments.meetingId, id)
    ),
  });
  if (!attachment) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

  await db.delete(meetingAttachments).where(eq(meetingAttachments.id, attachmentId));

  return NextResponse.json({ success: true });
}
