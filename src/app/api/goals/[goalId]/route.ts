import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { goals, keyResults, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ goalId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { goalId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [goalRow] = await db.select().from(goals).where(eq(goals.id, goalId)).limit(1);

  if (!goalRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, goalRow.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const goalKeyResults = await db.select().from(keyResults).where(eq(keyResults.goalId, goalId));
  const goal = { ...goalRow, keyResults: goalKeyResults };

  return NextResponse.json({ goal });
}

export async function PUT(request: Request, { params }: Params) {
  const { goalId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [goal] = await db.select().from(goals).where(eq(goals.id, goalId)).limit(1);

  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, goal.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    status?: "draft" | "active" | "at_risk" | "achieved" | "cancelled";
    startDate?: string | null;
    dueDate?: string | null;
    ownerUserId?: string;
  };

  const updateData: Partial<typeof goals.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (body.title !== undefined) updateData.title = body.title;
  if (body.description !== undefined) updateData.description = body.description ?? null;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.ownerUserId !== undefined) updateData.ownerUserId = body.ownerUserId;
  if (body.startDate !== undefined)
    updateData.startDate = body.startDate ? new Date(body.startDate) : null;
  if (body.dueDate !== undefined)
    updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;

  const [updated] = await db
    .update(goals)
    .set(updateData)
    .where(eq(goals.id, goalId))
    .returning();

  return NextResponse.json({ goal: updated });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { goalId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [goal] = await db.select().from(goals).where(eq(goals.id, goalId)).limit(1);

  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, goal.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Cascade: delete key results first
  await db.delete(keyResults).where(eq(keyResults.goalId, goalId));
  await db.delete(goals).where(eq(goals.id, goalId));

  return NextResponse.json({ success: true });
}
