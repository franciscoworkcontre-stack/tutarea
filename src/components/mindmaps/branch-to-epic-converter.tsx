"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, GitBranch, CheckSquare, Square, ChevronRight, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type NodeData = {
  id: string;
  label: string;
  parentNodeId: string | null;
  children: NodeData[];
};

type BranchItem = {
  id: string;
  label: string;
  depth: number; // 0 = root (epic), 1 = task, 2+ = subtask
  parentId: string | null;
  included: boolean;
};

type Props = {
  nodeId: string;
  mindmapId: string;
  projectId: string;
  onConverted: (epicId: string) => void;
  onClose: () => void;
};

function flattenBranch(node: NodeData, depth: number, parentId: string | null): BranchItem[] {
  const item: BranchItem = {
    id: node.id,
    label: node.label,
    depth,
    parentId,
    included: true,
  };
  const children = node.children.flatMap((child) =>
    flattenBranch(child, depth + 1, node.id)
  );
  return [item, ...children];
}

function buildTree(
  nodes: { id: string; label: string; parentNodeId: string | null }[],
  rootId: string
): NodeData | null {
  const map = new Map(nodes.map((n) => [n.id, { ...n, children: [] as NodeData[] }]));
  const root = map.get(rootId);
  if (!root) return null;

  for (const node of map.values()) {
    if (node.parentNodeId && node.id !== rootId) {
      const parent = map.get(node.parentNodeId);
      if (parent) parent.children.push(node);
    }
  }
  return root;
}

function getDepthLabel(depth: number): string {
  if (depth === 0) return "Epic";
  if (depth === 1) return "Tarea";
  return "Subtarea";
}

function getDepthStyle(depth: number): string {
  if (depth === 0) return "text-purple-500 bg-purple-500/10 border-purple-500/30";
  if (depth === 1) return "text-blue-500 bg-blue-500/10 border-blue-500/30";
  return "text-text-muted bg-surface-2 border-border";
}

export default function BranchToEpicConverter({
  nodeId,
  mindmapId,
  projectId,
  onConverted,
  onClose,
}: Props) {
  const [items, setItems] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [epicId, setEpicId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    // Fetch all nodes for this mindmap to build tree
    fetch(`/api/mindmaps/${mindmapId}/nodes`)
      .then((r) => (r.ok ? r.json() : { nodes: [] }))
      .then((data) => {
        const nodes = (data.nodes ?? []) as {
          id: string;
          label: string;
          parentNodeId: string | null;
        }[];

        // Filter to only descendants of nodeId (inclusive)
        const allDescendants = new Set<string>([nodeId]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const n of nodes) {
            if (n.parentNodeId && allDescendants.has(n.parentNodeId) && !allDescendants.has(n.id)) {
              allDescendants.add(n.id);
              changed = true;
            }
          }
        }

        const branchNodes = nodes.filter((n) => allDescendants.has(n.id));
        const tree = buildTree(branchNodes, nodeId);
        if (!tree) {
          setItems([]);
          return;
        }
        const flat = flattenBranch(tree, 0, null);
        setItems(flat);
      })
      .catch(() => {
        toast.error("No se pudo cargar la rama");
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, [nodeId, mindmapId]);

  const toggleItem = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) return { ...item, included: !item.included };
        // If excluding a parent, also exclude children
        if (!prev.find((i) => i.id === id)?.included === false) return item;
        return item;
      })
    );
  }, []);

  const includedItems = items.filter((i) => i.included);

  const handleConvert = async () => {
    if (includedItems.length === 0) {
      toast.error("Selecciona al menos un elemento");
      return;
    }

    setSubmitting(true);
    setProgress(0);

    try {
      // Map of original node ID → new task ID
      const idMap = new Map<string, string>();
      const total = includedItems.length;

      for (let i = 0; i < includedItems.length; i++) {
        const item = includedItems[i]!;
        const parentTaskId =
          item.parentId && idMap.has(item.parentId) ? idMap.get(item.parentId) : undefined;

        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.label,
            projectId,
            parentTaskId: parentTaskId ?? undefined,
          }),
        });

        if (!res.ok) {
          throw new Error(`No se pudo crear: ${item.label}`);
        }

        const { task } = (await res.json()) as { task: { id: string } };
        idMap.set(item.id, task.id);

        // Link the mindmap node to the created task
        await fetch(`/api/mindmaps/${mindmapId}/nodes/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ linkedTaskId: task.id }),
        }).catch(() => null); // non-blocking

        if (item.depth === 0) {
          setEpicId(task.id);
        }

        setProgress(Math.round(((i + 1) / total) * 100));
      }

      const rootTaskId = idMap.get(nodeId);
      setDone(true);
      toast.success(`Estructura creada: ${total} elemento${total !== 1 ? "s" : ""}`);

      setTimeout(() => {
        onConverted(rootTaskId ?? epicId ?? "");
        onClose();
      }, 1500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear la estructura");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={submitting ? undefined : onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
          className="relative z-10 w-full max-w-lg bg-background border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold">Convertir rama en Epic + Tareas</span>
            </div>
            <button
              onClick={onClose}
              disabled={submitting}
              className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-2 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {done ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <p className="text-sm font-medium">Estructura creada correctamente</p>
              <p className="text-xs text-text-muted">{includedItems.length} elementos creados</p>
            </div>
          ) : (
            <>
              {/* Info */}
              <div className="px-4 py-3 bg-surface-2/50 border-b border-border flex-shrink-0">
                <p className="text-xs text-text-muted">
                  Vista previa de la estructura que se va a crear. Desmarca los elementos que no quieras incluir.
                </p>
                <div className="flex items-center gap-3 mt-2">
                  {["Epic", "Tarea", "Subtarea"].map((label, i) => (
                    <div key={label} className="flex items-center gap-1">
                      <span
                        className={cn(
                          "text-xs px-1.5 py-0.5 rounded border",
                          getDepthStyle(i)
                        )}
                      >
                        {label}
                      </span>
                      {i < 2 && <ChevronRight className="w-3 h-3 text-text-subtle" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Item list */}
              <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                  <div className="flex items-center justify-center py-12 gap-2 text-text-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Analizando rama...</span>
                  </div>
                ) : items.length === 0 ? (
                  <div className="text-xs text-text-subtle text-center py-12">
                    No se encontraron nodos en esta rama
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        style={{ paddingLeft: `${item.depth * 20}px` }}
                        className="flex items-center gap-2"
                      >
                        <button
                          onClick={() => toggleItem(item.id)}
                          className="flex-shrink-0 text-text-muted hover:text-text transition-colors"
                        >
                          {item.included ? (
                            <CheckSquare className="w-4 h-4 text-accent" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                        <span
                          className={cn(
                            "text-xs px-1.5 py-0.5 rounded border flex-shrink-0",
                            getDepthStyle(item.depth)
                          )}
                        >
                          {getDepthLabel(item.depth)}
                        </span>
                        <span
                          className={cn(
                            "text-sm",
                            item.included ? "text-text" : "text-text-subtle line-through"
                          )}
                        >
                          {item.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Summary */}
              {!loading && items.length > 0 && (
                <div className="px-4 py-2 border-t border-border flex-shrink-0 flex items-center gap-2">
                  <span className="text-xs text-text-muted">
                    {includedItems.length} de {items.length} elementos seleccionados
                  </span>
                </div>
              )}

              {/* Progress bar */}
              {submitting && (
                <div className="px-4 py-2 flex-shrink-0">
                  <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-accent rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: "easeInOut" }}
                    />
                  </div>
                  <p className="text-xs text-text-muted mt-1 text-center">
                    Creando estructura... {progress}%
                  </p>
                </div>
              )}

              {/* Footer */}
              <div className="flex gap-2 px-4 py-3 border-t border-border flex-shrink-0">
                <button
                  onClick={onClose}
                  disabled={submitting}
                  className="flex-1 text-sm px-3 py-2 rounded-lg border border-border text-text-muted hover:text-text hover:border-border-strong transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConvert}
                  disabled={submitting || includedItems.length === 0 || loading}
                  className="flex-1 text-sm px-3 py-2 rounded-lg bg-accent text-accent-fg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <GitBranch className="w-3.5 h-3.5" />
                      Crear estructura
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
