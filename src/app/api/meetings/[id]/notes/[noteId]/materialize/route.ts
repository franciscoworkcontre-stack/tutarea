import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, meetingNotes, tasks, taskStatuses, projects, workspaceMembers } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, noteId } = await params;

  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, meeting.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [note] = await db.select().from(meetingNotes).where(and(
    eq(meetingNotes.id, noteId),
    eq(meetingNotes.meetingId, id)
  )).limit(1);
  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });

  if (note.noteType !== "action_item") {
    return NextResponse.json({ error: "Only action_item notes can be materialized" }, { status: 422 });
  }

  if (note.materializedTaskId) {
    return NextResponse.json({ error: "Note already has a materialized task" }, { status: 422 });
  }

  // Get the project info for key generation
  const [project] = await db.select().from(projects).where(eq(projects.id, meeting.projectId)).limit(1);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Get the 'todo' status for this project
  const [todoStatus] = await db.select().from(taskStatuses).where(and(
    eq(taskStatuses.projectId, meeting.projectId),
    eq(taskStatuses.type, "todo")
  )).limit(1);

  // Count existing tasks in the project for key generation
  const countResult = await db
    .select({ value: count() })
    .from(tasks)
    .where(eq(tasks.projectId, meeting.projectId));

  const taskCount = countResult[0]?.value ?? 0;
  const taskKey = `${project.key}-${Number(taskCount) + 1}`;
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

  if (!task) return NextResponse.json({ error: "Failed to create task" }, { status: 500 });

  const [updatedNote] = await db
    .update(meetingNotes)
    .set({ materializedTaskId: task.id, updatedAt: new Date() })
    .where(eq(meetingNotes.id, noteId))
    .returning();

  return NextResponse.json({ task, note: updatedNote }, { status: 201 });
}
