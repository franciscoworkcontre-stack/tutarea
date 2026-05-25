"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronRight, Zap, GitBranch, Bolt } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Condition = {
  id: string;
  field: string;
  operator: string;
  value: string;
};

type Action = {
  id: string;
  type: string;
  config: Record<string, string>;
};

type AutomationData = {
  name: string;
  description?: string;
  triggerType: string;
  triggerConfigJsonb: Record<string, unknown>;
  conditionsJsonb: Array<{ field: string; operator: string; value: unknown }>;
  actionsJsonb: Array<{ type: string; config: Record<string, unknown> }>;
};

type Props = {
  projectId: string;
  initial?: {
    id: string;
    name: string;
    description: string | null;
    triggerType: string;
    triggerConfigJsonb: Record<string, unknown>;
    conditionsJsonb: Array<{ field: string; operator: string; value: unknown }>;
    actionsJsonb: Array<{ type: string; config: Record<string, unknown> }>;
    isActive: boolean;
  } | null;
  onSave: (data: AutomationData & { id?: string }) => Promise<void>;
  onCancel: () => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TRIGGERS = [
  { value: "task_created", label: "Tarea creada", description: "Cuando se crea una nueva tarea" },
  { value: "task_status_changed", label: "Estado cambiado", description: "Cuando el estado de una tarea cambia" },
  { value: "task_assigned", label: "Tarea asignada", description: "Cuando se asigna una tarea a alguien" },
  { value: "task_due_date", label: "Fecha de vencimiento", description: "Cuando la tarea está por vencer" },
  { value: "task_priority_changed", label: "Prioridad cambiada", description: "Cuando cambia la prioridad" },
  { value: "task_completed", label: "Tarea completada", description: "Cuando una tarea se marca como completada" },
  { value: "sprint_started", label: "Sprint iniciado", description: "Cuando inicia un sprint" },
  { value: "sprint_completed", label: "Sprint completado", description: "Cuando se completa un sprint" },
];

const CONDITION_FIELDS = [
  { value: "status", label: "Estado" },
  { value: "priority", label: "Prioridad" },
  { value: "assignee", label: "Asignado" },
];

const CONDITION_OPERATORS = [
  { value: "equals", label: "es igual a" },
  { value: "not_equals", label: "no es igual a" },
  { value: "is_empty", label: "está vacío" },
  { value: "is_not_empty", label: "no está vacío" },
  { value: "contains", label: "contiene" },
];

const ACTION_TYPES = [
  { value: "change_status", label: "Cambiar estado" },
  { value: "assign_task", label: "Asignar tarea" },
  { value: "set_priority", label: "Establecer prioridad" },
  { value: "add_label", label: "Agregar etiqueta" },
  { value: "send_notification", label: "Enviar notificación" },
  { value: "create_task", label: "Crear tarea" },
  { value: "move_to_sprint", label: "Mover al sprint" },
];

const PRIORITY_OPTIONS = [
  { value: "no_priority", label: "Sin prioridad" },
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

function uid() {
  return Math.random().toString(36).slice(2);
}

// ─── Action config form ───────────────────────────────────────────────────────

function ActionConfigFields({
  action,
  onChange,
}: {
  action: Action;
  onChange: (config: Record<string, string>) => void;
}) {
  const cfg = action.config;

  switch (action.type) {
    case "change_status":
      return (
        <input
          className="flex-1 px-2 py-1 text-xs border border-border rounded bg-surface"
          placeholder="ID del estado"
          value={cfg["statusId"] ?? ""}
          onChange={(e) => onChange({ ...cfg, statusId: e.target.value })}
        />
      );

    case "assign_task":
      return (
        <input
          className="flex-1 px-2 py-1 text-xs border border-border rounded bg-surface"
          placeholder="ID del usuario"
          value={cfg["userId"] ?? ""}
          onChange={(e) => onChange({ ...cfg, userId: e.target.value })}
        />
      );

    case "set_priority":
      return (
        <select
          className="flex-1 px-2 py-1 text-xs border border-border rounded bg-surface"
          value={cfg["priority"] ?? "no_priority"}
          onChange={(e) => onChange({ ...cfg, priority: e.target.value })}
        >
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      );

    case "add_label":
      return (
        <input
          className="flex-1 px-2 py-1 text-xs border border-border rounded bg-surface"
          placeholder="ID de la etiqueta"
          value={cfg["labelId"] ?? ""}
          onChange={(e) => onChange({ ...cfg, labelId: e.target.value })}
        />
      );

    case "send_notification":
      return (
        <>
          <input
            className="flex-1 px-2 py-1 text-xs border border-border rounded bg-surface"
            placeholder="ID del usuario"
            value={cfg["userId"] ?? ""}
            onChange={(e) => onChange({ ...cfg, userId: e.target.value })}
          />
          <input
            className="flex-1 px-2 py-1 text-xs border border-border rounded bg-surface"
            placeholder="Mensaje"
            value={cfg["message"] ?? ""}
            onChange={(e) => onChange({ ...cfg, message: e.target.value })}
          />
        </>
      );

    case "create_task":
      return (
        <input
          className="flex-1 px-2 py-1 text-xs border border-border rounded bg-surface"
          placeholder="Título de la nueva tarea"
          value={cfg["title"] ?? ""}
          onChange={(e) => onChange({ ...cfg, title: e.target.value })}
        />
      );

    default:
      return null;
  }
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step, current }: { step: number; current: number }) {
  const done = step < current;
  const active = step === current;
  return (
    <div
      className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors",
        done && "bg-accent border-accent text-accent-fg",
        active && "bg-accent/10 border-accent text-accent",
        !done && !active && "bg-surface-2 border-border text-text-muted"
      )}
    >
      {done ? "✓" : step}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AutomationBuilder({
  projectId,
  initial,
  onSave,
  onCancel,
}: Props) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [triggerType, setTriggerType] = useState(initial?.triggerType ?? "");

  const [conditions, setConditions] = useState<Condition[]>(
    (initial?.conditionsJsonb ?? []).map((c) => ({
      id: uid(),
      field: c.field,
      operator: c.operator,
      value: String(c.value ?? ""),
    }))
  );

  const [actions, setActions] = useState<Action[]>(
    (initial?.actionsJsonb ?? []).map((a) => ({
      id: uid(),
      type: a.type,
      config: Object.fromEntries(
        Object.entries(a.config).map(([k, v]) => [k, String(v)])
      ),
    }))
  );

  function addCondition() {
    setConditions((prev) => [
      ...prev,
      { id: uid(), field: "status", operator: "equals", value: "" },
    ]);
  }

  function removeCondition(id: string) {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  }

  function updateCondition(id: string, updates: Partial<Condition>) {
    setConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }

  function addAction() {
    setActions((prev) => [
      ...prev,
      { id: uid(), type: "change_status", config: {} },
    ]);
  }

  function removeAction(id: string) {
    setActions((prev) => prev.filter((a) => a.id !== id));
  }

  function updateAction(id: string, updates: Partial<Action>) {
    setActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
  }

  async function handleSave() {
    if (!name || !triggerType || actions.length === 0) return;
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        name,
        description: description || undefined,
        triggerType,
        triggerConfigJsonb: {},
        conditionsJsonb: conditions.map((c) => ({
          field: c.field,
          operator: c.operator,
          value: c.value,
        })),
        actionsJsonb: actions.map((a) => ({
          type: a.type,
          config: a.config,
        })),
      });
    } finally {
      setSaving(false);
    }
  }

  const selectedTrigger = TRIGGERS.find((t) => t.value === triggerType);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-text">
          {initial ? "Editar automatización" : "Nueva automatización"}
        </h2>
        <p className="text-sm text-text-muted mt-0.5">
          Configura el trigger, condiciones y acciones en 3 pasos.
        </p>
      </div>

      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-text-subtle mb-1">
          Nombre
        </label>
        <input
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
          placeholder="Ej: Notificar cuando el estado cambia"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* Step tabs */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <button
            key={s}
            onClick={() => setStep(s)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-surface-2"
          >
            <StepIndicator step={s} current={step} />
            <span className={cn(step === s ? "text-accent" : "text-text-muted")}>
              {s === 1 && "Trigger"}
              {s === 2 && "Condiciones"}
              {s === 3 && "Acciones"}
            </span>
          </button>
        ))}
      </div>

      {/* ── Step 1: Trigger ── */}
      {step === 1 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-text-subtle uppercase tracking-wider">
            ¿Cuándo se ejecuta?
          </p>
          <div className="grid grid-cols-1 gap-2">
            {TRIGGERS.map((trigger) => (
              <button
                key={trigger.value}
                onClick={() => setTriggerType(trigger.value)}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border text-left transition-colors",
                  triggerType === trigger.value
                    ? "border-accent bg-accent/5"
                    : "border-border hover:border-accent/40 hover:bg-surface-2"
                )}
              >
                <div
                  className={cn(
                    "w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5",
                    triggerType === trigger.value
                      ? "border-accent bg-accent"
                      : "border-border"
                  )}
                />
                <div>
                  <p className="text-sm font-medium text-text">{trigger.label}</p>
                  <p className="text-xs text-text-muted">{trigger.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 2: Conditions ── */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-subtle uppercase tracking-wider">
              Condiciones (opcionales — AND entre todas)
            </p>
            <button
              onClick={addCondition}
              className="flex items-center gap-1 px-2 py-1 text-xs text-accent hover:bg-accent/10 rounded transition-colors"
            >
              <Plus className="w-3 h-3" />
              Agregar
            </button>
          </div>

          {conditions.length === 0 && (
            <p className="text-sm text-text-muted text-center py-6 border border-dashed border-border rounded-xl">
              Sin condiciones — la automatización se ejecutará siempre que ocurra el trigger.
            </p>
          )}

          {conditions.map((condition) => (
            <div
              key={condition.id}
              className="flex items-center gap-2 p-3 rounded-xl border border-border bg-surface"
            >
              <select
                className="px-2 py-1 text-xs border border-border rounded bg-surface"
                value={condition.field}
                onChange={(e) => updateCondition(condition.id, { field: e.target.value })}
              >
                {CONDITION_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>

              <select
                className="px-2 py-1 text-xs border border-border rounded bg-surface"
                value={condition.operator}
                onChange={(e) =>
                  updateCondition(condition.id, { operator: e.target.value })
                }
              >
                {CONDITION_OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>

              {!["is_empty", "is_not_empty"].includes(condition.operator) && (
                <input
                  className="flex-1 px-2 py-1 text-xs border border-border rounded bg-surface"
                  placeholder="Valor"
                  value={condition.value}
                  onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                />
              )}

              <button
                onClick={() => removeCondition(condition.id)}
                className="w-6 h-6 flex items-center justify-center text-text-subtle hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Step 3: Actions ── */}
      {step === 3 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-subtle uppercase tracking-wider">
              Acciones (en orden)
            </p>
            <button
              onClick={addAction}
              className="flex items-center gap-1 px-2 py-1 text-xs text-accent hover:bg-accent/10 rounded transition-colors"
            >
              <Plus className="w-3 h-3" />
              Agregar
            </button>
          </div>

          {actions.length === 0 && (
            <p className="text-sm text-text-muted text-center py-6 border border-dashed border-border rounded-xl">
              Agrega al menos una acción.
            </p>
          )}

          {actions.map((action, idx) => (
            <div
              key={action.id}
              className="flex items-start gap-2 p-3 rounded-xl border border-border bg-surface"
            >
              <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-full bg-accent/10 text-accent text-xs font-bold mt-1">
                {idx + 1}
              </span>

              <div className="flex-1 space-y-2">
                <select
                  className="w-full px-2 py-1 text-xs border border-border rounded bg-surface"
                  value={action.type}
                  onChange={(e) =>
                    updateAction(action.id, { type: e.target.value, config: {} })
                  }
                >
                  {ACTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2 flex-wrap">
                  <ActionConfigFields
                    action={action}
                    onChange={(config) => updateAction(action.id, { config })}
                  />
                </div>
              </div>

              <button
                onClick={() => removeAction(action.id)}
                className="w-6 h-6 flex items-center justify-center text-text-subtle hover:text-red-600 hover:bg-red-50 rounded transition-colors mt-1"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Visual summary ── */}
      {triggerType && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-2 border border-border text-xs text-text-muted">
          <Zap className="w-3.5 h-3.5 text-accent flex-shrink-0" />
          <span className="font-medium text-text">
            {selectedTrigger?.label ?? triggerType}
          </span>
          {conditions.length > 0 && (
            <>
              <GitBranch className="w-3 h-3 flex-shrink-0" />
              <span>
                {conditions.length} condición{conditions.length !== 1 ? "es" : ""}
              </span>
            </>
          )}
          <ChevronRight className="w-3 h-3 flex-shrink-0" />
          <Bolt className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
          <span>{actions.length} acción{actions.length !== 1 ? "es" : ""}</span>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-text-muted hover:text-text transition-colors"
        >
          Cancelar
        </button>

        <div className="flex items-center gap-2">
          {step > 1 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-surface-2 transition-colors"
            >
              Anterior
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 1 && !triggerType}
              className="px-4 py-1.5 bg-accent text-accent-fg rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              Siguiente
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={!name || !triggerType || actions.length === 0 || saving}
              className="px-4 py-1.5 bg-accent text-accent-fg rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Guardando..." : initial ? "Guardar cambios" : "Crear automatización"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
