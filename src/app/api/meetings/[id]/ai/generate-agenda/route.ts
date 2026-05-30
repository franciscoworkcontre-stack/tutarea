import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, meeting.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as {
    objective: string;
    duration: number;
    type: string;
  };

  const { objective, duration, type } = body;

  if (!objective || !duration || !type) {
    return NextResponse.json({ error: "objective, duration, and type are required" }, { status: 400 });
  }

  const systemPrompt = `You are an expert meeting facilitator. Generate a structured meeting agenda as a JSON array.
Each item should have: title (string), durationMin (number), itemType (one of: discussion, decision, update, brainstorm, qa), notes (string, optional brief description).
The total duration of all items should not exceed the specified meeting duration.
Respond with ONLY a valid JSON array, no markdown, no explanation.`;

  const userPrompt = `Generate an agenda for a ${type} meeting.
Objective: ${objective}
Total duration: ${duration} minutes
Meeting type: ${type}

Return a JSON array of agenda items.`;

  const stream = await anthropic.messages.stream({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
