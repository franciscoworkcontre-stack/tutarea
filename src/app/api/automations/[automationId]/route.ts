import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { automations, automationRuns, workspaceMembers } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ automationId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { automationId } = await params;

  const [automation] = await db.select().from(automations).where(eq(automations.id, automationId)).limit(1);
  if (!automation)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, automation.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const runs = await db
    .select()
    .from(automationRuns)
    .where(eq(automationRuns.automationId, automationId))
    .orderBy(desc(automationRuns.runAt))
    .limit(10);

  return NextResponse.json({ automation, runs });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ automationId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { automationId } = await params;

  const [existing] = await db.select().from(automations).where(eq(automations.id, automationId)).limit(1);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, existing.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as Partial<{
    name: string;
    description: string | null;
    triggerType: string;
    triggerConfigJsonb: Record<string, unknown>;
    conditionsJsonb: Array<{ field: string; operator: string; value: unknown }>;
    actionsJsonb: Array<{ type: string; config: Record<string, unknown> }>;
    isActive: boolean;
  }>;

  const updateData: Partial<typeof automations.$inferInsert> & {
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.triggerType !== undefined)
    updateData.triggerType = body.triggerType as typeof automations.$inferInsert["triggerType"];
  if (body.triggerConfigJsonb !== undefined)
    updateData.triggerConfigJsonb = body.triggerConfigJsonb;
  if (body.conditionsJsonb !== undefined)
    updateData.conditionsJsonb = body.conditionsJsonb;
  if (body.actionsJsonb !== undefined)
    updateData.actionsJsonb = body.actionsJsonb;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;

  const [updated] = await db
    .update(automations)
    .set(updateData)
    .where(eq(automations.id, automationId))
    .returning();

  return NextResponse.json({ automation: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ automationId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { automationId } = await params;

  const [existing] = await db.select().from(automations).where(eq(automations.id, automationId)).limit(1);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, existing.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(automations).where(eq(automations.id, automationId));

  return NextResponse.json({ success: true });
}
