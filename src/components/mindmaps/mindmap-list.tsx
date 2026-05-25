"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Plus, Brain, Clock, X } from "lucide-react";
import Link from "next/link";
import { cn, formatRelativeDate } from "@/lib/utils";
import { useNow } from "@/lib/hooks";
import type { InferSelectModel } from "drizzle-orm";
import type { mindmaps } from "@/db/schema";

type Mindmap = InferSelectModel<typeof mindmaps>;

type Props = {
  projectId: string;
  workspaceSlug: string;
  initialMindmaps: Mindmap[];
  canCreate: boolean;
};

const STATUS_STYLES: Record<Mindmap["status"], string> = {
  draft: "bg-surface-2 text-text-muted border-border",
  active: "bg-accent/10 text-accent border-accent/30",
  archived: "bg-surface-2 text-text-subtle border-border",
};

const STATUS_LABELS: Record<Mindmap["status"], string> = {
  draft: "Borrador",
  active: "Activo",
  archived: "Archivado",
};

export default function MindmapList({ projectId, workspaceSlug, initialMindmaps, canCreate }: Props) {
  const [mindmaps, setMindmaps] = useState<Mindmap[]>(initialMindmaps);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const now = useNow();

  const handleCreate = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/mindmaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, title: title.trim(), description: description.trim() || null }),
      });
      if (!res.ok) throw new Error("Error al crear");
      const { mindmap: created } = (await res.json()) as { mindmap: Mindmap };
      setMindmaps((prev) => [created, ...prev]);
      setTitle("");
      setDescription("");
      setCreating(false);
      toast.success("Mapa mental creado");
    } catch {
      toast.error("No se pudo crear el mapa mental");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCreate();
    }
    if (e.key === "Escape") {
      setTitle("");
      setDescription("");
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-medium">Mapas mentales</span>
          <span className="text-xs text-text-subtle bg-surface-2 px-1.5 py-0.5 rounded-full border border-border">
            {mindmaps.length}
          </span>
        </div>
        {canCreate && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-accent text-accent-fg hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Mindmap
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {creating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-accent/30 bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Nuevo mapa mental</span>
                <button
                  onClick={() => { setTitle(""); setDescription(""); setCreating(false); }}
                  className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Título del mapa mental..."
                className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 outline-none focus:border-accent/50 placeholder:text-text-subtle transition-colors"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción (opcional)..."
                rows={2}
                className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 outline-none focus:border-accent/50 placeholder:text-text-subtle transition-colors resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={!title.trim() || loading}
                  className="text-sm px-3 py-1.5 rounded-lg font-medium bg-accent text-accent-fg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Creando..." : "Crear"}
                </button>
                <button
                  onClick={() => { setTitle(""); setDescription(""); setCreating(false); }}
                  className="text-sm px-3 py-1.5 rounded-lg text-text-muted hover:text-text transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {mindmaps.length === 0 && !creating ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-text-subtle border border-dashed border-border/50 rounded-xl">
          <Brain className="w-10 h-10 opacity-30" />
          <p className="text-sm">No hay mapas mentales en este proyecto</p>
          {canCreate && (
            <button
              onClick={() => setCreating(true)}
              className="text-sm text-accent hover:underline"
            >
              Crear el primero
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence initial={false}>
            {mindmaps.map((mindmap, i) => (
              <motion.div
                key={mindmap.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.04, duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
              >
                <Link
                  href={`/app/${workspaceSlug}/projects/${projectId}/mindmaps/${mindmap.id}`}
                  className={cn(
                    "group flex flex-col rounded-xl border bg-background p-4 gap-3",
                    "border-border hover:border-border-strong hover:shadow-2 transition-all"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Brain className="w-4 h-4 text-text-muted flex-shrink-0" />
                      <span className="text-sm font-medium leading-snug truncate group-hover:text-accent transition-colors">
                        {mindmap.title}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full border flex-shrink-0",
                        STATUS_STYLES[mindmap.status]
                      )}
                    >
                      {STATUS_LABELS[mindmap.status]}
                    </span>
                  </div>

                  {mindmap.description && (
                    <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                      {mindmap.description}
                    </p>
                  )}

                  <div className="flex items-center gap-1.5 text-xs text-text-subtle mt-auto">
                    <Clock className="w-3 h-3" />
                    <span>{formatRelativeDate(mindmap.updatedAt, "es-CL", now)}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
