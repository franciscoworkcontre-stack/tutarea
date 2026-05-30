import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { sprints, sprintTasks, tasks, taskStatuses, workspaceMembers, profiles } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

type Params = { params: Promise<{ sprintId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { sprintId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [sprint] = await db.select().from(sprints).where(eq(sprints.id, sprintId)).limit(1);

  if (!sprint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, sprint.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sprintTaskRows = await db.select().from(sprintTasks).where(eq(sprintTasks.sprintId, sprintId));
  const taskIds = sprintTaskRows.map((st) => st.taskId);
  const taskRows = taskIds.length > 0 ? await db.select().from(tasks).where(inArray(tasks.id, taskIds)) : [];
  const statusIds = [...new Set(taskRows.map((t) => t.statusId).filter(Boolean))] as string[];
  const statusRows = statusIds.length > 0 ? await db.select().from(taskStatuses).where(inArray(taskStatuses.id, statusIds)) : [];
  const statusMap = new Map(statusRows.map((s) => [s.id, s]));
  const taskMap = new Map(taskRows.map((t) => [t.id, { ...t, status: t.statusId ? (statusMap.get(t.statusId) ?? null) : null }]));

  // Enrich with assignee profiles
  const assigneeIds = [
    ...new Set(
      taskRows.map((t) => t.assigneeId).filter((id): id is string => id !== null)
    ),
  ];

  const assigneeProfileRows = assigneeIds.length > 0
    ? await db.select().from(profiles).where(inArray(profiles.id, assigneeIds))
    : [];
  const profileMap = new Map(assigneeProfileRows.map((p) => [p.id, p]));

  const sprintTasksWithProfile = sprintTaskRows.map((st) => {
    const task = taskMap.get(st.taskId);
    return {
      ...st,
      task: task ? {
        ...task,
        assigneeProfile: task.assigneeId ? (profileMap.get(task.assigneeId) ?? null) : null,
      } : null,
    };
  });

  return NextResponse.json({
    sprint: { ...sprint, sprintTasks: sprintTasksWithProfile },
  });
}

export async function PUT(req: Request, { params }: Params) {
  const { sprintId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [sprint] = await db.select().from(sprints).where(eq(sprints.id, sprintId)).limit(1);
  if (!sprint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, sprint.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    name?: string;
    goal?: string;
    startDate?: string | null;
    endDate?: string | null;
    status?: "planned" | "active" | "completed" | "cancelled";
  };

  // If activating, ensure no other sprint is active
  if (body.status === "active") {
    const [activeSprint] = await db.select().from(sprints).where(and(
      eq(sprints.projectId, sprint.projectId),
      eq(sprints.status, "active")
    )).limit(1);
    if (activeSprint && activeSprint.id !== sprintId) {
      return NextResponse.json(
        { error: "There is already an active sprint in this project" },
        { status: 409 }
      );
    }
  }

  const updates: Partial<typeof sprints.$inferInsert> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.goal !== undefined) updates.goal = body.goal?.trim() ?? null;
  if (body.startDate !== undefined)
    updates.startDate = body.startDate ? new Date(body.startDate) : null;
  if (body.endDate !== undefined)
    updates.endDate = body.endDate ? new Date(body.endDate) : null;
  if (body.status !== undefined) updates.status = body.status;
  updates.updatedAt = new Date();

  const [updated] = await db
    .update(sprints)
    .set(updates)
    .where(eq(sprints.id, sprintId))
    .returning();

  return NextResponse.json({ sprint: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { sprintId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [sprint] = await db.select().from(sprints).where(eq(sprints.id, sprintId)).limit(1);
  if (!sprint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, sprint.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (sprint.status !== "planned") {
    return NextResponse.json(
      { error: "Only planned sprints can be deleted" },
      { status: 400 }
    );
  }

  await db.delete(sprints).where(eq(sprints.id, sprintId));
  return NextResponse.json({ ok: true });
}
