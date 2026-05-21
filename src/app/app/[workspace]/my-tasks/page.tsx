import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { tasks, workspaces, workspaceMembers } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import MyTasksView from "@/components/tasks/my-tasks-view";

type Props = {
  params: Promise<{ workspace: string }>;
};

export default async function MyTasksPage({ params }: Props) {
  const { workspace: slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, slug),
  });

  if (!workspace) redirect("/app");

  const myTasks = await db.query.tasks.findMany({
    where: and(
      eq(tasks.assigneeId, user.id),
      eq(tasks.workspaceId, workspace.id),
      isNull(tasks.archivedAt)
    ),
    with: { status: true },
    orderBy: [tasks.dueDate],
  });

  return <MyTasksView tasks={myTasks} workspaceSlug={slug} />;
}
