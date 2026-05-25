"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Clock,
  Plus,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import SprintTaskPicker from "./sprint-task-picker";
import SprintBurndown from "./sprint-burndown";

type Profile = {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
};

type TaskStatus = {
  id: string;
  name: string;
  color: string;
  type: string;
};

type SprintTask = {
  id: string;
  sprintId: string;
  taskId: string;
  storyPoints: number | null;
  task: {
    id: string;
    key: string;
    title: string;
    priority: string;
    assigneeId: string | null;
    status: TaskStatus | null;
    assigneeProfile: Profile | null;
  };
};

type Sprint = {
  id: string;
  name: string;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  status: "planned" | "active" | "completed" | "cancelled";
};

type Props = {
  sprint: Sprint;
  initialTasks: SprintTask[];
  projectId: string;
  workspaceSlug: string;
  onSprintUpdated: () => void;
};

const STATUS_ORDER = ["backlog", "todo", "in_progress", "review", "done", "cancelled"];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-400",
  no_priority: "bg-border",
};

function TaskCard({
  sprintTask,
  isDragging = false,
}: {
  sprintTask: SprintTask;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: sprintTask.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const t = sprintTask.task;
  const priorityColor = PRIORITY_COLORS[t.priority] ?? "bg-border";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "bg-surface-2 border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing",
        "hover:border-accent/30 transition-colors"
      )}
    >
      <div className="flex items-start gap-2">
        <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0", priorityColor)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-text-muted font-mono">{t.key}</span>
            {sprintTask.storyPoints !== null && (
              <span className="text-xs bg-surface border border-border rounded px-1.5 py-0.5 text-text-muted">
                {sprintTask.storyPoints} SP
              </span>
            )}
          </div>
          <p className="text-sm text-text leading-snug">{t.title}</p>
        </div>
        {t.assigneeProfile?.avatarUrl ? (
          <img
            src={t.assigneeProfile.avatarUrl}
            alt={t.assigneeProfile.fullName ?? ""}
            className="w-5 h-5 rounded-full flex-shrink-0"
          />
        ) : t.assigneeProfile ? (
          <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
            <span className="text-[8px] font-bold text-accent">
              {(t.assigneeProfile.fullName ?? "?")[0]?.toUpperCase()}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TaskCardOverlay({ sprintTask }: { sprintTask: SprintTask }) {
  const t = sprintTask.task;
  const priorityColor = PRIORITY_COLORS[t.priority] ?? "bg-border";
  return (
    <div className="bg-surface-2 border border-accent/40 rounded-lg p-3 shadow-lg rotate-1 w-64">
      <div className="flex items-start gap-2">
        <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0", priorityColor)} />
        <div className="flex-1 min-w-0">
          <span className="text-xs text-text-muted font-mono">{t.key}</span>
          <p className="text-sm text-text leading-snug">{t.title}</p>
        </div>
      </div>
    </div>
  );
}

export default function SprintBoard({
  sprint,
  initialTasks,
  projectId,
  onSprintUpdated,
}: Props) {
  const [tasks, setTasks] = useState<SprintTask[]>(initialTasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showBurndown, setShowBurndown] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Group tasks by status type
  const grouped = STATUS_ORDER.reduce<Record<string, SprintTask[]>>(
    (acc, statusType) => {
      acc[statusType] = tasks.filter(
        (st) => st.task.status?.type === statusType
      );
      return acc;
    },
    {}
  );

  // Tasks with unknown/null status go to backlog
  const noStatusTasks = tasks.filter((st) => !st.task.status);
  if (grouped["backlog"]) {
    grouped["backlog"] = [...(grouped["backlog"] ?? []), ...noStatusTasks];
  }

  const STATUS_LABELS: Record<string, string> = {
    backlog: "Backlog",
    todo: "Por hacer",
    in_progress: "En progreso",
    review: "En revisión",
    done: "Hecho",
    cancelled: "Cancelado",
  };

  const visibleStatuses = STATUS_ORDER.filter(
    (s) => (grouped[s]?.length ?? 0) > 0 || ["backlog", "todo", "in_progress"].includes(s)
  );

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  const handleDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      setActiveId(active.id as string);
    },
    []
  );

  const handleDragEnd = useCallback(
    async ({ active, over }: DragEndEvent) => {
      setActiveId(null);
      if (!over || active.id === over.id) return;

      // Find the task being dragged and the target column (over.id = statusType)
      const draggedTask = tasks.find((t) => t.id === active.id);
      if (!draggedTask) return;

      const targetStatusType = over.id as string;
      if (!STATUS_ORDER.includes(targetStatusType)) return;

      // Find the target status id by looking at another task in that column
      const targetTask = tasks.find(
        (t) => t.task.status?.type === targetStatusType
      );

      if (!targetTask?.task.status) return;

      const newStatusId = targetTask.task.status.id;

      // Optimistic update
      setTasks((prev) =>
        prev.map((t) =>
          t.id === draggedTask.id
            ? {
                ...t,
                task: { ...t.task, status: targetTask.task.status },
              }
            : t
        )
      );

      try {
        const res = await fetch(`/api/tasks/${draggedTask.taskId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ statusId: newStatusId }),
        });
        if (!res.ok) throw new Error("Failed to update");
      } catch {
        toast.error("Error al actualizar tarea");
        setTasks(initialTasks);
      }
    },
    [tasks, initialTasks]
  );

  // Sprint metadata
  const startDate = sprint.startDate
    ? new Date(sprint.startDate).toLocaleDateString("es-CL", {
        day: "numeric",
        month: "short",
      })
    : null;
  const endDate = sprint.endDate
    ? new Date(sprint.endDate).toLocaleDateString("es-CL", {
        day: "numeric",
        month: "short",
      })
    : null;
  const daysLeft =
    sprint.endDate
      ? Math.max(
          0,
          Math.ceil(
            (new Date(sprint.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          )
        )
      : null;

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.task.status?.type === "done").length;
  const progress = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

  const handleTasksAdded = useCallback(async () => {
    // Refetch tasks
    try {
      const res = await fetch(`/api/sprints/${sprint.id}/tasks`);
      if (!res.ok) return;
      const data = (await res.json()) as { tasks: SprintTask[] };
      setTasks(data.tasks);
    } catch {
      // ignore
    }
    onSprintUpdated();
  }, [sprint.id, onSprintUpdated]);

  return (
    <div className="flex flex-col h-full">
      {/* Sprint header */}
      <div className="bg-surface border-b border-border px-6 py-4 flex-shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-semibold text-text">{sprint.name}</h2>
              <span className="text-xs bg-green-500/10 text-green-500 font-medium px-2 py-0.5 rounded-full">
                ACTIVO
              </span>
            </div>
            {sprint.goal && (
              <p className="text-sm text-text-muted">{sprint.goal}</p>
            )}
            <div className="flex items-center gap-4 mt-2">
              {startDate && endDate && (
                <div className="flex items-center gap-1 text-xs text-text-muted">
                  <CalendarDays className="w-3 h-3" />
                  <span>
                    {startDate} - {endDate}
                  </span>
                </div>
              )}
              {daysLeft !== null && (
                <div
                  className={cn(
                    "flex items-center gap-1 text-xs font-medium",
                    daysLeft <= 2 ? "text-red-500" : "text-text-muted"
                  )}
                >
                  <Clock className="w-3 h-3" />
                  <span>
                    {daysLeft === 0
                      ? "Vence hoy"
                      : `${daysLeft} día(s) restante(s)`}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1 text-xs text-text-muted">
                <CheckCircle2 className="w-3 h-3" />
                <span>
                  {doneTasks}/{totalTasks} tareas
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBurndown((v) => !v)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-lg border transition-colors",
                showBurndown
                  ? "bg-accent/10 text-accent border-accent/30"
                  : "border-border text-text-muted hover:text-text hover:bg-surface-2"
              )}
            >
              Burndown
            </button>
            <button
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar tarea
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-muted">Progreso</span>
            <span className="text-xs font-medium text-text">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-accent rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Burndown chart */}
        {showBurndown && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-4 bg-surface-2 rounded-lg p-4 overflow-hidden"
          >
            <SprintBurndown sprintId={sprint.id} />
          </motion.div>
        )}
      </div>

      {/* Kanban columns */}
      <div className="flex-1 overflow-x-auto p-4">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full">
            {visibleStatuses.map((statusType) => {
              const columnTasks = grouped[statusType] ?? [];
              return (
                <div
                  key={statusType}
                  className="flex flex-col min-w-[260px] max-w-[280px]"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                      {STATUS_LABELS[statusType] ?? statusType}
                    </h3>
                    <span className="text-xs text-text-muted bg-surface-2 rounded-full px-1.5 py-0.5">
                      {columnTasks.length}
                    </span>
                  </div>
                  <div
                    className="flex-1 rounded-lg min-h-[100px] p-2 bg-surface-2/50 border border-dashed border-border"
                    data-column-id={statusType}
                  >
                    <SortableContext
                      items={columnTasks.map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                      id={statusType}
                    >
                      <div className="space-y-2">
                        {columnTasks.map((st) => (
                          <TaskCard
                            key={st.id}
                            sprintTask={st}
                            isDragging={activeId === st.id}
                          />
                        ))}
                      </div>
                    </SortableContext>
                    {columnTasks.length === 0 && (
                      <div className="flex items-center justify-center h-16 text-xs text-text-muted">
                        <AlertCircle className="w-3.5 h-3.5 mr-1 opacity-50" />
                        Sin tareas
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <DragOverlay>
            {activeTask && <TaskCardOverlay sprintTask={activeTask} />}
          </DragOverlay>
        </DndContext>
      </div>

      {showPicker && (
        <SprintTaskPicker
          sprintId={sprint.id}
          projectId={projectId}
          onClose={() => setShowPicker(false)}
          onAdded={handleTasksAdded}
        />
      )}
    </div>
  );
}
