import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { tasks, projects, workspaceMembers, profiles, taskStatuses } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import TaskDetail from "@/components/tasks/task-detail";

type Props = {
  params: Promise<{ workspace: string; project: string; taskId: string }>;
};

export default async function TaskPage({ params }: Props) {
  const { workspace: workspaceSlug, project: projectId, taskId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [taskRow] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);

  if (!taskRow) notFound();

  const [taskStatus] = taskRow.statusId
    ? await db.select().from(taskStatuses).where(eq(taskStatuses.id, taskRow.statusId)).limit(1)
    : [null];
  const task = { ...taskRow, status: taskStatus ?? null };

  const [project] = await db.select().from(projects).where(eq(projects.id, task.projectId)).limit(1);

  if (!project) notFound();

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, project.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);

  if (!member) redirect(`/app/${workspaceSlug}`);

  const statuses = await db.select().from(taskStatuses).where(eq(taskStatuses.projectId, projectId)).orderBy(taskStatuses.position);

  const workspaceUsers = await db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, project.workspaceId));

  const userIds = workspaceUsers.map(u => u.userId);
  const profileRows = userIds.length > 0 ? await db.select().from(profiles).where(inArray(profiles.id, userIds)) : [];
  const userProfiles = workspaceUsers.map(u => profileRows.find(p => p.id === u.userId));

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
