import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { sprints, sprintTasks, tasks, workspaceMembers, profiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ sprintId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { sprintId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sprint = await db.query.sprints.findFirst({
    where: eq(sprints.id, sprintId),
  });
  if (!sprint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, sprint.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db.query.sprintTasks.findMany({
    where: eq(sprintTasks.sprintId, sprintId),
    with: {
      task: { with: { status: true } },
    },
  });

  const assigneeIds = [
    ...new Set(
      rows
        .map((r) => r.task.assigneeId)
        .filter((id): id is string => id !== null)
    ),
  ];

  const profileList = await Promise.all(
    assigneeIds.map((id) =>
      db.query.profiles.findFirst({ where: eq(profiles.id, id) })
    )
  );
  const profileMap = new Map(
    assigneeIds.map((id, i) => [id, profileList[i] ?? null])
  );

  const enriched = rows.map((r) => ({
    ...r,
    task: {
      ...r.task,
      assigneeProfile: r.task.assigneeId
        ? (profileMap.get(r.task.assigneeId) ?? null)
        : null,
    },
  }));

  return NextResponse.json({ tasks: enriched });
}

export async function POST(req: Request, { params }: Params) {
  const { sprintId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sprint = await db.query.sprints.findFirst({
    where: eq(sprints.id, sprintId),
  });
  if (!sprint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, sprint.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    taskId: string;
    storyPoints?: number;
  };

  if (!body.taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  // Verify task belongs to same project
  const task = await db.query.tasks.findFirst({
    where: and(
      eq(tasks.id, body.taskId),
      eq(tasks.projectId, sprint.projectId)
    ),
  });
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

  const sprint = await db.query.sprints.findFirst({
    where: eq(sprints.id, sprintId),
  });
  if (!sprint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, sprint.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
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
