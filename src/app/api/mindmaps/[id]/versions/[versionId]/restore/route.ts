import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  mindmaps,
  mindmapNodes,
  mindmapEdges,
  mindmapVersions,
  workspaceMembers,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";

async function getMindmapAndVerifyAccess(id: string, userId: string) {
  const [mindmap] = await db.select().from(mindmaps).where(eq(mindmaps.id, id)).limit(1);
  if (!mindmap) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };

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
  if (!member) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };

  return { mindmap, member };
}

type SnapshotNode = {
  id: string;
  mindmapId: string;
  parentNodeId: string | null;
  label: string;
  content: string | null;
  color: string;
  positionX: number;
  positionY: number;
  nodeOrder: number;
  linkedTaskId: string | null;
  styleJsonb: Record<string, unknown>;
  positionOverrideJsonb: Record<string, unknown> | null;
  collapsedByJsonb: unknown[];
  orderInParent: number;
  metadataJsonb: Record<string, unknown>;
};

type SnapshotEdge = {
  id: string;
  mindmapId: string;
  sourceId: string;
  targetId: string;
  isHierarchical: boolean;
  styleJsonb: Record<string, unknown> | null;
};

type Snapshot = {
  mindmap: {
    title: string;
    description: string | null;
    layout: "radial" | "tree-h" | "tree-v";
    theme: "light" | "dark" | "blueprint" | "sepia";
    settingsJsonb: Record<string, unknown>;
  };
  nodes: SnapshotNode[];
  edges: SnapshotEdge[];
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, versionId } = await params;

  const access = await getMindmapAndVerifyAccess(id, user.id);
  if ("error" in access) return access.error;
  const { mindmap } = access;

  const [targetVersion] = await db
    .select()
    .from(mindmapVersions)
    .where(and(eq(mindmapVersions.id, versionId), eq(mindmapVersions.mindmapId, id)))
    .limit(1);

  if (!targetVersion) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const snapshot = targetVersion.snapshotJsonb as Snapshot;

  if (!snapshot || !snapshot.nodes || !snapshot.edges || !snapshot.mindmap) {
    return NextResponse.json({ error: "Invalid snapshot data" }, { status: 422 });
  }

  const [currentNodes, currentEdges] = await Promise.all([
    db.select().from(mindmapNodes).where(eq(mindmapNodes.mindmapId, id)),
    db.select().from(mindmapEdges).where(eq(mindmapEdges.mindmapId, id)),
  ]);

  const preRestoreSnapshot: Snapshot = {
    mindmap: {
      title: mindmap.title,
      description: mindmap.description,
      layout: mindmap.layout,
      theme: mindmap.theme,
      settingsJsonb: mindmap.settingsJsonb as Record<string, unknown>,
    },
    nodes: currentNodes as SnapshotNode[],
    edges: currentEdges as SnapshotEdge[],
  };

  const nextVersion = mindmap.version + 1;

  await db.insert(mindmapVersions).values({
    mindmapId: id,
    version: nextVersion,
    snapshotJsonb: preRestoreSnapshot,
    createdBy: user.id,
  });

  await db.delete(mindmapNodes).where(eq(mindmapNodes.mindmapId, id));

  let nodesRestored = 0;
  if (snapshot.nodes.length > 0) {
    await db.insert(mindmapNodes).values(
      snapshot.nodes.map((n) => ({
        id: n.id,
        mindmapId: id,
        parentNodeId: n.parentNodeId,
        label: n.label,
        content: n.content,
        color: n.color,
        positionX: n.positionX,
        positionY: n.positionY,
        nodeOrder: n.nodeOrder,
        linkedTaskId: n.linkedTaskId,
        styleJsonb: n.styleJsonb ?? {},
        positionOverrideJsonb: n.positionOverrideJsonb,
        collapsedByJsonb: n.collapsedByJsonb ?? [],
        orderInParent: n.orderInParent,
        metadataJsonb: n.metadataJsonb ?? {},
      }))
    );
    nodesRestored = snapshot.nodes.length;
  }

  if (snapshot.edges.length > 0) {
    await db.insert(mindmapEdges).values(
      snapshot.edges.map((e) => ({
        id: e.id,
        mindmapId: id,
        sourceId: e.sourceId,
        targetId: e.targetId,
        isHierarchical: e.isHierarchical,
        styleJsonb: e.styleJsonb ?? {},
      }))
    );
  }

  const [updatedMindmap] = await db
    .update(mindmaps)
    .set({
      title: snapshot.mindmap.title,
      description: snapshot.mindmap.description,
      layout: snapshot.mindmap.layout,
      theme: snapshot.mindmap.theme,
      settingsJsonb: snapshot.mindmap.settingsJsonb,
      version: nextVersion + 1,
      updatedAt: new Date(),
    })
    .where(eq(mindmaps.id, id))
    .returning();

  return NextResponse.json({ mindmap: updatedMindmap, nodesRestored });
}
