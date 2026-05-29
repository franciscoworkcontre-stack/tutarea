import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { tasks, taskStatuses, projects, workspaceMembers, profiles } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
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
    const subtasks = await db.query.tasks.findMany({
      where: and(
        eq(tasks.parentTaskId, parentTaskId),
        isNull(tasks.archivedAt),
      ),
      with: {
        status: true,
      },
      orderBy: [tasks.createdAt],
    });

    // Fetch assignee profiles
    const assigneeIds = [...new Set(subtasks.map((t) => t.assigneeId).filter(Boolean))] as string[];
    const assigneeProfiles = assigneeIds.length > 0
      ? await Promise.all(assigneeIds.map((id) => db.query.profiles.findFirst({ where: eq(profiles.id, id) })))
      : [];
    const profileMap = new Map(assigneeProfiles.filter(Boolean).map((p) => [p!.id, p]));

    const subtasksWithAssignee = subtasks.map((t) => ({
      ...t,
      assignee: t.assigneeId ? (profileMap.get(t.assigneeId) ?? null) : null,
    }));

    return NextResponse.json({ tasks: subtasksWithAssignee });
  }

  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const projectTasks = await db.query.tasks.findMany({
    where: and(
      eq(tasks.projectId, projectId),
      isNull(tasks.archivedAt),
      isNull(tasks.parentTaskId)
    ),
    with: {
      status: true,
    },
    orderBy: [tasks.position],
  });

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
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, body.projectId),
  });

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Check membership
  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, project.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Get count for key generation
  const existingCount = await db.query.tasks.findMany({
    where: eq(tasks.projectId, body.projectId),
  });

  const taskKey = `${project.key}-${existingCount.length + 1}`;

  // Get default status if none provided
  let statusId = body.statusId;
  if (!statusId) {
    const defaultStatus = await db.query.taskStatuses.findFirst({
      where: eq(taskStatuses.projectId, body.projectId),
      orderBy: [taskStatuses.position],
    });
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
