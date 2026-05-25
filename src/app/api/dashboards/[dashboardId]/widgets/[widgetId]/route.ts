import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { dashboards, dashboardWidgets, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ dashboardId: string; widgetId: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { dashboardId, widgetId } = await params;
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

  const body = (await request.json()) as {
    title?: string;
    configJsonb?: Record<string, unknown>;
    positionX?: number;
    positionY?: number;
    width?: number;
    height?: number;
  };

  const updated = await db
    .update(dashboardWidgets)
    .set({
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.configJsonb !== undefined ? { configJsonb: body.configJsonb } : {}),
      ...(body.positionX !== undefined ? { positionX: body.positionX } : {}),
      ...(body.positionY !== undefined ? { positionY: body.positionY } : {}),
      ...(body.width !== undefined ? { width: body.width } : {}),
      ...(body.height !== undefined ? { height: body.height } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(dashboardWidgets.id, widgetId),
        eq(dashboardWidgets.dashboardId, dashboardId)
      )
    )
    .returning();

  if (!updated[0]) return NextResponse.json({ error: "Widget not found" }, { status: 404 });

  return NextResponse.json({ widget: updated[0] });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { dashboardId, widgetId } = await params;
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

  await db
    .delete(dashboardWidgets)
    .where(
      and(
        eq(dashboardWidgets.id, widgetId),
        eq(dashboardWidgets.dashboardId, dashboardId)
      )
    );

  return NextResponse.json({ success: true });
}
