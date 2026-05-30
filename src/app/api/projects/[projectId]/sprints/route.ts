import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { sprints, sprintTasks, tasks, taskStatuses, workspaceMembers, projects } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, project.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const projectSprintsRaw = await db.select().from(sprints).where(eq(sprints.projectId, projectId)).orderBy(desc(sprints.createdAt));
  const sprintIds = projectSprintsRaw.map((s) => s.id);
  const allSprintTasks = sprintIds.length > 0
    ? await db.select().from(sprintTasks).where(inArray(sprintTasks.sprintId, sprintIds))
    : [];
  const projectSprints = projectSprintsRaw.map((s) => ({
    ...s,
    sprintTasks: allSprintTasks.filter((st) => st.sprintId === s.id),
  }));

  // Fetch all tasks in this project once (to check status)
  const allTasksRaw = await db.select().from(tasks).where(eq(tasks.projectId, projectId));
  const allStatusIds = [...new Set(allTasksRaw.map((t) => t.statusId).filter(Boolean))] as string[];
  const allStatusRows = allStatusIds.length > 0
    ? await db.select().from(taskStatuses).where(inArray(taskStatuses.id, allStatusIds))
    : [];
  const statusTypeMap = new Map(allStatusRows.map((s) => [s.id, s.type]));
  const taskMap = new Map(allTasksRaw.map((t) => [t.id, { ...t, status: t.statusId ? { type: statusTypeMap.get(t.statusId) } : null }]));

  // Build stats per sprint
  const sprintsWithStats = projectSprints.map((sprint) => {
    const taskIds = new Set(sprint.sprintTasks.map((st) => st.taskId));
    const sprintTaskRows = [...taskMap.values()].filter((t) => taskIds.has(t.id));

    const completedCount = sprintTaskRows.filter(
      (t) => t.status?.type === "done"
    ).length;

    const totalStoryPoints = sprint.sprintTasks.reduce(
      (sum, st) => sum + (st.storyPoints ?? 0),
      0
    );

    const { sprintTasks: _st, ...sprintData } = sprint;
    return {
      ...sprintData,
      totalTasks: sprint.sprintTasks.length,
      completedTasks: completedCount,
      totalStoryPoints,
    };
  });

  // Sort: active first, then planned, then completed/cancelled
  const order: Record<string, number> = {
    active: 0,
    planned: 1,
    completed: 2,
    cancelled: 3,
  };
  sprintsWithStats.sort(
    (a, b) => (order[a.status] ?? 4) - (order[b.status] ?? 4)
  );

  return NextResponse.json({ sprints: sprintsWithStats });
}

export async function POST(req: Request, { params }: Params) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, project.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    name: string;
    goal?: string;
    startDate?: string;
    endDate?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const [sprint] = await db
    .insert(sprints)
    .values({
      projectId,
      workspaceId: project.workspaceId,
      name: body.name.trim(),
      goal: body.goal?.trim() ?? null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      status: "planned",
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json({ sprint }, { status: 201 });
}
