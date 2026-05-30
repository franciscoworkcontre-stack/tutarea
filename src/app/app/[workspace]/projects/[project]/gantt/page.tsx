import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { tasks, taskStatuses, projects, workspaceMembers, profiles } from "@/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import GanttView from "@/components/tasks/gantt-view";

type Props = {
  params: Promise<{ workspace: string; project: string }>;
};

export default async function GanttPage({ params }: Props) {
  const { workspace: workspaceSlug, project: projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

  if (!project) redirect(`/app/${workspaceSlug}/projects`);

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, project.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);

  if (!member) redirect(`/app/${workspaceSlug}`);

  const statuses = await db.select().from(taskStatuses).where(eq(taskStatuses.projectId, projectId)).orderBy(taskStatuses.position);

  const projectTasks = await db.select().from(tasks).where(and(
    eq(tasks.projectId, projectId),
    isNull(tasks.archivedAt),
    isNull(tasks.parentTaskId)
  )).orderBy(tasks.position);

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
    <GanttView
      project={project}
      statuses={statuses}
      initialTasks={projectTasks}
      members={members}
      currentUserId={user.id}
      workspaceSlug={workspaceSlug}
    />
  );
}
