"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { toast } from "sonner";
import { LayoutGrid, List, GanttChart } from "lucide-react";
import { generateKeyBetween } from "fractional-indexing";
import { cn } from "@/lib/utils";
import Link from "next/link";
import BoardColumn from "./board-column";
import TaskCard from "./task-card";
import type { InferSelectModel } from "drizzle-orm";
import type { tasks, taskStatuses, projects, profiles } from "@/db/schema";

type Task = InferSelectModel<typeof tasks>;
type Status = InferSelectModel<typeof taskStatuses>;
type Project = InferSelectModel<typeof projects>;
type Profile = InferSelectModel<typeof profiles>;

type Member = {
  userId: string;
  role: string;
  profile: Profile | null;
};

type Props = {
  project: Project;
  statuses: Status[];
  initialTasks: Task[];
  members: Member[];
  currentUserId: string;
  workspaceSlug: string;
};

export default function BoardView({
  project,
  statuses,
  initialTasks,
  members,
  currentUserId,
  workspaceSlug,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const getTasksByStatus = (statusId: string) =>
    tasks
      .filter((t) => t.statusId === statusId)
      .sort((a, b) => a.position.localeCompare(b.position));

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    // Dragging over a column (status)
    const newStatusId = statuses.find((s) => s.id === over.id)?.id;
    if (newStatusId && activeTask.statusId !== newStatusId) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === activeTask.id ? { ...t, statusId: newStatusId } : t
        )
      );
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const movedTask = tasks.find((t) => t.id === active.id);
    if (!movedTask) return;

    // Determine target status
    let targetStatusId = movedTask.statusId;
    const overStatus = statuses.find((s) => s.id === over.id);
    const overTask = tasks.find((t) => t.id === over.id);

    if (overStatus) {
      targetStatusId = overStatus.id;
    } else if (overTask) {
      targetStatusId = overTask.statusId;
    }

    // Calculate new position
    const columnTasks = tasks
      .filter((t) => t.statusId === targetStatusId && t.id !== movedTask.id)
      .sort((a, b) => a.position.localeCompare(b.position));

    let newPosition: string;
    if (overTask && overTask.id !== movedTask.id) {
      const overIndex = columnTasks.findIndex((t) => t.id === overTask.id);
      const before = columnTasks[overIndex - 1]?.position ?? null;
      const after = columnTasks[overIndex]?.position ?? null;
      newPosition = generateKeyBetween(before, after);
    } else {
      const lastTask = columnTasks[columnTasks.length - 1];
      newPosition = generateKeyBetween(lastTask?.position ?? null, null);
    }

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === movedTask.id
          ? { ...t, statusId: targetStatusId ?? t.statusId, position: newPosition }
          : t
      )
    );

    // Server update
    startTransition(async () => {
      try {
        const res = await fetch(`/api/tasks/${movedTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            statusId: targetStatusId,
            position: newPosition,
          }),
        });
        if (!res.ok) throw new Error("Error al mover tarea");
      } catch {
        // Rollback
        setTasks(initialTasks);
        toast.error("Error al guardar el cambio");
      }
    });
  };

  const handleAddTask = async (statusId: string, title: string, assigneeId?: string | null) => {
    const columnTasks = getTasksByStatus(statusId);
    const lastTask = columnTasks[columnTasks.length - 1];
    const position = generateKeyBetween(lastTask?.position ?? null, null);

    // Optimistic add
    const tempId = `temp-${Date.now()}`;
    const optimisticTask: Task = {
      id: tempId,
      projectId: project.id,
      workspaceId: project.workspaceId,
      key: `${project.key}-?`,
      title,
      statusId,
      priority: "no_priority",
      position,
      assigneeId: assigneeId ?? null,
      reporterId: null,
      parentTaskId: null,
      description: null,
      dueDate: null,
      startDate: null,
      estimateHours: null,
      archivedAt: null,
      createdBy: currentUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setTasks((prev) => [...prev, optimisticTask]);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          projectId: project.id,
          statusId,
          assigneeId: assigneeId ?? undefined,
        }),
      });
      if (!res.ok) throw new Error("Error al crear tarea");
      const body = (await res.json()) as { task: Task };
      setTasks((prev) =>
        prev.map((t) => (t.id === tempId ? body.task : t))
      );
    } catch {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      toast.error("Error al crear tarea");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* View header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: project.color }}
          >
            {project.key[0]}
          </div>
          <span className="font-semibold">{project.name}</span>
          <span className="text-xs text-text-subtle px-1.5 py-0.5 rounded bg-surface-2 border border-border font-mono">
            {project.key}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {[
            { href: "board", icon: LayoutGrid, label: "Kanban" },
            { href: "list", icon: List, label: "Lista" },
            { href: "gantt", icon: GanttChart, label: "Gantt" },
          ].map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={`/app/${workspaceSlug}/projects/${project.id}/${href}`}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors",
                href === "board"
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-text-muted hover:text-text hover:bg-surface-2"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 p-6 h-full min-w-max">
            {statuses.map((status, i) => {
              const columnTasks = getTasksByStatus(status.id);
              return (
                <motion.div
                  key={status.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                >
                  <SortableContext
                    items={columnTasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <BoardColumn
                      status={status}
                      tasks={columnTasks}
                      members={members}
                      onAddTask={handleAddTask}
                      workspaceSlug={workspaceSlug}
                      projectId={project.id}
                    />
                  </SortableContext>
                </motion.div>
              );
            })}

            {/* Add column hint */}
            {statuses.length === 0 && (
              <div className="flex items-center justify-center w-64 h-48 rounded-xl border border-dashed border-border text-text-subtle text-sm">
                No hay columnas. Agrega un estado al proyecto.
              </div>
            )}
          </div>

          <DragOverlay>
            {activeTask ? (
              <motion.div
                initial={{ scale: 1.02, rotate: 1 }}
                style={{ boxShadow: "0 12px 32px -8px rgb(0 0 0 / 0.3)" }}
              >
                <TaskCard
                  task={activeTask}
                  members={members}
                  workspaceSlug={workspaceSlug}
                  projectId={activeTask.projectId}
                  isDragging
                />
              </motion.div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
