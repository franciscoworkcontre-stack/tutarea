"use client";

import { useState } from "react";
import {
  Zap,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn, getInitials } from "@/lib/utils";
import type { MeetingNote } from "@/lib/meetings/meeting-types";

type Props = {
  meetingId: string;
  notes: MeetingNote[];
  projectId: string;
  onMaterialized: (taskId: string, noteId: string) => void;
};

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-CL", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

const AVATAR_COLORS = [
  "bg-blue-500/20 text-blue-400",
  "bg-purple-500/20 text-purple-400",
  "bg-green-500/20 text-green-400",
  "bg-orange-500/20 text-orange-400",
  "bg-pink-500/20 text-pink-400",
  "bg-cyan-500/20 text-cyan-400",
];

export default function ActionItemsTracker({
  meetingId,
  notes,
  projectId,
  onMaterialized,
}: Props) {
  const actionItems = notes.filter((n) => n.noteType === "action_item");
  const [materializedMap, setMaterializedMap] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    actionItems.forEach((n) => {
      if (n.materializedTaskId) init[n.id] = n.materializedTaskId;
    });
    return init;
  });
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [materializingAll, setMaterializingAll] = useState(false);

  const pending = actionItems.filter((n) => !materializedMap[n.id]);

  async function materializeOne(note: MeetingNote) {
    setLoadingIds((prev) => new Set([...prev, note.id]));
    try {
      const res = await fetch(
        `/api/meetings/${meetingId}/notes/${note.id}/materialize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
        }
      );
      if (!res.ok) throw new Error("Error al crear tarea");
      const data = (await res.json()) as { task: { id: string }; note: { id: string } };
      const taskId: string = data.task?.id ?? "unknown";
      setMaterializedMap((prev) => ({ ...prev, [note.id]: taskId }));
      onMaterialized(taskId, note.id);
      toast.success("Tarea creada en el proyecto");
    } catch {
      toast.error("No se pudo crear la tarea");
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(note.id);
        return next;
      });
    }
  }

  async function materializeAll() {
    if (pending.length === 0) return;
    setMaterializingAll(true);
    try {
      const noteIds = pending.map((n) => n.id);
      const res = await fetch(`/api/meetings/${meetingId}/materialize-actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteIds }),
      });
      if (!res.ok) throw new Error("Error materializando");
      const data = (await res.json()) as { materialized: number; tasks: { id: string }[] };
      // Map created tasks back to note IDs (same order as pending)
      const map: Record<string, string> = {};
      data.tasks.forEach((task, idx) => {
        const noteId = noteIds[idx];
        if (noteId) {
          map[noteId] = task.id;
          onMaterialized(task.id, noteId);
        }
      });
      setMaterializedMap((prev) => ({ ...prev, ...map }));
      toast.success(`${data.materialized} acción${data.materialized !== 1 ? "es" : ""} materializada${data.materialized !== 1 ? "s" : ""}`);
    } catch {
      toast.error("No se pudo materializar las acciones");
    } finally {
      setMaterializingAll(false);
    }
  }

  if (actionItems.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-border rounded-xl">
        <Zap className="w-8 h-8 text-text-subtle mx-auto mb-2" />
        <p className="text-sm text-text-subtle">Sin action items en esta reunión</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text flex items-center gap-2">
          <Zap className="w-4 h-4 text-purple-400" />
          Action Items
          <span className="text-text-subtle font-normal">
            ({actionItems.length} total, {pending.length} pendiente
            {pending.length !== 1 ? "s" : ""} de materializar)
          </span>
        </h3>
        {pending.length > 0 && (
          <button
            onClick={materializeAll}
            disabled={materializingAll}
            className="flex items-center gap-1.5 text-xs text-accent hover:underline disabled:opacity-50"
          >
            {materializingAll ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            {materializingAll ? "Materializando..." : "Materializar todos"}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-surface-2 border-b border-border">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted">
                Descripción
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted w-24">
                Asignado
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted w-32">
                Fecha límite
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted w-40">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {actionItems.map((note, idx) => {
              const taskId = materializedMap[note.id];
              const isMaterialized = !!taskId;
              const isLoading = loadingIds.has(note.id);

              return (
                <tr
                  key={note.id}
                  className="bg-surface-1 hover:bg-surface-2 transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="text-text leading-snug">{note.contentMd}</p>
                  </td>
                  <td className="px-4 py-3">
                    {note.assigneeId ? (
                      <div className="flex items-center gap-1.5">
                        <div
                          className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold",
                            AVATAR_COLORS[idx % AVATAR_COLORS.length]
                          )}
                          title={note.assigneeId}
                        >
                          {getInitials(note.assigneeId.slice(0, 6))}
                        </div>
                        <span className="text-xs text-text-muted hidden sm:block">
                          {note.assigneeId.slice(0, 8)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-text-subtle text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">
                    {formatDate(note.dueDate)}
                  </td>
                  <td className="px-4 py-3">
                    {isMaterialized ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          En proyecto
                        </span>
                        {taskId !== "unknown" && (
                          <a
                            href={`/app/projects/${projectId}/tasks/${taskId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-text-subtle hover:text-accent"
                            title="Ver tarea"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => materializeOne(note)}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline disabled:opacity-50"
                      >
                        {isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5" />
                        )}
                        {isLoading ? "Creando..." : "Crear tarea"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
