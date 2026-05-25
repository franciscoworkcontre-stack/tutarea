import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { mindmaps, projects, workspaceMembers } from "@/db/schema";
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
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    resolvedWorkspaceId = project.workspaceId;
  }

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, resolvedWorkspaceId!),
      eq(workspaceMembers.userId, user.id)
    ),
  });

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const conditions = projectId
    ? eq(mindmaps.projectId, projectId)
    : eq(mindmaps.workspaceId, resolvedWorkspaceId!);

  const results = await db.query.mindmaps.findMany({
    where: conditions,
    orderBy: [desc(mindmaps.createdAt)],
  });

  return NextResponse.json({ mindmaps: results });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    projectId: string;
    title: string;
    description?: string;
  };

  if (!body.projectId || !body.title) {
    return NextResponse.json({ error: "projectId and title required" }, { status: 400 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, body.projectId),
  });

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, project.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [mindmap] = await db
    .insert(mindmaps)
    .values({
      projectId: body.projectId,
      workspaceId: project.workspaceId,
      title: body.title,
      description: body.description ?? null,
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json({ mindmap }, { status: 201 });
}
