import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { taskComments, tasks, workspaceMembers, profiles } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

type Params = { params: Promise<{ taskId: string }> };

async function verifyAccess(taskId: string, userId: string) {
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) return null;
  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, task.workspaceId),
      eq(workspaceMembers.userId, userId)
    ),
  });
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

  const comments = await db.query.taskComments.findMany({
    where: eq(taskComments.taskId, taskId),
    orderBy: [desc(taskComments.createdAt)],
  });

  const authorIds = [...new Set(comments.map((c) => c.authorId))];
  const authorProfiles = await Promise.all(
    authorIds.map((id) => db.query.profiles.findFirst({ where: eq(profiles.id, id) }))
  );
  const profileMap = Object.fromEntries(
    authorIds.map((id, i) => [id, authorProfiles[i] ?? null])
  );

  return NextResponse.json({
    comments: comments.map((c) => ({ ...c, author: profileMap[c.authorId] })),
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

  const author = await db.query.profiles.findFirst({ where: eq(profiles.id, user.id) });

  return NextResponse.json({ comment: { ...comment, author } }, { status: 201 });
}
