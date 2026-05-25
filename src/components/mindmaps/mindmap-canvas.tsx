"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ZoomIn, ZoomOut, Maximize2, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import MindmapNodeComponent, { type MindmapNode } from "./mindmap-node";

type Props = {
  mindmapId: string;
  initialNodes: MindmapNode[];
  readOnly?: boolean;
};

type Transform = { x: number; y: number; scale: number };

type DragState = {
  nodeId: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
} | null;

type PanState = {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
} | null;

export function autoLayout(nodes: MindmapNode[]): MindmapNode[] {
  if (nodes.length === 0) return nodes;

  const nodeMap = new Map<string, MindmapNode>();
  nodes.forEach((n) => nodeMap.set(n.id, { ...n, children: [] }));

  let root: MindmapNode | null = null;
  const childrenMap = new Map<string | null, MindmapNode[]>();

  nodes.forEach((n) => {
    const key = n.parentNodeId ?? null;
    if (!childrenMap.has(key)) childrenMap.set(key, []);
    childrenMap.get(key)!.push(nodeMap.get(n.id)!);
    if (!n.parentNodeId) root = nodeMap.get(n.id)!;
  });

  if (!root) root = nodeMap.get(nodes[0]!.id)!;

  const rootNode = root as MindmapNode;
  const H_SPACING = 180;
  const V_SPACING = 70;
  const CANVAS_CX = 0;
  const CANVAS_CY = 0;

  function getSubtreeHeight(nodeId: string): number {
    const children = childrenMap.get(nodeId) ?? [];
    if (children.length === 0) return 1;
    return children.reduce((sum, c) => sum + getSubtreeHeight(c.id), 0);
  }

  function assignPositions(nodeId: string, x: number, topY: number): void {
    const node = nodeMap.get(nodeId)!;
    const children = childrenMap.get(nodeId) ?? [];
    const totalH = getSubtreeHeight(nodeId);
    const centerY = topY + (totalH * V_SPACING) / 2;

    node.positionX = x;
    node.positionY = centerY;

    let currentY = topY;
    children.forEach((child) => {
      const childH = getSubtreeHeight(child.id);
      assignPositions(child.id, x + H_SPACING, currentY);
      currentY += childH * V_SPACING;
    });
  }

  const rootHeight = getSubtreeHeight(rootNode.id);
  assignPositions(rootNode.id, CANVAS_CX, CANVAS_CY - (rootHeight * V_SPACING) / 2);

  return Array.from(nodeMap.values());
}

function buildTree(flat: MindmapNode[]): MindmapNode[] {
  const map = new Map<string, MindmapNode>();
  flat.forEach((n) => map.set(n.id, { ...n, children: [] }));
  const roots: MindmapNode[] = [];
  map.forEach((node) => {
    if (node.parentNodeId && map.has(node.parentNodeId)) {
      map.get(node.parentNodeId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function flattenTree(roots: MindmapNode[]): MindmapNode[] {
  const result: MindmapNode[] = [];
  function walk(node: MindmapNode) {
    result.push(node);
    node.children?.forEach(walk);
  }
  roots.forEach(walk);
  return result;
}

function getDepth(nodeId: string, nodes: MindmapNode[]): number {
  const map = new Map<string, MindmapNode>();
  nodes.forEach((n) => map.set(n.id, n));
  let depth = 0;
  let current = map.get(nodeId);
  while (current?.parentNodeId) {
    depth++;
    current = map.get(current.parentNodeId);
  }
  return depth;
}

function generateId(): string {
  return crypto.randomUUID();
}

const EDGE_COLOR = "var(--color-border, #e2e8f0)";

export default function MindmapCanvas({ mindmapId, initialNodes, readOnly = false }: Props) {
  const needsLayout = initialNodes.length > 0 && initialNodes.every((n) => n.positionX === 0 && n.positionY === 0);
  const [nodes, setNodes] = useState<MindmapNode[]>(() =>
    needsLayout ? autoLayout(initialNodes) : initialNodes
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>(null);
  const panRef = useRef<PanState>(null);
  const isDraggingNode = useRef(false);

  const handleFitToScreen = useCallback(() => {
    if (nodes.length === 0) return;
    const container = containerRef.current;
    if (!container) return;
    const { width, height } = container.getBoundingClientRect();
    const xs = nodes.map((n) => n.positionX);
    const ys = nodes.map((n) => n.positionY);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const contentW = maxX - minX + 200;
    const contentH = maxY - minY + 100;
    const scale = Math.min(width / contentW, height / contentH, 1.5, 2);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setTransform({
      x: width / 2 - cx * scale,
      y: height / 2 - cy * scale,
      scale: Math.max(0.5, Math.min(scale, 2)),
    });
  }, [nodes]);

  useEffect(() => {
    if (nodes.length > 0) handleFitToScreen();
  }, []);

  const saveNodeLabel = useCallback(
    async (nodeId: string, label: string) => {
      try {
        const res = await fetch(`/api/mindmaps/${mindmapId}/nodes/${nodeId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label }),
        });
        if (!res.ok) throw new Error("Error al guardar");
      } catch {
        toast.error("No se pudo guardar el nodo");
      }
    },
    [mindmapId]
  );

  const saveNodePosition = useCallback(
    async (nodeId: string, positionX: number, positionY: number) => {
      try {
        await fetch(`/api/mindmaps/${mindmapId}/nodes/${nodeId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ positionX, positionY }),
        });
      } catch {
        toast.error("No se pudo guardar la posición");
      }
    },
    [mindmapId]
  );

  const handleLabelBlur = useCallback(
    (nodeId: string) => {
      setEditingId(null);
      const node = nodes.find((n) => n.id === nodeId);
      if (node) saveNodeLabel(nodeId, node.label);
    },
    [nodes, saveNodeLabel]
  );

  const handleLabelChange = useCallback((nodeId: string, label: string) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, label } : n)));
  }, []);

  const handleAddChild = useCallback(
    async (parentId: string) => {
      const parent = nodes.find((n) => n.id === parentId);
      if (!parent) return;
      const siblings = nodes.filter((n) => n.parentNodeId === parentId);
      const newNode: MindmapNode = {
        id: generateId(),
        mindmapId,
        parentNodeId: parentId,
        label: "Nuevo nodo",
        content: null,
        color: parent.color,
        positionX: parent.positionX + 180,
        positionY: parent.positionY + siblings.length * 70,
        nodeOrder: siblings.length,
        children: [],
      };
      setNodes((prev) => [...prev, newNode]);
      setSelectedId(newNode.id);
      setEditingId(newNode.id);
      try {
        const res = await fetch(`/api/mindmaps/${mindmapId}/nodes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parentNodeId: parentId,
            label: newNode.label,
            color: newNode.color,
            positionX: newNode.positionX,
            positionY: newNode.positionY,
            nodeOrder: newNode.nodeOrder,
          }),
        });
        if (!res.ok) throw new Error("Error al crear nodo");
        const { node: created } = (await res.json()) as { node: MindmapNode };
        setNodes((prev) => prev.map((n) => (n.id === newNode.id ? { ...n, id: created.id } : n)));
        setSelectedId(created.id);
        setEditingId(created.id);
      } catch {
        toast.error("No se pudo crear el nodo");
        setNodes((prev) => prev.filter((n) => n.id !== newNode.id));
      }
    },
    [nodes, mindmapId]
  );

  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const isRoot = !node.parentNodeId;
      if (isRoot) {
        toast.error("No se puede eliminar el nodo raíz");
        return;
      }
      function collectDescendants(id: string, all: MindmapNode[]): string[] {
        const children = all.filter((n) => n.parentNodeId === id);
        return [id, ...children.flatMap((c) => collectDescendants(c.id, all))];
      }
      const toDelete = new Set(collectDescendants(nodeId, nodes));
      setNodes((prev) => prev.filter((n) => !toDelete.has(n.id)));
      setSelectedId(null);
      try {
        const res = await fetch(`/api/mindmaps/${mindmapId}/nodes/${nodeId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Error al eliminar");
      } catch {
        toast.error("No se pudo eliminar el nodo");
        setNodes(nodes);
      }
    },
    [nodes, mindmapId]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (editingId) {
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          handleLabelBlur(editingId);
          handleAddChild(editingId);
        }
        return;
      }
      if (!selectedId) return;
      if (e.key === "Backspace" || e.key === "Delete") {
        handleDeleteNode(selectedId);
      }
      if (e.key === "Escape") {
        setSelectedId(null);
      }
    },
    [editingId, selectedId, handleLabelBlur, handleAddChild, handleDeleteNode]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((prev) => {
      const newScale = Math.max(0.5, Math.min(2, prev.scale * delta));
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { ...prev, scale: newScale };
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const dx = (mouseX - prev.x) * (newScale / prev.scale - 1);
      const dy = (mouseY - prev.y) * (newScale / prev.scale - 1);
      return { x: prev.x - dx, y: prev.y - dy, scale: newScale };
    });
  }, []);

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("[data-mindmap-node]")) return;
      setSelectedId(null);
      setEditingId(null);
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: transform.x,
        originY: transform.y,
      };
    },
    [transform]
  );

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      if (readOnly) return;
      e.stopPropagation();
      if (editingId === nodeId) return;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      isDraggingNode.current = false;
      dragRef.current = {
        nodeId,
        startX: e.clientX,
        startY: e.clientY,
        originX: node.positionX,
        originY: node.positionY,
      };
    },
    [nodes, editingId, readOnly]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragRef.current) {
        const dx = (e.clientX - dragRef.current.startX) / transform.scale;
        const dy = (e.clientY - dragRef.current.startY) / transform.scale;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDraggingNode.current = true;
        if (isDraggingNode.current) {
          const { nodeId, originX, originY } = dragRef.current;
          setNodes((prev) =>
            prev.map((n) =>
              n.id === nodeId
                ? { ...n, positionX: originX + dx, positionY: originY + dy }
                : n
            )
          );
        }
      } else if (panRef.current) {
        const dx = e.clientX - panRef.current.startX;
        const dy = e.clientY - panRef.current.startY;
        setTransform((prev) => ({
          ...prev,
          x: panRef.current!.originX + dx,
          y: panRef.current!.originY + dy,
        }));
      }
    },
    [transform.scale]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (dragRef.current && isDraggingNode.current) {
        const { nodeId } = dragRef.current;
        const node = nodes.find((n) => n.id === nodeId);
        if (node) saveNodePosition(nodeId, node.positionX, node.positionY);
      }
      dragRef.current = null;
      panRef.current = null;
      isDraggingNode.current = false;
    },
    [nodes, saveNodePosition]
  );

  const treeRoots = buildTree(nodes);
  const allFlat = flattenTree(treeRoots);

  function renderEdges() {
    const edges: React.ReactNode[] = [];
    nodes.forEach((node) => {
      if (!node.parentNodeId) return;
      const parent = nodes.find((n) => n.id === node.parentNodeId);
      if (!parent) return;
      const x1 = parent.positionX;
      const y1 = parent.positionY;
      const x2 = node.positionX;
      const y2 = node.positionY;
      const mx = (x1 + x2) / 2;
      const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
      edges.push(
        <path
          key={`${parent.id}-${node.id}`}
          d={d}
          fill="none"
          stroke={EDGE_COLOR}
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.7}
        />
      );
    });
    return edges;
  }

  const xs = nodes.map((n) => n.positionX);
  const ys = nodes.map((n) => n.positionY);
  const svgMinX = (Math.min(...xs) || 0) - 150;
  const svgMinY = (Math.min(...ys) || 0) - 150;
  const svgW = (Math.max(...xs) || 0) - svgMinX + 300;
  const svgH = (Math.max(...ys) || 0) - svgMinY + 300;

  return (
    <div className="relative w-full h-full flex flex-col bg-surface overflow-hidden rounded-xl border border-border">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background flex-shrink-0 z-10">
        <button
          onClick={() => setTransform((t) => ({ ...t, scale: Math.min(2, t.scale * 1.2) }))}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted hover:text-text transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setTransform((t) => ({ ...t, scale: Math.max(0.5, t.scale * 0.8) }))}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted hover:text-text transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleFitToScreen}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted hover:text-text transition-colors"
          title="Ajustar pantalla"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-border mx-1" />
        {!readOnly && selectedId && (
          <button
            onClick={() => handleAddChild(selectedId)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
            title="Agregar nodo hijo"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add child</span>
          </button>
        )}
        {!readOnly && selectedId && (
          <button
            onClick={() => handleDeleteNode(selectedId)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-danger hover:bg-danger/10 transition-colors"
            title="Eliminar nodo"
          >
            <Minus className="w-3.5 h-3.5" />
            <span>Eliminar</span>
          </button>
        )}
        <div className="ml-auto text-xs text-text-muted">
          {nodes.length} nodo{nodes.length !== 1 ? "s" : ""}
        </div>
      </div>

      <div
        ref={containerRef}
        className={cn(
          "flex-1 relative overflow-hidden",
          panRef.current ? "cursor-grabbing" : "cursor-grab"
        )}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: "0 0",
            position: "absolute",
            width: 0,
            height: 0,
          }}
        >
          <svg
            style={{
              position: "absolute",
              left: svgMinX,
              top: svgMinY,
              width: svgW,
              height: svgH,
              pointerEvents: "none",
              overflow: "visible",
            }}
            viewBox={`${svgMinX} ${svgMinY} ${svgW} ${svgH}`}
          >
            {renderEdges()}
          </svg>

          <AnimatePresence>
            {allFlat.map((node) => (
              <div
                key={node.id}
                data-mindmap-node="true"
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                style={{ position: "absolute", left: 0, top: 0 }}
              >
                <MindmapNodeComponent
                  node={node}
                  isSelected={selectedId === node.id}
                  isEditing={editingId === node.id}
                  onSelect={(id) => {
                    if (!isDraggingNode.current) setSelectedId(id);
                  }}
                  onDoubleClick={(id) => {
                    if (!readOnly) {
                      setSelectedId(id);
                      setEditingId(id);
                    }
                  }}
                  onLabelChange={handleLabelChange}
                  onLabelBlur={handleLabelBlur}
                  depth={getDepth(node.id, nodes)}
                />
              </div>
            ))}
          </AnimatePresence>
        </div>

        {nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted gap-2">
            <span className="text-sm">El mapa mental está vacío</span>
            {!readOnly && (
              <button
                onClick={async () => {
                  const newNode: MindmapNode = {
                    id: generateId(),
                    mindmapId,
                    parentNodeId: null,
                    label: "Idea central",
                    content: null,
                    color: "#94a3b8",
                    positionX: 0,
                    positionY: 0,
                    nodeOrder: 0,
                    children: [],
                  };
                  setNodes([newNode]);
                  setSelectedId(newNode.id);
                  setEditingId(newNode.id);
                  try {
                    const res = await fetch(`/api/mindmaps/${mindmapId}/nodes`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ label: newNode.label, color: newNode.color, positionX: 0, positionY: 0, nodeOrder: 0 }),
                    });
                    if (!res.ok) throw new Error();
                    const { node: created } = (await res.json()) as { node: MindmapNode };
                    setNodes([{ ...newNode, id: created.id }]);
                    setSelectedId(created.id);
                    setEditingId(created.id);
                  } catch {
                    toast.error("No se pudo crear el nodo raíz");
                    setNodes([]);
                  }
                }}
                className="text-xs px-3 py-1.5 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
              >
                + Crear nodo raíz
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
