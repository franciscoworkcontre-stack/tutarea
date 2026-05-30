import { NextResponse } from "next/server";
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

export interface WorkloadTask {
  id: string;
  title: string;
  priority: string;
  statusType: string;
  dueDate: string | null;
  estimatedHours: number | null;
}

export interface WorkloadMember {
  userId: string;
  fullName: string | null;
  avatarUrl: string | null;
  tasksTotal: number;
  tasksCompleted: number;
  tasksOverdue: number;
  tasksInProgress: number;
  estimatedHours: number;
  capacityPercent: number;
  tasks: WorkloadTask[];
}

export interface WorkloadResponse {
  members: WorkloadMember[];
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, project.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();

  // 1. Get all project members
  const projectMemberRows = await db.select().from(projectMembers).where(eq(projectMembers.projectId, projectId));

  if (projectMemberRows.length === 0) {
    return NextResponse.json({ members: [] } satisfies WorkloadResponse);
  }

  // 2. Get profiles for all members
  const memberUserIds = projectMemberRows.map((pm) => pm.userId);
  const memberProfileRows = await db.select().from(profiles).where(inArray(profiles.id, memberUserIds));
  const memberProfiles = projectMemberRows.map((pm) => memberProfileRows.find((p) => p.id === pm.userId));

  // 3. Get task statuses to resolve statusType
  const statusRows = await db.select().from(taskStatuses).where(eq(taskStatuses.projectId, projectId));
  const statusMap = new Map(statusRows.map((s) => [s.id, s.type]));

  // 4. Fetch all tasks for the project (non-archived), then filter by assignee
  const allProjectTasks = await db.select().from(tasks).where(and(
    eq(tasks.projectId, projectId),
    isNull(tasks.archivedAt)
  ));

  // 5. Build per-member metrics
  const membersData: WorkloadMember[] = projectMemberRows.map((pm, idx) => {
    const profile = memberProfiles[idx];
    const memberTasks = allProjectTasks.filter(
      (t) => t.assigneeId === pm.userId
    );

    const nowMs = now.getTime();

    const tasksTotal = memberTasks.length;

    const tasksCompleted = memberTasks.filter((t) => {
      const type = t.statusId ? (statusMap.get(t.statusId) ?? "todo") : "todo";
      return type === "done";
    }).length;

    const tasksOverdue = memberTasks.filter((t) => {
      const type = t.statusId ? (statusMap.get(t.statusId) ?? "todo") : "todo";
      const isDone = type === "done" || type === "cancelled";
      return !isDone && t.dueDate !== null && new Date(t.dueDate).getTime() < nowMs;
    }).length;

    const activeTasks = memberTasks.filter((t) => {
      const type = t.statusId ? (statusMap.get(t.statusId) ?? "todo") : "todo";
      return type !== "done" && type !== "cancelled";
    });

    const tasksInProgress = memberTasks.filter((t) => {
      const type = t.statusId ? (statusMap.get(t.statusId) ?? "todo") : "todo";
      return type === "in_progress" || type === "review";
    }).length;

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

  // 6. Sort by tasksTotal DESC
  membersData.sort((a, b) => b.tasksTotal - a.tasksTotal);

  return NextResponse.json({ members: membersData } satisfies WorkloadResponse);
}
