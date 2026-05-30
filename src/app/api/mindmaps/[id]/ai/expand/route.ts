import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { mindmaps, mindmapNodes, workspaceMembers } from "@/db/schema";
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
  const { mindmap } = access;

  const body = (await request.json()) as { nodeId: string; count?: number };

  if (!body.nodeId) {
    return NextResponse.json({ error: "nodeId is required" }, { status: 400 });
  }

  const expandCount = body.count ?? 5;

  const [node] = await db
    .select()
    .from(mindmapNodes)
    .where(and(eq(mindmapNodes.id, body.nodeId), eq(mindmapNodes.mindmapId, id)))
    .limit(1);

  if (!node) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  const siblings = node.parentNodeId
    ? await db
        .select()
        .from(mindmapNodes)
        .where(
          and(
            eq(mindmapNodes.mindmapId, id),
            eq(mindmapNodes.parentNodeId, node.parentNodeId)
          )
        )
    : [];

  const siblingLabels = siblings
    .filter((s) => s.id !== node.id)
    .map((s) => s.label)
    .join(", ");

  const contextNote = siblingLabels ? ` (siblings: ${siblingLabels})` : "";

  const prompt = `Given this mindmap node: '${node.label}'${contextNote} in the context of mindmap '${mindmap.title}', suggest ${expandCount} specific sub-topics or ideas as children nodes. Return a JSON array of strings: ["subtopic1", "subtopic2", ...]. Only return the JSON array.`;

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic();

  const stream = await anthropic.messages.stream({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
