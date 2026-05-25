import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, projects, workspaceMembers, profiles } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import MeetingDetail from "@/components/meetings/meeting-detail";

type Props = {
  params: Promise<{ workspace: string; project: string; meetingId: string }>;
};

export default async function MeetingDetailPage({ params }: Props) {
  const { workspace: workspaceSlug, project: projectId, meetingId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border flex-shrink-0">
        <Link
          href={`/app/${workspaceSlug}/projects/${projectId}/meetings`}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Reuniones
        </Link>
        <span className="text-text-subtle">/</span>
        <span className="text-sm text-text truncate">{meeting.title}</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <MeetingDetail
          meeting={meeting}
          members={members}
          workspaceSlug={workspaceSlug}
          currentUserId={user.id}
        />
      </div>
    </div>
  );
}
