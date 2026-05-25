"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Plus,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  PlayCircle,
  CheckCircle,
  Layers,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn, spring } from "@/lib/utils";
import CreateSprintModal, { type SprintRow } from "./create-sprint-modal";
import SprintBoard from "./sprint-board";

export type SprintWithStats = SprintRow & {
  totalTasks: number;
  completedTasks: number;
  totalStoryPoints: number;
};

type Props = {
  projectId: string;
  workspaceSlug: string;
  initialSprints: SprintWithStats[];
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function SprintCard({
  sprint,
  onStart,
  onComplete,
  onDelete,
  onOpenBoard,
  starting,
  completing,
}: {
  sprint: SprintWithStats;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenBoard: (id: string) => void;
  starting: boolean;
  completing: boolean;
}) {
  const progress =
    sprint.totalTasks > 0
      ? (sprint.completedTasks / sprint.totalTasks) * 100
      : 0;

  const isActive = sprint.status === "active";
  const isPlanned = sprint.status === "planned";
  const isCompleted = sprint.status === "completed";
  const isCancelled = sprint.status === "cancelled";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={spring}
      className={cn(
        "rounded-xl border p-4 transition-colors",
        isActive
          ? "border-green-500/40 bg-green-500/5"
          : "border-border bg-surface hover:bg-surface-2"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3
              className={cn(
                "font-semibold text-sm",
                isActive ? "text-text" : "text-text"
              )}
            >
              {sprint.name}
            </h3>
            {isActive && (
              <span className="text-xs bg-green-500/15 text-green-500 font-medium px-2 py-0.5 rounded-full border border-green-500/20">
                ACTIVO
              </span>
            )}
            {isCompleted && (
              <span className="text-xs bg-blue-500/10 text-blue-500 font-medium px-2 py-0.5 rounded-full">
                COMPLETADO
              </span>
            )}
            {isCancelled && (
              <span className="text-xs bg-surface-2 text-text-muted font-medium px-2 py-0.5 rounded-full">
                CANCELADO
              </span>
            )}
          </div>

          {sprint.goal && (
            <p className="text-xs text-text-muted mb-2 line-clamp-2">
              {sprint.goal}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-text-muted flex-wrap">
            {(sprint.startDate ?? sprint.endDate) && (
              <div className="flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                <span>
                  {formatDate(sprint.startDate) ?? "—"}
                  {" – "}
                  {formatDate(sprint.endDate) ?? "—"}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Layers className="w-3 h-3" />
              <span>
                {sprint.completedTasks}/{sprint.totalTasks} tareas
              </span>
            </div>
            {sprint.totalStoryPoints > 0 && (
              <span>{sprint.totalStoryPoints} SP</span>
            )}
            {isCompleted && sprint.velocity !== null && sprint.velocity > 0 && (
              <span className="text-blue-500">
                Velocidad: {sprint.velocity} SP
              </span>
            )}
          </div>

          {/* Progress bar */}
          {sprint.totalTasks > 0 && (
            <div className="mt-3">
              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    isCompleted ? "bg-blue-500" : "bg-accent"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-text-muted">
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isActive && (
            <>
              <button
                onClick={() => onOpenBoard(sprint.id)}
                className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors flex items-center gap-1"
              >
                <Zap className="w-3 h-3" />
                Ver sprint
              </button>
              <button
                disabled={completing}
                onClick={() => onComplete(sprint.id)}
                className="px-3 py-1.5 text-xs border border-border text-text-muted hover:text-text hover:bg-surface-2 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <CheckCircle className="w-3 h-3" />
                Completar
              </button>
            </>
          )}
          {isPlanned && (
            <>
              <button
                disabled={starting}
                onClick={() => onStart(sprint.id)}
                className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                {starting ? "Iniciando..." : "Iniciar"}
              </button>
              <button
                onClick={() => onDelete(sprint.id)}
                className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function SprintList({
  projectId,
  workspaceSlug,
  initialSprints,
}: Props) {
  const [sprints, setSprints] = useState<SprintWithStats[]>(initialSprints);
  const [showCreate, setShowCreate] = useState(false);
  const [activeBoardSprintId, setActiveBoardSprintId] = useState<string | null>(
    initialSprints.find((s) => s.status === "active")?.id ?? null
  );
  const [completedOpen, setCompletedOpen] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const reloadSprints = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/sprints`);
      if (!res.ok) return;
      const data = (await res.json()) as { sprints: SprintWithStats[] };
      setSprints(data.sprints);
    } catch {
      // ignore
    }
  }, [projectId]);

  const handleCreated = (sprint: SprintRow) => {
    setSprints((prev) => [
      { ...sprint, totalTasks: 0, completedTasks: 0, totalStoryPoints: 0 },
      ...prev,
    ]);
  };

  const handleStart = async (sprintId: string) => {
    // Check no other active sprint
    const hasActive = sprints.some((s) => s.status === "active");
    if (hasActive) {
      toast.error("Ya hay un sprint activo en este proyecto");
      return;
    }
    setStartingId(sprintId);
    try {
      const res = await fetch(`/api/sprints/${sprintId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Error al iniciar sprint");
        return;
      }
      toast.success("Sprint iniciado");
      await reloadSprints();
      setActiveBoardSprintId(sprintId);
    } finally {
      setStartingId(null);
    }
  };

  const handleComplete = async (sprintId: string) => {
    setCompletingId(sprintId);
    try {
      const res = await fetch(`/api/sprints/${sprintId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Error al completar sprint");
        return;
      }
      toast.success("Sprint completado");
      await reloadSprints();
      setActiveBoardSprintId(null);
    } finally {
      setCompletingId(null);
    }
  };

  const handleDelete = async (sprintId: string) => {
    if (!confirm("¿Eliminar este sprint?")) return;
    try {
      const res = await fetch(`/api/sprints/${sprintId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Error al eliminar");
        return;
      }
      toast.success("Sprint eliminado");
      setSprints((prev) => prev.filter((s) => s.id !== sprintId));
    } catch {
      toast.error("Error de red");
    }
  };

  const activeSprint = sprints.find((s) => s.status === "active");
  const plannedSprints = sprints.filter((s) => s.status === "planned");
  const finishedSprints = sprints.filter(
    (s) => s.status === "completed" || s.status === "cancelled"
  );

  // If showing the board for a sprint, render it
  if (activeBoardSprintId) {
    const boardSprint = sprints.find((s) => s.id === activeBoardSprintId);
    if (boardSprint) {
      return (
        <div className="h-full flex flex-col">
          <div className="px-6 py-3 border-b border-border flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setActiveBoardSprintId(null)}
              className="text-xs text-text-muted hover:text-text transition-colors"
            >
              ← Volver a Sprints
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <SprintBoard
              sprint={boardSprint}
              initialTasks={[]}
              projectId={projectId}
              workspaceSlug={workspaceSlug}
              onSprintUpdated={reloadSprints}
            />
          </div>
        </div>
      );
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <Zap className="w-5 h-5 text-accent" />
              Sprints
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              Organiza el trabajo en ciclos de desarrollo
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Crear Sprint
          </button>
        </div>

        {/* Active sprint */}
        {activeSprint && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Sprint Activo
            </h2>
            <SprintCard
              sprint={activeSprint}
              onStart={handleStart}
              onComplete={handleComplete}
              onDelete={handleDelete}
              onOpenBoard={setActiveBoardSprintId}
              starting={startingId === activeSprint.id}
              completing={completingId === activeSprint.id}
            />
          </section>
        )}

        {/* Planned sprints */}
        {plannedSprints.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Próximos
            </h2>
            <div className="space-y-2">
              <AnimatePresence>
                {plannedSprints.map((sprint) => (
                  <SprintCard
                    key={sprint.id}
                    sprint={sprint}
                    onStart={handleStart}
                    onComplete={handleComplete}
                    onDelete={handleDelete}
                    onOpenBoard={setActiveBoardSprintId}
                    starting={startingId === sprint.id}
                    completing={completingId === sprint.id}
                  />
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* Empty state */}
        {sprints.length === 0 && (
          <div className="text-center py-16">
            <Zap className="w-10 h-10 text-accent/30 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-text mb-1">
              Sin sprints aún
            </h3>
            <p className="text-xs text-text-muted mb-4">
              Crea tu primer sprint para organizar el trabajo del equipo
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent/90 transition-colors mx-auto"
            >
              <Plus className="w-4 h-4" />
              Crear Sprint
            </button>
          </div>
        )}

        {/* Completed / Cancelled */}
        {finishedSprints.length > 0 && (
          <section>
            <button
              onClick={() => setCompletedOpen((v) => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wider hover:text-text transition-colors w-full mb-2"
            >
              {completedOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              Completados ({finishedSprints.length})
            </button>
            <AnimatePresence initial={false}>
              {completedOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden space-y-2"
                >
                  {finishedSprints.map((sprint) => (
                    <SprintCard
                      key={sprint.id}
                      sprint={sprint}
                      onStart={handleStart}
                      onComplete={handleComplete}
                      onDelete={handleDelete}
                      onOpenBoard={setActiveBoardSprintId}
                      starting={false}
                      completing={false}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}
      </div>

      <AnimatePresence>
        {showCreate && (
          <CreateSprintModal
            projectId={projectId}
            onClose={() => setShowCreate(false)}
            onCreated={handleCreated}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
