import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { projects, meetingDecisions, meetings, workspaceMembers } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, project.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const decisions = await db.query.meetingDecisions.findMany({
    where: eq(meetingDecisions.projectId, projectId),
    orderBy: [desc(meetingDecisions.decidedAt)],
    with: {
      meeting: {
        columns: {
          id: true,
          title: true,
          scheduledAt: true,
          status: true,
          type: true,
        },
      },
    },
  });

  return NextResponse.json({ decisions });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, project.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as {
    meetingId: string;
    meetingNoteId?: string;
    title: string;
    descriptionMd?: string;
    decidedAt?: string;
  };

  if (!body.meetingId || !body.title) {
    return NextResponse.json({ error: "meetingId and title are required" }, { status: 400 });
  }

  // Verify meeting belongs to this project
  const meeting = await db.query.meetings.findFirst({
    where: and(
      eq(meetings.id, body.meetingId),
      eq(meetings.projectId, projectId)
    ),
  });
  if (!meeting) return NextResponse.json({ error: "Meeting not found in this project" }, { status: 404 });

  const [decision] = await db
    .insert(meetingDecisions)
    .values({
      projectId,
      workspaceId: project.workspaceId,
      meetingId: body.meetingId,
      meetingNoteId: body.meetingNoteId ?? null,
      title: body.title,
      descriptionMd: body.descriptionMd ?? null,
      decidedAt: body.decidedAt ? new Date(body.decidedAt) : new Date(),
      decidedBy: user.id,
    })
    .returning();

  return NextResponse.json({ decision }, { status: 201 });
}
