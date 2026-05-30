import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { sprints, sprintTasks, tasks, taskStatuses, workspaceMembers } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

type Params = { params: Promise<{ sprintId: string }> };

type BurndownPoint = {
  date: string;
  remaining: number;
  ideal: number;
};

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
  const sprintTasksWithStatus = sprintTaskRows.map((st) => ({ ...st, task: taskMap.get(st.taskId) ?? null }));

  if (!sprint.startDate || !sprint.endDate) {
    return NextResponse.json(
      { error: "Sprint has no start/end date" },
      { status: 400 }
    );
  }

  const totalPoints = sprintTasksWithStatus.reduce(
    (sum, st) => sum + (st.storyPoints ?? 1),
    0
  );

  const totalTaskCount = sprintTasksWithStatus.length;
  const total = totalPoints > 0 ? totalPoints : totalTaskCount;

  const start = new Date(sprint.startDate);
  const end = new Date(sprint.endDate);
  const today = new Date();

  // Generate day-by-day array
  const days: BurndownPoint[] = [];
  const msPerDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / msPerDay)
  );

  // Count tasks done by day using completedAt approximation:
  // For each done task, we don't have a per-task completedAt in the schema,
  // so we approximate based on proportion of done tasks spread over elapsed days.
  const doneTasks = sprintTasksWithStatus.filter(
    (st) => st.task?.status?.type === "done"
  );
  const donePoints = doneTasks.reduce(
    (sum, st) => sum + (st.storyPoints ?? 1),
    0
  );

  const elapsedDays = Math.max(
    0,
    Math.min(
      totalDays,
      Math.round((today.getTime() - start.getTime()) / msPerDay)
    )
  );

  for (let d = 0; d <= totalDays; d++) {
    const date = new Date(start.getTime() + d * msPerDay);
    const dateStr = date.toISOString().split("T")[0] ?? date.toDateString();

    // Ideal: linear burn from total to 0
    const ideal = Math.max(0, total - (total / totalDays) * d);

    // Real: only known for past days up to today
    let remaining: number;
    if (d === 0) {
      remaining = total;
    } else if (d <= elapsedDays) {
      // Linear interpolation of done work over elapsed period
      const burnedSoFar = elapsedDays > 0
        ? (donePoints / elapsedDays) * d
        : 0;
      remaining = Math.max(0, total - burnedSoFar);
    } else {
      // Future days: null-ish — we'll use a sentinel that the chart ignores
      remaining = -1;
    }

    days.push({ date: dateStr, remaining, ideal: Math.round(ideal * 10) / 10 });
  }

  return NextResponse.json({
    burndown: days,
    total,
    donePoints,
    totalDays,
    elapsedDays,
    isOnTrack: donePoints >= (total / totalDays) * elapsedDays,
  });
}
