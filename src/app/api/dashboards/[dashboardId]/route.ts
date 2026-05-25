import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { dashboards, dashboardWidgets, workspaceMembers } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

type Params = { params: Promise<{ dashboardId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { dashboardId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dashboard = await db.query.dashboards.findFirst({
    where: eq(dashboards.id, dashboardId),
  });
  if (!dashboard) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, dashboard.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const widgets = await db
    .select()
    .from(dashboardWidgets)
    .where(eq(dashboardWidgets.dashboardId, dashboardId))
    .orderBy(asc(dashboardWidgets.positionY), asc(dashboardWidgets.positionX));

  return NextResponse.json({ dashboard, widgets });
}

export async function PUT(request: Request, { params }: Params) {
  const { dashboardId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dashboard = await db.query.dashboards.findFirst({
    where: eq(dashboards.id, dashboardId),
  });
  if (!dashboard) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, dashboard.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as { name?: string; isDefault?: boolean };

  const updated = await db
    .update(dashboards)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
      updatedAt: new Date(),
    })
    .where(eq(dashboards.id, dashboardId))
    .returning();

  return NextResponse.json({ dashboard: updated[0] });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { dashboardId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dashboard = await db.query.dashboards.findFirst({
    where: eq(dashboards.id, dashboardId),
  });
  if (!dashboard) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (dashboard.isDefault)
    return NextResponse.json({ error: "Cannot delete default dashboard" }, { status: 400 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, dashboard.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(dashboards).where(eq(dashboards.id, dashboardId));
  return NextResponse.json({ success: true });
}
