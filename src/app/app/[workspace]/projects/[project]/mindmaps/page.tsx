import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { mindmaps, mindmapNodes, projects, workspaceMembers } from "@/db/schema";
import { eq, and, count, inArray } from "drizzle-orm";
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
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

    if (!project) redirect(`/app/${workspaceSlug}/projects`);

    const [member] = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, project.workspaceId),
          eq(workspaceMembers.userId, user.id)
        )
      )
      .limit(1);

    if (!member) redirect(`/app/${workspaceSlug}`);

    const projectMindmaps = await db
      .select()
      .from(mindmaps)
      .where(eq(mindmaps.projectId, projectId))
      .orderBy(mindmaps.updatedAt);

    const mindmapIds = projectMindmaps.map((m) => m.id);
    const nodeCounts =
      mindmapIds.length > 0
        ? await db
            .select({ mindmapId: mindmapNodes.mindmapId, cnt: count() })
            .from(mindmapNodes)
            .where(inArray(mindmapNodes.mindmapId, mindmapIds))
            .groupBy(mindmapNodes.mindmapId)
        : [];
    const nodeCountMap = new Map(nodeCounts.map((r) => [r.mindmapId, Number(r.cnt)]));

    const mindmapsWithCount = projectMindmaps.map((m) => ({
      ...m,
      nodeCount: nodeCountMap.get(m.id) ?? 0,
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
