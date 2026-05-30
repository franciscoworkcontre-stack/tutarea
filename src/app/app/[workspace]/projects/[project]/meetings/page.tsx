import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, meetingAttendees, meetingAgendaItems, meetingAttachments, meetingNotes, meetingPreQuestions, projects, workspaceMembers } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import MeetingList from "@/components/meetings/meeting-list";
import type { MeetingWithDetails } from "@/lib/meetings/meeting-types";

type Props = {
  params: Promise<{ workspace: string; project: string }>;
};

export default async function MeetingsPage({ params }: Props) {
  const { workspace: workspaceSlug, project: projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  try {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

    if (!project) redirect(`/app/${workspaceSlug}/projects`);

    const [member] = await db.select().from(workspaceMembers).where(and(
      eq(workspaceMembers.workspaceId, project.workspaceId),
      eq(workspaceMembers.userId, user.id)
    )).limit(1);

    if (!member) redirect(`/app/${workspaceSlug}`);

    const meetingRows = await db.select().from(meetings).where(eq(meetings.projectId, projectId));
    const meetingIds = meetingRows.map(m => m.id);
    const [attendees, agendaItems, attachments, notes, preQuestions] = meetingIds.length > 0
      ? await Promise.all([
          db.select().from(meetingAttendees).where(inArray(meetingAttendees.meetingId, meetingIds)),
          db.select().from(meetingAgendaItems).where(inArray(meetingAgendaItems.meetingId, meetingIds)),
          db.select().from(meetingAttachments).where(inArray(meetingAttachments.meetingId, meetingIds)),
          db.select().from(meetingNotes).where(inArray(meetingNotes.meetingId, meetingIds)),
          db.select().from(meetingPreQuestions).where(inArray(meetingPreQuestions.meetingId, meetingIds)),
        ])
      : [[], [], [], [], []];
    const projectMeetings = meetingRows.map(m => ({
      ...m,
      attendees: attendees.filter(a => a.meetingId === m.id),
      agendaItems: agendaItems.filter(a => a.meetingId === m.id),
      attachments: attachments.filter(a => a.meetingId === m.id),
      notes: notes.filter(n => n.meetingId === m.id),
      preQuestions: preQuestions.filter(q => q.meetingId === m.id),
    }));

    const canCreate = member.role !== "viewer";

    // Serialize Date objects so they can be passed to Client Components
    const serializedMeetings = JSON.parse(JSON.stringify(projectMeetings)) as MeetingWithDetails[];

    return (
      <MeetingList
        projectId={projectId}
        workspaceSlug={workspaceSlug}
        workspaceId={project.workspaceId}
        initialMeetings={serializedMeetings}
        canCreate={canCreate}
      />
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return (
      <div className="p-6 text-sm text-red-400 font-mono whitespace-pre-wrap">
        Error en Meetings: {message}
      </div>
    );
  }
}
