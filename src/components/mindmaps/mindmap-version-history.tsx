"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, History, Clock, RotateCcw, Camera, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Version = {
  id: string;
  mindmapId: string;
  version: number;
  createdBy: string;
  createdAt: string;
  author?: { id: string; fullName: string | null; avatarUrl: string | null } | null;
};

type Props = {
  mindmapId: string;
  currentVersion: number;
  onClose: () => void;
  onRestored?: () => void;
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

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

export default function MindmapVersionHistory({
  mindmapId,
  currentVersion,
  onClose,
  onRestored,
}: Props) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  const fetchVersions = useCallback(() => {
    setLoading(true);
    fetch(`/api/mindmaps/${mindmapId}/versions`)
      .then((r) => (r.ok ? r.json() : { versions: [] }))
      .then((data) => setVersions((data.versions ?? []) as Version[]))
      .catch(() => {
        toast.error("No se pudieron cargar las versiones");
        setVersions([]);
      })
      .finally(() => setLoading(false));
  }, [mindmapId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const handleCreateSnapshot = useCallback(async () => {
    setCreatingSnapshot(true);
    try {
      const res = await fetch(`/api/mindmaps/${mindmapId}/versions`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const { version } = (await res.json()) as { version: Version };
      setVersions((prev) => [version, ...prev]);
      toast.success(`Snapshot v${version.version} creado`);
    } catch {
      toast.error("No se pudo crear el snapshot");
    } finally {
      setCreatingSnapshot(false);
    }
  }, [mindmapId]);

  const handleRestore = useCallback(
    async (versionId: string, versionNumber: number) => {
      setRestoringId(versionId);
      setConfirmRestoreId(null);
      try {
        const res = await fetch(
          `/api/mindmaps/${mindmapId}/versions/${versionId}/restore`,
          { method: "POST" }
        );
        if (!res.ok) throw new Error();
        toast.success(`Restaurado a v${versionNumber}`);
        onRestored?.();
        onClose();
      } catch {
        toast.error("No se pudo restaurar la versión");
      } finally {
        setRestoringId(null);
      }
    },
    [mindmapId, onRestored, onClose]
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/30"
          onClick={onClose}
        />

        {/* Drawer */}
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="relative ml-auto z-10 w-full max-w-sm bg-background border-l border-border h-full flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold">Historial de versiones</span>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Current version info */}
          <div className="px-4 py-2.5 bg-accent/5 border-b border-border flex-shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-muted">Versión actual:</span>
              <span className="text-xs font-semibold text-accent">v{currentVersion}</span>
            </div>
            <button
              onClick={handleCreateSnapshot}
              disabled={creatingSnapshot}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
            >
              {creatingSnapshot ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Camera className="w-3 h-3" />
              )}
              {creatingSnapshot ? "Guardando..." : "Crear snapshot"}
            </button>
          </div>

          {/* Version list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-text-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Cargando versiones...</span>
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-text-subtle">
                <History className="w-8 h-8 opacity-30" />
                <p className="text-sm">No hay versiones guardadas</p>
                <p className="text-xs text-center px-4">
                  Crea un snapshot para guardar el estado actual del mapa
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {versions.map((v) => {
                  const isCurrent = v.version === currentVersion;
                  const isRestoring = restoringId === v.id;
                  const isConfirming = confirmRestoreId === v.id;

                  return (
                    <li key={v.id} className={cn("px-4 py-3", isCurrent && "bg-accent/5")}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "text-sm font-semibold",
                                isCurrent ? "text-accent" : "text-text"
                              )}
                            >
                              v{v.version}
                            </span>
                            {isCurrent && (
                              <span className="text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">
                                actual
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Clock className="w-3 h-3 text-text-subtle flex-shrink-0" />
                            <span className="text-xs text-text-muted">{formatDate(v.createdAt)}</span>
                          </div>
                          {v.author && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <div className="w-4 h-4 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center flex-shrink-0 font-medium text-[10px]">
                                {v.author.avatarUrl ? (
                                  <img
                                    src={v.author.avatarUrl}
                                    alt={v.author.fullName ?? ""}
                                    className="w-4 h-4 rounded-full object-cover"
                                  />
                                ) : (
                                  getInitials(v.author.fullName)
                                )}
                              </div>
                              <span className="text-xs text-text-muted truncate">
                                {v.author.fullName ?? "Usuario"}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Restore button */}
                        {!isCurrent && (
                          <div className="flex-shrink-0">
                            {isConfirming ? (
                              <div className="flex flex-col gap-1 items-end">
                                <div className="flex items-center gap-1 text-xs text-amber-500">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>¿Restaurar?</span>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleRestore(v.id, v.version)}
                                    disabled={isRestoring}
                                    className="text-xs px-2 py-1 rounded bg-accent text-accent-fg hover:bg-accent/90 transition-colors disabled:opacity-50"
                                  >
                                    {isRestoring ? "..." : "Sí"}
                                  </button>
                                  <button
                                    onClick={() => setConfirmRestoreId(null)}
                                    className="text-xs px-2 py-1 rounded border border-border text-text-muted hover:text-text transition-colors"
                                  >
                                    No
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmRestoreId(v.id)}
                                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border text-text-muted hover:border-accent/50 hover:text-accent transition-colors"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Restaurar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </motion.aside>
      </div>
    </AnimatePresence>
  );
}
