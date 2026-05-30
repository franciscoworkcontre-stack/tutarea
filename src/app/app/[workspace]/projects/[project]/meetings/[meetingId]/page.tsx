import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, meetingAttendees, meetingAgendaItems, meetingAttachments, meetingNotes, meetingPreQuestions, projects, workspaceMembers, profiles } from "@/db/schema";
import { eq, and, asc, inArray } from "drizzle-orm";
import MeetingDetail from "@/components/meetings/meeting-detail";
import type { MeetingWithDetails } from "@/lib/meetings/meeting-types";

type Props = {
  params: Promise<{
    workspace: string;
    project: string;
    meetingId: string;
  }>;
};

export default async function MeetingDetailPage({ params }: Props) {
  const {
    workspace: workspaceSlug,
    project: projectId,
    meetingId,
  } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

  if (!project) redirect(`/app/${workspaceSlug}/projects`);

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, project.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);

  if (!member) redirect(`/app/${workspaceSlug}`);

  const [meetingRow] = await db.select().from(meetings).where(and(eq(meetings.id, meetingId), eq(meetings.projectId, projectId))).limit(1);

  if (!meetingRow) notFound();

  const [attendees, agendaItemsRaw, attachments, notes, preQuestionsRaw] = await Promise.all([
    db.select().from(meetingAttendees).where(eq(meetingAttendees.meetingId, meetingId)),
    db.select().from(meetingAgendaItems).where(eq(meetingAgendaItems.meetingId, meetingId)).orderBy(asc(meetingAgendaItems.orderIdx)),
    db.select().from(meetingAttachments).where(eq(meetingAttachments.meetingId, meetingId)),
    db.select().from(meetingNotes).where(eq(meetingNotes.meetingId, meetingId)),
    db.select().from(meetingPreQuestions).where(eq(meetingPreQuestions.meetingId, meetingId)).orderBy(asc(meetingPreQuestions.orderIdx)),
  ]);
  const meeting = { ...meetingRow, attendees, agendaItems: agendaItemsRaw, attachments, notes, preQuestions: preQuestionsRaw };

  const workspaceUsers = await db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, project.workspaceId));

  const userIds = workspaceUsers.map(u => u.userId);
  const profileRows = userIds.length > 0 ? await db.select().from(profiles).where(inArray(profiles.id, userIds)) : [];
  const userProfiles = workspaceUsers.map(u => profileRows.find(p => p.id === u.userId));

  const members = workspaceUsers.map((m, i) => ({
    userId: m.userId,
    role: m.role,
    profile: userProfiles[i] ?? null,
  }));

  // Serialize Date objects so they can be passed to Client Components
  const serializedMeeting = JSON.parse(JSON.stringify(meeting)) as MeetingWithDetails;
  const serializedMembers = JSON.parse(JSON.stringify(members)) as typeof members;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <MeetingDetail
        meeting={serializedMeeting}
        members={serializedMembers}
        currentUserId={user.id}
        workspaceSlug={workspaceSlug}
      />
    </div>
  );
}
