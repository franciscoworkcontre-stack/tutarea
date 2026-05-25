import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, projects, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
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

    const projectMeetings = await db.query.meetings.findMany({
      where: eq(meetings.projectId, projectId),
      with: {
        attendees: true,
        agendaItems: true,
        attachments: true,
        notes: true,
        preQuestions: true,
      },
    });

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
