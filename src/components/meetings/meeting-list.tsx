"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ChevronDown, ChevronRight, Video } from "lucide-react";
import { toast } from "sonner";
import { cn, spring } from "@/lib/utils";
import {
  MEETING_TYPE_LABELS,
  MEETING_STATUS_COLORS,
} from "@/lib/meetings/meeting-types";
import type { MeetingWithDetails } from "@/lib/meetings/meeting-types";
import MeetingCard from "./meeting-card";

type Props = {
  projectId: string;
  workspaceSlug: string;
  workspaceId: string;
  initialMeetings: MeetingWithDetails[];
  canCreate: boolean;
};

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

const STATUS_DOT: Record<string, string> = {
  in_progress: "bg-yellow-400",
  scheduled: "bg-blue-400",
  draft: "bg-border",
  completed: "bg-green-500",
  cancelled: "bg-red-400",
};

export default function MeetingList({
  projectId,
  workspaceSlug,
  workspaceId,
  initialMeetings,
  canCreate,
}: Props) {
  const [meetings, setMeetings] = useState<MeetingWithDetails[]>(initialMeetings);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [cancelledOpen, setCancelledOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("team-sync");
  const [objective, setObjective] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMin, setDurationMin] = useState<number>(60);
  const [timezone] = useState("America/Santiago");

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showForm) setTimeout(() => titleRef.current?.focus(), 50);
  }, [showForm]);

  const resetForm = () => {
    setTitle("");
    setType("team-sync");
    setObjective("");
    setScheduledAt("");
    setDurationMin(60);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !objective.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          type,
          objective: objective.trim(),
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          durationMin,
          timezone,
          projectId,
          workspaceId,
        }),
      });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { meeting: MeetingWithDetails };
      const newMeeting: MeetingWithDetails = {
        ...body.meeting,
        attendees: body.meeting.attendees ?? [],
        agendaItems: body.meeting.agendaItems ?? [],
        attachments: body.meeting.attachments ?? [],
        notes: body.meeting.notes ?? [],
        preQuestions: body.meeting.preQuestions ?? [],
      };
      setMeetings((prev) => [newMeeting, ...prev]);
      toast.success("Reunión creada");
      resetForm();
      setShowForm(false);
    } catch {
      toast.error("Error al crear la reunión");
    } finally {
      setSaving(false);
    }
  };

  const inProgress = meetings.filter((m) => m.status === "in_progress");
  const scheduled = meetings
    .filter((m) => m.status === "scheduled")
    .sort(
      (a, b) =>
        new Date(a.scheduledAt ?? 0).getTime() -
        new Date(b.scheduledAt ?? 0).getTime()
    );
  const drafts = meetings.filter((m) => m.status === "draft");
  const completed = meetings
    .filter((m) => m.status === "completed")
    .slice(0, 5);
  const cancelled = meetings.filter(
    (m) => m.status === "cancelled" || m.status === "archived"
  );

  const hasAny =
    inProgress.length + scheduled.length + drafts.length + completed.length + cancelled.length > 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-text-muted" />
          <h2 className="text-base font-semibold">Reuniones</h2>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors",
              showForm
                ? "bg-surface-2 text-text-muted hover:bg-surface-2"
                : "bg-accent text-accent-fg hover:bg-accent/90"
            )}
          >
            <Plus className="w-4 h-4" />
            Nueva Reunión
          </button>
        )}
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring}
            className="overflow-hidden"
          >
            <form
              onSubmit={handleCreate}
              className="border border-border rounded-xl p-4 bg-surface flex flex-col gap-3"
            >
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-text-muted">
                  Título *
                </label>
                <input
                  ref={titleRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nombre de la reunión"
                  required
                  className="text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors placeholder:text-text-subtle"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-text-muted">
                    Tipo
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors text-text"
                  >
                    {Object.entries(MEETING_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-text-muted">
                    Duración
                  </label>
                  <select
                    value={durationMin}
                    onChange={(e) => setDurationMin(Number(e.target.value))}
                    className="text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors text-text"
                  >
                    {DURATION_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d} min
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-text-muted">
                  Objetivo *
                </label>
                <textarea
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="¿Qué se quiere lograr en esta reunión?"
                  required
                  rows={2}
                  className="text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors resize-none placeholder:text-text-subtle"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-text-muted">
                  Fecha y hora
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors text-text"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving || !title.trim() || !objective.trim()}
                  className="text-sm px-4 py-1.5 bg-accent text-accent-fg rounded-lg font-medium disabled:opacity-50 transition-colors hover:bg-accent/90"
                >
                  {saving ? "Creando..." : "Crear reunión"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="text-sm px-3 py-1.5 text-text-muted hover:text-text transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!hasAny && !showForm && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
          <Video className="w-10 h-10 text-text-subtle mb-2" />
          <p className="text-sm text-text-muted">No hay reuniones aún</p>
          {canCreate && (
            <p className="text-xs text-text-subtle">
              Crea la primera reunión con el botón de arriba
            </p>
          )}
        </div>
      )}

      {/* In progress */}
      {inProgress.length > 0 && (
        <MeetingGroup
          label="En progreso"
          dotColor={STATUS_DOT["in_progress"]!}
          meetings={inProgress}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
        />
      )}

      {/* Scheduled */}
      {scheduled.length > 0 && (
        <MeetingGroup
          label="Próximas"
          dotColor={STATUS_DOT["scheduled"]!}
          meetings={scheduled}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
        />
      )}

      {/* Drafts */}
      {drafts.length > 0 && (
        <MeetingGroup
          label="Borradores"
          dotColor={STATUS_DOT["draft"]!}
          meetings={drafts}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
        />
      )}

      {/* Completed (collapsible, last 5) */}
      {completed.length > 0 && (
        <CollapsibleGroup
          label="Completadas"
          dotColor={STATUS_DOT["completed"]!}
          meetings={completed}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          open={completedOpen}
          onToggle={() => setCompletedOpen((v) => !v)}
        />
      )}

      {/* Cancelled / Archived (collapsible) */}
      {cancelled.length > 0 && (
        <CollapsibleGroup
          label="Canceladas / Archivadas"
          dotColor={STATUS_DOT["cancelled"]!}
          meetings={cancelled}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          open={cancelledOpen}
          onToggle={() => setCancelledOpen((v) => !v)}
          muted
        />
      )}
    </div>
  );
}

function MeetingGroup({
  label,
  dotColor,
  meetings,
  workspaceSlug,
  projectId,
}: {
  label: string;
  dotColor: string;
  meetings: MeetingWithDetails[];
  workspaceSlug: string;
  projectId: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className={cn("w-2 h-2 rounded-full", dotColor)} />
        <span className="text-xs font-medium text-text-muted">{label}</span>
        <span className="text-xs text-text-subtle">({meetings.length})</span>
      </div>
      <div className="flex flex-col gap-2">
        {meetings.map((m) => (
          <MeetingCard
            key={m.id}
            meeting={m}
            workspaceSlug={workspaceSlug}
            projectId={projectId}
          />
        ))}
      </div>
    </section>
  );
}

function CollapsibleGroup({
  label,
  dotColor,
  meetings,
  workspaceSlug,
  projectId,
  open,
  onToggle,
  muted,
}: {
  label: string;
  dotColor: string;
  meetings: MeetingWithDetails[];
  workspaceSlug: string;
  projectId: string;
  open: boolean;
  onToggle: () => void;
  muted?: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-left"
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-text-subtle" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-text-subtle" />
        )}
        <div className={cn("w-2 h-2 rounded-full", dotColor)} />
        <span className="text-xs font-medium text-text-muted">{label}</span>
        <span className="text-xs text-text-subtle">({meetings.length})</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring}
            className="overflow-hidden"
          >
            <div className={cn("flex flex-col gap-2", muted && "opacity-60")}>
              {meetings.map((m) => (
                <MeetingCard
                  key={m.id}
                  meeting={m}
                  workspaceSlug={workspaceSlug}
                  projectId={projectId}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
