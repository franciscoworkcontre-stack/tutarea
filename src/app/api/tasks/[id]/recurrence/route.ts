import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { tasks, taskRecurrence, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateNextOccurrence } from "@/lib/recurrence/recurrence-utils";

type RouteContext = { params: Promise<{ id: string }> };

async function getAuthorizedTask(taskId: string, userId: string) {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });
  if (!task) return { task: null, error: "Not found", status: 404 } as const;

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, task.workspaceId),
      eq(workspaceMembers.userId, userId)
    ),
  });
  if (!member) return { task: null, error: "Forbidden", status: 403 } as const;

  return { task, error: null, status: 200 } as const;
}

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { task, error, status } = await getAuthorizedTask(id, user.id);
  if (!task) return NextResponse.json({ error }, { status });

  const recurrence = await db.query.taskRecurrence.findFirst({
    where: eq(taskRecurrence.taskId, id),
  });

  return NextResponse.json({ recurrence: recurrence ?? null });
}

type CreateRecurrenceBody = {
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  endDate?: string;
  maxOccurrences?: number;
};

export async function POST(
  request: Request,
  { params }: RouteContext
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { task, error, status } = await getAuthorizedTask(id, user.id);
  if (!task) return NextResponse.json({ error }, { status });

  const body = (await request.json()) as CreateRecurrenceBody;

  if (!body.frequency) {
    return NextResponse.json({ error: "frequency is required" }, { status: 400 });
  }

  const validFrequencies = ["daily", "weekly", "monthly", "yearly"] as const;
  if (!validFrequencies.includes(body.frequency)) {
    return NextResponse.json({ error: "Invalid frequency" }, { status: 400 });
  }

  const interval = body.interval ?? 1;
  const from = task.dueDate ?? new Date();

  const nextOccurrenceAt = calculateNextOccurrence(
    from,
    body.frequency,
    interval,
    body.daysOfWeek,
    body.dayOfMonth
  );

  // Upsert: delete existing then insert (task_id is unique)
  await db.delete(taskRecurrence).where(eq(taskRecurrence.taskId, id));

  const [recurrence] = await db
    .insert(taskRecurrence)
    .values({
      taskId: id,
      frequency: body.frequency,
      interval,
      daysOfWeek: body.daysOfWeek ?? null,
      dayOfMonth: body.dayOfMonth ?? null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      maxOccurrences: body.maxOccurrences ?? null,
      occurrenceCount: 0,
      nextOccurrenceAt,
      isActive: true,
    })
    .returning();

  return NextResponse.json({ recurrence });
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { task, error, status } = await getAuthorizedTask(id, user.id);
  if (!task) return NextResponse.json({ error }, { status });

  await db.delete(taskRecurrence).where(eq(taskRecurrence.taskId, id));

  return NextResponse.json({ success: true });
}
