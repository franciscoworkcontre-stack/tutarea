import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { tasks, taskStatuses, projects, workspaceMembers, profiles } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import BoardView from "@/components/tasks/board-view";

type Props = {
  params: Promise<{ workspace: string; project: string }>;
};

export default async function BoardPage({ params }: Props) {
  const { workspace: workspaceSlug, project: projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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

  const statuses = await db.query.taskStatuses.findMany({
    where: eq(taskStatuses.projectId, projectId),
    orderBy: [taskStatuses.position],
  });

  const projectTasks = await db.query.tasks.findMany({
    where: and(
      eq(tasks.projectId, projectId),
      isNull(tasks.archivedAt),
      isNull(tasks.parentTaskId)
    ),
    orderBy: [tasks.position],
  });

  const workspaceUsers = await db.query.workspaceMembers.findMany({
    where: eq(workspaceMembers.workspaceId, project.workspaceId),
  });

  const userProfiles = await Promise.all(
    workspaceUsers.map((m) =>
      db.query.profiles.findFirst({ where: eq(profiles.id, m.userId) })
    )
  );

  const members = workspaceUsers.map((m, i) => ({
    userId: m.userId,
    role: m.role,
    profile: userProfiles[i] ?? null,
  }));

  return (
    <BoardView
      project={project}
      statuses={statuses}
      initialTasks={projectTasks}
      members={members}
      currentUserId={user.id}
      workspaceSlug={workspaceSlug}
    />
  );
}
