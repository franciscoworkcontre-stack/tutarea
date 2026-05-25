import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  portfolios,
  portfolioProjects,
  projects,
  tasks,
  taskStatuses,
  projectMembers,
  workspaceMembers,
} from "@/db/schema";
import { eq, and, desc, count, sql } from "drizzle-orm";

type Params = { params: Promise<{ portfolioId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { portfolioId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const portfolio = await db.query.portfolios.findFirst({
    where: eq(portfolios.id, portfolioId),
  });
  if (!portfolio) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, portfolio.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Fetch portfolio projects with their project data
  const ppRows = await db.query.portfolioProjects.findMany({
    where: eq(portfolioProjects.portfolioId, portfolioId),
    with: {
      project: true,
    },
    orderBy: [desc(portfolioProjects.addedAt)],
  });

  // For each project, compute task stats and member count
  const projectsWithStats = await Promise.all(
    ppRows.map(async (pp) => {
      const project = pp.project;

      // Get all task statuses for this project to classify
      const statuses = await db.query.taskStatuses.findMany({
        where: eq(taskStatuses.projectId, project.id),
      });

      const doneStatusIds = statuses
        .filter((s) => s.type === "done")
        .map((s) => s.id);
      const inProgressStatusIds = statuses
        .filter((s) => s.type === "in_progress" || s.type === "review")
        .map((s) => s.id);

      // Get all non-archived tasks for this project
      const allTasks = await db.query.tasks.findMany({
        where: and(
          eq(tasks.projectId, project.id),
          sql`${tasks.archivedAt} IS NULL`
        ),
      });

      const total = allTasks.length;
      const completed = allTasks.filter(
        (t) => t.statusId !== null && doneStatusIds.includes(t.statusId)
      ).length;
      const inProgress = allTasks.filter(
        (t) => t.statusId !== null && inProgressStatusIds.includes(t.statusId)
      ).length;

      const now = new Date();
      const overdue = allTasks.filter(
        (t) =>
          t.dueDate !== null &&
          t.dueDate < now &&
          (t.statusId === null || !doneStatusIds.includes(t.statusId))
      ).length;

      const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

      // Member count
      const memberRows = await db.query.projectMembers.findMany({
        where: eq(projectMembers.projectId, project.id),
      });

      // Latest due date among tasks
      const taskWithLatestDue = allTasks
        .filter((t) => t.dueDate !== null)
        .sort(
          (a, b) =>
            (b.dueDate as Date).getTime() - (a.dueDate as Date).getTime()
        )[0];

      return {
        id: project.id,
        name: project.name,
        key: project.key,
        color: project.color,
        status: project.status,
        icon: project.icon,
        taskStats: { total, completed, inProgress, overdue },
        completionPercent,
        memberCount: memberRows.length,
        dueDate: taskWithLatestDue?.dueDate?.toISOString() ?? null,
      };
    })
  );

  return NextResponse.json({
    portfolio: {
      id: portfolio.id,
      name: portfolio.name,
      description: portfolio.description,
      color: portfolio.color,
      createdAt: portfolio.createdAt,
    },
    projects: projectsWithStats,
  });
}

export async function PUT(request: Request, { params }: Params) {
  const { portfolioId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const portfolio = await db.query.portfolios.findFirst({
    where: eq(portfolios.id, portfolioId),
  });
  if (!portfolio) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, portfolio.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as {
    name?: string;
    description?: string;
    color?: string;
  };

  const [updated] = await db
    .update(portfolios)
    .set({
      name: body.name ?? portfolio.name,
      description: body.description !== undefined ? body.description : portfolio.description,
      color: body.color ?? portfolio.color,
      updatedAt: new Date(),
    })
    .where(eq(portfolios.id, portfolioId))
    .returning();

  return NextResponse.json({ portfolio: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { portfolioId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const portfolio = await db.query.portfolios.findFirst({
    where: eq(portfolios.id, portfolioId),
  });
  if (!portfolio) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, portfolio.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(portfolios).where(eq(portfolios.id, portfolioId));

  return NextResponse.json({ success: true });
}
