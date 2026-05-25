import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { mindmaps, projects, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import MindmapCanvas from "@/components/mindmaps/mindmap-canvas";

type Props = {
  params: Promise<{ workspace: string; project: string; mindmapId: string }>;
};

export default async function MindmapEditorPage({ params }: Props) {
  const { workspace: workspaceSlug, project: projectId, mindmapId } = await params;
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

  const mindmap = await db.query.mindmaps.findFirst({
    where: eq(mindmaps.id, mindmapId),
    with: { nodes: true, edges: true },
  });

  if (!mindmap || mindmap.projectId !== projectId) notFound();

  const canEdit =
    member.role === "owner" || member.role === "admin" || member.role === "member";

  const initialNodes = mindmap.nodes.map((n) => ({
    id: n.id,
    mindmapId: n.mindmapId,
    parentNodeId: n.parentNodeId,
    label: n.label,
    content: n.content,
    color: n.color,
    positionX: n.positionX,
    positionY: n.positionY,
    nodeOrder: n.nodeOrder,
    linkedTaskId: n.linkedTaskId ?? null,
    styleJsonb: (n.styleJsonb ?? {}) as Record<string, unknown>,
    collapsedByJsonb: (n.collapsedByJsonb ?? []) as string[],
    orderInParent: n.orderInParent,
  }));

  const initialEdges = mindmap.edges.map((e) => ({
    id: e.id,
    sourceId: e.sourceId,
    targetId: e.targetId,
    styleJsonb: (e.styleJsonb ?? {}) as Record<string, unknown>,
  }));

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-4 h-12 border-b border-border bg-surface flex-shrink-0 min-w-0">
        <Link
          href={`/app/${workspaceSlug}/projects/${projectId}/mindmaps`}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors flex-shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Volver</span>
        </Link>
        <div className="w-px h-4 bg-border flex-shrink-0" />
        <nav className="flex items-center gap-1 sm:gap-1.5 text-sm text-text-muted min-w-0 overflow-hidden">
          <Link
            href={`/app/${workspaceSlug}/projects/${projectId}`}
            className="hidden sm:inline hover:text-text transition-colors flex-shrink-0 truncate max-w-[8rem]"
          >
            {project.name}
          </Link>
          <span className="hidden sm:inline flex-shrink-0">/</span>
          <Link
            href={`/app/${workspaceSlug}/projects/${projectId}/mindmaps`}
            className="hover:text-text transition-colors flex-shrink-0"
          >
            <span className="hidden sm:inline">Mindmaps</span>
          </Link>
          <span className="hidden sm:inline flex-shrink-0">/</span>
          <span className="text-text font-medium truncate min-w-0">{mindmap.title}</span>
        </nav>
      </div>

      {/* Canvas wrapper — needs defined height */}
      <div className="flex-1 overflow-hidden p-2 sm:p-4 min-h-0">
        <MindmapCanvas
          mindmapId={mindmapId}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          canEdit={canEdit}
          currentUserId={user.id}
        />
      </div>
    </div>
  );
}
