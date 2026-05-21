import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { tasks, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, task.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as Partial<{
    title: string;
    description: string;
    statusId: string;
    priority: string;
    assigneeId: string;
    dueDate: string;
    startDate: string;
    position: string;
    estimateHours: number;
  }>;

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (body.title !== undefined) updateData["title"] = body.title;
  if (body.description !== undefined) updateData["description"] = body.description;
  if (body.statusId !== undefined) updateData["statusId"] = body.statusId;
  if (body.priority !== undefined) updateData["priority"] = body.priority;
  if (body.assigneeId !== undefined) updateData["assigneeId"] = body.assigneeId;
  if (body.dueDate !== undefined) updateData["dueDate"] = body.dueDate ? new Date(body.dueDate) : null;
  if (body.startDate !== undefined) updateData["startDate"] = body.startDate ? new Date(body.startDate) : null;
  if (body.position !== undefined) updateData["position"] = body.position;
  if (body.estimateHours !== undefined) updateData["estimateHours"] = body.estimateHours;

  const [updated] = await db
    .update(tasks)
    .set(updateData)
    .where(eq(tasks.id, id))
    .returning();

  return NextResponse.json({ task: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, task.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.update(tasks)
    .set({ archivedAt: new Date() })
    .where(eq(tasks.id, id));

  return NextResponse.json({ success: true });
}
