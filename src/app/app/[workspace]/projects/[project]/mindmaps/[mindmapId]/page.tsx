import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { mindmaps, projects, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import MindmapCanvas from "@/components/mindmaps/mindmap-canvas";
import type { MindmapNode } from "@/components/mindmaps/mindmap-node";

type Props = {
  params: Promise<{ workspace: string; project: string; mindmapId: string }>;
};

export default async function MindmapEditorPage({ params }: Props) {
  const { workspace: workspaceSlug, project: projectId, mindmapId } = await params;
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

  const mindmap = await db.query.mindmaps.findFirst({
    where: eq(mindmaps.id, mindmapId),
    with: { nodes: true },
  });

  if (!mindmap || mindmap.projectId !== projectId) notFound();

  const initialNodes: MindmapNode[] = mindmap.nodes.map((n) => ({
    id: n.id,
    mindmapId: n.mindmapId,
    parentNodeId: n.parentNodeId,
    label: n.label,
    content: n.content,
    color: n.color,
    positionX: n.positionX,
    positionY: n.positionY,
    nodeOrder: n.nodeOrder,
    children: [],
  }));

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center gap-3 px-4 h-12 border-b border-border bg-surface flex-shrink-0">
        <Link
          href={`/app/${workspaceSlug}/projects/${projectId}/mindmaps`}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Volver</span>
        </Link>
        <div className="w-px h-4 bg-border" />
        <nav className="flex items-center gap-1.5 text-sm text-text-muted">
          <span>Proyectos</span>
          <span>/</span>
          <span className="text-text">{project.name}</span>
          <span>/</span>
          <Link
            href={`/app/${workspaceSlug}/projects/${projectId}/mindmaps`}
            className="hover:text-text transition-colors"
          >
            Mindmaps
          </Link>
          <span>/</span>
          <span className="text-text font-medium">{mindmap.title}</span>
        </nav>
      </div>

      <div className="flex-1 overflow-hidden p-4">
        <MindmapCanvas
          mindmapId={mindmapId}
          initialNodes={initialNodes}
          readOnly={false}
        />
      </div>
    </div>
  );
}
