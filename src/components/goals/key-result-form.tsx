"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { InferSelectModel } from "drizzle-orm";
import type { projects } from "@/db/schema";

type Project = InferSelectModel<typeof projects>;

type KRType = "number" | "percentage" | "boolean" | "task_count";

type Props = {
  projects: Project[];
  onSubmit: (data: {
    title: string;
    type: KRType;
    startValue: number;
    targetValue: number;
    unit: string;
    linkedProjectId: string | null;
    ownerUserId: string | null;
    dueDate: string | null;
  }) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
};

const KR_TYPE_LABELS: Record<KRType, string> = {
  number: "Número",
  percentage: "Porcentaje",
  boolean: "Booleano",
  task_count: "Conteo de tareas",
};

export default function KeyResultForm({ projects, onSubmit, onCancel, loading }: Props) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<KRType>("number");
  const [startValue, setStartValue] = useState(0);
  const [targetValue, setTargetValue] = useState(100);
  const [unit, setUnit] = useState("");
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");

  const showNumericFields = type !== "boolean";
  const showProjectSelect = type === "task_count";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await onSubmit({
      title: title.trim(),
      type,
      startValue: showNumericFields ? startValue : 0,
      targetValue: showNumericFields ? targetValue : 1,
      unit: unit.trim(),
      linkedProjectId: showProjectSelect ? linkedProjectId : null,
      ownerUserId: null,
      dueDate: dueDate || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-3 bg-surface-2 rounded-lg border border-border">
      <div>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nombre del resultado clave..."
          className="w-full bg-transparent text-sm border-none outline-none placeholder:text-text-subtle text-text"
          required
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs text-text-subtle mb-1">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as KRType)}
            className="w-full text-xs bg-surface border border-border rounded-md px-2 py-1.5 text-text outline-none focus:border-accent"
          >
            {(Object.keys(KR_TYPE_LABELS) as KRType[]).map((t) => (
              <option key={t} value={t}>
                {KR_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        {showNumericFields && (
          <>
            <div className="w-20">
              <label className="block text-xs text-text-subtle mb-1">Inicio</label>
              <input
                type="number"
                value={startValue}
                onChange={(e) => setStartValue(Number(e.target.value))}
                className="w-full text-xs bg-surface border border-border rounded-md px-2 py-1.5 text-text outline-none focus:border-accent"
              />
            </div>
            <div className="w-20">
              <label className="block text-xs text-text-subtle mb-1">Objetivo</label>
              <input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(Number(e.target.value))}
                className="w-full text-xs bg-surface border border-border rounded-md px-2 py-1.5 text-text outline-none focus:border-accent"
              />
            </div>
            <div className="w-24">
              <label className="block text-xs text-text-subtle mb-1">Unidad</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="€, %, usuarios..."
                className="w-full text-xs bg-surface border border-border rounded-md px-2 py-1.5 text-text outline-none focus:border-accent"
              />
            </div>
          </>
        )}

        <div className="w-36">
          <label className="block text-xs text-text-subtle mb-1">Vencimiento</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full text-xs bg-surface border border-border rounded-md px-2 py-1.5 text-text outline-none focus:border-accent"
          />
        </div>
      </div>

      {showProjectSelect && (
        <div>
          <label className="block text-xs text-text-subtle mb-1">Proyecto vinculado</label>
          <select
            value={linkedProjectId ?? ""}
            onChange={(e) => setLinkedProjectId(e.target.value || null)}
            className="w-full text-xs bg-surface border border-border rounded-md px-2 py-1.5 text-text outline-none focus:border-accent"
          >
            <option value="">Sin proyecto</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={loading || !title.trim()}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md bg-accent text-accent-fg transition-opacity",
            (loading || !title.trim()) && "opacity-50 cursor-not-allowed"
          )}
        >
          {loading ? "Guardando..." : "Agregar KR"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-text-muted hover:text-text transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
