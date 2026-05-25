"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Play, Square, Plus, Clock, Trash2 } from "lucide-react";
import type { InferSelectModel } from "drizzle-orm";
import type { timeEntries } from "@/db/schema";
import TimeEntryManualModal from "./time-entry-manual-modal";

type TimeEntry = InferSelectModel<typeof timeEntries>;

type TimeEntriesResponse = {
  entries: TimeEntry[];
  totalMinutes: number;
  runningEntry: TimeEntry | null;
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatElapsed(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const seconds = Math.floor((now - start) / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatEntryDate(dateStr: string | Date): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

type Props = {
  taskId: string;
  currentUserId: string;
};

export default function TimeTracker({ taskId, currentUserId }: Props) {
  const [data, setData] = useState<TimeEntriesResponse>({
    entries: [],
    totalMinutes: 0,
    runningEntry: null,
  });
  const [elapsed, setElapsed] = useState("00:00:00");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/time-entries`);
      if (!res.ok) throw new Error("Error");
      const json = (await res.json()) as TimeEntriesResponse;
      setData(json);
    } catch {
      toast.error("Error al cargar entradas de tiempo");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  // Live elapsed counter
  useEffect(() => {
    if (!data.runningEntry) {
      setElapsed("00:00:00");
      return;
    }
    const startedAt = data.runningEntry.startedAt;
    setElapsed(formatElapsed(String(startedAt)));
    const interval = setInterval(() => {
      setElapsed(formatElapsed(String(startedAt)));
    }, 1000);
    return () => clearInterval(interval);
  }, [data.runningEntry]);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/time-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startedAt: new Date().toISOString(),
          isRunning: true,
        }),
      });
      if (!res.ok) throw new Error("Error");
      await fetchEntries();
      toast.success("Timer iniciado");
    } catch {
      toast.error("Error al iniciar el timer");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    if (!data.runningEntry) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/time-entries/${data.runningEntry.id}/stop`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Error");
      await fetchEntries();
      toast.success("Timer detenido");
    } catch {
      toast.error("Error al detener el timer");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    try {
      const res = await fetch(`/api/time-entries/${entryId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Error");
      await fetchEntries();
      toast.success("Entrada eliminada");
    } catch {
      toast.error("Error al eliminar la entrada");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-text-subtle text-sm">
        Cargando...
      </div>
    );
  }

  const isRunning = !!data.runningEntry;

  return (
    <div className="space-y-6">
      {/* Timer controls */}
      <div className="flex flex-col items-center gap-4 py-6 rounded-xl border border-border bg-surface">
        {isRunning && (
          <div className="text-4xl font-mono font-semibold tracking-tighter text-accent">
            {elapsed}
          </div>
        )}
        {!isRunning && (
          <div className="flex items-center gap-2 text-text-subtle">
            <Clock className="w-5 h-5" />
            <span className="text-sm">Sin timer activo</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          {!isRunning ? (
            <button
              onClick={handleStart}
              disabled={actionLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="w-4 h-4" />
              Iniciar timer
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={actionLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-500 text-white font-medium text-sm hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Square className="w-4 h-4" />
              Detener
            </button>
          )}
          <button
            onClick={() => setShowManual(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-surface-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Manual
          </button>
        </div>
      </div>

      {/* Total logged */}
      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-2 border border-border">
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Clock className="w-4 h-4" />
          <span>Tiempo total registrado</span>
        </div>
        <span className="text-sm font-semibold text-text">
          {formatDuration(data.totalMinutes)}
        </span>
      </div>

      {/* Entries list */}
      {data.entries.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-text-subtle uppercase tracking-wider px-1 mb-2">
            Entradas
          </p>
          {data.entries.map((entry) => {
            const isOwn = entry.userId === currentUserId;
            return (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-2 transition-colors group"
              >
                {entry.isRunning && (
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                )}
                {!entry.isRunning && (
                  <span className="w-2 h-2 rounded-full bg-border flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text truncate">
                    {entry.description ?? "Sin descripción"}
                  </p>
                  <p className="text-xs text-text-subtle">
                    {formatEntryDate(entry.startedAt)}
                    {entry.isRunning && (
                      <span className="ml-2 text-green-500">En curso</span>
                    )}
                  </p>
                </div>
                <span className="text-sm font-medium text-text-muted flex-shrink-0">
                  {entry.isRunning ? elapsed : formatDuration(entry.durationMinutes)}
                </span>
                {isOwn && !entry.isRunning && (
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-text-subtle hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showManual && (
        <TimeEntryManualModal
          taskId={taskId}
          onClose={() => setShowManual(false)}
          onCreated={fetchEntries}
        />
      )}
    </div>
  );
}
