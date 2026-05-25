import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { mindmaps, mindmapNodes, workspaceMembers } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getDescendantIds } from "@/lib/mindmaps/mindmap-utils";

async function getNodeAndVerifyAccess(
  nodeId: string,
  userId: string
): Promise<
  | { error: NextResponse; mindmap?: never; node?: never }
  | { error?: never; mindmap: typeof mindmaps.$inferSelect; node: typeof mindmapNodes.$inferSelect }
> {
  const node = await db.query.mindmapNodes.findFirst({
    where: eq(mindmapNodes.id, nodeId),
  });

  if (!node) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  const mindmap = await db.query.mindmaps.findFirst({
    where: eq(mindmaps.id, node.mindmapId),
  });

  if (!mindmap) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, mindmap.workspaceId),
      eq(workspaceMembers.userId, userId)
    ),
  });

  if (!member) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { mindmap, node };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { nodeId } = await params;

  const result = await getNodeAndVerifyAccess(nodeId, user.id);
  if (result.error) return result.error;

  return NextResponse.json({ node: result.node });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { nodeId } = await params;

  const result = await getNodeAndVerifyAccess(nodeId, user.id);
  if (result.error) return result.error;

  const body = (await request.json()) as Partial<{
    label: string;
    content: string;
    color: string;
    positionX: number;
    positionY: number;
    parentNodeId: string | null;
  }>;

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (body.label !== undefined) updateData["label"] = body.label;
  if (body.content !== undefined) updateData["content"] = body.content;
  if (body.color !== undefined) updateData["color"] = body.color;
  if (body.positionX !== undefined) updateData["positionX"] = body.positionX;
  if (body.positionY !== undefined) updateData["positionY"] = body.positionY;
  if (body.parentNodeId !== undefined) updateData["parentNodeId"] = body.parentNodeId;

  const [updated] = await db
    .update(mindmapNodes)
    .set(updateData)
    .where(eq(mindmapNodes.id, nodeId))
    .returning();

  return NextResponse.json({ node: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { nodeId } = await params;

  const result = await getNodeAndVerifyAccess(nodeId, user.id);
  if (result.error) return result.error;

  // Fetch all nodes for this mindmap to find descendants
  const allNodes = await db.query.mindmapNodes.findMany({
    where: eq(mindmapNodes.mindmapId, result.node.mindmapId),
  });
  const descendantIds = getDescendantIds(nodeId, allNodes);
  const idsToDelete = [nodeId, ...descendantIds];

  await db.delete(mindmapNodes).where(inArray(mindmapNodes.id, idsToDelete));

  return NextResponse.json({ success: true });
}
