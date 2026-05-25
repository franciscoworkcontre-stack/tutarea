"use client";

import { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";

type Props = {
  taskId: string;
  onClose: () => void;
  onCreated: () => void;
};

export default function TimeEntryManualModal({ taskId, onClose, onCreated }: Props) {
  const today = new Date().toISOString().split("T")[0]!;
  const [date, setDate] = useState(today);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(30);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (hours === 0 && minutes === 0) {
      toast.error("La duración debe ser mayor a 0");
      return;
    }

    setSaving(true);
    try {
      const totalMinutes = hours * 60 + minutes;
      const startedAt = new Date(`${date}T09:00:00`);
      const endedAt = new Date(startedAt.getTime() + totalMinutes * 60 * 1000);

      const res = await fetch(`/api/tasks/${taskId}/time-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description || undefined,
          durationMinutes: totalMinutes,
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          isRunning: false,
        }),
      });

      if (!res.ok) throw new Error("Error al guardar");

      toast.success("Tiempo registrado");
      onCreated();
      onClose();
    } catch {
      toast.error("Error al guardar el tiempo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Agregar tiempo manual</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-2 text-text-subtle hover:text-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">
              Fecha
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface-2 text-sm outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">
              Duración
            </label>
            <div className="flex gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={hours}
                    onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface-2 text-sm outline-none focus:border-accent transition-colors text-center"
                  />
                  <span className="text-sm text-text-muted whitespace-nowrap">h</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={minutes}
                    onChange={(e) => setMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface-2 text-sm outline-none focus:border-accent transition-colors text-center"
                  />
                  <span className="text-sm text-text-muted whitespace-nowrap">min</span>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">
              Descripción <span className="text-text-subtle">(opcional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="¿En qué trabajaste?"
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface-2 text-sm outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-surface-2 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || (hours === 0 && minutes === 0)}
              className="flex-1 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
