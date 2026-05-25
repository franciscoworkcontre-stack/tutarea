import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  dashboards,
  tasks,
  taskStatuses,
  profiles,
  workspaceMembers,
} from "@/db/schema";
import { eq, and, desc, count, sql, lt, isNotNull, isNull, asc } from "drizzle-orm";

type Params = { params: Promise<{ dashboardId: string }> };

export async function GET(request: Request, { params }: Params) {
  const { dashboardId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dashboard = await db.query.dashboards.findFirst({
    where: eq(dashboards.id, dashboardId),
  });
  if (!dashboard) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, dashboard.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const widgetType = searchParams.get("widgetType");
  const projectId = searchParams.get("projectId") ?? undefined;

  if (!widgetType)
    return NextResponse.json({ error: "widgetType required" }, { status: 400 });

  const workspaceId = dashboard.workspaceId;

  // Build base task condition
  const baseConditions = projectId
    ? and(eq(tasks.workspaceId, workspaceId), eq(tasks.projectId, projectId), isNull(tasks.archivedAt))
    : and(eq(tasks.workspaceId, workspaceId), isNull(tasks.archivedAt));

  if (widgetType === "tasks_by_status") {
    const rows = await db
      .select({
        statusId: tasks.statusId,
        statusName: taskStatuses.name,
        color: taskStatuses.color,
        count: count(),
      })
      .from(tasks)
      .leftJoin(taskStatuses, eq(tasks.statusId, taskStatuses.id))
      .where(baseConditions)
      .groupBy(tasks.statusId, taskStatuses.name, taskStatuses.color);

    const data = rows.map((r) => ({
      statusName: r.statusName ?? "Sin estado",
      count: Number(r.count),
      color: r.color ?? "#94a3b8",
    }));
    return NextResponse.json({ data });
  }

  if (widgetType === "tasks_by_assignee") {
    const rows = await db
      .select({
        assigneeId: tasks.assigneeId,
        count: count(),
      })
      .from(tasks)
      .where(and(baseConditions, isNotNull(tasks.assigneeId)))
      .groupBy(tasks.assigneeId);

    const enriched = await Promise.all(
      rows.map(async (r) => {
        const profile = r.assigneeId
          ? await db.query.profiles.findFirst({
              where: eq(profiles.id, r.assigneeId),
            })
          : null;
        return {
          userId: r.assigneeId ?? "",
          fullName: profile?.fullName ?? "Sin asignar",
          avatarUrl: profile?.avatarUrl ?? null,
          count: Number(r.count),
        };
      })
    );
    return NextResponse.json({ data: enriched });
  }

  if (widgetType === "tasks_by_priority") {
    const rows = await db
      .select({
        priority: tasks.priority,
        count: count(),
      })
      .from(tasks)
      .where(baseConditions)
      .groupBy(tasks.priority);

    const data = rows.map((r) => ({
      priority: r.priority,
      count: Number(r.count),
    }));
    return NextResponse.json({ data });
  }

  if (widgetType === "overdue_tasks") {
    const now = new Date();
    const rows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueDate: tasks.dueDate,
        assigneeId: tasks.assigneeId,
        priority: tasks.priority,
        statusId: tasks.statusId,
        statusName: taskStatuses.name,
        statusType: taskStatuses.type,
      })
      .from(tasks)
      .leftJoin(taskStatuses, eq(tasks.statusId, taskStatuses.id))
      .where(
        and(
          baseConditions,
          lt(tasks.dueDate, sql`${now.toISOString()}::timestamptz`),
          isNotNull(tasks.dueDate)
        )
      )
      .orderBy(asc(tasks.dueDate))
      .limit(10);

    // Filter out completed/cancelled
    const filtered = rows.filter(
      (r) => r.statusType !== "done" && r.statusType !== "cancelled"
    );

    const enriched = await Promise.all(
      filtered.map(async (r) => {
        const profile = r.assigneeId
          ? await db.query.profiles.findFirst({
              where: eq(profiles.id, r.assigneeId),
            })
          : null;
        return {
          id: r.id,
          title: r.title,
          dueDate: r.dueDate,
          priority: r.priority,
          assignee: profile
            ? { id: profile.id, fullName: profile.fullName, avatarUrl: profile.avatarUrl }
            : null,
        };
      })
    );
    return NextResponse.json({ data: enriched });
  }

  if (widgetType === "recently_completed") {
    // Find done-type status ids
    const doneStatuses = await db
      .select({ id: taskStatuses.id })
      .from(taskStatuses)
      .where(
        and(
          eq(taskStatuses.workspaceId, workspaceId),
          eq(taskStatuses.type, "done")
        )
      );
    const doneStatusIds = doneStatuses.map((s) => s.id);

    if (doneStatusIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const rows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        updatedAt: tasks.updatedAt,
        assigneeId: tasks.assigneeId,
      })
      .from(tasks)
      .where(
        and(
          baseConditions,
          sql`${tasks.statusId} = ANY(ARRAY[${sql.join(
            doneStatusIds.map((id) => sql`${id}::uuid`),
            sql`, `
          )}])`
        )
      )
      .orderBy(desc(tasks.updatedAt))
      .limit(10);

    const enriched = await Promise.all(
      rows.map(async (r) => {
        const profile = r.assigneeId
          ? await db.query.profiles.findFirst({
              where: eq(profiles.id, r.assigneeId),
            })
          : null;
        return {
          id: r.id,
          title: r.title,
          completedAt: r.updatedAt,
          assignee: profile
            ? { id: profile.id, fullName: profile.fullName, avatarUrl: profile.avatarUrl }
            : null,
        };
      })
    );
    return NextResponse.json({ data: enriched });
  }

  if (widgetType === "workload") {
    const rows = await db
      .select({
        assigneeId: tasks.assigneeId,
        count: count(),
        estimatedHours: sql<number>`COALESCE(SUM(${tasks.estimateHours}), 0)`,
      })
      .from(tasks)
      .where(and(baseConditions, isNotNull(tasks.assigneeId)))
      .groupBy(tasks.assigneeId);

    const enriched = await Promise.all(
      rows.map(async (r) => {
        const profile = r.assigneeId
          ? await db.query.profiles.findFirst({
              where: eq(profiles.id, r.assigneeId),
            })
          : null;
        return {
          userId: r.assigneeId ?? "",
          fullName: profile?.fullName ?? "Sin asignar",
          taskCount: Number(r.count),
          estimatedHours: Number(r.estimatedHours),
        };
      })
    );
    return NextResponse.json({ data: enriched });
  }

  return NextResponse.json({ error: "Unsupported widgetType" }, { status: 400 });
}
