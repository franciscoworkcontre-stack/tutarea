import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { workspaces, workspaceMembers, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import AppShell from "@/components/layout/app-shell";

type Props = {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
};

export default async function WorkspaceLayout({ children, params }: Props) {
  const { workspace: slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);

  if (!workspace) redirect("/app");

  const [membership] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, workspace.id),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);

  if (!membership) redirect("/app");

  const workspaceProjects = await db.select().from(projects).where(and(
    eq(projects.workspaceId, workspace.id),
    eq(projects.status, "active")
  )).orderBy(projects.position);

  return (
    <AppShell
      workspace={workspace}
      role={membership.role}
      projects={workspaceProjects}
      userId={user.id}
    >
      {children}
    </AppShell>
  );
}
