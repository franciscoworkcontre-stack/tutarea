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

  const [nodes, edges] = await Promise.all([
    db.select().from(mindmapNodes).where(eq(mindmapNodes.mindmapId, id)).orderBy(mindmapNodes.orderInParent),
    db.select().from(mindmapEdges).where(eq(mindmapEdges.mindmapId, id)),
  ]);

  return NextResponse.json({ mindmap: result.mindmap, nodes, edges });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const result = await getMindmapAndVerifyAccess(id, user.id);
  if (result.error) return result.error;

  const body = (await request.json()) as Partial<{
    title: string;
    description: string | null;
    status: "draft" | "active" | "archived";
    layout: "radial" | "tree-h" | "tree-v";
    theme: "light" | "dark" | "blueprint" | "sepia";
    settingsJsonb: Record<string, unknown>;
  }>;

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (body.title !== undefined) updateData["title"] = body.title;
  if (body.description !== undefined) updateData["description"] = body.description;
  if (body.status !== undefined) updateData["status"] = body.status;
  if (body.layout !== undefined) updateData["layout"] = body.layout;
  if (body.theme !== undefined) updateData["theme"] = body.theme;
  if (body.settingsJsonb !== undefined) updateData["settingsJsonb"] = body.settingsJsonb;

  const [updated] = await db
    .update(mindmaps)
    .set(updateData)
    .where(eq(mindmaps.id, id))
    .returning();

  return NextResponse.json({ mindmap: updated });
}

// PATCH as alias for PUT — accepts partial updates
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return PUT(request, { params });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const result = await getMindmapAndVerifyAccess(id, user.id);
  if (result.error) return result.error;

  await db.delete(mindmaps).where(eq(mindmaps.id, id));

  return NextResponse.json({ success: true });
}
