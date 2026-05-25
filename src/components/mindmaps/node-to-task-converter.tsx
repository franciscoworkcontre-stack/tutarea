"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type TaskStatus = {
  id: string;
  name: string;
  color: string;
  type: string;
};

type Member = {
  id: string;
  userId: string;
  profile?: { id: string; fullName: string | null; avatarUrl: string | null } | null;
};

type Props = {
  node: { id: string; label: string };
  mindmapId: string;
  projectId: string;
  workspaceSlug: string;
  onConverted: (taskId: string) => void;
  onClose: () => void;
};

const PRIORITY_OPTIONS = [
  { value: "urgent", label: "Urgente" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baja" },
  { value: "no_priority", label: "Sin prioridad" },
];

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

export default function NodeToTaskConverter({
  node,
  mindmapId,
  projectId,
  workspaceSlug,
  onConverted,
  onClose,
}: Props) {
  const [title, setTitle] = useState(node.label);
  const [statusId, setStatusId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState("no_priority");
  const [dueDate, setDueDate] = useState("");
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/tasks?projectId=${encodeURIComponent(projectId)}&_statuses=1`)
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({})),
      fetch(`/api/projects/${projectId}/members`)
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({})),
    ])
      .then(([tasksData, membersData]) => {
        const td = tasksData as Record<string, unknown>;
        const md = membersData as Record<string, unknown>;
        const s = (Array.isArray(td.statuses) ? td.statuses : []) as TaskStatus[];
        setStatuses(s);
        if (s.length > 0 && s[0]) setStatusId(s[0].id);

        const m = (Array.isArray(md.members) ? md.members : []) as Member[];
        setMembers(m);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  // Fallback: fetch statuses via task statuses endpoint pattern
  useEffect(() => {
    if (statuses.length > 0) return;
    fetch(`/api/task-statuses?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, unknown>) => {
        const s = (Array.isArray(data.statuses) ? data.statuses : []) as TaskStatus[];
        if (s.length > 0) {
          setStatuses(s);
          setStatusId(s[0]!.id);
        }
      })
      .catch(() => null);
  }, [projectId, statuses.length]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("El título es requerido");
      return;
    }
    setSubmitting(true);
    try {
      // Create the task
      const taskRes = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          projectId,
          statusId: statusId || undefined,
          assigneeId: assigneeId || undefined,
          priority,
          dueDate: dueDate || undefined,
        }),
      });
      if (!taskRes.ok) {
        const err = (await taskRes.json()) as { error?: string };
        throw new Error(err.error ?? "Error al crear la tarea");
      }
      const { task } = (await taskRes.json()) as { task: { id: string } };

      // Link node to task
      await fetch(`/api/mindmaps/${mindmapId}/nodes/${node.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedTaskId: task.id }),
      });

      setDone(true);
      toast.success("Tarea creada y vinculada");
      setTimeout(() => {
        onConverted(task.id);
        onClose();
      }, 1200);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear la tarea");
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
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
          className="relative z-10 w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold">Convertir nodo en tarea</span>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {done ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <p className="text-sm font-medium">Tarea creada y vinculada</p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Nodo origen */}
              <div className="text-xs text-text-muted bg-surface-2 rounded-lg px-3 py-2 border border-border">
                Nodo: <span className="font-medium text-text">{node.label}</span>
              </div>

              {/* Título */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
                  Título
                </label>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 outline-none focus:border-accent/50 placeholder:text-text-subtle transition-colors"
                  placeholder="Título de la tarea..."
                />
              </div>

              {/* Estado */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
                  Estado
                </label>
                {loading ? (
                  <div className="text-xs text-text-muted">Cargando...</div>
                ) : (
                  <select
                    value={statusId}
                    onChange={(e) => setStatusId(e.target.value)}
                    className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 outline-none focus:border-accent/50 transition-colors"
                  >
                    <option value="">Sin estado</option>
                    {statuses.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Asignado */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
                  Asignado
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 outline-none focus:border-accent/50 transition-colors"
                >
                  <option value="">Sin asignar</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.profile?.fullName ?? m.userId}
                    </option>
                  ))}
                </select>
              </div>

              {/* Prioridad */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
                  Prioridad
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 outline-none focus:border-accent/50 transition-colors"
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fecha límite */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
                  Fecha límite
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 outline-none focus:border-accent/50 transition-colors"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 text-sm px-3 py-2 rounded-lg border border-border text-text-muted hover:text-text hover:border-border-strong transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!title.trim() || submitting}
                  className="flex-1 text-sm px-3 py-2 rounded-lg bg-accent text-accent-fg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                >
                  {submitting ? (
                    "Creando..."
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      Crear y vincular
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
