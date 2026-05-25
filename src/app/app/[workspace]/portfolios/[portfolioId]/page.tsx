import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  portfolios,
  portfolioProjects,
  projects,
  tasks,
  taskStatuses,
  projectMembers,
  workspaces,
  workspaceMembers,
} from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import PortfolioView from "@/components/portfolios/portfolio-view";

type Props = {
  params: Promise<{ workspace: string; portfolioId: string }>;
};

type PortfolioProject = {
  id: string;
  name: string;
  key: string;
  color: string;
  status: "active" | "archived";
  icon: string | null;
  taskStats: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
  };
  completionPercent: number;
  memberCount: number;
  dueDate: string | null;
};

export default async function PortfolioDetailPage({ params }: Props) {
  const { workspace: slug, portfolioId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, slug),
  });
  if (!workspace) redirect("/app");

  const membership = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspace.id),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!membership) redirect("/app");

  const portfolio = await db.query.portfolios.findFirst({
    where: and(
      eq(portfolios.id, portfolioId),
      eq(portfolios.workspaceId, workspace.id)
    ),
  });
  if (!portfolio) notFound();

  const ppRows = await db.query.portfolioProjects.findMany({
    where: eq(portfolioProjects.portfolioId, portfolioId),
    with: { project: true },
    orderBy: [desc(portfolioProjects.addedAt)],
  });

  const portfolioProjectsData: PortfolioProject[] = await Promise.all(
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

  return (
    <PortfolioView
      portfolio={{
        id: portfolio.id,
        name: portfolio.name,
        description: portfolio.description,
        color: portfolio.color,
        createdAt: portfolio.createdAt.toISOString(),
      }}
      initialProjects={portfolioProjectsData}
      workspaceId={workspace.id}
      workspaceSlug={workspace.slug}
    />
  );
}
