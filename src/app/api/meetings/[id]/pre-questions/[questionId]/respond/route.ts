import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, meetingPreQuestions, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, questionId } = await params;

  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, meeting.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [question] = await db.select().from(meetingPreQuestions).where(and(
    eq(meetingPreQuestions.id, questionId),
    eq(meetingPreQuestions.meetingId, id)
  )).limit(1);
  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  const body = (await request.json()) as { response: string };

  if (typeof body.response !== "string" || !body.response.trim()) {
    return NextResponse.json({ error: "response is required" }, { status: 400 });
  }

  const existing = (question.responsesJsonb as Record<string, string>) ?? {};
  const merged = { ...existing, [user.id]: body.response };

  const [updated] = await db
    .update(meetingPreQuestions)
    .set({ responsesJsonb: merged })
    .where(eq(meetingPreQuestions.id, questionId))
    .returning();

  return NextResponse.json({ question: updated });
}
