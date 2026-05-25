"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, AlertCircle, Clock } from "lucide-react";
import CapacityBar from "./capacity-bar";
import type { WorkloadMember, WorkloadTask } from "@/app/api/projects/[projectId]/workload/route";

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  no_priority: "Sin prioridad",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-blue-100 text-blue-700 border-blue-200",
  no_priority: "bg-surface-2 text-text-subtle border-border",
};

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "Por hacer",
  in_progress: "En progreso",
  review: "En revisión",
  done: "Hecho",
  cancelled: "Cancelado",
};

function getInitials(fullName: string | null): string {
  if (!fullName) return "?";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.[0] ?? "?").toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

function isOverdue(dateStr: string | null, statusType: string): boolean {
  if (!dateStr) return false;
  if (statusType === "done" || statusType === "cancelled") return false;
  return new Date(dateStr).getTime() < Date.now();
}

const VISIBLE_TASK_COUNT = 5;

interface WorkloadMemberCardProps {
  member: WorkloadMember;
}

export default function WorkloadMemberCard({ member }: WorkloadMemberCardProps) {
  const [expanded, setExpanded] = useState(false);

  const activeTasks = member.tasks.filter(
    (t) => t.statusType !== "done" && t.statusType !== "cancelled"
  );
  const visibleTasks = expanded ? activeTasks : activeTasks.slice(0, VISIBLE_TASK_COUNT);
  const hasMore = activeTasks.length > VISIBLE_TASK_COUNT;

  return (
    <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3 hover:border-border/80 transition-colors">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          {member.avatarUrl ? (
            <img
              src={member.avatarUrl}
              alt={member.fullName ?? "Usuario"}
              className="w-9 h-9 rounded-full object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center">
              <span className="text-accent text-sm font-semibold">
                {getInitials(member.fullName)}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text truncate">
            {member.fullName ?? "Usuario sin nombre"}
          </p>
          <p className="text-xs text-text-subtle">
            {member.tasksInProgress} activa{member.tasksInProgress !== 1 ? "s" : ""}
            {member.tasksOverdue > 0 && (
              <span className="ml-1.5 text-red-500">
                · {member.tasksOverdue} vencida{member.tasksOverdue !== 1 ? "s" : ""}
              </span>
            )}
            {member.estimatedHours > 0 && (
              <span className="ml-1.5">· {member.estimatedHours.toFixed(1)}h est.</span>
            )}
          </p>
        </div>
      </div>

      {/* Capacity bar */}
      <CapacityBar percent={member.capacityPercent} showLabel />

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-border text-center">
        <div className="px-2 py-1">
          <p className="text-base font-semibold text-text">{member.tasksTotal}</p>
          <p className="text-xs text-text-subtle">Total</p>
        </div>
        <div className="px-2 py-1">
          <p className="text-base font-semibold text-green-600">{member.tasksCompleted}</p>
          <p className="text-xs text-text-subtle">Completadas</p>
        </div>
        <div className="px-2 py-1">
          <p className={`text-base font-semibold ${member.tasksOverdue > 0 ? "text-red-500" : "text-text"}`}>
            {member.tasksOverdue}
          </p>
          <p className="text-xs text-text-subtle">Vencidas</p>
        </div>
      </div>

      {/* Task list */}
      {activeTasks.length > 0 && (
        <div className="space-y-1.5">
          <div className="space-y-1">
            {visibleTasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>

          {hasMore && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full flex items-center justify-center gap-1 text-xs text-text-subtle hover:text-text transition-colors py-1"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Ver menos</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Ver {activeTasks.length - VISIBLE_TASK_COUNT} más</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {activeTasks.length === 0 && (
        <p className="text-xs text-text-subtle text-center py-1">Sin tareas activas</p>
      )}
    </div>
  );
}

function TaskRow({ task }: { task: WorkloadTask }) {
  const overdue = isOverdue(task.dueDate, task.statusType);
  const formattedDate = formatDate(task.dueDate);

  return (
    <div className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-surface-2 transition-colors group">
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border flex-shrink-0 ${
          PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.no_priority
        }`}
      >
        {PRIORITY_LABELS[task.priority] ?? task.priority}
      </span>
      <span className="flex-1 text-xs text-text truncate min-w-0">{task.title}</span>
      {formattedDate && (
        <span
          className={`flex items-center gap-0.5 text-xs flex-shrink-0 ${
            overdue ? "text-red-500" : "text-text-subtle"
          }`}
        >
          {overdue && <AlertCircle className="w-3 h-3" />}
          <Clock className="w-3 h-3" />
          {formattedDate}
        </span>
      )}
    </div>
  );
}
