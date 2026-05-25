import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { mindmaps, workspaceMembers } from "@/db/schema";
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

  const body = (await request.json()) as { objective: string; depth?: number };

  if (!body.objective || body.objective.trim().length === 0) {
    return NextResponse.json({ error: "objective is required" }, { status: 400 });
  }

  const depth = body.depth ?? 2;

  const prompt = `Create a mindmap for: '${body.objective.trim()}'. Generate ${depth} levels of nodes. Return a JSON tree: { label: string, children: [{ label: string, children: [...] }] }. Only return the JSON.`;

  const anthropic = new Anthropic();

  const stream = await anthropic.messages.stream({
    model: "claude-opus-4-5",
    max_tokens: 4096,
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
