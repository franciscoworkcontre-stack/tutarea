import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, projects, workspaceMembers, profiles } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
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

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) redirect(`/app/${workspaceSlug}/projects`);

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, project.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });

  if (!member) redirect(`/app/${workspaceSlug}`);

  const meeting = await db.query.meetings.findFirst({
    where: and(eq(meetings.id, meetingId), eq(meetings.projectId, projectId)),
    with: {
      attendees: true,
      agendaItems: { orderBy: (items) => [asc(items.orderIdx)] },
      attachments: true,
      notes: true,
      preQuestions: { orderBy: (q) => [asc(q.orderIdx)] },
    },
  });

  if (!meeting) notFound();

  const workspaceUsers = await db.query.workspaceMembers.findMany({
    where: eq(workspaceMembers.workspaceId, project.workspaceId),
  });

  const userProfiles = await Promise.all(
    workspaceUsers.map((m) =>
      db.query.profiles.findFirst({ where: eq(profiles.id, m.userId) })
    )
  );

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
