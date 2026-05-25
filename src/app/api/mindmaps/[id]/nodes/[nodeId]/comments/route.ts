import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  mindmaps,
  mindmapNodes,
  mindmapNodeComments,
  workspaceMembers,
  profiles,
} from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, nodeId } = await params;

  const access = await verifyAccess(id, user.id);
  if ("error" in access) return access.error;

  const node = await db.query.mindmapNodes.findFirst({
    where: and(eq(mindmapNodes.id, nodeId), eq(mindmapNodes.mindmapId, id)),
  });
  if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });

  // Fetch all comments for this node ordered by createdAt ASC
  const comments = await db
    .select({
      id: mindmapNodeComments.id,
      mindmapId: mindmapNodeComments.mindmapId,
      nodeId: mindmapNodeComments.nodeId,
      userId: mindmapNodeComments.userId,
      content: mindmapNodeComments.content,
      parentCommentId: mindmapNodeComments.parentCommentId,
      createdAt: mindmapNodeComments.createdAt,
      updatedAt: mindmapNodeComments.updatedAt,
      author: {
        id: profiles.id,
        fullName: profiles.fullName,
        avatarUrl: profiles.avatarUrl,
      },
    })
    .from(mindmapNodeComments)
    .leftJoin(profiles, eq(mindmapNodeComments.userId, profiles.id))
    .where(
      and(
        eq(mindmapNodeComments.nodeId, nodeId),
        eq(mindmapNodeComments.mindmapId, id)
      )
    )
    .orderBy(asc(mindmapNodeComments.createdAt));

  // Build nested reply structure
  const topLevel = comments.filter((c) => c.parentCommentId === null);
  const replies = comments.filter((c) => c.parentCommentId !== null);

  type CommentWithReplies = (typeof comments)[number] & {
    replies: CommentWithReplies[];
  };

  function attachReplies(comment: (typeof comments)[number]): CommentWithReplies {
    const children = replies
      .filter((r) => r.parentCommentId === comment.id)
      .map(attachReplies);
    return { ...comment, replies: children };
  }

  const nested = topLevel.map(attachReplies);

  return NextResponse.json({ comments: nested });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, nodeId } = await params;

  const access = await verifyAccess(id, user.id);
  if ("error" in access) return access.error;

  const node = await db.query.mindmapNodes.findFirst({
    where: and(eq(mindmapNodes.id, nodeId), eq(mindmapNodes.mindmapId, id)),
  });
  if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });

  const body = (await request.json()) as { content: string; parentCommentId?: string };

  if (!body.content || body.content.trim().length === 0) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  // Validate parentCommentId if provided
  if (body.parentCommentId) {
    const parent = await db.query.mindmapNodeComments.findFirst({
      where: and(
        eq(mindmapNodeComments.id, body.parentCommentId),
        eq(mindmapNodeComments.nodeId, nodeId)
      ),
    });
    if (!parent) {
      return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
    }
  }

  const [created] = await db
    .insert(mindmapNodeComments)
    .values({
      mindmapId: id,
      nodeId,
      userId: user.id,
      content: body.content.trim(),
      parentCommentId: body.parentCommentId ?? null,
    })
    .returning();

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
  });

  return NextResponse.json(
    {
      comment: {
        ...created,
        author: profile
          ? { id: profile.id, fullName: profile.fullName, avatarUrl: profile.avatarUrl }
          : null,
        replies: [],
      },
    },
    { status: 201 }
  );
}
