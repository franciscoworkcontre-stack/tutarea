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
import { eq, and, desc } from "drizzle-orm";

async function getMindmapAndVerifyAccess(id: string, userId: string) {
  const mindmap = await db.query.mindmaps.findFirst({
    where: eq(mindmaps.id, id),
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
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const access = await getMindmapAndVerifyAccess(id, user.id);
  if ("error" in access) return access.error;

  // Return version list without snapshotJsonb for performance
  const versions = await db
    .select({
      id: mindmapVersions.id,
      mindmapId: mindmapVersions.mindmapId,
      version: mindmapVersions.version,
      createdBy: mindmapVersions.createdBy,
      createdAt: mindmapVersions.createdAt,
    })
    .from(mindmapVersions)
    .where(eq(mindmapVersions.mindmapId, id))
    .orderBy(desc(mindmapVersions.version));

  return NextResponse.json({ versions });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const access = await getMindmapAndVerifyAccess(id, user.id);
  if ("error" in access) return access.error;
  const { mindmap } = access;

  // Fetch full current state
  const [nodes, edges] = await Promise.all([
    db.query.mindmapNodes.findMany({ where: eq(mindmapNodes.mindmapId, id) }),
    db.query.mindmapEdges.findMany({ where: eq(mindmapEdges.mindmapId, id) }),
  ]);

  const nextVersion = mindmap.version + 1;

  const snapshot = {
    mindmap: {
      title: mindmap.title,
      description: mindmap.description,
      layout: mindmap.layout,
      theme: mindmap.theme,
      settingsJsonb: mindmap.settingsJsonb,
    },
    nodes,
    edges,
  };

  const [mindmapVersion] = await db
    .insert(mindmapVersions)
    .values({
      mindmapId: id,
      version: nextVersion,
      snapshotJsonb: snapshot,
      createdBy: user.id,
    })
    .returning();

  // Increment version on the mindmap
  await db
    .update(mindmaps)
    .set({ version: nextVersion, updatedAt: new Date() })
    .where(eq(mindmaps.id, id));

  return NextResponse.json({ version: mindmapVersion }, { status: 201 });
}
