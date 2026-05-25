"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Link2, Unlink, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Task = {
  id: string;
  key: string;
  title: string;
  statusId: string | null;
  assigneeId: string | null;
  priority: string;
  dueDate: Date | null;
  status?: { id: string; name: string; color: string; type: string } | null;
  assignee?: { id: string; fullName: string | null; avatarUrl: string | null } | null;
};

type Props = {
  projectId: string;
  currentLinkedTaskId: string | null;
  onLink: (taskId: string) => void;
  onUnlink: () => void;
  onClose: () => void;
};

const PRIORITY_ICONS: Record<string, string> = {
  urgent: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🔵",
  no_priority: "⚪",
};

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase();
}

export default function TaskLinkPicker({
  projectId,
  currentLinkedTaskId,
  onLink,
  onUnlink,
  onClose,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(currentLinkedTaskId);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tasks?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => (r.ok ? r.json() : { tasks: [] }))
      .then((data) => setTasks((data.tasks ?? []) as Task[]))
      .catch(() => {
        toast.error("No se pudieron cargar las tareas");
        setTasks([]);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  const filtered = tasks.filter((t) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.key.toLowerCase().includes(q);
  });

  const handleSelect = useCallback(
    (taskId: string) => {
      if (selected === taskId) {
        setSelected(null);
      } else {
        setSelected(taskId);
      }
    },
    [selected]
  );

  const handleConfirm = useCallback(() => {
    if (selected) {
      onLink(selected);
    } else if (currentLinkedTaskId) {
      onUnlink();
    }
    onClose();
  }, [selected, currentLinkedTaskId, onLink, onUnlink, onClose]);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
          className="relative z-10 w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold">Vincular tarea</span>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-border flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar tarea por nombre o clave..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-surface-2 border border-border rounded-lg outline-none focus:border-accent/50 placeholder:text-text-subtle transition-colors"
              />
            </div>
          </div>

          {/* Current linked */}
          {currentLinkedTaskId && (
            <div className="px-4 py-2 bg-accent/5 border-b border-border flex-shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs text-accent font-medium">Tarea actualmente vinculada</span>
                <button
                  onClick={() => {
                    onUnlink();
                    onClose();
                  }}
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-red-500 transition-colors"
                >
                  <Unlink className="w-3 h-3" />
                  Desvincular
                </button>
              </div>
            </div>
          )}

          {/* Task list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-xs text-text-muted">
                Cargando tareas...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-text-subtle">
                <Search className="w-8 h-8 opacity-30" />
                <span className="text-xs">
                  {query ? `No se encontraron resultados para "${query}"` : "No hay tareas en este proyecto"}
                </span>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((task) => {
                  const isSelected = selected === task.id;
                  const isCurrent = currentLinkedTaskId === task.id;
                  return (
                    <li key={task.id}>
                      <button
                        onClick={() => handleSelect(task.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                          isSelected
                            ? "bg-accent/10"
                            : "hover:bg-surface-2"
                        )}
                      >
                        {/* Check */}
                        <div
                          className={cn(
                            "w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors",
                            isSelected
                              ? "bg-accent border-accent"
                              : "border-border"
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3 text-accent-fg" />}
                        </div>

                        {/* Task info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs text-text-muted font-mono flex-shrink-0">
                              {task.key}
                            </span>
                            <span className="text-sm text-text truncate">{task.title}</span>
                            {isCurrent && (
                              <span className="text-xs text-accent bg-accent/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                actual
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {task.status && (
                              <span
                                className="text-xs px-1.5 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: task.status.color + "20",
                                  color: task.status.color,
                                }}
                              >
                                {task.status.name}
                              </span>
                            )}
                            <span className="text-xs text-text-subtle">
                              {PRIORITY_ICONS[task.priority]} {task.priority !== "no_priority" ? task.priority : ""}
                            </span>
                          </div>
                        </div>

                        {/* Assignee */}
                        {task.assignee && (
                          <div className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center flex-shrink-0 font-medium">
                            {task.assignee.avatarUrl ? (
                              <img
                                src={task.assignee.avatarUrl}
                                alt={task.assignee.fullName ?? ""}
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            ) : (
                              getInitials(task.assignee.fullName)
                            )}
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 px-4 py-3 border-t border-border flex-shrink-0">
            <button
              onClick={onClose}
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-border text-text-muted hover:text-text hover:border-border-strong transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={selected === currentLinkedTaskId && !(!selected && currentLinkedTaskId)}
              className="flex-1 text-sm px-3 py-2 rounded-lg bg-accent text-accent-fg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {selected ? "Vincular" : "Confirmar"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
