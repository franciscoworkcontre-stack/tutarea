"use client";

import { useState } from "react";
import { Plus, Zap, Pencil, Trash2, Power, Clock, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Automation = {
  id: string;
  name: string;
  description: string | null;
  triggerType: string;
  isActive: boolean;
  runCount: number;
  lastRunAt: string | null;
  createdAt: string;
};

type Props = {
  automations: Automation[];
  projectId: string;
  onNew: () => void;
  onEdit: (automationId: string) => void;
};

const TRIGGER_LABELS: Record<string, string> = {
  task_created: "Tarea creada",
  task_status_changed: "Estado cambiado",
  task_assigned: "Tarea asignada",
  task_due_date: "Fecha de vencimiento",
  task_priority_changed: "Prioridad cambiada",
  task_completed: "Tarea completada",
  sprint_started: "Sprint iniciado",
  sprint_completed: "Sprint completado",
};

const TRIGGER_COLORS: Record<string, string> = {
  task_created: "bg-blue-100 text-blue-700",
  task_status_changed: "bg-purple-100 text-purple-700",
  task_assigned: "bg-orange-100 text-orange-700",
  task_due_date: "bg-yellow-100 text-yellow-700",
  task_priority_changed: "bg-red-100 text-red-700",
  task_completed: "bg-green-100 text-green-700",
  sprint_started: "bg-cyan-100 text-cyan-700",
  sprint_completed: "bg-teal-100 text-teal-700",
};

const POPULAR_EXAMPLES = [
  {
    trigger: "task_status_changed",
    name: "Notificar al asignado cuando cambia el estado",
    description: "Envía una notificación cuando la tarea pasa a revisión",
  },
  {
    trigger: "task_created",
    name: "Asignar automáticamente al crear",
    description: "Asigna nuevas tareas al líder del proyecto",
  },
  {
    trigger: "task_completed",
    name: "Mover al sprint completado",
    description: "Mueve tareas terminadas al sprint activo como referencia",
  },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Nunca";
  return new Date(dateStr).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AutomationList({
  automations: initialList,
  projectId,
  onNew,
  onEdit,
}: Props) {
  const [automations, setAutomations] = useState<Automation[]>(initialList);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  async function handleToggle(automation: Automation) {
    const res = await fetch(`/api/automations/${automation.id}/toggle`, {
      method: "POST",
    });
    if (res.ok) {
      const data = (await res.json()) as { automation: Automation };
      setAutomations((prev) =>
        prev.map((a) => (a.id === automation.id ? data.automation : a))
      );
    }
  }

  async function handleDelete(automationId: string) {
    if (!confirm("¿Eliminar esta automatización?")) return;
    setDeletingId(automationId);
    const res = await fetch(`/api/automations/${automationId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setAutomations((prev) => prev.filter((a) => a.id !== automationId));
    }
    setDeletingId(null);
  }

  async function handleTest(automationId: string) {
    setTestingId(automationId);
    const res = await fetch(`/api/automations/${automationId}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun: true }),
    });
    if (res.ok) {
      const data = (await res.json()) as { result: { actionsExecuted: number; status: string } };
      alert(
        `Test completado: ${data.result.actionsExecuted} acciones ejecutadas (estado: ${data.result.status})`
      );
    }
    setTestingId(null);
  }

  if (automations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
          <Zap className="w-8 h-8 text-accent" />
        </div>
        <h3 className="text-lg font-semibold text-text mb-2">
          No hay automatizaciones
        </h3>
        <p className="text-sm text-text-muted text-center max-w-xs mb-8">
          Las automatizaciones ejecutan acciones cuando ocurren eventos en tus tareas y sprints.
        </p>

        <button
          onClick={onNew}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-fg rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors mb-10"
        >
          <Plus className="w-4 h-4" />
          Nueva Automatización
        </button>

        <div className="w-full max-w-lg">
          <p className="text-xs font-medium text-text-subtle uppercase tracking-wider mb-3">
            Ejemplos populares
          </p>
          <div className="space-y-2">
            {POPULAR_EXAMPLES.map((example, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg border border-border bg-surface-2 cursor-pointer hover:border-accent/50 transition-colors"
                onClick={onNew}
              >
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 mt-0.5",
                    TRIGGER_COLORS[example.trigger] ?? "bg-gray-100 text-gray-700"
                  )}
                >
                  {TRIGGER_LABELS[example.trigger] ?? example.trigger}
                </span>
                <div>
                  <p className="text-sm font-medium text-text">{example.name}</p>
                  <p className="text-xs text-text-muted">{example.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">
          {automations.length} automatización{automations.length !== 1 ? "es" : ""}
        </p>
        <button
          onClick={onNew}
          className="flex items-center gap-2 px-3 py-1.5 bg-accent text-accent-fg rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva
        </button>
      </div>

      <div className="space-y-2">
        {automations.map((automation) => (
          <div
            key={automation.id}
            className={cn(
              "flex items-center gap-4 p-4 rounded-xl border transition-colors",
              automation.isActive
                ? "border-border bg-surface"
                : "border-border bg-surface-2 opacity-60"
            )}
          >
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-accent" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-text truncate">
                  {automation.name}
                </span>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0",
                    TRIGGER_COLORS[automation.triggerType] ??
                      "bg-gray-100 text-gray-700"
                  )}
                >
                  {TRIGGER_LABELS[automation.triggerType] ?? automation.triggerType}
                </span>
              </div>
              {automation.description && (
                <p className="text-xs text-text-muted mt-0.5 truncate">
                  {automation.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1 text-xs text-text-subtle">
                  <PlayCircle className="w-3 h-3" />
                  {automation.runCount} ejecuciones
                </span>
                <span className="flex items-center gap-1 text-xs text-text-subtle">
                  <Clock className="w-3 h-3" />
                  {formatDate(automation.lastRunAt)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => handleTest(automation.id)}
                disabled={testingId === automation.id}
                title="Probar"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-subtle hover:text-accent hover:bg-accent/10 transition-colors"
              >
                <PlayCircle className="w-4 h-4" />
              </button>
              <button
                onClick={() => onEdit(automation.id)}
                title="Editar"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-subtle hover:text-text hover:bg-surface-2 transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleToggle(automation)}
                title={automation.isActive ? "Desactivar" : "Activar"}
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                  automation.isActive
                    ? "text-green-600 hover:bg-green-100"
                    : "text-text-subtle hover:bg-surface-2"
                )}
              >
                <Power className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(automation.id)}
                disabled={deletingId === automation.id}
                title="Eliminar"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-subtle hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
