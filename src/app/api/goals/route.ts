import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { goals, keyResults, workspaceMembers } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  const status = searchParams.get("status");
  const projectId = searchParams.get("projectId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const conditions = [eq(goals.workspaceId, workspaceId)];

  if (status) {
    const validStatuses = ["draft", "active", "at_risk", "achieved", "cancelled"] as const;
    if (validStatuses.includes(status as (typeof validStatuses)[number])) {
      conditions.push(
        eq(goals.status, status as (typeof validStatuses)[number])
      );
    }
  }

  if (projectId) {
    conditions.push(eq(goals.projectId, projectId));
  }

  const goalsRaw = await db.select().from(goals).where(and(...conditions)).orderBy(desc(goals.createdAt));
  const goalIds = goalsRaw.map((g) => g.id);
  const allKeyResults = goalIds.length > 0
    ? await db.select().from(keyResults).where(inArray(keyResults.goalId, goalIds))
    : [];
  const goalsWithKRs = goalsRaw.map((g) => ({ ...g, keyResults: allKeyResults.filter((kr) => kr.goalId === g.id) }));

  return NextResponse.json({ goals: goalsWithKRs });
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
    title: string;
    description?: string;
    ownerUserId?: string;
    startDate?: string;
    dueDate?: string;
  };

  if (!body.workspaceId || !body.title) {
    return NextResponse.json(
      { error: "workspaceId and title required" },
      { status: 400 }
    );
  }

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, body.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [goal] = await db
    .insert(goals)
    .values({
      workspaceId: body.workspaceId,
      projectId: body.projectId ?? null,
      title: body.title,
      description: body.description ?? null,
      ownerUserId: body.ownerUserId ?? user.id,
      startDate: body.startDate ? new Date(body.startDate) : null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json({ goal }, { status: 201 });
}
