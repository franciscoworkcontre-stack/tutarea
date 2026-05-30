import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { projects, workspaceMembers, taskStatuses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateProjectKey } from "@/lib/utils";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const workspaceProjects = await db.select().from(projects).where(and(
    eq(projects.workspaceId, workspaceId),
    eq(projects.status, "active")
  )).orderBy(projects.position);

  return NextResponse.json({ projects: workspaceProjects });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    name: string;
    workspaceId: string;
    description?: string;
    color?: string;
    icon?: string;
  };

  if (!body.name || !body.workspaceId) {
    return NextResponse.json({ error: "name and workspaceId required" }, { status: 400 });
  }

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, body.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);

  if (!member || member.role === "viewer" || member.role === "guest") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existingProjects = await db.select().from(projects).where(eq(projects.workspaceId, body.workspaceId));

  const [project] = await db
    .insert(projects)
    .values({
      name: body.name,
      workspaceId: body.workspaceId,
      key: generateProjectKey(body.name),
      description: body.description ?? null,
      color: body.color ?? "#f57522",
      icon: body.icon ?? null,
      createdBy: user.id,
      position: existingProjects.length,
    })
    .returning();

  if (!project) throw new Error("Failed to create project");

  // Create default statuses
  const defaultStatuses = [
    { name: "Por hacer", color: "#94a3b8", type: "todo" as const, position: 1 },
    { name: "En progreso", color: "#3b82f6", type: "in_progress" as const, position: 2 },
    { name: "En revisión", color: "#f59e0b", type: "review" as const, position: 3 },
    { name: "Hecho", color: "#22c55e", type: "done" as const, position: 4 },
  ];

  await db.insert(taskStatuses).values(
    defaultStatuses.map((s) => ({
      projectId: project.id,
      workspaceId: body.workspaceId,
      ...s,
    }))
  );

  return NextResponse.json({ project });
}
