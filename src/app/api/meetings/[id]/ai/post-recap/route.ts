import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, meetingNotes, meetingAgendaItems, workspaceMembers } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
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

  const meeting = await db.query.meetings.findFirst({
    where: eq(meetings.id, id),
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, meeting.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [notes, agendaItems] = await Promise.all([
    db.query.meetingNotes.findMany({
      where: eq(meetingNotes.meetingId, id),
      orderBy: [asc(meetingNotes.createdAt)],
    }),
    db.query.meetingAgendaItems.findMany({
      where: eq(meetingAgendaItems.meetingId, id),
      orderBy: [asc(meetingAgendaItems.orderIdx)],
    }),
  ]);

  const generalNotes = notes.filter((n) => n.noteType === "note");
  const decisions = notes.filter((n) => n.noteType === "decision");
  const actionItems = notes.filter((n) => n.noteType === "action_item");

  const meetingContext = `
Meeting: ${meeting.title}
Type: ${meeting.type}
Objective: ${meeting.objective ?? "Not specified"}
Duration: ${meeting.durationMin} minutes

Agenda covered:
${agendaItems.map((item, i) => `${i + 1}. ${item.title} (${item.itemType})`).join("\n")}

Notes (${generalNotes.length}):
${generalNotes.map((n) => `- ${n.contentMd}`).join("\n")}

Decisions made (${decisions.length}):
${decisions.map((d) => `- ${d.contentMd}`).join("\n")}

Action items (${actionItems.length}):
${actionItems.map((a) => `- ${a.contentMd}${a.assigneeId ? ` [assigned]` : ""}${a.dueDate ? ` (due: ${new Date(a.dueDate).toLocaleDateString()})` : ""}`).join("\n")}
  `.trim();

  const systemPrompt = `You are an expert at writing post-meeting recaps. Create structured, clear recaps that help both attendees remember what happened and inform those who couldn't attend.`;

  const userPrompt = `Generate a structured post-meeting recap for the following meeting data.
Structure the recap with these sections:
## Summary
## Key Decisions
## Action Items
## Next Steps (if applicable)

${meetingContext}`;

  const stream = await anthropic.messages.stream({
    model: "claude-opus-4-5",
    max_tokens: 2048,
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
