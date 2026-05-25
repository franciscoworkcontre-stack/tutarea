"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Plus,
  Brain,
  Clock,
  X,
  MoreHorizontal,
  Edit3,
  Copy,
  Archive,
  Trash2,
  Circle,
  Network,
  GitBranch,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, formatRelativeDate } from "@/lib/utils";
import { useNow } from "@/lib/hooks";
import type { InferSelectModel } from "drizzle-orm";
import type { mindmaps } from "@/db/schema";

type Mindmap = InferSelectModel<typeof mindmaps> & { nodeCount?: number };

type Props = {
  projectId: string;
  workspaceSlug: string;
  initialMindmaps: Mindmap[];
  canCreate: boolean;
};

type StatusFilter = "all" | "active" | "archived";

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

const LAYOUT_LABELS: Record<string, string> = {
  radial: "Radial",
  "tree-h": "Árbol H",
  "tree-v": "Árbol V",
};

const LAYOUT_ICONS: Record<string, React.ReactNode> = {
  radial: <Circle className="w-3 h-3" />,
  "tree-h": <Network className="w-3 h-3" />,
  "tree-v": <GitBranch className="w-3 h-3" />,
};

const THEME_COLORS: Record<string, string> = {
  light: "#f8fafc",
  dark: "#0f172a",
  blueprint: "#1e3a8a",
  sepia: "#fef3c7",
};

const LAYOUT_OPTIONS = [
  { value: "radial", label: "Radial" },
  { value: "tree-h", label: "Árbol Horizontal" },
  { value: "tree-v", label: "Árbol Vertical" },
];

type DropdownProps = {
  mindmap: Mindmap;
  onEdit: (m: Mindmap) => void;
  onDuplicate: (m: Mindmap) => void;
  onArchive: (m: Mindmap) => void;
  onDelete: (m: Mindmap) => void;
};

function CardDropdown({ mindmap, onEdit, onDuplicate, onArchive, onDelete }: DropdownProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full mt-1 z-20 w-40 bg-background border border-border rounded-xl shadow-2xl overflow-hidden"
            >
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEdit(mindmap);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Editar
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDuplicate(mindmap);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Duplicar
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onArchive(mindmap);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
              >
                <Archive className="w-3.5 h-3.5" />
                {mindmap.status === "archived" ? "Desarchivar" : "Archivar"}
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(mindmap);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function MindmapList({
  projectId,
  workspaceSlug,
  initialMindmaps,
  canCreate,
}: Props) {
  const router = useRouter();
  const [mindmaps, setMindmaps] = useState<Mindmap[]>(initialMindmaps);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [creating, setCreating] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createLayout, setCreateLayout] = useState<"radial" | "tree-h" | "tree-v">("radial");
  const [createLoading, setCreateLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const now = useNow();

  const filtered = mindmaps.filter((m) => {
    if (statusFilter === "active") return m.status !== "archived";
    if (statusFilter === "archived") return m.status === "archived";
    return true;
  });

  const handleCreate = useCallback(async () => {
    if (!createTitle.trim()) return;
    setCreateLoading(true);
    try {
      const res = await fetch("/api/mindmaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: createTitle.trim(),
          description: createDesc.trim() || null,
          layout: createLayout,
        }),
      });
      if (!res.ok) throw new Error("Error al crear");
      const { mindmap: created } = (await res.json()) as { mindmap: Mindmap };
      setMindmaps((prev) => [created, ...prev]);
      setCreateTitle("");
      setCreateDesc("");
      setCreateLayout("radial");
      setCreating(false);
      toast.success("Mapa mental creado");
      router.push(`/app/${workspaceSlug}/projects/${projectId}/mindmaps/${created.id}`);
    } catch {
      toast.error("No se pudo crear el mapa mental");
    } finally {
      setCreateLoading(false);
    }
  }, [createTitle, createDesc, createLayout, projectId, workspaceSlug, router]);

  const handleEdit = useCallback(
    async (id: string) => {
      const m = mindmaps.find((mm) => mm.id === id);
      if (!m) return;
      try {
        const res = await fetch(`/api/mindmaps/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editTitle.trim() || m.title,
            description: editDesc.trim() || null,
          }),
        });
        if (!res.ok) throw new Error();
        const { mindmap: updated } = (await res.json()) as { mindmap: Mindmap };
        setMindmaps((prev) =>
          prev.map((mm) => (mm.id === id ? { ...mm, ...updated } : mm))
        );
        toast.success("Mapa mental actualizado");
      } catch {
        toast.error("No se pudo actualizar");
      } finally {
        setEditingId(null);
      }
    },
    [mindmaps, editTitle, editDesc]
  );

  const handleDuplicate = useCallback(
    async (m: Mindmap) => {
      try {
        const res = await fetch("/api/mindmaps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            title: `${m.title} (copia)`,
            description: m.description,
            layout: m.layout,
          }),
        });
        if (!res.ok) throw new Error();
        const { mindmap: created } = (await res.json()) as { mindmap: Mindmap };
        setMindmaps((prev) => [created, ...prev]);
        toast.success("Mapa duplicado");
      } catch {
        toast.error("No se pudo duplicar");
      }
    },
    [projectId]
  );

  const handleArchive = useCallback(async (m: Mindmap) => {
    const newStatus = m.status === "archived" ? "active" : "archived";
    try {
      const res = await fetch(`/api/mindmaps/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      setMindmaps((prev) =>
        prev.map((mm) => (mm.id === m.id ? { ...mm, status: newStatus } : mm))
      );
      toast.success(newStatus === "archived" ? "Archivado" : "Desarchivado");
    } catch {
      toast.error("No se pudo actualizar el estado");
    }
  }, []);

  const handleDelete = useCallback(async (m: Mindmap) => {
    if (
      !window.confirm(
        `¿Eliminar "${m.title}"? Esta acción no se puede deshacer.`
      )
    )
      return;
    try {
      const res = await fetch(`/api/mindmaps/${m.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setMindmaps((prev) => prev.filter((mm) => mm.id !== m.id));
      toast.success("Mapa mental eliminado");
    } catch {
      toast.error("No se pudo eliminar");
    }
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-medium">Mapas mentales</span>
          <span className="text-xs text-text-subtle bg-surface-2 px-1.5 py-0.5 rounded-full border border-border">
            {filtered.length}
          </span>
        </div>
        {canCreate && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-accent text-accent-fg hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo Mindmap
          </button>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {(
          [
            { key: "all", label: "Todos" },
            { key: "active", label: "Activos" },
            { key: "archived", label: "Archivados" },
          ] as { key: StatusFilter; label: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              "text-xs px-3 py-2 border-b-2 transition-colors font-medium",
              statusFilter === tab.key
                ? "border-accent text-accent"
                : "border-transparent text-text-muted hover:text-text"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Create form */}
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
                  onClick={() => {
                    setCreateTitle("");
                    setCreateDesc("");
                    setCreating(false);
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                autoFocus
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") {
                    setCreateTitle("");
                    setCreateDesc("");
                    setCreating(false);
                  }
                }}
                placeholder="Título del mapa mental..."
                className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 outline-none focus:border-accent/50 placeholder:text-text-subtle transition-colors"
              />
              <textarea
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="Descripción (opcional)..."
                rows={2}
                className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 outline-none focus:border-accent/50 placeholder:text-text-subtle transition-colors resize-none"
              />
              {/* Layout selector */}
              <div className="space-y-1.5">
                <label className="text-xs text-text-muted">Layout inicial</label>
                <div className="flex gap-2">
                  {LAYOUT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() =>
                        setCreateLayout(opt.value as "radial" | "tree-h" | "tree-v")
                      }
                      className={cn(
                        "flex-1 text-xs px-2 py-1.5 rounded border transition-colors flex items-center justify-center gap-1",
                        createLayout === opt.value
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border text-text-muted hover:border-border-strong"
                      )}
                    >
                      {LAYOUT_ICONS[opt.value]}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={!createTitle.trim() || createLoading}
                  className="text-sm px-3 py-1.5 rounded-lg font-medium bg-accent text-accent-fg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {createLoading ? "Creando..." : "Crear"}
                </button>
                <button
                  onClick={() => {
                    setCreateTitle("");
                    setCreateDesc("");
                    setCreating(false);
                  }}
                  className="text-sm px-3 py-1.5 rounded-lg text-text-muted hover:text-text transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {filtered.length === 0 && !creating ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-text-subtle border border-dashed border-border/50 rounded-xl">
          <Brain className="w-10 h-10 opacity-30" />
          <p className="text-sm">
            {statusFilter === "archived"
              ? "No hay mapas archivados"
              : statusFilter === "active"
              ? "No hay mapas activos"
              : "No hay mapas mentales en este proyecto"}
          </p>
          {canCreate && statusFilter !== "archived" && (
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
            {filtered.map((mindmap, i) => (
              <motion.div
                key={mindmap.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{
                  delay: i * 0.04,
                  duration: 0.2,
                  ease: [0.32, 0.72, 0, 1],
                }}
                className="group"
              >
                {editingId === mindmap.id ? (
                  /* Inline edit form */
                  <div className="rounded-xl border border-accent/30 bg-surface p-4 space-y-3">
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleEdit(mindmap.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 outline-none focus:border-accent/50"
                    />
                    <textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Descripción (opcional)..."
                      rows={2}
                      className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 outline-none focus:border-accent/50 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(mindmap.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-accent text-accent-fg hover:bg-accent/90 transition-colors"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs px-3 py-1.5 rounded-lg text-text-muted hover:text-text transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <Link
                    href={`/app/${workspaceSlug}/projects/${projectId}/mindmaps/${mindmap.id}`}
                    className={cn(
                      "flex flex-col rounded-xl border bg-background gap-0 overflow-hidden",
                      "border-border hover:border-border-strong hover:shadow-2 transition-all h-full"
                    )}
                  >
                    {/* Preview area */}
                    <div
                      className="h-28 flex items-center justify-center relative overflow-hidden"
                      style={{ backgroundColor: THEME_COLORS[mindmap.theme] ?? "#f8fafc" }}
                    >
                      <Brain
                        className="w-10 h-10 opacity-20"
                        style={{
                          color: mindmap.theme === "dark" || mindmap.theme === "blueprint" ? "#fff" : "#64748b",
                        }}
                      />
                      {/* Decorative mini-node dots */}
                      <div className="absolute inset-0 pointer-events-none">
                        {[
                          { x: "30%", y: "40%", size: "w-2 h-2" },
                          { x: "55%", y: "30%", size: "w-1.5 h-1.5" },
                          { x: "65%", y: "55%", size: "w-1.5 h-1.5" },
                          { x: "40%", y: "65%", size: "w-1.5 h-1.5" },
                        ].map((dot, di) => (
                          <div
                            key={di}
                            className={cn("absolute rounded-full", dot.size)}
                            style={{
                              left: dot.x,
                              top: dot.y,
                              backgroundColor:
                                mindmap.theme === "dark" || mindmap.theme === "blueprint"
                                  ? "rgba(255,255,255,0.3)"
                                  : "rgba(100,116,139,0.3)",
                            }}
                          />
                        ))}
                      </div>

                      {/* Status badge overlay */}
                      <div className="absolute top-2 right-2">
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full border",
                            STATUS_STYLES[mindmap.status]
                          )}
                        >
                          {STATUS_LABELS[mindmap.status]}
                        </span>
                      </div>

                      {/* Hover actions */}
                      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <CardDropdown
                          mindmap={mindmap}
                          onEdit={(m) => {
                            setEditingId(m.id);
                            setEditTitle(m.title);
                            setEditDesc(m.description ?? "");
                          }}
                          onDuplicate={handleDuplicate}
                          onArchive={handleArchive}
                          onDelete={handleDelete}
                        />
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="p-3 flex flex-col gap-2 flex-1">
                      <div className="flex items-start justify-between gap-1 min-w-0">
                        <span className="text-sm font-medium leading-snug truncate group-hover:text-accent transition-colors">
                          {mindmap.title}
                        </span>
                      </div>

                      {mindmap.description && (
                        <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                          {mindmap.description}
                        </p>
                      )}

                      {/* Meta row */}
                      <div className="flex items-center gap-2 mt-auto flex-wrap">
                        {/* Layout badge */}
                        <span className="flex items-center gap-1 text-xs text-text-subtle bg-surface-2 px-1.5 py-0.5 rounded border border-border">
                          {LAYOUT_ICONS[mindmap.layout]}
                          {LAYOUT_LABELS[mindmap.layout] ?? mindmap.layout}
                        </span>

                        {/* Theme dot */}
                        <span
                          className="w-3 h-3 rounded-full border border-border flex-shrink-0"
                          style={{ backgroundColor: THEME_COLORS[mindmap.theme] ?? "#f8fafc" }}
                          title={mindmap.theme}
                        />

                        {/* Node count */}
                        {mindmap.nodeCount !== undefined && (
                          <span className="text-xs text-text-subtle">
                            {mindmap.nodeCount} nodo{mindmap.nodeCount !== 1 ? "s" : ""}
                          </span>
                        )}

                        {/* Updated */}
                        <span className="flex items-center gap-1 text-xs text-text-subtle ml-auto">
                          <Clock className="w-3 h-3" />
                          {formatRelativeDate(mindmap.updatedAt, "es-CL", now)}
                        </span>
                      </div>
                    </div>
                  </Link>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
