import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, meetingNotes, tasks, taskStatuses, projects, workspaceMembers } from "@/db/schema";
import { eq, and, inArray, count } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const meeting = await db.query.meetings.findFirst({
    where: eq(meetings.id, id),
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, meeting.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as { noteIds: string[] };
  const { noteIds } = body;

  if (!Array.isArray(noteIds) || noteIds.length === 0) {
    return NextResponse.json({ error: "noteIds array is required" }, { status: 400 });
  }

  // Get all requested notes that are action_items without a materialized task
  const notes = await db.query.meetingNotes.findMany({
    where: and(
      eq(meetingNotes.meetingId, id),
      inArray(meetingNotes.id, noteIds)
    ),
  });

  const notesToMaterialize = notes.filter(
    (n) => n.noteType === "action_item" && !n.materializedTaskId
  );

  if (notesToMaterialize.length === 0) {
    return NextResponse.json({ materialized: 0, tasks: [] });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, meeting.projectId),
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const todoStatus = await db.query.taskStatuses.findFirst({
    where: and(
      eq(taskStatuses.projectId, meeting.projectId),
      eq(taskStatuses.type, "todo")
    ),
  });

  const countResult = await db
    .select({ value: count() })
    .from(tasks)
    .where(eq(tasks.projectId, meeting.projectId));

  const createdTasks = [];
  let counter = Number(countResult[0]?.value ?? 0);

  for (const note of notesToMaterialize) {
    counter++;
    const taskKey = `${project.key}-${counter}`;
    const position = generateKeyBetween(null, null);

    const [task] = await db
      .insert(tasks)
      .values({
        projectId: meeting.projectId,
        workspaceId: meeting.workspaceId,
        key: taskKey,
        title: note.contentMd,
        statusId: todoStatus?.id ?? null,
        assigneeId: note.assigneeId ?? null,
        dueDate: note.dueDate ?? null,
        position,
        createdBy: user.id,
      })
      .returning();

    if (task) {
      await db
        .update(meetingNotes)
        .set({ materializedTaskId: task.id, updatedAt: new Date() })
        .where(eq(meetingNotes.id, note.id));
      createdTasks.push(task);
    }
  }

  return NextResponse.json({ materialized: createdTasks.length, tasks: createdTasks });
}
