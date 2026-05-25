import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, meetingPreQuestions, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, questionId } = await params;

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

  const question = await db.query.meetingPreQuestions.findFirst({
    where: and(
      eq(meetingPreQuestions.id, questionId),
      eq(meetingPreQuestions.meetingId, id)
    ),
  });
  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  const body = (await request.json()) as Partial<{
    questionText: string;
    orderIdx: number;
  }>;

  const updateData: Record<string, unknown> = {};
  if (body.questionText !== undefined) updateData.questionText = body.questionText;
  if (body.orderIdx !== undefined) updateData.orderIdx = body.orderIdx;

  const [updated] = await db
    .update(meetingPreQuestions)
    .set(updateData)
    .where(eq(meetingPreQuestions.id, questionId))
    .returning();

  return NextResponse.json({ question: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, questionId } = await params;

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

  const question = await db.query.meetingPreQuestions.findFirst({
    where: and(
      eq(meetingPreQuestions.id, questionId),
      eq(meetingPreQuestions.meetingId, id)
    ),
  });
  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  await db.delete(meetingPreQuestions).where(eq(meetingPreQuestions.id, questionId));

  return NextResponse.json({ success: true });
}
