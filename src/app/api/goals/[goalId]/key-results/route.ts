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

  const goal = await db.query.goals.findFirst({
    where: eq(goals.id, goalId),
  });

  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, goal.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const krs = await db.query.keyResults.findMany({
    where: eq(keyResults.goalId, goalId),
  });

  return NextResponse.json({ keyResults: krs });
}

export async function POST(request: Request, { params }: Params) {
  const { goalId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const goal = await db.query.goals.findFirst({
    where: eq(goals.id, goalId),
  });

  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, goal.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as {
    title: string;
    type: "number" | "percentage" | "boolean" | "task_count";
    startValue?: number;
    targetValue: number;
    unit?: string;
    linkedProjectId?: string;
    ownerUserId?: string;
    dueDate?: string;
  };

  if (!body.title || !body.type || body.targetValue === undefined) {
    return NextResponse.json(
      { error: "title, type, and targetValue required" },
      { status: 400 }
    );
  }

  const [kr] = await db
    .insert(keyResults)
    .values({
      goalId,
      title: body.title,
      type: body.type,
      startValue: body.startValue ?? 0,
      targetValue: body.targetValue,
      currentValue: body.startValue ?? 0,
      unit: body.unit ?? null,
      linkedProjectId: body.linkedProjectId ?? null,
      ownerUserId: body.ownerUserId ?? null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
    })
    .returning();

  return NextResponse.json({ keyResult: kr }, { status: 201 });
}
