import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  mindmaps,
  mindmapNodeComments,
  workspaceMembers,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";

async function verifyAccess(mindmapId: string, userId: string) {
  const mindmap = await db.query.mindmaps.findFirst({
    where: eq(mindmaps.id, mindmapId),
  });
  if (!mindmap) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, mindmap.workspaceId),
      eq(workspaceMembers.userId, userId)
    ),
  });
  if (!member) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };

  return { mindmap, member };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; nodeId: string; commentId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, nodeId, commentId } = await params;

  const access = await verifyAccess(id, user.id);
  if ("error" in access) return access.error;

  const comment = await db.query.mindmapNodeComments.findFirst({
    where: and(
      eq(mindmapNodeComments.id, commentId),
      eq(mindmapNodeComments.nodeId, nodeId),
      eq(mindmapNodeComments.mindmapId, id)
    ),
  });

  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  // Only the author can edit
  if (comment.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden: only the author can edit this comment" }, { status: 403 });
  }

  const body = (await request.json()) as { content: string };

  if (!body.content || body.content.trim().length === 0) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const [updated] = await db
    .update(mindmapNodeComments)
    .set({ content: body.content.trim(), updatedAt: new Date() })
    .where(eq(mindmapNodeComments.id, commentId))
    .returning();

  return NextResponse.json({ comment: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; nodeId: string; commentId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, nodeId, commentId } = await params;

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

  const comment = await db.query.mindmapNodeComments.findFirst({
    where: and(
      eq(mindmapNodeComments.id, commentId),
      eq(mindmapNodeComments.nodeId, nodeId),
      eq(mindmapNodeComments.mindmapId, id)
    ),
  });

  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  // Only the author or a workspace admin can delete
  const isAdmin = member.role === "admin" || member.role === "owner";
  if (comment.userId !== user.id && !isAdmin) {
    return NextResponse.json(
      { error: "Forbidden: only the author or a workspace admin can delete this comment" },
      { status: 403 }
    );
  }

  await db.delete(mindmapNodeComments).where(eq(mindmapNodeComments.id, commentId));

  return NextResponse.json({ success: true });
}
