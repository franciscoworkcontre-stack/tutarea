import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { mindmaps, mindmapEdges, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

async function getEdgeAndVerifyAccess(
  edgeId: string,
  userId: string
): Promise<
  | { error: NextResponse; edge?: never; mindmap?: never }
  | { error?: never; edge: typeof mindmapEdges.$inferSelect; mindmap: typeof mindmaps.$inferSelect }
> {
  const [edge] = await db.select().from(mindmapEdges).where(eq(mindmapEdges.id, edgeId)).limit(1);

  if (!edge) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  const [mindmap] = await db.select().from(mindmaps).where(eq(mindmaps.id, edge.mindmapId)).limit(1);

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

  return { edge, mindmap };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; edgeId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { edgeId } = await params;

  const result = await getEdgeAndVerifyAccess(edgeId, user.id);
  if (result.error) return result.error;

  const body = (await request.json()) as {
    styleJsonb?: Record<string, unknown>;
  };

  if (!body.styleJsonb) {
    return NextResponse.json({ error: "styleJsonb required" }, { status: 400 });
  }

  const [updated] = await db
    .update(mindmapEdges)
    .set({ styleJsonb: body.styleJsonb })
    .where(eq(mindmapEdges.id, edgeId))
    .returning();

  return NextResponse.json({ edge: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; edgeId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { edgeId } = await params;

  const result = await getEdgeAndVerifyAccess(edgeId, user.id);
  if (result.error) return result.error;

  await db.delete(mindmapEdges).where(eq(mindmapEdges.id, edgeId));

  return NextResponse.json({ success: true });
}
