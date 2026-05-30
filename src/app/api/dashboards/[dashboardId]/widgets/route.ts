import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { dashboards, dashboardWidgets, workspaceMembers } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

type WidgetType = InferSelectModel<typeof dashboardWidgets>["type"];

type Params = { params: Promise<{ dashboardId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { dashboardId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [dashboard] = await db.select().from(dashboards).where(eq(dashboards.id, dashboardId)).limit(1);
  if (!dashboard) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, dashboard.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const widgets = await db
    .select()
    .from(dashboardWidgets)
    .where(eq(dashboardWidgets.dashboardId, dashboardId))
    .orderBy(asc(dashboardWidgets.positionY), asc(dashboardWidgets.positionX));

  return NextResponse.json({ widgets });
}

export async function POST(request: Request, { params }: Params) {
  const { dashboardId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [dashboard] = await db.select().from(dashboards).where(eq(dashboards.id, dashboardId)).limit(1);
  if (!dashboard) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, dashboard.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as {
    type: WidgetType;
    title: string;
    configJsonb?: Record<string, unknown>;
    positionX?: number;
    positionY?: number;
    width?: number;
    height?: number;
  };

  if (!body.type || !body.title)
    return NextResponse.json({ error: "type and title required" }, { status: 400 });

  const inserted = await db
    .insert(dashboardWidgets)
    .values({
      dashboardId,
      type: body.type,
      title: body.title,
      configJsonb: body.configJsonb ?? {},
      positionX: body.positionX ?? 0,
      positionY: body.positionY ?? 0,
      width: body.width ?? 4,
      height: body.height ?? 2,
    })
    .returning();

  return NextResponse.json({ widget: inserted[0] }, { status: 201 });
}
