import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { dashboards, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId)
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  // Check membership
  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let rows = await db.query.dashboards.findMany({
    where: eq(dashboards.workspaceId, workspaceId),
    orderBy: [dashboards.createdAt],
  });

  // Auto-create default if none exist
  if (rows.length === 0) {
    const inserted = await db
      .insert(dashboards)
      .values({
        workspaceId,
        name: "Dashboard principal",
        isDefault: true,
        createdBy: user.id,
      })
      .returning();
    rows = inserted;
  }

  return NextResponse.json({ dashboards: rows });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    workspaceId: string;
    projectId?: string;
    name: string;
    isDefault?: boolean;
  };

  if (!body.workspaceId || !body.name)
    return NextResponse.json({ error: "workspaceId and name required" }, { status: 400 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, body.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const inserted = await db
    .insert(dashboards)
    .values({
      workspaceId: body.workspaceId,
      projectId: body.projectId ?? null,
      name: body.name,
      isDefault: body.isDefault ?? false,
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json({ dashboard: inserted[0] }, { status: 201 });
}
