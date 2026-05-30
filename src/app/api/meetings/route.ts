import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, projects, workspaceMembers } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  const projectId = searchParams.get("projectId");

  if (!workspaceId && !projectId) {
    return NextResponse.json({ error: "workspaceId or projectId required" }, { status: 400 });
  }

  // Determine workspaceId for membership check
  let resolvedWorkspaceId = workspaceId;
  if (!resolvedWorkspaceId && projectId) {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    resolvedWorkspaceId = project.workspaceId;
  }

  // Check membership
  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, resolvedWorkspaceId!),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const conditions = projectId
    ? eq(meetings.projectId, projectId)
    : eq(meetings.workspaceId, resolvedWorkspaceId!);

  const rows = await db.select().from(meetings).where(conditions).orderBy(desc(meetings.scheduledAt));

  return NextResponse.json({ meetings: rows });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    projectId: string;
    title: string;
    objective?: string;
    scheduledAt?: string;
    durationMin?: number;
    location?: string;
    meetingUrl?: string;
  };

  if (!body.projectId || !body.title) {
    return NextResponse.json({ error: "projectId and title are required" }, { status: 400 });
  }

  const [project] = await db.select().from(projects).where(eq(projects.id, body.projectId)).limit(1);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Check workspace membership
  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, project.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [meeting] = await db
    .insert(meetings)
    .values({
      projectId: body.projectId,
      workspaceId: project.workspaceId,
      title: body.title,
      objective: body.objective ?? null,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      durationMin: body.durationMin ?? 60,
      location: body.location ?? null,
      meetingUrl: body.meetingUrl ?? null,
      ownerId: user.id,
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json({ meeting }, { status: 201 });
}
