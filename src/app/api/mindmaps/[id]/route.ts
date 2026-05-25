import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { mindmaps, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const mindmap = await db.query.mindmaps.findFirst({
    where: eq(mindmaps.id, id),
    with: {
      nodes: true,
    },
  });

  if (!mindmap) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, mindmap.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ mindmap });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const mindmap = await db.query.mindmaps.findFirst({
    where: eq(mindmaps.id, id),
  });

  if (!mindmap) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, mindmap.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as Partial<{
    title: string;
    description: string;
    status: "draft" | "active" | "archived";
  }>;

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (body.title !== undefined) updateData["title"] = body.title;
  if (body.description !== undefined) updateData["description"] = body.description;
  if (body.status !== undefined) updateData["status"] = body.status;

  const [updated] = await db
    .update(mindmaps)
    .set(updateData)
    .where(eq(mindmaps.id, id))
    .returning();

  return NextResponse.json({ mindmap: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const mindmap = await db.query.mindmaps.findFirst({
    where: eq(mindmaps.id, id),
  });

  if (!mindmap) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, mindmap.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(mindmaps).where(eq(mindmaps.id, id));

  return NextResponse.json({ success: true });
}
