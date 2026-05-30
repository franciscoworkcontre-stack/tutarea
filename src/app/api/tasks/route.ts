import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { tasks, taskStatuses, projects, workspaceMembers, profiles } from "@/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import { runAutomations } from "@/lib/automations/automation-engine";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const parentTaskId = searchParams.get("parentTaskId");

  // If parentTaskId is provided, fetch subtasks for that task
  if (parentTaskId) {
    const subtasksRaw = await db.select().from(tasks).where(and(
      eq(tasks.parentTaskId, parentTaskId),
      isNull(tasks.archivedAt)
    )).orderBy(tasks.createdAt);

    const subtaskStatusIds = [...new Set(subtasksRaw.map((t) => t.statusId).filter(Boolean))] as string[];
    const subtaskStatusRows = subtaskStatusIds.length > 0
      ? await db.select().from(taskStatuses).where(inArray(taskStatuses.id, subtaskStatusIds))
      : [];
    const subtaskStatusMap = new Map(subtaskStatusRows.map((s) => [s.id, s]));

    // Fetch assignee profiles
    const assigneeIds = [...new Set(subtasksRaw.map((t) => t.assigneeId).filter(Boolean))] as string[];
    const assigneeProfileRows = assigneeIds.length > 0
      ? await db.select().from(profiles).where(inArray(profiles.id, assigneeIds))
      : [];
    const profileMap = new Map(assigneeProfileRows.map((p) => [p.id, p]));

    const subtasksWithAssignee = subtasksRaw.map((t) => ({
      ...t,
      status: t.statusId ? (subtaskStatusMap.get(t.statusId) ?? null) : null,
      assignee: t.assigneeId ? (profileMap.get(t.assigneeId) ?? null) : null,
    }));

    return NextResponse.json({ tasks: subtasksWithAssignee });
  }

  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const projectTasksRaw = await db.select().from(tasks).where(and(
    eq(tasks.projectId, projectId),
    isNull(tasks.archivedAt),
    isNull(tasks.parentTaskId)
  )).orderBy(tasks.position);

  const projectStatusIds = [...new Set(projectTasksRaw.map((t) => t.statusId).filter(Boolean))] as string[];
  const projectStatusRows = projectStatusIds.length > 0
    ? await db.select().from(taskStatuses).where(inArray(taskStatuses.id, projectStatusIds))
    : [];
  const projectStatusMap = new Map(projectStatusRows.map((s) => [s.id, s]));

  const projectTasks = projectTasksRaw.map((t) => ({
    ...t,
    status: t.statusId ? (projectStatusMap.get(t.statusId) ?? null) : null,
  }));

  return NextResponse.json({ tasks: projectTasks });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    title: string;
    projectId: string;
    statusId?: string;
    priority?: string;
    assigneeId?: string;
    dueDate?: string;
    description?: string;
    parentTaskId?: string;
  };

  if (!body.title || !body.projectId) {
    return NextResponse.json({ error: "title and projectId required" }, { status: 400 });
  }

  // Get project to check workspace membership and generate key
  const [project] = await db.select().from(projects).where(eq(projects.id, body.projectId)).limit(1);

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Check membership
  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, project.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Get count for key generation
  const existingCount = await db.select().from(tasks).where(eq(tasks.projectId, body.projectId));

  const taskKey = `${project.key}-${existingCount.length + 1}`;

  // Get default status if none provided
  let statusId = body.statusId;
  if (!statusId) {
    const [defaultStatus] = await db.select().from(taskStatuses).where(eq(taskStatuses.projectId, body.projectId)).orderBy(taskStatuses.position).limit(1);
    statusId = defaultStatus?.id;
  }

  const [task] = await db
    .insert(tasks)
    .values({
      projectId: body.projectId,
      workspaceId: project.workspaceId,
      title: body.title,
      key: taskKey,
      statusId: statusId ?? null,
      priority: (body.priority as "no_priority" | "low" | "medium" | "high" | "urgent") ?? "no_priority",
      assigneeId: body.assigneeId ?? null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      description: body.description ?? null,
      parentTaskId: body.parentTaskId ?? null,
      createdBy: user.id,
      position: generateKeyBetween(null, null),
    })
    .returning();

  if (!task) return NextResponse.json({ error: "Insert failed" }, { status: 500 });

  // ── Trigger task_created automation (non-blocking) ───────────────────────
  void runAutomations(
    {
      type: "task_created",
      projectId: task.projectId,
      workspaceId: task.workspaceId,
      taskId: task.id,
      triggeredBy: user.id,
      payload: { taskId: task.id },
    },
    db
  ).catch(() => {});

  return NextResponse.json({ task });
}
