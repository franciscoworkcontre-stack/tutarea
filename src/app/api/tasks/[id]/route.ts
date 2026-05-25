import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { tasks, taskStatuses, taskRecurrence, workspaceMembers } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { runAutomations } from "@/lib/automations/automation-engine";
import { generateKeyBetween } from "fractional-indexing";
import {
  calculateNextOccurrence,
  shouldCreateNextOccurrence,
  cloneTaskForRecurrence,
} from "@/lib/recurrence/recurrence-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
    with: { status: true },
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, task.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ task });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, task.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as Partial<{
    title: string;
    description: string;
    statusId: string;
    priority: string;
    assigneeId: string;
    dueDate: string;
    startDate: string;
    position: string;
    estimateHours: number;
  }>;

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (body.title !== undefined) updateData["title"] = body.title;
  if (body.description !== undefined) updateData["description"] = body.description;
  if (body.statusId !== undefined) updateData["statusId"] = body.statusId;
  if (body.priority !== undefined) updateData["priority"] = body.priority;
  if (body.assigneeId !== undefined) updateData["assigneeId"] = body.assigneeId;
  if (body.dueDate !== undefined) updateData["dueDate"] = body.dueDate ? new Date(body.dueDate) : null;
  if (body.startDate !== undefined) updateData["startDate"] = body.startDate ? new Date(body.startDate) : null;
  if (body.position !== undefined) updateData["position"] = body.position;
  if (body.estimateHours !== undefined) updateData["estimateHours"] = body.estimateHours;

  const [updated] = await db
    .update(tasks)
    .set(updateData)
    .where(eq(tasks.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Update failed" }, { status: 500 });

  // ── Auto-trigger recurrence when task becomes "done" ─────────────────────
  if (body.statusId !== undefined && body.statusId !== task.statusId) {
    // Check if the new status is of type "done"
    const newStatus = await db.query.taskStatuses.findFirst({
      where: eq(taskStatuses.id, body.statusId ?? ""),
    });

    if (newStatus?.type === "done") {
      const recurrence = await db.query.taskRecurrence.findFirst({
        where: eq(taskRecurrence.taskId, id),
      });

      if (
        recurrence?.isActive &&
        shouldCreateNextOccurrence({
          endDate: recurrence.endDate,
          maxOccurrences: recurrence.maxOccurrences,
          occurrenceCount: recurrence.occurrenceCount,
        })
      ) {
        const nextDue = recurrence.nextOccurrenceAt ?? new Date();

        // Get first status for project
        const firstStatus = await db.query.taskStatuses.findFirst({
          where: eq(taskStatuses.projectId, task.projectId),
          orderBy: [asc(taskStatuses.position)],
        });

        // Generate unique key
        const existingTasks = await db.query.tasks.findMany({
          where: eq(tasks.projectId, task.projectId),
        });
        const keyPrefix = task.key.split("-").slice(0, -1).join("-");
        const taskKey = `${keyPrefix}-${existingTasks.length + 1}`;

        const cloned = cloneTaskForRecurrence(
          task,
          nextDue,
          taskKey,
          generateKeyBetween(null, null),
          firstStatus?.id ?? null
        );

        await db.insert(tasks).values(cloned);

        // Advance recurrence
        const newNextOccurrence = calculateNextOccurrence(
          nextDue,
          recurrence.frequency,
          recurrence.interval,
          recurrence.daysOfWeek as number[] | undefined,
          recurrence.dayOfMonth ?? undefined
        );

        const newCount = recurrence.occurrenceCount + 1;
        const willBeExhausted = !shouldCreateNextOccurrence({
          endDate: recurrence.endDate,
          maxOccurrences: recurrence.maxOccurrences,
          occurrenceCount: newCount,
        });

        await db
          .update(taskRecurrence)
          .set({
            occurrenceCount: newCount,
            nextOccurrenceAt: newNextOccurrence,
            isActive: !willBeExhausted,
            updatedAt: new Date(),
          })
          .where(eq(taskRecurrence.id, recurrence.id));
      }
    }
  }

  // ── Trigger automations (non-blocking) ───────────────────────────────────
  const existingTask = task;
  if (body.statusId !== undefined && body.statusId !== existingTask.statusId) {
    void runAutomations(
      {
        type: "task_status_changed",
        projectId: updated.projectId,
        workspaceId: updated.workspaceId,
        taskId: updated.id,
        triggeredBy: user.id,
        payload: {
          oldStatusId: existingTask.statusId,
          newStatusId: body.statusId,
        },
      },
      db
    ).catch(() => {});
  }

  if (body.assigneeId !== undefined && body.assigneeId !== existingTask.assigneeId) {
    void runAutomations(
      {
        type: "task_assigned",
        projectId: updated.projectId,
        workspaceId: updated.workspaceId,
        taskId: updated.id,
        triggeredBy: user.id,
        payload: { assigneeId: body.assigneeId },
      },
      db
    ).catch(() => {});
  }

  if (body.priority !== undefined && body.priority !== existingTask.priority) {
    void runAutomations(
      {
        type: "task_priority_changed",
        projectId: updated.projectId,
        workspaceId: updated.workspaceId,
        taskId: updated.id,
        triggeredBy: user.id,
        payload: { oldPriority: existingTask.priority, newPriority: body.priority },
      },
      db
    ).catch(() => {});
  }

  return NextResponse.json({ task: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, task.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.update(tasks)
    .set({ archivedAt: new Date() })
    .where(eq(tasks.id, id));

  return NextResponse.json({ success: true });
}
