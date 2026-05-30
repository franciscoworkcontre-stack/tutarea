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

  const rows = await db.select().from(sprintTasks).where(eq(sprintTasks.sprintId, sprintId));
  const taskIds = rows.map((r) => r.taskId);
  const taskRows = taskIds.length > 0 ? await db.select().from(tasks).where(inArray(tasks.id, taskIds)) : [];
  const statusIds = [...new Set(taskRows.map((t) => t.statusId).filter(Boolean))] as string[];
  const statusRows = statusIds.length > 0 ? await db.select().from(taskStatuses).where(inArray(taskStatuses.id, statusIds)) : [];
  const statusMap = new Map(statusRows.map((s) => [s.id, s]));
  const taskMap = new Map(taskRows.map((t) => [t.id, { ...t, status: t.statusId ? (statusMap.get(t.statusId) ?? null) : null }]));

  const assigneeIds = [
    ...new Set(taskRows.map((t) => t.assigneeId).filter((id): id is string => id !== null)),
  ];
  const profileList = assigneeIds.length > 0
    ? await db.select().from(profiles).where(inArray(profiles.id, assigneeIds))
    : [];
  const profileMap = new Map(profileList.map((p) => [p.id, p]));

  const enriched = rows.map((r) => {
    const task = taskMap.get(r.taskId);
    return {
      ...r,
      task: task ? {
        ...task,
        assigneeProfile: task.assigneeId ? (profileMap.get(task.assigneeId) ?? null) : null,
      } : null,
    };
  });

  return NextResponse.json({ tasks: enriched });
}

export async function POST(req: Request, { params }: Params) {
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
    taskId: string;
    storyPoints?: number;
  };

  if (!body.taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  // Verify task belongs to same project
  const [task] = await db.select().from(tasks).where(and(
    eq(tasks.id, body.taskId),
    eq(tasks.projectId, sprint.projectId)
  )).limit(1);
  if (!task) {
    return NextResponse.json(
      { error: "Task not found in this project" },
      { status: 404 }
    );
  }

  const [row] = await db
    .insert(sprintTasks)
    .values({
      sprintId,
      taskId: body.taskId,
      addedBy: user.id,
      storyPoints: body.storyPoints ?? null,
    })
    .onConflictDoNothing()
    .returning();

  return NextResponse.json({ sprintTask: row ?? null }, { status: 201 });
}

export async function DELETE(req: Request, { params }: Params) {
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

  const body = (await req.json()) as { taskId: string };
  if (!body.taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  await db
    .delete(sprintTasks)
    .where(
      and(
        eq(sprintTasks.sprintId, sprintId),
        eq(sprintTasks.taskId, body.taskId)
      )
    );

  return NextResponse.json({ ok: true });
}
