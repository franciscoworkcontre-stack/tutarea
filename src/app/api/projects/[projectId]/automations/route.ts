import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { automations, workspaceMembers, projects } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project)
    return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, project.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const list = await db
    .select()
    .from(automations)
    .where(eq(automations.projectId, projectId))
    .orderBy(desc(automations.createdAt));

  return NextResponse.json({ automations: list });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project)
    return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, project.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as {
    name: string;
    description?: string;
    triggerType: string;
    triggerConfigJsonb?: Record<string, unknown>;
    conditionsJsonb?: Array<{ field: string; operator: string; value: unknown }>;
    actionsJsonb?: Array<{ type: string; config: Record<string, unknown> }>;
  };

  if (!body.name || !body.triggerType) {
    return NextResponse.json(
      { error: "name and triggerType are required" },
      { status: 400 }
    );
  }

  const [automation] = await db
    .insert(automations)
    .values({
      projectId,
      workspaceId: project.workspaceId,
      name: body.name,
      description: body.description ?? null,
      triggerType: body.triggerType as typeof automations.$inferInsert["triggerType"],
      triggerConfigJsonb: body.triggerConfigJsonb ?? {},
      conditionsJsonb: body.conditionsJsonb ?? [],
      actionsJsonb: body.actionsJsonb ?? [],
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json({ automation }, { status: 201 });
}
