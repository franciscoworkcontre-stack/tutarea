import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { sprints, sprintTasks, tasks, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ sprintId: string }> };

export async function POST(req: Request, { params }: Params) {
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
        with: { task: { with: { status: true } } },
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

  if (sprint.status !== "active") {
    return NextResponse.json(
      { error: "Only active sprints can be completed" },
      { status: 400 }
    );
  }

  const body = (await req.json()) as { moveIncompleteToSprintId?: string };

  // Separate done vs incomplete tasks
  const doneTasks = sprint.sprintTasks.filter(
    (st) => st.task.status?.type === "done"
  );
  const incompleteTasks = sprint.sprintTasks.filter(
    (st) => st.task.status?.type !== "done"
  );

  // Velocity = sum of story points for done tasks
  const velocity = doneTasks.reduce(
    (sum, st) => sum + (st.storyPoints ?? 0),
    0
  );

  // If moveIncompleteToSprintId is provided, move incomplete tasks there
  if (body.moveIncompleteToSprintId && incompleteTasks.length > 0) {
    const targetSprint = await db.query.sprints.findFirst({
      where: eq(sprints.id, body.moveIncompleteToSprintId),
    });

    if (!targetSprint || targetSprint.projectId !== sprint.projectId) {
      return NextResponse.json(
        { error: "Target sprint not found in this project" },
        { status: 400 }
      );
    }

    // Insert incomplete tasks into target sprint
    await Promise.all(
      incompleteTasks.map((st) =>
        db
          .insert(sprintTasks)
          .values({
            sprintId: body.moveIncompleteToSprintId!,
            taskId: st.taskId,
            addedBy: user.id,
            storyPoints: st.storyPoints,
          })
          .onConflictDoNothing()
      )
    );
  }
  // Otherwise incomplete tasks stay in backlog (just removed from sprint)
  // sprintTasks cascade deletes when sprint is completed — we keep them as records
  // but the sprint status change signals backlog

  // Update sprint to completed
  const [completed] = await db
    .update(sprints)
    .set({
      status: "completed",
      completedAt: new Date(),
      velocity,
      updatedAt: new Date(),
    })
    .where(eq(sprints.id, sprintId))
    .returning();

  return NextResponse.json({
    sprint: completed,
    movedTasks: body.moveIncompleteToSprintId ? incompleteTasks.length : 0,
    doneTasks: doneTasks.length,
    velocity,
  });
}
