import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { tasks, timeEntries, workspaceMembers } from "@/db/schema";
import { eq, and, sum, desc } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId } = await params;

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, task.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const entries = await db
    .select()
    .from(timeEntries)
    .where(eq(timeEntries.taskId, taskId))
    .orderBy(desc(timeEntries.startedAt));

  const totalResult = await db
    .select({ total: sum(timeEntries.durationMinutes) })
    .from(timeEntries)
    .where(eq(timeEntries.taskId, taskId));

  const totalMinutes = Number(totalResult[0]?.total ?? 0);

  const runningEntry =
    entries.find((e) => e.isRunning && e.userId === user.id) ?? null;

  return NextResponse.json({
    entries,
    totalMinutes,
    runningEntry,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId } = await params;

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, task.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as {
    description?: string;
    durationMinutes?: number;
    startedAt: string;
    endedAt?: string;
    isRunning?: boolean;
  };

  // If starting a running timer, stop any existing running entry first
  if (body.isRunning) {
    const running = await db.query.timeEntries.findFirst({
      where: and(
        eq(timeEntries.userId, user.id),
        eq(timeEntries.isRunning, true)
      ),
    });
    if (running) {
      const now = new Date();
      const startedAt = new Date(running.startedAt);
      const durationMinutes = Math.round(
        (now.getTime() - startedAt.getTime()) / 60000
      );
      await db
        .update(timeEntries)
        .set({
          isRunning: false,
          endedAt: now,
          durationMinutes,
          updatedAt: now,
        })
        .where(eq(timeEntries.id, running.id));
    }
  }

  const startedAt = new Date(body.startedAt);
  const endedAt = body.endedAt ? new Date(body.endedAt) : null;

  let durationMinutes = body.durationMinutes ?? 0;
  if (!body.isRunning && endedAt && durationMinutes === 0) {
    durationMinutes = Math.round(
      (endedAt.getTime() - startedAt.getTime()) / 60000
    );
  }

  const [entry] = await db
    .insert(timeEntries)
    .values({
      taskId,
      userId: user.id,
      workspaceId: task.workspaceId,
      description: body.description ?? null,
      durationMinutes,
      startedAt,
      endedAt,
      isRunning: body.isRunning ?? false,
    })
    .returning();

  return NextResponse.json({ entry }, { status: 201 });
}
