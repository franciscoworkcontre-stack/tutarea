import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { mindmaps, projects, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import MindmapList from "@/components/mindmaps/mindmap-list";

type Props = {
  params: Promise<{ workspace: string; project: string }>;
};

export default async function MindmapsPage({ params }: Props) {
  const { workspace: workspaceSlug, project: projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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

    const projectMindmaps = await db.query.mindmaps.findMany({
      where: eq(mindmaps.projectId, projectId),
      with: { nodes: true },
      orderBy: [mindmaps.updatedAt],
    });

    // Attach node count to each mindmap — strip the nodes relation before passing as props
    // (Server Component props must be serializable; Date fields are serialized to ISO strings by Next.js)
    const mindmapsWithCount = projectMindmaps.map(({ nodes, ...m }) => ({
      ...m,
      nodeCount: nodes?.length ?? 0,
    }));

    const canCreate = member.role === "owner" || member.role === "admin" || member.role === "member";

    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <MindmapList
            projectId={projectId}
            workspaceSlug={workspaceSlug}
            initialMindmaps={mindmapsWithCount}
            canCreate={canCreate}
          />
        </div>
      </div>
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return (
      <div className="p-6 text-sm text-red-400 font-mono whitespace-pre-wrap">
        Error en Mindmaps: {message}
      </div>
    );
  }
}
