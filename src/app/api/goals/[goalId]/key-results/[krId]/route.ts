import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { goals, keyResults, workspaceMembers, tasks, taskStatuses } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";

type Params = { params: Promise<{ goalId: string; krId: string }> };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

async function calculateKrProgress(
  kr: typeof keyResults.$inferSelect
): Promise<number> {
  if (kr.type === "boolean") {
    return kr.currentValue >= 1 ? 100 : 0;
  }

  if (kr.type === "task_count" && kr.linkedProjectId) {
    const [totalResult] = await db
      .select({ total: count() })
      .from(tasks)
      .where(eq(tasks.projectId, kr.linkedProjectId));

    const doneStatuses = await db.select().from(taskStatuses).where(and(
      eq(taskStatuses.projectId, kr.linkedProjectId),
      eq(taskStatuses.type, "done")
    ));

    const doneStatusIds = doneStatuses.map((s) => s.id);
    let completedCount = 0;

    if (doneStatusIds.length > 0) {
      const completedResults = await Promise.all(
        doneStatusIds.map((statusId) =>
          db
            .select({ cnt: count() })
            .from(tasks)
            .where(
              and(
                eq(tasks.projectId, kr.linkedProjectId!),
                eq(tasks.statusId, statusId)
              )
            )
        )
      );
      completedCount = completedResults.reduce(
        (sum, r) => sum + Number(r[0]?.cnt ?? 0),
        0
      );
    }

    const total = Number(totalResult?.total ?? 0);
    if (total === 0) return 0;
    return clamp((completedCount / total) * 100, 0, 100);
  }

  // number / percentage / task_count without linkedProject
  const range = kr.targetValue - kr.startValue;
  if (range === 0) return kr.currentValue >= kr.targetValue ? 100 : 0;
  return clamp(
    ((kr.currentValue - kr.startValue) / range) * 100,
    0,
    100
  );
}

async function recalculateGoalProgress(goalId: string): Promise<number> {
  const krs = await db.select().from(keyResults).where(eq(keyResults.goalId, goalId));

  if (krs.length === 0) return 0;

  const progressValues = await Promise.all(krs.map(calculateKrProgress));
  const avg = progressValues.reduce((sum, v) => sum + v, 0) / progressValues.length;
  return Math.round(clamp(avg, 0, 100));
}

export async function PUT(request: Request, { params }: Params) {
  const { goalId, krId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [goal] = await db.select().from(goals).where(eq(goals.id, goalId)).limit(1);

  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, goal.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [kr] = await db.select().from(keyResults).where(and(eq(keyResults.id, krId), eq(keyResults.goalId, goalId))).limit(1);

  if (!kr) return NextResponse.json({ error: "Key result not found" }, { status: 404 });

  const body = (await request.json()) as {
    title?: string;
    currentValue?: number;
    targetValue?: number;
    startValue?: number;
    unit?: string;
    linkedProjectId?: string | null;
    ownerUserId?: string | null;
    dueDate?: string | null;
  };

  const updateData: Partial<typeof keyResults.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (body.title !== undefined) updateData.title = body.title;
  if (body.currentValue !== undefined) updateData.currentValue = body.currentValue;
  if (body.targetValue !== undefined) updateData.targetValue = body.targetValue;
  if (body.startValue !== undefined) updateData.startValue = body.startValue;
  if (body.unit !== undefined) updateData.unit = body.unit ?? null;
  if (body.linkedProjectId !== undefined)
    updateData.linkedProjectId = body.linkedProjectId ?? null;
  if (body.ownerUserId !== undefined)
    updateData.ownerUserId = body.ownerUserId ?? null;
  if (body.dueDate !== undefined)
    updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;

  const [updatedKr] = await db
    .update(keyResults)
    .set(updateData)
    .where(eq(keyResults.id, krId))
    .returning();

  // Recalculate goal progress after KR update
  const newProgress = await recalculateGoalProgress(goalId);

  const [updatedGoal] = await db
    .update(goals)
    .set({ progress: newProgress, updatedAt: new Date() })
    .where(eq(goals.id, goalId))
    .returning();

  return NextResponse.json({ keyResult: updatedKr, goal: updatedGoal });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { goalId, krId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [goal] = await db.select().from(goals).where(eq(goals.id, goalId)).limit(1);

  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, goal.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db
    .delete(keyResults)
    .where(and(eq(keyResults.id, krId), eq(keyResults.goalId, goalId)));

  // Recalculate goal progress after KR removal
  const newProgress = await recalculateGoalProgress(goalId);

  const [updatedGoal] = await db
    .update(goals)
    .set({ progress: newProgress, updatedAt: new Date() })
    .where(eq(goals.id, goalId))
    .returning();

  return NextResponse.json({ success: true, goal: updatedGoal });
}
