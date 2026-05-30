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
import { eq, and, desc, sql, inArray } from "drizzle-orm";

type Params = { params: Promise<{ portfolioId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { portfolioId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [portfolio] = await db.select().from(portfolios).where(eq(portfolios.id, portfolioId)).limit(1);
  if (!portfolio) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, portfolio.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ppRowsRaw = await db.select().from(portfolioProjects).where(eq(portfolioProjects.portfolioId, portfolioId)).orderBy(desc(portfolioProjects.addedAt));
  const ppProjectIds = ppRowsRaw.map((pp) => pp.projectId);
  const ppProjectRows = ppProjectIds.length > 0 ? await db.select().from(projects).where(inArray(projects.id, ppProjectIds)) : [];
  const ppProjectMap = new Map(ppProjectRows.map((p) => [p.id, p]));
  const ppRows = ppRowsRaw.map((pp) => ({ ...pp, project: ppProjectMap.get(pp.projectId)! })).filter((pp) => pp.project);

  const projectsWithStats = await Promise.all(
    ppRows.map(async (pp) => {
      const project = pp.project;

      const statuses = await db.select().from(taskStatuses).where(eq(taskStatuses.projectId, project.id));

      const doneStatusIds = statuses
        .filter((s) => s.type === "done")
        .map((s) => s.id);
      const inProgressStatusIds = statuses
        .filter((s) => s.type === "in_progress" || s.type === "review")
        .map((s) => s.id);

      const allTasks = await db.select().from(tasks).where(and(
        eq(tasks.projectId, project.id),
        sql`${tasks.archivedAt} IS NULL`
      ));

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

      const memberRows = await db.select().from(projectMembers).where(eq(projectMembers.projectId, project.id));

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

  const [portfolio] = await db.select().from(portfolios).where(eq(portfolios.id, portfolioId)).limit(1);
  if (!portfolio) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, portfolio.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as { projectId: string };
  if (!body.projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  // Verify project belongs to same workspace
  const [project] = await db.select().from(projects).where(and(
    eq(projects.id, body.projectId),
    eq(projects.workspaceId, portfolio.workspaceId)
  )).limit(1);
  if (!project) {
    return NextResponse.json({ error: "Project not found in workspace" }, { status: 404 });
  }

  // Check for duplicate (upsert-style: ignore if already exists)
  const [existing] = await db.select().from(portfolioProjects).where(and(
    eq(portfolioProjects.portfolioId, portfolioId),
    eq(portfolioProjects.projectId, body.projectId)
  )).limit(1);
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

  const [portfolio] = await db.select().from(portfolios).where(eq(portfolios.id, portfolioId)).limit(1);
  if (!portfolio) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, portfolio.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
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
