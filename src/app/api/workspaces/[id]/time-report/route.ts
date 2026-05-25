import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { timeEntries, workspaceMembers, tasks } from "@/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: workspaceId } = await params;

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const userId = searchParams.get("userId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Build conditions
  const conditions = [eq(timeEntries.workspaceId, workspaceId)];

  if (userId) {
    conditions.push(eq(timeEntries.userId, userId));
  }

  if (from) {
    conditions.push(gte(timeEntries.startedAt, new Date(from)));
  }

  if (to) {
    conditions.push(lte(timeEntries.startedAt, new Date(to)));
  }

  // Fetch entries with task info for project filtering
  const allEntries = await db
    .select({
      id: timeEntries.id,
      taskId: timeEntries.taskId,
      userId: timeEntries.userId,
      description: timeEntries.description,
      durationMinutes: timeEntries.durationMinutes,
      startedAt: timeEntries.startedAt,
      endedAt: timeEntries.endedAt,
      isRunning: timeEntries.isRunning,
      taskProjectId: tasks.projectId,
      taskTitle: tasks.title,
    })
    .from(timeEntries)
    .innerJoin(tasks, eq(timeEntries.taskId, tasks.id))
    .where(and(...conditions))
    .orderBy(desc(timeEntries.startedAt));

  // Filter by projectId if provided
  const filtered = projectId
    ? allEntries.filter((e) => e.taskProjectId === projectId)
    : allEntries;

  // Group by user
  const byUser: Record<string, { userId: string; totalMinutes: number; entryCount: number }> = {};
  for (const entry of filtered) {
    const uid = entry.userId;
    if (!byUser[uid]) {
      byUser[uid] = { userId: uid, totalMinutes: 0, entryCount: 0 };
    }
    byUser[uid]!.totalMinutes += entry.durationMinutes;
    byUser[uid]!.entryCount += 1;
  }

  // Group by day (YYYY-MM-DD)
  const byDay: Record<string, number> = {};
  for (const entry of filtered) {
    const day = new Date(entry.startedAt).toISOString().split("T")[0]!;
    byDay[day] = (byDay[day] ?? 0) + entry.durationMinutes;
  }

  const totalMinutes = filtered.reduce((acc, e) => acc + e.durationMinutes, 0);

  // Top contributors sorted by total minutes desc
  const topContributors = Object.values(byUser).sort(
    (a, b) => b.totalMinutes - a.totalMinutes
  );

  // Daily breakdown sorted by date
  const dailyBreakdown = Object.entries(byDay)
    .map(([date, minutes]) => ({ date, minutes }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    entries: filtered,
    totalMinutes,
    topContributors,
    dailyBreakdown,
  });
}
