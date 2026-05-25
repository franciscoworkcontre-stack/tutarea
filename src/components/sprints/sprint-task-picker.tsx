"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Plus, Hash } from "lucide-react";
import { toast } from "sonner";
import { cn, spring } from "@/lib/utils";

type BacklogTask = {
  id: string;
  key: string;
  title: string;
  priority: string;
  status: { name: string; color: string; type: string } | null;
};

type Props = {
  sprintId: string;
  projectId: string;
  onClose: () => void;
  onAdded: () => void;
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-500",
  high: "text-orange-500",
  medium: "text-yellow-500",
  low: "text-blue-400",
  no_priority: "text-text-muted",
};

export default function SprintTaskPicker({
  sprintId,
  projectId,
  onClose,
  onAdded,
}: Props) {
  const [tasks, setTasks] = useState<BacklogTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [storyPoints, setStoryPoints] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks?projectId=${projectId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { tasks: BacklogTask[] };
      setTasks(data.tasks);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const filtered = tasks.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.key.toLowerCase().includes(search.toLowerCase())
  );

  const toggleTask = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    let successCount = 0;
    try {
      await Promise.all(
        [...selected].map(async (taskId) => {
          const pts = storyPoints[taskId];
          const res = await fetch(`/api/sprints/${sprintId}/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taskId,
              storyPoints: pts ? parseInt(pts, 10) : undefined,
            }),
          });
          if (res.ok) successCount++;
        })
      );
      toast.success(`${successCount} tarea(s) agregada(s) al sprint`);
      onAdded();
      onClose();
    } catch {
      toast.error("Error al agregar tareas");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
        />
        <motion.div
          className="relative bg-surface rounded-xl border border-border w-full max-w-lg shadow-xl z-10 flex flex-col max-h-[80vh]"
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={spring}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
            <h2 className="font-semibold text-sm text-text">
              Agregar tareas al sprint
            </h2>
            <button
              onClick={onClose}
              className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-surface-2 transition-colors text-text-muted"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 py-3 border-b border-border flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar tareas..."
                className="w-full pl-8 pr-3 py-2 text-sm bg-surface-2 border border-border rounded-lg text-text placeholder:text-text-muted outline-none focus:border-accent transition-colors"
                autoFocus
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-text-muted text-sm">
                Cargando...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-text-muted text-sm">
                No hay tareas disponibles
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {filtered.map((task) => {
                  const isSelected = selected.has(task.id);
                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors group",
                        isSelected
                          ? "bg-accent/10"
                          : "hover:bg-surface-2"
                      )}
                      onClick={() => toggleTask(task.id)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleTask(task.id)}
                        className="rounded border-border accent-accent flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-text-muted font-mono">
                            {task.key}
                          </span>
                          {task.status && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded text-white"
                              style={{ backgroundColor: task.status.color }}
                            >
                              {task.status.name}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-text truncate mt-0.5">
                          {task.title}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "flex items-center gap-1",
                          PRIORITY_COLORS[task.priority] ?? "text-text-muted"
                        )}
                      >
                        <span className="w-2 h-2 rounded-full bg-current" />
                      </div>
                      {isSelected && (
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Hash className="w-3 h-3 text-text-muted" />
                          <input
                            type="number"
                            value={storyPoints[task.id] ?? ""}
                            onChange={(e) =>
                              setStoryPoints((prev) => ({
                                ...prev,
                                [task.id]: e.target.value,
                              }))
                            }
                            placeholder="SP"
                            min={0}
                            className="w-12 text-xs text-center bg-surface border border-border rounded px-1 py-0.5 outline-none focus:border-accent transition-colors"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-border flex items-center justify-between flex-shrink-0">
            <span className="text-xs text-text-muted">
              {selected.size} tarea(s) seleccionada(s)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-sm text-text-muted hover:text-text hover:bg-surface-2 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={selected.size === 0 || saving}
                onClick={handleAdd}
                className="px-4 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Agregar
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
