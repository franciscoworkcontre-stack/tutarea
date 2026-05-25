import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { tasks, taskStatuses, taskRecurrence, workspaceMembers } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import {
  calculateNextOccurrence,
  shouldCreateNextOccurrence,
  cloneTaskForRecurrence,
} from "@/lib/recurrence/recurrence-utils";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  _request: Request,
  { params }: RouteContext
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

  const recurrence = await db.query.taskRecurrence.findFirst({
    where: eq(taskRecurrence.taskId, id),
  });

  if (!recurrence) {
    return NextResponse.json({ error: "No recurrence configured for this task" }, { status: 404 });
  }

  if (!recurrence.isActive) {
    return NextResponse.json({ error: "Recurrence is inactive" }, { status: 400 });
  }

  if (
    !shouldCreateNextOccurrence({
      endDate: recurrence.endDate,
      maxOccurrences: recurrence.maxOccurrences,
      occurrenceCount: recurrence.occurrenceCount,
    })
  ) {
    // Deactivate recurrence since it's exhausted
    await db
      .update(taskRecurrence)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(taskRecurrence.id, recurrence.id));

    return NextResponse.json({ message: "Recurrence exhausted, no new task created" });
  }

  const nextDue = recurrence.nextOccurrenceAt ?? new Date();

  // Get first status for the project
  const firstStatus = await db.query.taskStatuses.findFirst({
    where: eq(taskStatuses.projectId, task.projectId),
    orderBy: [asc(taskStatuses.position)],
  });

  // Generate key
  const existingTasks = await db.query.tasks.findMany({
    where: eq(tasks.projectId, task.projectId),
  });
  const taskKey = `${task.key.split("-").slice(0, -1).join("-")}-${existingTasks.length + 1}`;

  const cloned = cloneTaskForRecurrence(
    task,
    nextDue,
    taskKey,
    generateKeyBetween(null, null),
    firstStatus?.id ?? null
  );

  const [newTask] = await db.insert(tasks).values(cloned).returning();

  // Calculate next occurrence from the current nextOccurrenceAt
  const newNextOccurrence = calculateNextOccurrence(
    nextDue,
    recurrence.frequency,
    recurrence.interval,
    recurrence.daysOfWeek as number[] | undefined,
    recurrence.dayOfMonth ?? undefined
  );

  const newCount = recurrence.occurrenceCount + 1;
  const willBeExhausted =
    !shouldCreateNextOccurrence({
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

  return NextResponse.json({ task: newTask });
}
