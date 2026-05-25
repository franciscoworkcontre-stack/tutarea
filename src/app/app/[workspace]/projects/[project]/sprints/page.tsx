import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { sprints, tasks, projects, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import SprintList, { type SprintWithStats } from "@/components/sprints/sprint-list";

type Props = {
  params: Promise<{ workspace: string; project: string }>;
};

export default async function SprintsPage({ params }: Props) {
  const { workspace: workspaceSlug, project: projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) redirect(`/app/${workspaceSlug}/projects`);

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, project.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });

  if (!member) redirect(`/app/${workspaceSlug}`);

  const projectSprints = await db.query.sprints.findMany({
    where: eq(sprints.projectId, projectId),
    orderBy: (s, { desc }) => [desc(s.createdAt)],
    with: { sprintTasks: true },
  });

  // Build stats per sprint and serialize dates to strings
  const sprintsRaw = await Promise.all(
    projectSprints.map(async (sprint) => {
      const taskIds = sprint.sprintTasks.map((st) => st.taskId);
      let completedCount = 0;

      if (taskIds.length > 0) {
        const taskRows = await db.query.tasks.findMany({
          where: eq(tasks.projectId, projectId),
          with: { status: true },
        });
        const sprintTaskSet = new Set(taskIds);
        completedCount = taskRows.filter(
          (t) => sprintTaskSet.has(t.id) && t.status?.type === "done"
        ).length;
      }

      const totalStoryPoints = sprint.sprintTasks.reduce(
        (sum, st) => sum + (st.storyPoints ?? 0),
        0
      );

      const { sprintTasks: _st, ...sprintData } = sprint;
      return {
        ...sprintData,
        totalTasks: sprint.sprintTasks.length,
        completedTasks: completedCount,
        totalStoryPoints,
      };
    })
  );

  // Sort: active first, then planned, then completed/cancelled
  const ORDER: Record<string, number> = {
    active: 0,
    planned: 1,
    completed: 2,
    cancelled: 3,
  };
  sprintsRaw.sort((a, b) => (ORDER[a.status] ?? 4) - (ORDER[b.status] ?? 4));

  // Serialize to JSON-safe types (Date → string)
  const serialized = JSON.parse(JSON.stringify(sprintsRaw)) as SprintWithStats[];

  return (
    <div className="h-full overflow-hidden">
      <SprintList
        projectId={projectId}
        workspaceSlug={workspaceSlug}
        initialSprints={serialized}
      />
    </div>
  );
}
