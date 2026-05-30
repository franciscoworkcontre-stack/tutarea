import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { mindmaps, mindmapNodes, workspaceMembers } from "@/db/schema";
import { eq, and, max } from "drizzle-orm";

type NodeRow = typeof mindmapNodes.$inferSelect;
type NodeWithChildren = NodeRow & { children: NodeWithChildren[] };

function buildTree(nodes: NodeRow[]): NodeWithChildren[] {
  const map = new Map<string, NodeWithChildren>();
  const roots: NodeWithChildren[] = [];

  for (const node of nodes) {
    map.set(node.id, { ...node, children: [] });
  }

  for (const node of nodes) {
    const withChildren = map.get(node.id)!;
    if (node.parentNodeId) {
      const parent = map.get(node.parentNodeId);
      if (parent) {
        parent.children.push(withChildren);
      } else {
        roots.push(withChildren);
      }
    } else {
      roots.push(withChildren);
    }
  }

  // Sort children by orderInParent
  for (const node of map.values()) {
    node.children.sort((a, b) => a.orderInParent - b.orderInParent);
  }

  return roots;
}

async function getMindmapAndVerifyAccess(
  id: string,
  userId: string
): Promise<
  | { error: NextResponse; mindmap?: never }
  | { error?: never; mindmap: typeof mindmaps.$inferSelect }
> {
  const [mindmap] = await db.select().from(mindmaps).where(eq(mindmaps.id, id)).limit(1);

  if (!mindmap) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, mindmap.workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    )
    .limit(1);

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

  const nodes = await db
    .select()
    .from(mindmapNodes)
    .where(eq(mindmapNodes.mindmapId, id))
    .orderBy(mindmapNodes.orderInParent);

  const tree = buildTree(nodes);

  return NextResponse.json({ nodes, tree });
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
    label: string;
    parentNodeId?: string;
    color?: string;
    styleJsonb?: Record<string, unknown>;
    positionX?: number;
    positionY?: number;
    orderInParent?: number;
  };

  if (!body.label) {
    return NextResponse.json({ error: "label required" }, { status: 400 });
  }

  // Calculate nodeOrder: max order among siblings + 1
  const siblingCondition = body.parentNodeId
    ? and(
        eq(mindmapNodes.mindmapId, id),
        eq(mindmapNodes.parentNodeId, body.parentNodeId)
      )
    : eq(mindmapNodes.mindmapId, id);

  const [maxResult] = await db
    .select({ maxOrder: max(mindmapNodes.nodeOrder) })
    .from(mindmapNodes)
    .where(siblingCondition);

  const nodeOrder = (maxResult?.maxOrder ?? -1) + 1;

  const [node] = await db
    .insert(mindmapNodes)
    .values({
      mindmapId: id,
      parentNodeId: body.parentNodeId ?? null,
      label: body.label,
      color: body.color ?? "#94a3b8",
      positionX: body.positionX ?? 0,
      positionY: body.positionY ?? 0,
      nodeOrder,
      orderInParent: body.orderInParent ?? nodeOrder,
      styleJsonb: body.styleJsonb ?? {},
    })
    .returning();

  return NextResponse.json({ node }, { status: 201 });
}
