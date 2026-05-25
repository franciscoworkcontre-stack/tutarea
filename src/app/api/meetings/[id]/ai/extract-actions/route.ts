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

  const existingActionItems = notes.filter((n) => n.noteType === "action_item");
  const generalNotes = notes.filter((n) => n.noteType === "note");

  const meetingContext = `
Meeting: ${meeting.title}
Objective: ${meeting.objective ?? "Not specified"}

Agenda:
${agendaItems.map((item, i) => `${i + 1}. ${item.title} (${item.itemType})${item.notesMd ? ": " + item.notesMd : ""}`).join("\n")}

Notes taken:
${generalNotes.map((n) => `- ${n.contentMd}`).join("\n")}

Existing action items already captured:
${existingActionItems.map((a) => `- ${a.contentMd}`).join("\n") || "None"}
  `.trim();

  const systemPrompt = `You are an expert at identifying action items from meeting notes. Extract implicit commitments, follow-ups, and tasks mentioned in notes that haven't been explicitly captured as action items yet.`;

  const userPrompt = `Analyze the following meeting notes and suggest additional action items that may have been missed.
Do NOT duplicate the existing action items listed.
Return a JSON object with a key "suggestions" containing an array of objects, each with:
- contentMd (string): the action item description
- suggestedAssignee (string|null): name or role hint if mentioned in notes
- estimatedDueHint (string|null): any due date hints mentioned

Respond with ONLY valid JSON, no markdown, no explanation.

${meetingContext}`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const firstBlock = message.content[0];
  const responseText = firstBlock?.type === "text" ? firstBlock.text : "{}";

  let suggestions = [];
  try {
    const parsed = JSON.parse(responseText);
    suggestions = parsed.suggestions ?? [];
  } catch {
    // Try to extract JSON from text
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        suggestions = parsed.suggestions ?? [];
      } catch {
        suggestions = [];
      }
    }
  }

  return NextResponse.json({ suggestions });
}
