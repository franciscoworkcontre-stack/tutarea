import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { taskComments, tasks, workspaceMembers, profiles } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

type Params = { params: Promise<{ taskId: string }> };

async function verifyAccess(taskId: string, userId: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return null;
  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, task.workspaceId),
    eq(workspaceMembers.userId, userId)
  )).limit(1);
  if (!member) return null;
  return task;
}

export async function GET(_req: Request, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const task = await verifyAccess(taskId, user.id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const comments = await db.select().from(taskComments).where(eq(taskComments.taskId, taskId)).orderBy(desc(taskComments.createdAt));

  const authorIds = [...new Set(comments.map((c) => c.authorId))];
  const authorProfileRows = authorIds.length > 0
    ? await db.select().from(profiles).where(inArray(profiles.id, authorIds))
    : [];
  const profileMap = Object.fromEntries(authorProfileRows.map((p) => [p.id, p]));

  return NextResponse.json({
    comments: comments.map((c) => ({ ...c, author: profileMap[c.authorId] ?? null })),
  });
}

export async function POST(req: Request, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const task = await verifyAccess(taskId, user.id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as { body: string };
  if (!body.body?.trim()) {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }

  const [comment] = await db
    .insert(taskComments)
    .values({ taskId, authorId: user.id, body: body.body.trim() })
    .returning();

  const [author] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);

  return NextResponse.json({ comment: { ...comment, author: author ?? null } }, { status: 201 });
}
