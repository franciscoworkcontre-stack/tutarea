"use client";

import { useState, Fragment } from "react";
import { useNow } from "@/lib/hooks";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertCircle, ArrowUp, ArrowDown, Minus, Calendar, GanttChart, LayoutGrid, Plus, Check } from "lucide-react";
import { cn, formatRelativeDate, getInitials } from "@/lib/utils";
import type { InferSelectModel } from "drizzle-orm";
import type { tasks, taskStatuses, projects, profiles } from "@/db/schema";
import AssigneePicker from "@/components/shared/assignee-picker";
import { toast } from "sonner";

type Task = InferSelectModel<typeof tasks>;
type Status = InferSelectModel<typeof taskStatuses>;
type Project = InferSelectModel<typeof projects>;
type Profile = InferSelectModel<typeof profiles>;
type Member = { userId: string; role: string; profile: Profile | null };

type Props = {
  project: Project;
  statuses: Status[];
  initialTasks: Task[];
  members: Member[];
  currentUserId: string;
  workspaceSlug: string;
};

const PriorityDot = ({ priority }: { priority: string }) => {
  const colors: Record<string, string> = {
    urgent: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-yellow-500",
    low: "bg-blue-400",
    no_priority: "bg-border",
  };
  return <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[priority] ?? "bg-border"}`} />;
};

const PriorityIcon = ({ priority }: { priority: string }) => {
  switch (priority) {
    case "urgent": return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
    case "high": return <ArrowUp className="w-3.5 h-3.5 text-orange-500" />;
    case "medium": return <Minus className="w-3.5 h-3.5 text-yellow-500" />;
    case "low": return <ArrowDown className="w-3.5 h-3.5 text-blue-400" />;
    default: return <div className="w-3.5 h-3.5" />;
  }
};

export default function ListView({
  project,
  statuses,
  initialTasks,
  members,
  currentUserId,
  workspaceSlug,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [adding, setAdding] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newAssigneeId, setNewAssigneeId] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const now = useNow();

  const doneStatus = statuses.find((s) => s.type === "done");
  const defaultStatus = statuses.find((s) => s.type === "todo") ?? statuses[0];

  const tasksByStatus = statuses.map((s) => ({
    status: s,
    tasks: tasks.filter((t) => t.statusId === s.id).sort((a, b) => a.position.localeCompare(b.position)),
  }));

  const toggleDone = async (task: Task) => {
    if (!doneStatus) { toast.error("Este proyecto no tiene un estado 'Hecho'"); return; }
    const isDone = task.statusId === doneStatus.id;
    const nextStatusId = isDone ? (defaultStatus?.id ?? task.statusId) : doneStatus.id;

    setCompleting(task.id);
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, statusId: nextStatusId } : t));

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusId: nextStatusId }),
      });
      if (!res.ok) throw new Error();
      if (!isDone) toast.success(`✓ ${task.title}`);
    } catch {
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, statusId: task.statusId } : t));
      toast.error("Error al actualizar tarea");
    } finally {
      setCompleting(null);
    }
  };

  const handleAddTask = async (statusId: string) => {
    if (!newTitle.trim()) { setAdding(null); return; }

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          projectId: project.id,
          statusId,
          assigneeId: newAssigneeId ?? undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { task: Task };
      setTasks((prev) => [...prev, body.task]);
      toast.success(`Tarea ${body.task.key} creada`);
    } catch {
      toast.error("Error al crear tarea");
    } finally {
      setNewTitle("");
      setNewAssigneeId(null);
      setAdding(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
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
            { href: "list", icon: null, label: "Lista" },
            { href: "gantt", icon: GanttChart, label: "Gantt" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={`/app/${workspaceSlug}/projects/${project.id}/${href}`}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors",
                href === "list"
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-text-muted hover:text-text hover:bg-surface-2"
              )}
            >
              {href === "board" && <LayoutGrid className="w-3.5 h-3.5" />}
              {href === "list" && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              {href === "gantt" && <GanttChart className="w-3.5 h-3.5" />}
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface/50 sticky top-0 z-10">
              <th className="px-4 py-2.5 w-10"></th>
              <th className="text-left px-2 py-2.5 text-xs font-medium text-text-subtle w-8"></th>
              <th className="text-left px-2 py-2.5 text-xs font-medium text-text-subtle w-24">Clave</th>
              <th className="text-left px-2 py-2.5 text-xs font-medium text-text-subtle">Título</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-subtle w-36">Estado</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-subtle w-36">Asignado</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-subtle w-32">Vence</th>
            </tr>
          </thead>
          <tbody>
            {tasksByStatus.map(({ status, tasks: group }) => (
              <Fragment key={status.id}>
                {/* Status group header */}
                <tr key={`group-${status.id}`} className="border-b border-border/50 bg-surface/30">
                  <td colSpan={7} className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color }} />
                      <span className="text-xs font-medium text-text-muted">{status.name}</span>
                      <span className="text-xs text-text-subtle">({group.length})</span>
                    </div>
                  </td>
                </tr>

                {/* Tasks */}
                {group.map((task, i) => {
                  const assignee = members.find((m) => m.userId === task.assigneeId);
                  const isOverdue = now && task.dueDate ? new Date(task.dueDate) < now : false;

                  const isDone = task.statusId === doneStatus?.id;
                  return (
                    <motion.tr
                      key={task.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className={cn(
                        "border-b border-border/30 hover:bg-surface/50 transition-colors group",
                        isDone && "opacity-50"
                      )}
                    >
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => toggleDone(task)}
                          disabled={completing === task.id || !doneStatus}
                          title={isDone ? "Marcar como pendiente" : "Completar tarea"}
                          className={cn(
                            "w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center transition-all mx-auto",
                            isDone
                              ? "bg-success border-success text-white"
                              : "border-border hover:border-success hover:bg-success/10",
                            completing === task.id && "opacity-40 cursor-not-allowed"
                          )}
                        >
                          {isDone && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                        </button>
                      </td>
                      <td className="px-2 py-2.5">
                        <PriorityIcon priority={task.priority} />
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="text-xs font-mono text-text-subtle">{task.key}</span>
                      </td>
                      <td className="px-2 py-2.5">
                        <Link
                          href={`/app/${workspaceSlug}/projects/${project.id}/tasks/${task.id}`}
                          className={cn("hover:text-accent transition-colors line-clamp-1", isDone && "line-through text-text-muted")}
                        >
                          {task.title}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color }} />
                          <span className="text-xs text-text-muted">{status.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {assignee ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-medium text-accent">
                              {getInitials(assignee.profile?.fullName ?? "?")}
                            </div>
                            <span className="text-xs text-text-muted truncate max-w-24">
                              {assignee.profile?.fullName?.split(" ")[0] ?? "—"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-text-subtle">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {task.dueDate ? (
                          <div className={cn("flex items-center gap-1 text-xs", isOverdue ? "text-danger" : "text-text-muted")}>
                            <Calendar className="w-3 h-3" />
                            {formatRelativeDate(task.dueDate, "es-CL", now)}
                          </div>
                        ) : (
                          <span className="text-xs text-text-subtle">—</span>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}

                {/* Add task row */}
                <tr key={`add-${status.id}`} className="border-b border-border/20">
                  {adding === status.id ? (
                    <td colSpan={7} className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddTask(status.id);
                            if (e.key === "Escape") { setNewTitle(""); setAdding(null); }
                          }}
                          placeholder="Título de la tarea..."
                          className="flex-1 text-sm bg-transparent outline-none border-b border-accent/40 pb-0.5 placeholder:text-text-subtle"
                        />
                        {members.length > 0 && (
                          <AssigneePicker members={members} value={newAssigneeId} onChange={setNewAssigneeId} size="sm" />
                        )}
                        <button
                          onClick={() => handleAddTask(status.id)}
                          className="text-xs px-2.5 py-1 bg-accent text-accent-fg rounded font-medium"
                        >
                          Agregar
                        </button>
                        <button
                          onClick={() => { setNewTitle(""); setAdding(null); }}
                          className="text-xs text-text-muted hover:text-text"
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  ) : (
                    <td colSpan={7} className="px-4 py-1.5">
                      <button
                        onClick={() => setAdding(status.id)}
                        className="flex items-center gap-1.5 text-xs text-text-subtle hover:text-text-muted transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Agregar tarea
                      </button>
                    </td>
                  )}
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>

        {tasks.length === 0 && statuses.length === 0 && (
          <div className="flex items-center justify-center h-48 text-text-subtle text-sm">
            No hay estados en este proyecto.
          </div>
        )}
      </div>
    </div>
  );
}
