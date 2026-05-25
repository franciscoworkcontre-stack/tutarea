import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, meetingAttendees, meetingAgendaItems, meetingAttachments, meetingPreQuestions, workspaceMembers } from "@/db/schema";
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

  const [attendees, agendaItems, attachments, preQuestions] = await Promise.all([
    db.query.meetingAttendees.findMany({ where: eq(meetingAttendees.meetingId, id) }),
    db.query.meetingAgendaItems.findMany({
      where: eq(meetingAgendaItems.meetingId, id),
      orderBy: [asc(meetingAgendaItems.orderIdx)],
    }),
    db.query.meetingAttachments.findMany({ where: eq(meetingAttachments.meetingId, id) }),
    db.query.meetingPreQuestions.findMany({
      where: eq(meetingPreQuestions.meetingId, id),
      orderBy: [asc(meetingPreQuestions.orderIdx)],
    }),
  ]);

  const meetingContext = `
Meeting: ${meeting.title}
Type: ${meeting.type}
Status: ${meeting.status}
Objective: ${meeting.objective ?? "Not specified"}
Duration: ${meeting.durationMin} minutes
Scheduled: ${meeting.scheduledAt ? new Date(meeting.scheduledAt).toISOString() : "Not scheduled"}
Location: ${meeting.location ?? meeting.meetingUrl ?? "Not specified"}
Attendees: ${attendees.length} people

Agenda Items:
${agendaItems.map((item, i) => `${i + 1}. ${item.title} (${item.durationMin ?? "?"}min, ${item.itemType})${item.notesMd ? ": " + item.notesMd : ""}`).join("\n")}

Pre-reading materials:
${attachments.length > 0 ? attachments.map((a) => `- ${a.title}${a.preReadRequired ? " [REQUIRED]" : ""}`).join("\n") : "None"}

Pre-meeting questions:
${preQuestions.length > 0 ? preQuestions.map((q, i) => `${i + 1}. ${q.questionText}`).join("\n") : "None"}
  `.trim();

  const systemPrompt = `You are an expert at preparing meeting briefings. Write concise, actionable briefings that help attendees arrive prepared.`;

  const userPrompt = `Generate a 2-paragraph meeting briefing for the following meeting.
The first paragraph should summarize the meeting purpose and key context.
The second paragraph should outline what attendees should prepare or know before attending.

${meetingContext}`;

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
