import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { mindmaps, mindmapNodes, projects, workspaceMembers } from "@/db/schema";
import { eq, and, desc, count, inArray } from "drizzle-orm";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, project.workspaceId),
        eq(workspaceMembers.userId, user.id)
      )
    )
    .limit(1);

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const results = await db
    .select()
    .from(mindmaps)
    .where(eq(mindmaps.projectId, projectId))
    .orderBy(desc(mindmaps.createdAt));

  // Get node counts per mindmap
  const mindmapIds = results.map((m) => m.id);
  const nodeCounts =
    mindmapIds.length > 0
      ? await db
          .select({ mindmapId: mindmapNodes.mindmapId, nodeCount: count() })
          .from(mindmapNodes)
          .where(inArray(mindmapNodes.mindmapId, mindmapIds))
          .groupBy(mindmapNodes.mindmapId)
      : [];

  // Build a lookup map
  const nodeCountMap = new Map(nodeCounts.map((r) => [r.mindmapId, Number(r.nodeCount)]));

  const mindmapsWithCount = results.map((m) => ({
    ...m,
    nodeCount: nodeCountMap.get(m.id) ?? 0,
  }));

  return NextResponse.json({ mindmaps: mindmapsWithCount });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    projectId: string;
    title: string;
    description?: string;
    layout?: "radial" | "tree-h" | "tree-v";
    theme?: "light" | "dark" | "blueprint" | "sepia";
  };

  if (!body.projectId || !body.title) {
    return NextResponse.json({ error: "projectId and title required" }, { status: 400 });
  }

  const [project] = await db.select().from(projects).where(eq(projects.id, body.projectId)).limit(1);

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, project.workspaceId),
        eq(workspaceMembers.userId, user.id)
      )
    )
    .limit(1);

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [mindmap] = await db
    .insert(mindmaps)
    .values({
      projectId: body.projectId,
      workspaceId: project.workspaceId,
      title: body.title,
      description: body.description ?? null,
      layout: body.layout ?? "radial",
      theme: body.theme ?? "light",
      createdBy: user.id,
    })
    .returning();

  // Create root node automatically
  const [rootNode] = await db
    .insert(mindmapNodes)
    .values({
      mindmapId: mindmap!.id,
      parentNodeId: null,
      label: body.title,
      positionX: 0,
      positionY: 0,
      nodeOrder: 0,
      orderInParent: 0,
    })
    .returning();

  return NextResponse.json({ mindmap, rootNode }, { status: 201 });
}
