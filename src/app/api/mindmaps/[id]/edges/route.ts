import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { mindmaps, mindmapNodes, mindmapEdges, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

async function getMindmapAndVerifyAccess(
  id: string,
  userId: string
): Promise<
  | { error: NextResponse; mindmap?: never }
  | { error?: never; mindmap: typeof mindmaps.$inferSelect }
> {
  const mindmap = await db.query.mindmaps.findFirst({
    where: eq(mindmaps.id, id),
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

  return { mindmap };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const result = await getMindmapAndVerifyAccess(id, user.id);
  if (result.error) return result.error;

  const edges = await db.query.mindmapEdges.findMany({
    where: eq(mindmapEdges.mindmapId, id),
  });

  return NextResponse.json({ edges });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const result = await getMindmapAndVerifyAccess(id, user.id);
  if (result.error) return result.error;

  const body = (await request.json()) as {
    sourceId: string;
    targetId: string;
    styleJsonb?: Record<string, unknown>;
  };

  if (!body.sourceId || !body.targetId) {
    return NextResponse.json({ error: "sourceId and targetId required" }, { status: 400 });
  }

  // Verify both nodes belong to this mindmap
  const [sourceNode, targetNode] = await Promise.all([
    db.query.mindmapNodes.findFirst({
      where: and(eq(mindmapNodes.id, body.sourceId), eq(mindmapNodes.mindmapId, id)),
    }),
    db.query.mindmapNodes.findFirst({
      where: and(eq(mindmapNodes.id, body.targetId), eq(mindmapNodes.mindmapId, id)),
    }),
  ]);

  if (!sourceNode || !targetNode) {
    return NextResponse.json({ error: "Source or target node not found in this mindmap" }, { status: 400 });
  }

  const [edge] = await db
    .insert(mindmapEdges)
    .values({
      mindmapId: id,
      sourceId: body.sourceId,
      targetId: body.targetId,
      isHierarchical: false, // cross-link edges are non-hierarchical
      styleJsonb: body.styleJsonb ?? {},
    })
    .returning();

  return NextResponse.json({ edge }, { status: 201 });
}
