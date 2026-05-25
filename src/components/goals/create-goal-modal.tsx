"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InferSelectModel } from "drizzle-orm";
import type { workspaceMembers, profiles, projects } from "@/db/schema";

type Member = InferSelectModel<typeof workspaceMembers> & {
  profile: InferSelectModel<typeof profiles> | null;
};
type Project = InferSelectModel<typeof projects>;

type Props = {
  workspaceId: string;
  members: Member[];
  projects: Project[];
  onClose: () => void;
  onCreated: (goal: {
    id: string;
    title: string;
    status: string;
    progress: number;
  }) => void;
};

export default function CreateGoalModal({
  workspaceId,
  members,
  projects,
  onClose,
  onCreated,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          title: title.trim(),
          description: description.trim() || undefined,
          projectId: projectId || undefined,
          ownerUserId: ownerUserId || undefined,
          startDate: startDate || undefined,
          dueDate: dueDate || undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Error al crear el objetivo");
      }

      const data = (await res.json()) as {
        goal: { id: string; title: string; status: string; progress: number };
      };
      onCreated(data.goal);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
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
          className="relative bg-surface border border-border rounded-xl shadow-xl w-full max-w-md z-10"
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-text">Nuevo objetivo</h2>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:bg-surface-2 hover:text-text transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                Título <span className="text-red-500">*</span>
              </label>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Aumentar retención de usuarios al 80%"
                className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-accent placeholder:text-text-subtle"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                Descripción
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe el objetivo y su contexto..."
                rows={3}
                className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-accent placeholder:text-text-subtle resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Proyecto (opcional)
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-accent"
                >
                  <option value="">Sin proyecto</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Responsable
                </label>
                <select
                  value={ownerUserId}
                  onChange={(e) => setOwnerUserId(e.target.value)}
                  className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-accent"
                >
                  <option value="">Sin asignar</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.profile?.fullName ?? m.userId.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Fecha inicio
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Fecha fin
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-text-muted hover:text-text transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !title.trim()}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg bg-accent text-accent-fg transition-opacity",
                  (loading || !title.trim()) && "opacity-50 cursor-not-allowed"
                )}
              >
                {loading ? "Creando..." : "Crear objetivo"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
