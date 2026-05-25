import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { mindmaps, mindmapNodes, workspaceMembers } from "@/db/schema";
import { eq, and, max } from "drizzle-orm";

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
  });

  if (!mindmap) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, mindmap.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const nodes = await db.query.mindmapNodes.findMany({
    where: eq(mindmapNodes.mindmapId, id),
    orderBy: [mindmapNodes.nodeOrder],
  });

  return NextResponse.json({ nodes });
}

export async function POST(
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

  const body = (await request.json()) as {
    label: string;
    parentNodeId?: string;
    color?: string;
    positionX?: number;
    positionY?: number;
    linkedTaskId?: string;
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
    : and(
        eq(mindmapNodes.mindmapId, id)
      );

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
      linkedTaskId: body.linkedTaskId ?? null,
    })
    .returning();

  return NextResponse.json({ node }, { status: 201 });
}
