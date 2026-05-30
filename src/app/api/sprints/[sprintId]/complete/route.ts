import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { sprints, sprintTasks, tasks, taskStatuses, workspaceMembers } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

type Params = { params: Promise<{ sprintId: string }> };

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

  // Fetch sprint tasks with task status
  const sprintTaskRows = await db.select().from(sprintTasks).where(eq(sprintTasks.sprintId, sprintId));
  const taskIds = sprintTaskRows.map((st) => st.taskId);
  const taskRows = taskIds.length > 0 ? await db.select().from(tasks).where(inArray(tasks.id, taskIds)) : [];
  const statusIds = [...new Set(taskRows.map((t) => t.statusId).filter(Boolean))] as string[];
  const statusRows = statusIds.length > 0 ? await db.select().from(taskStatuses).where(inArray(taskStatuses.id, statusIds)) : [];
  const statusMap = new Map(statusRows.map((s) => [s.id, s]));
  const taskMap = new Map(taskRows.map((t) => [t.id, { ...t, status: t.statusId ? (statusMap.get(t.statusId) ?? null) : null }]));
  const sprintTasksWithStatus = sprintTaskRows.map((st) => ({ ...st, task: taskMap.get(st.taskId) ?? null }));

  if (sprint.status !== "active") {
    return NextResponse.json(
      { error: "Only active sprints can be completed" },
      { status: 400 }
    );
  }

  const body = (await req.json()) as { moveIncompleteToSprintId?: string };

  // Separate done vs incomplete tasks
  const doneTasks = sprintTasksWithStatus.filter(
    (st) => st.task?.status?.type === "done"
  );
  const incompleteTasks = sprintTasksWithStatus.filter(
    (st) => st.task?.status?.type !== "done"
  );

  // Velocity = sum of story points for done tasks
  const velocity = doneTasks.reduce(
    (sum, st) => sum + (st.storyPoints ?? 0),
    0
  );

  // If moveIncompleteToSprintId is provided, move incomplete tasks there
  if (body.moveIncompleteToSprintId && incompleteTasks.length > 0) {
    const [targetSprint] = await db.select().from(sprints).where(eq(sprints.id, body.moveIncompleteToSprintId)).limit(1);

    if (!targetSprint || targetSprint.projectId !== sprint.projectId) {
      return NextResponse.json(
        { error: "Target sprint not found in this project" },
        { status: 400 }
      );
    }

    // Insert incomplete tasks into target sprint
    await Promise.all(
      incompleteTasks.map((st) =>
        db
          .insert(sprintTasks)
          .values({
            sprintId: body.moveIncompleteToSprintId!,
            taskId: st.taskId,
            addedBy: user.id,
            storyPoints: st.storyPoints,
          })
          .onConflictDoNothing()
      )
    );
  }
  // Otherwise incomplete tasks stay in backlog (just removed from sprint)
  // sprintTasks cascade deletes when sprint is completed — we keep them as records
  // but the sprint status change signals backlog

  // Update sprint to completed
  const [completed] = await db
    .update(sprints)
    .set({
      status: "completed",
      completedAt: new Date(),
      velocity,
      updatedAt: new Date(),
    })
    .where(eq(sprints.id, sprintId))
    .returning();

  return NextResponse.json({
    sprint: completed,
    movedTasks: body.moveIncompleteToSprintId ? incompleteTasks.length : 0,
    doneTasks: doneTasks.length,
    velocity,
  });
}
