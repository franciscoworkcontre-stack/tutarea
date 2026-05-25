import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, meetingPreQuestions, workspaceMembers } from "@/db/schema";
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

  const questions = await db.query.meetingPreQuestions.findMany({
    where: eq(meetingPreQuestions.meetingId, id),
    orderBy: [asc(meetingPreQuestions.orderIdx)],
  });

  return NextResponse.json({ questions });
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
    questionText: string;
    orderIdx?: number;
  };

  if (!body.questionText) {
    return NextResponse.json({ error: "questionText is required" }, { status: 400 });
  }

  const [question] = await db
    .insert(meetingPreQuestions)
    .values({
      meetingId: id,
      questionText: body.questionText,
      orderIdx: body.orderIdx ?? 0,
    })
    .returning();

  return NextResponse.json({ question }, { status: 201 });
}
