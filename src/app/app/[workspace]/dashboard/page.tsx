import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { workspaces, dashboards, dashboardWidgets, workspaceMembers } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import DashboardView from "@/components/dashboards/dashboard-view";
import type { InferSelectModel } from "drizzle-orm";

type Workspace = InferSelectModel<typeof workspaces>;
type Dashboard = InferSelectModel<typeof dashboards>;
type Widget = InferSelectModel<typeof dashboardWidgets>;

type Props = {
  params: Promise<{ workspace: string }>;
};

export default async function DashboardPage({ params }: Props) {
  const { workspace: slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);
  if (!workspace) redirect("/app");

  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspace.id),
        eq(workspaceMembers.userId, user.id)
      )
    )
    .limit(1);
  if (!member) redirect("/app");

  let workspaceDashboards = await db
    .select()
    .from(dashboards)
    .where(eq(dashboards.workspaceId, workspace.id))
    .orderBy(dashboards.createdAt);

  if (workspaceDashboards.length === 0) {
    const inserted = await db
      .insert(dashboards)
      .values({
        workspaceId: workspace.id,
        name: "Dashboard principal",
        isDefault: true,
        createdBy: user.id,
      })
      .returning();
    workspaceDashboards = inserted;
  }

  const defaultDashboard =
    workspaceDashboards.find((d) => d.isDefault) ?? workspaceDashboards[0];

  if (!defaultDashboard) redirect("/app");

  const widgets = await db
    .select()
    .from(dashboardWidgets)
    .where(eq(dashboardWidgets.dashboardId, defaultDashboard.id))
    .orderBy(asc(dashboardWidgets.positionY), asc(dashboardWidgets.positionX));

  return (
    <DashboardView
      workspace={workspace as Workspace}
      dashboards={workspaceDashboards as Dashboard[]}
      initialDashboard={defaultDashboard as Dashboard}
      initialWidgets={widgets as Widget[]}
    />
  );
}
