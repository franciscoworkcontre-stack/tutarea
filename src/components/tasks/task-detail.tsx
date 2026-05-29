"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronRight,
  Calendar,
  User,
  Flag,
  Tag,
  ArrowLeft,
  Edit2,
  Check,
  Clock,
  MessageCircle,
  Plus,
  ListChecks,
} from "lucide-react";
import { formatDate, getInitials, priorityLabel, spring, cn } from "@/lib/utils";
import type { InferSelectModel } from "drizzle-orm";
import type { tasks, taskStatuses, projects, profiles } from "@/db/schema";
import TimeTracker from "@/components/time-tracking/time-tracker";
import RecurrencePicker from "@/components/recurring-tasks/recurrence-picker";
import RecurrenceBadge from "@/components/recurring-tasks/recurrence-badge";
import TaskComments from "@/components/tasks/task-comments";

type Task = InferSelectModel<typeof tasks> & { status: InferSelectModel<typeof taskStatuses> | null };
type Status = InferSelectModel<typeof taskStatuses>;
type Project = InferSelectModel<typeof projects>;
type Profile = InferSelectModel<typeof profiles>;
type Member = { userId: string; role: string; profile: Profile | null };

type Subtask = InferSelectModel<typeof tasks> & {
  status: InferSelectModel<typeof taskStatuses> | null;
  assignee: Pick<Profile, "id" | "fullName"> | null;
};

type ApiRecurrence = {
  id: string;
  taskId: string;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  daysOfWeek: number[] | null;
  dayOfMonth: number | null;
  endDate: string | null;
  maxOccurrences: number | null;
  occurrenceCount: number;
  nextOccurrenceAt: string | null;
  isActive: boolean;
};

type Props = {
  task: Task;
  project: Project;
  statuses: Status[];
  members: Member[];
  currentUserId: string;
  workspaceSlug: string;
  initialRecurrence?: ApiRecurrence | null;
};

type MainTab = "detalle" | "comentarios" | "tiempo";

function SubtasksPanel({
  parentTaskId,
  projectId,
  statuses,
  members,
}: {
  parentTaskId: string;
  projectId: string;
  statuses: Status[];
  members: Member[];
}) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const doneStatus = statuses.find((s) => s.type === "done");
  const defaultStatus = statuses.find((s) => s.type === "todo") ?? statuses[0];

  const fetchSubtasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks?parentTaskId=${parentTaskId}`);
      if (!res.ok) return;
      const body = (await res.json()) as { tasks: Subtask[] };
      setSubtasks(body.tasks);
    } finally {
      setLoading(false);
    }
  }, [parentTaskId]);

  useEffect(() => { void fetchSubtasks(); }, [fetchSubtasks]);

  const completedCount = subtasks.filter((t) => t.statusId === doneStatus?.id).length;
  const totalCount = subtasks.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleAddSubtask = async () => {
    if (!newTitle.trim()) { setAdding(false); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          projectId,
          parentTaskId,
          statusId: defaultStatus?.id,
        }),
      });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { task: InferSelectModel<typeof tasks> };
      const created: Subtask = {
        ...body.task,
        status: defaultStatus ?? null,
        assignee: null,
      };
      setSubtasks((prev) => [...prev, created]);
      setNewTitle("");
      setAdding(false);
      toast.success("Subtarea creada");
    } catch {
      toast.error("Error al crear subtarea");
    } finally {
      setSaving(false);
    }
  };

  const toggleSubtask = async (subtask: Subtask) => {
    if (!doneStatus) { toast.error("No hay estado 'Hecho' en este proyecto"); return; }
    const isDone = subtask.statusId === doneStatus.id;
    const nextStatusId = isDone ? (defaultStatus?.id ?? subtask.statusId) : doneStatus.id;

    setTogglingId(subtask.id);
    setSubtasks((prev) => prev.map((t) => t.id === subtask.id ? { ...t, statusId: nextStatusId } : t));

    try {
      const res = await fetch(`/api/tasks/${subtask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusId: nextStatusId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setSubtasks((prev) => prev.map((t) => t.id === subtask.id ? { ...t, statusId: subtask.statusId } : t));
      toast.error("Error al actualizar subtarea");
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return <div className="text-xs text-text-subtle py-2">Cargando subtareas...</div>;
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-text-subtle" />
          <span className="text-sm font-medium">Subtareas</span>
          {totalCount > 0 && (
            <span className="text-xs text-text-subtle">
              {completedCount}/{totalCount}
            </span>
          )}
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-xs text-text-muted hover:text-accent transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Agregar
        </button>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="mb-3">
          <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-text-subtle mt-1">{progressPct}% completado</p>
        </div>
      )}

      {/* Subtask list */}
      <div className="space-y-1">
        {subtasks.map((subtask) => {
          const isDone = subtask.statusId === doneStatus?.id;
          const assignee = subtask.assignee ?? members.find((m) => m.userId === subtask.assigneeId)?.profile ?? null;
          return (
            <div
              key={subtask.id}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg border border-transparent hover:border-border hover:bg-surface transition-all group",
                isDone && "opacity-60"
              )}
            >
              <button
                onClick={() => toggleSubtask(subtask)}
                disabled={togglingId === subtask.id || !doneStatus}
                className={cn(
                  "w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all",
                  isDone
                    ? "bg-success border-success text-white"
                    : "border-border hover:border-success hover:bg-success/10",
                  togglingId === subtask.id && "opacity-40 cursor-not-allowed"
                )}
              >
                {isDone && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
              </button>
              <span
                className={cn(
                  "flex-1 text-sm leading-snug",
                  isDone && "line-through text-text-muted"
                )}
              >
                {subtask.title}
              </span>
              {subtask.status && (
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: subtask.status.color }}
                  title={subtask.status.name}
                />
              )}
              {assignee && (
                <div
                  className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-medium text-accent flex-shrink-0"
                  title={assignee.fullName ?? ""}
                >
                  {getInitials(assignee.fullName)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add subtask inline input */}
      {adding && (
        <div className="flex items-center gap-2 mt-2 p-2 rounded-lg border border-accent/30 bg-surface">
          <div className="w-4 h-4 rounded-full border-2 border-border flex-shrink-0" />
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleAddSubtask();
              if (e.key === "Escape") { setNewTitle(""); setAdding(false); }
            }}
            placeholder="Título de la subtarea..."
            disabled={saving}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-text-subtle"
          />
          <button
            onClick={() => void handleAddSubtask()}
            disabled={saving || !newTitle.trim()}
            className="text-xs px-2 py-0.5 bg-accent text-accent-fg rounded font-medium disabled:opacity-50"
          >
            {saving ? "..." : "Agregar"}
          </button>
          <button
            onClick={() => { setNewTitle(""); setAdding(false); }}
            className="text-xs text-text-muted hover:text-text"
          >
            Cancelar
          </button>
        </div>
      )}

      {subtasks.length === 0 && !adding && (
        <p className="text-xs text-text-subtle italic py-1">Sin subtareas aún.</p>
      )}
    </div>
  );
}

export default function TaskDetail({ task: initialTask, project, statuses, members, currentUserId, workspaceSlug, initialRecurrence }: Props) {
  const [task, setTask] = useState(initialTask);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(initialTask.title);
  const [activeTab, setActiveTab] = useState<MainTab>("detalle");
  const [recurrence, setRecurrence] = useState<ApiRecurrence | null>(initialRecurrence ?? null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const assignee = members.find((m) => m.userId === task.assigneeId);

  const updateTask = async (updates: Partial<typeof task>) => {
    setTask((prev) => ({ ...prev, ...updates }));
    startTransition(async () => {
      try {
        const res = await fetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error("Error al actualizar");
        const body = (await res.json()) as { task: typeof task };
        setTask(body.task);
        toast.success("Guardado");
      } catch {
        setTask(initialTask);
        toast.error("Error al guardar");
      }
    });
  };

  const saveTitle = () => {
    setEditingTitle(false);
    if (title !== task.title) {
      updateTask({ title });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-border flex-shrink-0">
        <Link
          href={`/app/${workspaceSlug}/projects/${project.id}/board`}
          className="flex items-center gap-1 text-sm text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {project.name}
        </Link>
        <ChevronRight className="w-4 h-4 text-text-subtle" />
        <span className="text-sm text-text-subtle font-mono">{task.key}</span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 border-b border-border flex-shrink-0">
        <button
          onClick={() => setActiveTab("detalle")}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "detalle"
              ? "border-accent text-text"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          Detalle
        </button>
        <button
          onClick={() => setActiveTab("comentarios")}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "comentarios"
              ? "border-accent text-text"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Comentarios
        </button>
        <button
          onClick={() => setActiveTab("tiempo")}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "tiempo"
              ? "border-accent text-text"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Tiempo
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Comments tab */}
        {activeTab === "comentarios" && (
          <div className="max-w-2xl mx-auto px-6 py-8">
            <TaskComments taskId={task.id} currentUserId={currentUserId} />
          </div>
        )}

        {/* Time tracking tab */}
        {activeTab === "tiempo" && (
          <div className="max-w-2xl mx-auto px-6 py-8">
            <TimeTracker taskId={task.id} currentUserId={currentUserId} />
          </div>
        )}

        {/* Detail tab */}
        {activeTab === "detalle" && (
        <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
          {/* Main content */}
          <div>
            {/* Title */}
            <div className="mb-6">
              {editingTitle ? (
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTitle();
                    if (e.key === "Escape") {
                      setTitle(task.title);
                      setEditingTitle(false);
                    }
                  }}
                  className="w-full text-2xl font-semibold tracking-tighter bg-transparent border-0 outline-none border-b-2 border-accent pb-1"
                  autoFocus
                />
              ) : (
                <div className="group flex items-start gap-2">
                  <h1 className="text-2xl font-semibold tracking-tighter flex-1">
                    {task.title}
                  </h1>
                  <button
                    onClick={() => setEditingTitle(true)}
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded flex items-center justify-center text-text-subtle hover:text-text hover:bg-surface-2 transition-all mt-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Description placeholder */}
            <div className="min-h-32 p-4 rounded-xl border border-dashed border-border bg-surface text-text-subtle text-sm">
              <p className="italic">
                Agrega una descripción para dar más contexto al equipo...
              </p>
            </div>

            {/* Subtasks */}
            <SubtasksPanel
              parentTaskId={task.id}
              projectId={project.id}
              statuses={statuses}
              members={members}
            />
          </div>

          {/* Properties rail */}
          <motion.div
            className="space-y-1"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          >
            <p className="text-xs font-medium text-text-subtle uppercase tracking-wider mb-3">
              Propiedades
            </p>

            {/* Status */}
            <div className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-surface-2 transition-colors group">
              <div className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: task.status?.color ?? "#94a3b8" }}
              />
              <span className="text-xs text-text-muted w-20 flex-shrink-0">Estado</span>
              <select
                value={task.statusId ?? ""}
                onChange={(e) => updateTask({ statusId: e.target.value || null })}
                className="flex-1 text-sm bg-transparent outline-none"
              >
                <option value="">Sin estado</option>
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-surface-2 transition-colors">
              <User className="w-4 h-4 text-text-subtle flex-shrink-0" />
              <span className="text-xs text-text-muted w-20 flex-shrink-0">Responsable</span>
              <select
                value={task.assigneeId ?? ""}
                onChange={(e) => updateTask({ assigneeId: e.target.value || null })}
                className="flex-1 text-sm bg-transparent outline-none"
              >
                <option value="">Sin asignar</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.profile?.fullName ?? m.userId}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-surface-2 transition-colors">
              <Flag className="w-4 h-4 text-text-subtle flex-shrink-0" />
              <span className="text-xs text-text-muted w-20 flex-shrink-0">Prioridad</span>
              <select
                value={task.priority}
                onChange={(e) => updateTask({ priority: e.target.value as typeof task.priority })}
                className="flex-1 text-sm bg-transparent outline-none"
              >
                <option value="no_priority">Sin prioridad</option>
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>

            {/* Due date */}
            <div className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-surface-2 transition-colors">
              <Calendar className="w-4 h-4 text-text-subtle flex-shrink-0" />
              <span className="text-xs text-text-muted w-20 flex-shrink-0">Fecha límite</span>
              <input
                type="date"
                value={task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""}
                onChange={(e) => updateTask({ dueDate: e.target.value ? new Date(e.target.value) : null })}
                className="flex-1 text-sm bg-transparent outline-none"
              />
            </div>

            {/* Key */}
            <div className="flex items-center gap-3 py-2 px-2 rounded-lg">
              <Tag className="w-4 h-4 text-text-subtle flex-shrink-0" />
              <span className="text-xs text-text-muted w-20 flex-shrink-0">Clave</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(task.key);
                  toast.success("Copiado");
                }}
                className="text-sm font-mono text-text-subtle hover:text-accent transition-colors"
              >
                {task.key}
              </button>
            </div>

            {/* Recurrence badge (shows when configured) */}
            {recurrence?.isActive && (
              <div className="flex items-center gap-3 py-2 px-2 rounded-lg">
                <span className="text-xs text-text-muted w-20 flex-shrink-0">Recurrencia</span>
                <RecurrenceBadge
                  frequency={recurrence.frequency}
                  nextOccurrenceAt={recurrence.nextOccurrenceAt}
                  isActive={recurrence.isActive}
                />
              </div>
            )}

            {/* Recurrence picker */}
            <div className="py-2 px-2">
              <RecurrencePicker
                taskId={task.id}
                taskDueDate={task.dueDate}
                initialRecurrence={recurrence}
                onSave={(r) => setRecurrence(r)}
                onDelete={() => setRecurrence(null)}
              />
            </div>

            <div className="pt-4 border-t border-border mt-4">
              <p className="text-xs text-text-subtle">
                Creado {formatDate(task.createdAt)}
              </p>
            </div>
          </motion.div>
        </div>
        )}
      </div>
    </div>
  );
}
