"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Users, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import AddProjectToPortfolioModal from "./add-project-to-portfolio-modal";

type TaskStats = {
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
};

type PortfolioProject = {
  id: string;
  name: string;
  key: string;
  color: string;
  status: "active" | "archived";
  icon: string | null;
  taskStats: TaskStats;
  completionPercent: number;
  memberCount: number;
  dueDate: string | null;
};

type PortfolioDetail = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  createdAt: string;
};

type Props = {
  portfolio: PortfolioDetail;
  initialProjects: PortfolioProject[];
  workspaceId: string;
  workspaceSlug: string;
};

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-text-muted w-8 text-right tabular-nums">
        {percent}%
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: "active" | "archived" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        status === "active"
          ? "bg-green-500/10 text-green-600 dark:text-green-400"
          : "bg-surface-2 text-text-muted"
      )}
    >
      {status === "active" ? "Activo" : "Archivado"}
    </span>
  );
}

export default function PortfolioView({
  portfolio: initialPortfolio,
  initialProjects,
  workspaceId,
  workspaceSlug,
}: Props) {
  const router = useRouter();
  const [portfolio, setPortfolio] = useState(initialPortfolio);
  const [portfolioProjects, setPortfolioProjects] = useState(initialProjects);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Inline editing for name
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(portfolio.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editingName]);

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === portfolio.name) {
      setNameDraft(portfolio.name);
      setEditingName(false);
      return;
    }
    try {
      const res = await fetch(`/api/portfolios/${portfolio.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        const data = (await res.json()) as { portfolio: PortfolioDetail };
        setPortfolio(data.portfolio);
        setNameDraft(data.portfolio.name);
      }
    } catch {
      setNameDraft(portfolio.name);
    } finally {
      setEditingName(false);
    }
  }

  async function removeProject(projectId: string) {
    try {
      const res = await fetch(`/api/portfolios/${portfolio.id}/projects`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (res.ok) {
        setPortfolioProjects((prev) => prev.filter((p) => p.id !== projectId));
      }
    } catch {
      // ignore
    }
  }

  async function refreshProjects() {
    try {
      const res = await fetch(`/api/portfolios/${portfolio.id}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        portfolio: PortfolioDetail;
        projects: PortfolioProject[];
      };
      setPortfolioProjects(data.projects);
    } catch {
      // ignore
    }
  }

  const existingProjectIds = portfolioProjects.map((p) => p.id);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
              style={{ backgroundColor: portfolio.color }}
            />
            <div className="min-w-0">
              {editingName ? (
                <input
                  ref={nameInputRef}
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={() => void saveName()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void saveName();
                    if (e.key === "Escape") {
                      setNameDraft(portfolio.name);
                      setEditingName(false);
                    }
                  }}
                  className="text-xl font-semibold text-text bg-surface border border-accent rounded-lg px-2 py-0.5 focus:outline-none w-full"
                />
              ) : (
                <h1
                  onClick={() => setEditingName(true)}
                  className="text-xl font-semibold text-text cursor-text hover:text-accent transition-colors"
                  title="Haz clic para editar"
                >
                  {portfolio.name}
                </h1>
              )}
              {portfolio.description && (
                <p className="text-sm text-text-subtle mt-0.5">
                  {portfolio.description}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-accent text-accent-fg rounded-lg hover:bg-accent/90 transition-colors flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar proyecto</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        {portfolioProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
              <Plus className="w-6 h-6 text-text-muted" />
            </div>
            <h3 className="font-medium text-text mb-1">Sin proyectos</h3>
            <p className="text-sm text-text-subtle max-w-xs mb-5">
              Agrega proyectos a este portfolio para monitorear su progreso
              de forma conjunta.
            </p>
            <button
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-accent text-accent-fg rounded-lg hover:bg-accent/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar proyecto</span>
            </button>
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-2 border-b border-border">
                  <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider">
                    Proyecto
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider hidden sm:table-cell">
                    Estado
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider">
                    Progreso
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider hidden md:table-cell">
                    Tareas
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider hidden md:table-cell">
                    Vencidas
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider hidden lg:table-cell">
                    Miembros
                  </th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {portfolioProjects.map((project) => (
                  <tr
                    key={project.id}
                    className="hover:bg-surface-2/50 transition-colors group"
                  >
                    {/* Project name + icon */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: project.color }}
                        >
                          {project.icon ? (
                            <span className="text-white text-xs">
                              {project.icon}
                            </span>
                          ) : (
                            <span className="text-white text-xs font-bold">
                              {project.name[0]?.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <button
                            onClick={() =>
                              router.push(
                                `/app/${workspaceSlug}/projects/${project.id}/board`
                              )
                            }
                            className="font-medium text-text hover:text-accent transition-colors truncate max-w-[160px] block"
                          >
                            {project.name}
                          </button>
                          <p className="text-xs text-text-subtle">{project.key}</p>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <StatusBadge status={project.status} />
                    </td>

                    {/* Progress */}
                    <td className="px-4 py-3 min-w-[140px]">
                      <ProgressBar
                        percent={project.completionPercent}
                        color={project.color}
                      />
                    </td>

                    {/* Task counts */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-2.5 text-xs text-text-muted">
                        <span
                          className="flex items-center gap-1"
                          title="Total"
                        >
                          {project.taskStats.total}
                        </span>
                        <span className="text-border">·</span>
                        <span
                          className="flex items-center gap-1 text-green-500"
                          title="Completadas"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {project.taskStats.completed}
                        </span>
                        <span className="text-border">·</span>
                        <span
                          className="flex items-center gap-1 text-blue-500"
                          title="En progreso"
                        >
                          <Clock className="w-3 h-3" />
                          {project.taskStats.inProgress}
                        </span>
                      </div>
                    </td>

                    {/* Overdue */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      {project.taskStats.overdue > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-xs font-medium">
                          <AlertCircle className="w-3 h-3" />
                          {project.taskStats.overdue}
                        </span>
                      ) : (
                        <span className="text-xs text-text-subtle">—</span>
                      )}
                    </td>

                    {/* Members */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="flex items-center gap-1 text-xs text-text-muted">
                        <Users className="w-3.5 h-3.5" />
                        {project.memberCount}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => void removeProject(project.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-text-subtle hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Quitar del portfolio"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {addModalOpen && (
        <AddProjectToPortfolioModal
          portfolioId={portfolio.id}
          workspaceId={workspaceId}
          existingProjectIds={existingProjectIds}
          onClose={() => setAddModalOpen(false)}
          onAdded={() => void refreshProjects()}
        />
      )}
    </div>
  );
}
