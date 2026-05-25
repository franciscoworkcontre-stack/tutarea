"use client";

import { useState, useEffect, useTransition } from "react";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { calculateNextOccurrence } from "@/lib/recurrence/recurrence-utils";

type Frequency = "daily" | "weekly" | "monthly" | "yearly";

const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: "Diaria",
  weekly: "Semanal",
  monthly: "Mensual",
  yearly: "Anual",
};

const INTERVAL_UNITS: Record<Frequency, string> = {
  daily: "días",
  weekly: "semanas",
  monthly: "meses",
  yearly: "años",
};

const DAY_LABELS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];

type RecurrenceConfig = {
  frequency: Frequency;
  interval: number;
  daysOfWeek: number[];
  dayOfMonth: number;
  endDate: string;
  maxOccurrences: number | null;
  isActive: boolean;
};

type ApiRecurrence = {
  id: string;
  taskId: string;
  frequency: Frequency;
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
  taskId: string;
  taskDueDate?: Date | null;
  initialRecurrence?: ApiRecurrence | null;
  onSave?: (recurrence: ApiRecurrence) => void;
  onDelete?: () => void;
};

export default function RecurrencePicker({
  taskId,
  taskDueDate,
  initialRecurrence,
  onSave,
  onDelete,
}: Props) {
  const [enabled, setEnabled] = useState(initialRecurrence?.isActive ?? false);
  const [config, setConfig] = useState<RecurrenceConfig>({
    frequency: initialRecurrence?.frequency ?? "weekly",
    interval: initialRecurrence?.interval ?? 1,
    daysOfWeek: initialRecurrence?.daysOfWeek ?? [],
    dayOfMonth: initialRecurrence?.dayOfMonth ?? 1,
    endDate: initialRecurrence?.endDate
      ? new Date(initialRecurrence.endDate).toISOString().split("T")[0] ?? ""
      : "",
    maxOccurrences: initialRecurrence?.maxOccurrences ?? null,
    isActive: initialRecurrence?.isActive ?? true,
  });
  const [isPending, startTransition] = useTransition();

  const previewDate = (() => {
    const from = taskDueDate ?? new Date();
    try {
      return calculateNextOccurrence(
        from,
        config.frequency,
        config.interval,
        config.frequency === "weekly" && config.daysOfWeek.length > 0
          ? config.daysOfWeek
          : undefined,
        config.frequency === "monthly" ? config.dayOfMonth : undefined
      );
    } catch {
      return addDays(from, 1);
    }
  })();

  const previewText = (() => {
    let base = `Se repetirá ${FREQUENCY_LABELS[config.frequency].toLowerCase()}`;
    if (config.interval > 1) {
      base = `Se repetirá cada ${config.interval} ${INTERVAL_UNITS[config.frequency]}`;
    }
    if (config.frequency === "weekly" && config.daysOfWeek.length > 0) {
      const dayNames = config.daysOfWeek
        .slice()
        .sort((a, b) => a - b)
        .map((d) => DAY_LABELS[d] ?? "")
        .filter(Boolean)
        .join(", ");
      base += ` los días ${dayNames}`;
    }
    if (config.frequency === "monthly") {
      base += `, el día ${config.dayOfMonth} de cada mes`;
    }
    base += `. Próxima ocurrencia: ${format(previewDate, "d MMM yyyy", { locale: es })}`;
    return base;
  })();

  const toggleDay = (day: number) => {
    setConfig((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day],
    }));
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/recurrence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            frequency: config.frequency,
            interval: config.interval,
            daysOfWeek:
              config.frequency === "weekly" && config.daysOfWeek.length > 0
                ? config.daysOfWeek
                : undefined,
            dayOfMonth:
              config.frequency === "monthly" ? config.dayOfMonth : undefined,
            endDate: config.endDate || undefined,
            maxOccurrences: config.maxOccurrences ?? undefined,
          }),
        });
        if (!res.ok) throw new Error("Error al guardar");
        const data = (await res.json()) as { recurrence: ApiRecurrence };
        onSave?.(data.recurrence);
        toast.success("Recurrencia guardada");
      } catch {
        toast.error("Error al guardar la recurrencia");
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/recurrence`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Error al eliminar");
        setEnabled(false);
        onDelete?.();
        toast.success("Recurrencia eliminada");
      } catch {
        toast.error("Error al eliminar la recurrencia");
      }
    });
  };

  // Sync enabled state to config
  useEffect(() => {
    setConfig((prev) => ({ ...prev, isActive: enabled }));
  }, [enabled]);

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-text-subtle" />
          <span className="text-sm font-medium text-text">Recurrencia</span>
        </div>
        <div className="flex items-center gap-2">
          {enabled && initialRecurrence && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="text-xs text-destructive hover:text-destructive/80 transition-colors"
              aria-label="Eliminar recurrencia"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              enabled ? "bg-accent" : "bg-surface-3"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-4" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {enabled && (
        <div className="space-y-3 pl-6">
          {/* Frequency */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-muted w-20 flex-shrink-0">
              Frecuencia
            </label>
            <select
              value={config.frequency}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  frequency: e.target.value as Frequency,
                }))
              }
              className="flex-1 text-sm bg-surface border border-border rounded-md px-2 py-1 outline-none focus:border-accent"
            >
              {(Object.keys(FREQUENCY_LABELS) as Frequency[]).map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABELS[f]}
                </option>
              ))}
            </select>
          </div>

          {/* Interval */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-muted w-20 flex-shrink-0">
              Repetir cada
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={config.interval}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  interval: Math.max(1, parseInt(e.target.value, 10) || 1),
                }))
              }
              className="w-16 text-sm bg-surface border border-border rounded-md px-2 py-1 outline-none focus:border-accent"
            />
            <span className="text-xs text-text-muted">
              {INTERVAL_UNITS[config.frequency]}
            </span>
          </div>

          {/* Days of week (weekly only) */}
          {config.frequency === "weekly" && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-text-muted w-20 flex-shrink-0">
                Días
              </label>
              <div className="flex gap-1 flex-wrap">
                {DAY_LABELS.map((label, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleDay(idx)}
                    className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                      config.daysOfWeek.includes(idx)
                        ? "bg-accent text-white"
                        : "bg-surface-2 text-text-subtle hover:bg-surface-3"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Day of month (monthly only) */}
          {config.frequency === "monthly" && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-text-muted w-20 flex-shrink-0">
                Día del mes
              </label>
              <input
                type="number"
                min={1}
                max={31}
                value={config.dayOfMonth}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    dayOfMonth: Math.min(
                      31,
                      Math.max(1, parseInt(e.target.value, 10) || 1)
                    ),
                  }))
                }
                className="w-16 text-sm bg-surface border border-border rounded-md px-2 py-1 outline-none focus:border-accent"
              />
            </div>
          )}

          {/* End date */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-muted w-20 flex-shrink-0">
              Fecha fin
            </label>
            <input
              type="date"
              value={config.endDate}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, endDate: e.target.value }))
              }
              className="flex-1 text-sm bg-surface border border-border rounded-md px-2 py-1 outline-none focus:border-accent"
            />
          </div>

          {/* Max occurrences */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-muted w-20 flex-shrink-0">
              Máx. veces
            </label>
            <input
              type="number"
              min={1}
              placeholder="Ilimitado"
              value={config.maxOccurrences ?? ""}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  maxOccurrences: e.target.value
                    ? parseInt(e.target.value, 10)
                    : null,
                }))
              }
              className="w-24 text-sm bg-surface border border-border rounded-md px-2 py-1 outline-none focus:border-accent"
            />
          </div>

          {/* Preview */}
          <p className="text-xs text-text-muted italic bg-surface-2 rounded-lg px-3 py-2">
            {previewText}
          </p>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={isPending}
            className="w-full text-sm bg-accent text-white rounded-lg py-1.5 hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {isPending ? "Guardando…" : "Guardar recurrencia"}
          </button>
        </div>
      )}
    </div>
  );
}
