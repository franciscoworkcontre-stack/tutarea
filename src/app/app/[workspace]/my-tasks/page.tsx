import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { tasks, taskStatuses, workspaces, workspaceMembers } from "@/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import MyTasksView from "@/components/tasks/my-tasks-view";

type Props = {
  params: Promise<{ workspace: string }>;
};

export default async function MyTasksPage({ params }: Props) {
  const { workspace: slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);

  if (!workspace) redirect("/app");

  const myTasksRaw = await db.select().from(tasks).where(and(
    eq(tasks.assigneeId, user.id),
    eq(tasks.workspaceId, workspace.id),
    isNull(tasks.archivedAt)
  )).orderBy(tasks.dueDate);

  const statusIds = [...new Set(myTasksRaw.map(t => t.statusId).filter(Boolean))] as string[];
  const statusRows = statusIds.length > 0
    ? await db.select().from(taskStatuses).where(inArray(taskStatuses.id, statusIds))
    : [];
  const statusMap = new Map(statusRows.map(s => [s.id, s]));

  const myTasks = myTasksRaw.map(t => ({ ...t, status: t.statusId ? (statusMap.get(t.statusId) ?? null) : null }));

  return <MyTasksView tasks={myTasks} workspaceSlug={slug} />;
}
