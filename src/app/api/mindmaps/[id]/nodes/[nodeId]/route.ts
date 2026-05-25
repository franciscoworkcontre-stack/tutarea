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
    content: string | null;
    color: string;
    positionX: number;
    positionY: number;
    parentNodeId: string | null;
    styleJsonb: Record<string, unknown>;
    positionOverrideJsonb: Record<string, unknown> | null;
    orderInParent: number;
    metadataJsonb: Record<string, unknown>;
    linkedTaskId: string | null;
  }>;

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (body.label !== undefined) updateData["label"] = body.label;
  if (body.content !== undefined) updateData["content"] = body.content;
  if (body.color !== undefined) updateData["color"] = body.color;
  if (body.positionX !== undefined) updateData["positionX"] = body.positionX;
  if (body.positionY !== undefined) updateData["positionY"] = body.positionY;
  if (body.parentNodeId !== undefined) updateData["parentNodeId"] = body.parentNodeId;
  if (body.styleJsonb !== undefined) updateData["styleJsonb"] = body.styleJsonb;
  if (body.positionOverrideJsonb !== undefined) updateData["positionOverrideJsonb"] = body.positionOverrideJsonb;
  if (body.orderInParent !== undefined) updateData["orderInParent"] = body.orderInParent;
  if (body.metadataJsonb !== undefined) updateData["metadataJsonb"] = body.metadataJsonb;
  if (body.linkedTaskId !== undefined) updateData["linkedTaskId"] = body.linkedTaskId;

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

  return NextResponse.json({ success: true, deleted: idsToDelete.length });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { nodeId } = await params;

  const result = await getNodeAndVerifyAccess(nodeId, user.id);
  if (result.error) return result.error;

  const body = (await request.json()) as Record<string, unknown>;

  // Legacy action-based API (collapse / expand / link-task)
  if ("action" in body && typeof body.action === "string") {
    const action = body.action;

    if (action === "collapse" || action === "expand") {
      const userId = body.userId as string;
      const currentCollapsedBy = (result.node.collapsedByJsonb ?? []) as string[];
      let updatedCollapsedBy: string[];

      if (action === "collapse") {
        updatedCollapsedBy = currentCollapsedBy.includes(userId)
          ? currentCollapsedBy
          : [...currentCollapsedBy, userId];
      } else {
        updatedCollapsedBy = currentCollapsedBy.filter((uid) => uid !== userId);
      }

      const [updated] = await db
        .update(mindmapNodes)
        .set({ collapsedByJsonb: updatedCollapsedBy, updatedAt: new Date() })
        .where(eq(mindmapNodes.id, nodeId))
        .returning();

      return NextResponse.json({ node: updated });
    }

    if (action === "link-task") {
      const linkedTaskId = (body.linkedTaskId as string | null) ?? null;
      const [updated] = await db
        .update(mindmapNodes)
        .set({ linkedTaskId, updatedAt: new Date() })
        .where(eq(mindmapNodes.id, nodeId))
        .returning();

      return NextResponse.json({ node: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Generic field-update API: accepts any subset of allowed fields directly
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if ("content" in body) updateData["content"] = body.content ?? null;
  if ("color" in body && body.color !== undefined) updateData["color"] = body.color;
  if ("label" in body && body.label !== undefined) updateData["label"] = body.label;
  if ("linkedTaskId" in body) updateData["linkedTaskId"] = body.linkedTaskId ?? null;
  if ("styleJsonb" in body && body.styleJsonb !== undefined) updateData["styleJsonb"] = body.styleJsonb;
  if ("positionX" in body && body.positionX !== undefined) updateData["positionX"] = body.positionX;
  if ("positionY" in body && body.positionY !== undefined) updateData["positionY"] = body.positionY;
  if ("parentNodeId" in body) updateData["parentNodeId"] = body.parentNodeId ?? null;
  if ("orderInParent" in body && body.orderInParent !== undefined) updateData["orderInParent"] = body.orderInParent;

  if (Object.keys(updateData).length === 1) {
    // Only updatedAt — nothing to update
    return NextResponse.json({ node: result.node });
  }

  const [updated] = await db
    .update(mindmapNodes)
    .set(updateData)
    .where(eq(mindmapNodes.id, nodeId))
    .returning();

  return NextResponse.json({ node: updated });
}
