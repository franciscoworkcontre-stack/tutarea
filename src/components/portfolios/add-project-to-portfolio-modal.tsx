"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type WorkspaceProject = {
  id: string;
  name: string;
  key: string;
  color: string;
  icon: string | null;
};

type Props = {
  portfolioId: string;
  workspaceId: string;
  existingProjectIds: string[];
  onClose: () => void;
  onAdded: () => void;
};

export default function AddProjectToPortfolioModal({
  portfolioId,
  workspaceId,
  existingProjectIds,
  onClose,
  onAdded,
}: Props) {
  const [allProjects, setAllProjects] = useState<WorkspaceProject[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch(`/api/projects?workspaceId=${workspaceId}`);
        if (!res.ok) throw new Error("Error al cargar proyectos");
        const data = (await res.json()) as { projects: WorkspaceProject[] };
        setAllProjects(data.projects ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    }
    void fetchProjects();
  }, [workspaceId]);

  const availableProjects = useMemo(
    () => allProjects.filter((p) => !existingProjectIds.includes(p.id)),
    [allProjects, existingProjectIds]
  );

  const filtered = useMemo(
    () =>
      search.trim()
        ? availableProjects.filter(
            (p) =>
              p.name.toLowerCase().includes(search.toLowerCase()) ||
              p.key.toLowerCase().includes(search.toLowerCase())
          )
        : availableProjects,
    [availableProjects, search]
  );

  function toggleProject(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleAdd() {
    if (selected.size === 0) return;
    setSaving(true);
    setError(null);

    try {
      await Promise.all(
        [...selected].map((projectId) =>
          fetch(`/api/portfolios/${portfolioId}/projects`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId }),
          }).then(async (res) => {
            if (!res.ok && res.status !== 409) {
              const data = (await res.json()) as { error?: string };
              throw new Error(data.error ?? "Error al agregar proyecto");
            }
          })
        )
      );
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-text">Agregar proyectos</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-subtle pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar proyectos…"
              className="w-full pl-9 pr-4 py-2 text-sm bg-surface-2 border border-border rounded-lg text-text placeholder-text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
            />
          </div>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-text-muted">
                {availableProjects.length === 0
                  ? "Todos los proyectos ya están en este portfolio"
                  : "No se encontraron proyectos"}
              </p>
            </div>
          )}

          {!loading &&
            filtered.map((project) => {
              const isSelected = selected.has(project.id);
              return (
                <button
                  key={project.id}
                  onClick={() => toggleProject(project.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                    isSelected
                      ? "bg-accent/10 text-accent"
                      : "hover:bg-surface-2 text-text"
                  )}
                >
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: project.color }}
                  >
                    {project.icon ? (
                      <span className="text-white text-xs">{project.icon}</span>
                    ) : (
                      <span className="text-white text-xs font-bold">
                        {project.name[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{project.name}</p>
                    <p className="text-xs text-text-subtle">{project.key}</p>
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-accent flex-shrink-0" />
                  )}
                </button>
              );
            })}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex-shrink-0 space-y-2">
          {error && (
            <p className="text-xs text-red-500 bg-red-500/10 px-3 py-1.5 rounded-lg">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-text-muted border border-border rounded-lg hover:bg-surface-2 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleAdd}
              disabled={saving || selected.size === 0}
              className="flex-1 px-4 py-2 text-sm font-medium bg-accent text-accent-fg rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving
                ? "Agregando…"
                : `Agregar${selected.size > 0 ? ` (${selected.size})` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
