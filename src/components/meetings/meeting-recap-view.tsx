"use client";

import { useState } from "react";
import {
  Clipboard,
  Mail,
  Archive,
  RefreshCw,
  Gavel,
  Zap,
  FileText,
  Paperclip,
  CheckCircle2,
  ArrowRight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn, getInitials } from "@/lib/utils";
import {
  MEETING_TYPE_LABELS,
  MEETING_STATUS_LABELS,
} from "@/lib/meetings/meeting-types";
import type { MeetingWithDetails, MeetingNote } from "@/lib/meetings/meeting-types";

type Props = {
  meeting: MeetingWithDetails;
  currentUserId: string;
};

/** Very simple Markdown renderer: bold + line breaks only */
function renderSimpleMd(text: string): React.ReactNode {
  const lines = text.split("\n");
  return lines.map((line, li) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={li}>
        {parts.map((part, pi) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={pi}>{part.slice(2, -2)}</strong>;
          }
          return part;
        })}
        {li < lines.length - 1 && <br />}
      </span>
    );
  });
}

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatShortDate(date: Date | string | null): string {
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

type EmailModalProps = {
  meeting: MeetingWithDetails;
  onClose: () => void;
};

function EmailModal({ meeting, onClose }: EmailModalProps) {
  const decisions = meeting.notes.filter((n) => n.noteType === "decision");
  const actions = meeting.notes.filter((n) => n.noteType === "action_item");
  const notes = meeting.notes.filter((n) => n.noteType === "note");

  const preview = [
    `Recap de reunión: ${meeting.title}`,
    `Fecha: ${formatDate(meeting.scheduledAt)}`,
    `Duración: ${meeting.durationMin} minutos`,
    "",
    meeting.recapMd ? `Resumen:\n${meeting.recapMd}` : "",
    decisions.length > 0
      ? `\nDecisiones:\n${decisions.map((d) => `• ${d.contentMd}`).join("\n")}`
      : "",
    actions.length > 0
      ? `\nAcciones:\n${actions.map((a) => `• ${a.contentMd}${a.assigneeId ? ` (${a.assigneeId.slice(0, 8)})` : ""}${a.dueDate ? ` — ${formatShortDate(a.dueDate)}` : ""}`).join("\n")}`
      : "",
    notes.length > 0 ? `\nNotas:\n${notes.map((n) => `• ${n.contentMd}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-1 border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-text">Preview del email</h3>
          <button onClick={onClose} className="text-text-subtle hover:text-text">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="bg-background rounded-xl border border-border p-4 max-h-80 overflow-y-auto">
          <pre className="text-xs text-text-muted whitespace-pre-wrap font-sans">{preview}</pre>
        </div>
        <p className="text-xs text-text-subtle mt-3">
          Esta funcionalidad enviará el recap por correo a los asistentes (próximamente).
        </p>
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm text-text-muted hover:bg-surface-2 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MeetingRecapView({ meeting, currentUserId }: Props) {
  const [recapMd, setRecapMd] = useState(meeting.recapMd ?? "");
  const [regenerating, setRegenerating] = useState(false);
  const [materializing, setMaterializing] = useState(false);
  const [materializedIds, setMaterializedIds] = useState<Set<string>>(new Set());
  const [archiving, setArchiving] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const decisions = meeting.notes.filter((n) => n.noteType === "decision");
  const actionItems = meeting.notes.filter((n) => n.noteType === "action_item");
  const generalNotes = meeting.notes.filter((n) => n.noteType === "note");

  const pendingActions = actionItems.filter(
    (a) => !a.materializedTaskId && !materializedIds.has(a.id)
  );

  async function regenerateRecap() {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/ai/post-recap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Error generando recap");
      // Endpoint streams plain text
      const text = await res.text();
      setRecapMd(text);
      // Persist recap to DB
      await fetch(`/api/meetings/${meeting.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recapMd: text }),
      });
      toast.success("Recap regenerado");
    } catch {
      toast.error("No se pudo regenerar el recap");
    } finally {
      setRegenerating(false);
    }
  }

  async function materializeAll() {
    setMaterializing(true);
    try {
      const noteIds = pendingActions.map((a) => a.id);
      if (noteIds.length === 0) return;
      const res = await fetch(`/api/meetings/${meeting.id}/materialize-actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteIds }),
      });
      if (!res.ok) throw new Error("Error materializando acciones");
      const data = (await res.json()) as { materialized: number; tasks: { id: string }[] };
      const newIds = new Set(materializedIds);
      // Mark all pending actions as materialized (API processed all noteIds)
      noteIds.forEach((id) => newIds.add(id));
      setMaterializedIds(newIds);
      toast.success(`${data.materialized} acción${data.materialized !== 1 ? "es" : ""} materializada${data.materialized !== 1 ? "s" : ""} en el proyecto`);
    } catch {
      toast.error("No se pudo materializar las acciones");
    } finally {
      setMaterializing(false);
    }
  }

  async function materializeOne(note: MeetingNote) {
    try {
      const res = await fetch(
        `/api/meetings/${meeting.id}/notes/${note.id}/materialize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      if (!res.ok) throw new Error("Error al crear tarea");
      setMaterializedIds((prev) => new Set([...prev, note.id]));
      toast.success("Tarea creada en el proyecto");
    } catch {
      toast.error("No se pudo crear la tarea");
    }
  }

  async function archiveMeeting() {
    setArchiving(true);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
      if (!res.ok) throw new Error("Error al archivar");
      toast.success("Reunión archivada");
    } catch {
      toast.error("No se pudo archivar la reunión");
    } finally {
      setArchiving(false);
    }
  }

  function copySummary() {
    const lines = [
      `📋 Recap: ${meeting.title}`,
      `📅 ${formatDate(meeting.scheduledAt)}`,
      `⏱ ${meeting.durationMin} min | ${MEETING_TYPE_LABELS[meeting.type] ?? meeting.type}`,
      "",
    ];
    if (recapMd) {
      lines.push("## Resumen", recapMd, "");
    }
    if (decisions.length > 0) {
      lines.push("## Decisiones");
      decisions.forEach((d) => lines.push(`• ${d.contentMd}`));
      lines.push("");
    }
    if (actionItems.length > 0) {
      lines.push("## Acciones");
      actionItems.forEach((a) => {
        let line = `• ${a.contentMd}`;
        if (a.assigneeId) line += ` (${a.assigneeId.slice(0, 8)})`;
        if (a.dueDate) line += ` — ${formatShortDate(a.dueDate)}`;
        lines.push(line);
      });
    }
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      toast.success("Resumen copiado al portapapeles");
    });
  }

  const typeLabel = MEETING_TYPE_LABELS[meeting.type] ?? meeting.type;
  const statusLabel = MEETING_STATUS_LABELS[meeting.status] ?? meeting.status;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* 1. Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded-full border bg-surface-2 text-text-muted border-border">
            {typeLabel}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full border bg-green-500/10 text-green-400 border-green-500/20">
            {statusLabel}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-text">{meeting.title}</h1>
        {meeting.objective && (
          <p className="text-text-muted">{meeting.objective}</p>
        )}
        <div className="flex items-center gap-4 text-sm text-text-subtle flex-wrap">
          <span>{formatDate(meeting.scheduledAt)}</span>
          <span>·</span>
          <span>{meeting.durationMin} min</span>
          <span>·</span>
          <span>Owner: {meeting.ownerId.slice(0, 8)}</span>
        </div>
        {/* Attendees */}
        {meeting.attendees.length > 0 && (
          <div className="flex items-center gap-1">
            {meeting.attendees.slice(0, 6).map((a, idx) => (
              <div
                key={a.id}
                title={a.userId}
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold border border-background -ml-1 first:ml-0",
                  AVATAR_COLORS[idx % AVATAR_COLORS.length]
                )}
              >
                {getInitials(a.userId.slice(0, 4))}
              </div>
            ))}
            {meeting.attendees.length > 6 && (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold bg-surface-2 text-text-subtle border border-background -ml-1">
                +{meeting.attendees.length - 6}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Resumen ejecutivo (briefingMd) */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-text border-b border-border pb-2">
          Resumen ejecutivo
        </h2>
        {meeting.briefingMd ? (
          <div className="prose-sm text-text-muted leading-relaxed">
            {renderSimpleMd(meeting.briefingMd)}
          </div>
        ) : (
          <p className="text-sm text-text-subtle italic">
            Sin resumen ejecutivo. Puedes generarlo con la IA antes de la reunión.
          </p>
        )}
      </section>

      {/* 3. Recap AI */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-base font-semibold text-text">Recap AI</h2>
          <button
            onClick={regenerateRecap}
            disabled={regenerating}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", regenerating && "animate-spin")} />
            Regenerar
          </button>
        </div>
        {recapMd ? (
          <div className="prose-sm text-text-muted leading-relaxed">
            {renderSimpleMd(recapMd)}
          </div>
        ) : (
          <div className="flex flex-col items-center py-8 gap-3">
            <p className="text-sm text-text-subtle">Sin recap generado aún</p>
            <button
              onClick={regenerateRecap}
              disabled={regenerating}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {regenerating ? "Generando..." : "Generar recap con IA"}
            </button>
          </div>
        )}
      </section>

      {/* 4. Decisions */}
      {decisions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text border-b border-border pb-2 flex items-center gap-2">
            <Gavel className="w-4 h-4 text-orange-400" />
            Decisiones ({decisions.length})
          </h2>
          <ul className="space-y-2">
            {decisions.map((note) => (
              <li
                key={note.id}
                className="flex items-start gap-2.5 p-3 rounded-lg border border-border bg-surface-1"
              >
                <Gavel className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
                <p className="text-sm text-text">{note.contentMd}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 5. Action Items */}
      {actionItems.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-base font-semibold text-text flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              Acciones ({actionItems.length})
            </h2>
            {pendingActions.length > 0 && (
              <button
                onClick={materializeAll}
                disabled={materializing}
                className="text-xs text-accent hover:underline disabled:opacity-50"
              >
                {materializing ? "Materializando..." : "Materializar todas"}
              </button>
            )}
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted">
                    Descripción
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted">
                    Asignado
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted">
                    Fecha límite
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {actionItems.map((note) => {
                  const isMaterialized =
                    !!note.materializedTaskId || materializedIds.has(note.id);
                  return (
                    <tr key={note.id} className="bg-surface-1 hover:bg-surface-2 transition-colors">
                      <td className="px-4 py-3 text-text">{note.contentMd}</td>
                      <td className="px-4 py-3 text-text-muted text-xs">
                        {note.assigneeId ? note.assigneeId.slice(0, 8) : "—"}
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs">
                        {note.dueDate ? formatShortDate(note.dueDate) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {isMaterialized ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            Materializado
                          </span>
                        ) : (
                          <button
                            onClick={() => materializeOne(note)}
                            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                          >
                            <ArrowRight className="w-3 h-3" />
                            Crear tarea
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 6. Notas generales */}
      {generalNotes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text border-b border-border pb-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            Notas generales ({generalNotes.length})
          </h2>
          <ul className="space-y-2">
            {generalNotes.map((note) => (
              <li
                key={note.id}
                className="flex items-start gap-2.5 p-3 rounded-lg border border-border bg-surface-1"
              >
                <FileText className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                <p className="text-sm text-text">{note.contentMd}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 7. Adjuntos */}
      {meeting.attachments.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text border-b border-border pb-2 flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-text-muted" />
            Adjuntos ({meeting.attachments.length})
          </h2>
          <ul className="space-y-1">
            {meeting.attachments.map((att) => (
              <li
                key={att.id}
                className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-surface-1 text-sm"
              >
                <Paperclip className="w-3.5 h-3.5 text-text-subtle shrink-0" />
                <span className="text-text truncate">{att.title}</span>
                {att.externalUrl && (
                  <a
                    href={att.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-xs text-accent hover:underline shrink-0"
                  >
                    Abrir
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Distribution panel */}
      <div className="sticky bottom-0 bg-background/80 backdrop-blur border-t border-border pt-4 pb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={copySummary}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-surface-1 text-sm text-text hover:bg-surface-2 transition-colors"
          >
            <Clipboard className="w-4 h-4" />
            Copiar resumen
          </button>
          <button
            onClick={() => setShowEmailModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-surface-1 text-sm text-text hover:bg-surface-2 transition-colors"
          >
            <Mail className="w-4 h-4" />
            Enviar recap
          </button>
          <button
            onClick={archiveMeeting}
            disabled={archiving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-surface-1 text-sm text-text hover:bg-surface-2 disabled:opacity-50 transition-colors ml-auto"
          >
            <Archive className="w-4 h-4" />
            {archiving ? "Archivando..." : "Archivar"}
          </button>
        </div>
      </div>

      {showEmailModal && (
        <EmailModal meeting={meeting} onClose={() => setShowEmailModal(false)} />
      )}
    </div>
  );
}
