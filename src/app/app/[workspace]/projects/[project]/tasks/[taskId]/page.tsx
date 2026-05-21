import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { tasks, projects, workspaceMembers, profiles, taskStatuses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import TaskDetail from "@/components/tasks/task-detail";

type Props = {
  params: Promise<{ workspace: string; project: string; taskId: string }>;
};

export default async function TaskPage({ params }: Props) {
  const { workspace: workspaceSlug, project: projectId, taskId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { status: true },
  });

  if (!task) notFound();

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, task.projectId),
  });

  if (!project) notFound();

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
    <TaskDetail
      task={task}
      project={project}
      statuses={statuses}
      members={members}
      currentUserId={user.id}
      workspaceSlug={workspaceSlug}
    />
  );
}
