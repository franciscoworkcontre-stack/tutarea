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
import { eq, and, desc, sql } from "drizzle-orm";

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

  const ppRows = await db.query.portfolioProjects.findMany({
    where: eq(portfolioProjects.portfolioId, portfolioId),
    with: { project: true },
    orderBy: [desc(portfolioProjects.addedAt)],
  });

  const projectsWithStats = await Promise.all(
    ppRows.map(async (pp) => {
      const project = pp.project;

      const statuses = await db.query.taskStatuses.findMany({
        where: eq(taskStatuses.projectId, project.id),
      });

      const doneStatusIds = statuses
        .filter((s) => s.type === "done")
        .map((s) => s.id);
      const inProgressStatusIds = statuses
        .filter((s) => s.type === "in_progress" || s.type === "review")
        .map((s) => s.id);

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

      const memberRows = await db.query.projectMembers.findMany({
        where: eq(projectMembers.projectId, project.id),
      });

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

  return NextResponse.json({ projects: projectsWithStats });
}

export async function POST(request: Request, { params }: Params) {
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

  const body = (await request.json()) as { projectId: string };
  if (!body.projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  // Verify project belongs to same workspace
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, body.projectId),
      eq(projects.workspaceId, portfolio.workspaceId)
    ),
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found in workspace" }, { status: 404 });
  }

  // Check for duplicate (upsert-style: ignore if already exists)
  const existing = await db.query.portfolioProjects.findFirst({
    where: and(
      eq(portfolioProjects.portfolioId, portfolioId),
      eq(portfolioProjects.projectId, body.projectId)
    ),
  });
  if (existing) {
    return NextResponse.json({ error: "Project already in portfolio" }, { status: 409 });
  }

  const [pp] = await db
    .insert(portfolioProjects)
    .values({
      portfolioId,
      projectId: body.projectId,
      addedBy: user.id,
    })
    .returning();

  return NextResponse.json({ portfolioProject: pp }, { status: 201 });
}

export async function DELETE(request: Request, { params }: Params) {
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

  const body = (await request.json()) as { projectId: string };
  if (!body.projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  await db
    .delete(portfolioProjects)
    .where(
      and(
        eq(portfolioProjects.portfolioId, portfolioId),
        eq(portfolioProjects.projectId, body.projectId)
      )
    );

  return NextResponse.json({ success: true });
}
