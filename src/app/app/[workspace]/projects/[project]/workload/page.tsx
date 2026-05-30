import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  projects,
  projectMembers,
  workspaceMembers,
  profiles,
  tasks,
  taskStatuses,
} from "@/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import WorkloadView from "@/components/workload/workload-view";
import type { WorkloadMember, WorkloadTask } from "@/app/api/projects/[projectId]/workload/route";

type Props = {
  params: Promise<{ workspace: string; project: string }>;
};

export default async function WorkloadPage({ params }: Props) {
  const { workspace: workspaceSlug, project: projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

  if (!project) redirect(`/app/${workspaceSlug}/projects`);

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, project.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);

  if (!member) redirect(`/app/${workspaceSlug}`);

  // Get project members
  const projectMemberRows = await db.select().from(projectMembers).where(eq(projectMembers.projectId, projectId));

  // Get task statuses
  const statusRows = await db.select().from(taskStatuses).where(eq(taskStatuses.projectId, projectId));
  const statusMap = new Map(statusRows.map((s) => [s.id, s.type]));

  // Get all active tasks for the project
  const allProjectTasks = await db.select().from(tasks).where(and(eq(tasks.projectId, projectId), isNull(tasks.archivedAt)));

  const now = new Date();

  // Build initial member data (no date filter for SSR — default view)
  const memberUserIds = projectMemberRows.map((pm) => pm.userId);
  const memberProfileRows = memberUserIds.length > 0
    ? await db.select().from(profiles).where(inArray(profiles.id, memberUserIds))
    : [];
  const memberProfiles = projectMemberRows.map((pm) => memberProfileRows.find((p) => p.id === pm.userId));

  const membersData: WorkloadMember[] = projectMemberRows.map((pm, idx) => {
    const profile = memberProfiles[idx];
    const memberTasks = allProjectTasks.filter((t) => t.assigneeId === pm.userId);

    const tasksTotal = memberTasks.length;

    const tasksCompleted = memberTasks.filter((t) => {
      const type = t.statusId ? (statusMap.get(t.statusId) ?? "todo") : "todo";
      return type === "done";
    }).length;

    const tasksOverdue = memberTasks.filter((t) => {
      const type = t.statusId ? (statusMap.get(t.statusId) ?? "todo") : "todo";
      const isDone = type === "done" || type === "cancelled";
      return !isDone && t.dueDate !== null && new Date(t.dueDate).getTime() < now.getTime();
    }).length;

    const tasksInProgress = memberTasks.filter((t) => {
      const type = t.statusId ? (statusMap.get(t.statusId) ?? "todo") : "todo";
      return type === "in_progress" || type === "review";
    }).length;

    const activeTasks = memberTasks.filter((t) => {
      const type = t.statusId ? (statusMap.get(t.statusId) ?? "todo") : "todo";
      return type !== "done" && type !== "cancelled";
    });

    const estimatedHours = activeTasks.reduce(
      (sum, t) => sum + (t.estimateHours ?? 0),
      0
    );

    const capacityPercent = Math.min((tasksInProgress / 5) * 100, 100);

    const taskList: WorkloadTask[] = memberTasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      statusType: t.statusId ? (statusMap.get(t.statusId) ?? "todo") : "todo",
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      estimatedHours: t.estimateHours ?? null,
    }));

    return {
      userId: pm.userId,
      fullName: profile?.fullName ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      tasksTotal,
      tasksCompleted,
      tasksOverdue,
      tasksInProgress,
      estimatedHours,
      capacityPercent,
      tasks: taskList,
    };
  });

  membersData.sort((a, b) => b.tasksTotal - a.tasksTotal);

  // Serialize to avoid passing non-plain objects to client component
  const serialized: WorkloadMember[] = JSON.parse(JSON.stringify(membersData));

  return (
    <WorkloadView projectId={projectId} initialMembers={serialized} />
  );
}
