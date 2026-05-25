import type { InferSelectModel } from "drizzle-orm";
import type { mindmaps, mindmapNodes } from "@/db/schema";

export type Mindmap = InferSelectModel<typeof mindmaps>;
export type MindmapNode = InferSelectModel<typeof mindmapNodes>;

export type MindmapNodeWithChildren = MindmapNode & {
  children: MindmapNodeWithChildren[];
};

export function buildNodeTree(nodes: MindmapNode[]): MindmapNodeWithChildren[] {
  const map = new Map<string, MindmapNodeWithChildren>();
  nodes.forEach(n => map.set(n.id, { ...n, children: [] }));
  const roots: MindmapNodeWithChildren[] = [];
  nodes.forEach(n => {
    if (n.parentNodeId && map.has(n.parentNodeId)) {
      map.get(n.parentNodeId)!.children.push(map.get(n.id)!);
    } else if (!n.parentNodeId) {
      roots.push(map.get(n.id)!);
    }
  });
  return roots;
}

export function getDescendantIds(nodeId: string, nodes: MindmapNode[]): string[] {
  const children = nodes.filter(n => n.parentNodeId === nodeId);
  return children.flatMap(c => [c.id, ...getDescendantIds(c.id, nodes)]);
}
