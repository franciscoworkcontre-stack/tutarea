import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { sprints, sprintTasks, tasks, workspaceMembers, profiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ sprintId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { sprintId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sprint = await db.query.sprints.findFirst({
    where: eq(sprints.id, sprintId),
    with: {
      sprintTasks: {
        with: {
          task: {
            with: { status: true },
          },
        },
      },
    },
  });

  if (!sprint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, sprint.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Enrich with assignee profiles
  const assigneeIds = [
    ...new Set(
      sprint.sprintTasks
        .map((st) => st.task.assigneeId)
        .filter((id): id is string => id !== null)
    ),
  ];

  const assigneeProfiles = await Promise.all(
    assigneeIds.map((id) =>
      db.query.profiles.findFirst({ where: eq(profiles.id, id) })
    )
  );

  const profileMap = new Map(
    assigneeIds.map((id, i) => [id, assigneeProfiles[i] ?? null])
  );

  const sprintTasksWithProfile = sprint.sprintTasks.map((st) => ({
    ...st,
    task: {
      ...st.task,
      assigneeProfile: st.task.assigneeId
        ? (profileMap.get(st.task.assigneeId) ?? null)
        : null,
    },
  }));

  return NextResponse.json({
    sprint: { ...sprint, sprintTasks: sprintTasksWithProfile },
  });
}

export async function PUT(req: Request, { params }: Params) {
  const { sprintId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sprint = await db.query.sprints.findFirst({
    where: eq(sprints.id, sprintId),
  });
  if (!sprint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, sprint.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    name?: string;
    goal?: string;
    startDate?: string | null;
    endDate?: string | null;
    status?: "planned" | "active" | "completed" | "cancelled";
  };

  // If activating, ensure no other sprint is active
  if (body.status === "active") {
    const activeSprint = await db.query.sprints.findFirst({
      where: and(
        eq(sprints.projectId, sprint.projectId),
        eq(sprints.status, "active")
      ),
    });
    if (activeSprint && activeSprint.id !== sprintId) {
      return NextResponse.json(
        { error: "There is already an active sprint in this project" },
        { status: 409 }
      );
    }
  }

  const updates: Partial<typeof sprints.$inferInsert> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.goal !== undefined) updates.goal = body.goal?.trim() ?? null;
  if (body.startDate !== undefined)
    updates.startDate = body.startDate ? new Date(body.startDate) : null;
  if (body.endDate !== undefined)
    updates.endDate = body.endDate ? new Date(body.endDate) : null;
  if (body.status !== undefined) updates.status = body.status;
  updates.updatedAt = new Date();

  const [updated] = await db
    .update(sprints)
    .set(updates)
    .where(eq(sprints.id, sprintId))
    .returning();

  return NextResponse.json({ sprint: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { sprintId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sprint = await db.query.sprints.findFirst({
    where: eq(sprints.id, sprintId),
  });
  if (!sprint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, sprint.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (sprint.status !== "planned") {
    return NextResponse.json(
      { error: "Only planned sprints can be deleted" },
      { status: 400 }
    );
  }

  await db.delete(sprints).where(eq(sprints.id, sprintId));
  return NextResponse.json({ ok: true });
}
