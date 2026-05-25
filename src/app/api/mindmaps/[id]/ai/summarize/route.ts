import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { mindmaps, mindmapNodes, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

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

async function getDescendants(mindmapId: string, nodeId: string) {
  const all: (typeof mindmapNodes.$inferSelect)[] = [];
  const queue = [nodeId];
  while (queue.length) {
    const parentId = queue.shift()!;
    const children = await db.query.mindmapNodes.findMany({
      where: and(
        eq(mindmapNodes.mindmapId, mindmapId),
        eq(mindmapNodes.parentNodeId, parentId)
      ),
    });
    all.push(...children);
    queue.push(...children.map((c) => c.id));
  }
  return all;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const access = await getMindmapAndVerifyAccess(id, user.id);
  if ("error" in access) return access.error;

  const body = (await request.json()) as { nodeId: string };

  if (!body.nodeId) {
    return NextResponse.json({ error: "nodeId is required" }, { status: 400 });
  }

  const node = await db.query.mindmapNodes.findFirst({
    where: and(eq(mindmapNodes.id, body.nodeId), eq(mindmapNodes.mindmapId, id)),
  });

  if (!node) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  const descendants = await getDescendants(id, body.nodeId);

  // Build a readable text representation of the branch
  const childrenOfRoot = descendants.filter((d) => d.parentNodeId === body.nodeId);
  const grandchildren = descendants.filter(
    (d) => d.parentNodeId !== body.nodeId && d.parentNodeId !== null
  );

  const parts: string[] = [`Node: ${node.label}`];
  if (childrenOfRoot.length > 0) {
    parts.push(`Children: [${childrenOfRoot.map((c) => c.label).join(", ")}]`);
  }
  if (grandchildren.length > 0) {
    parts.push(`Grandchildren: [${grandchildren.map((c) => c.label).join(", ")}]`);
  }

  const branchText = parts.join(", ");

  const prompt = `Summarize this branch of a mindmap in ONE concise sentence (max 10 words): ${branchText}`;

  const anthropic = new Anthropic();

  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 100,
    messages: [{ role: "user", content: prompt }],
  });

  const firstBlock = message.content[0];
  const summary = firstBlock?.type === "text" ? firstBlock.text.trim() : "";

  return NextResponse.json({ summary });
}
