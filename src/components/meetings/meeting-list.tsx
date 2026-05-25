"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn, spring } from "@/lib/utils";
import MeetingCard from "./meeting-card";
import type { Meeting, MeetingAttendee } from "@/lib/meetings/meeting-utils";

type Props = {
  projectId: string;
  workspaceSlug: string;
  workspaceId: string;
  initialMeetings: (Meeting & { attendees?: MeetingAttendee[] })[];
  canCreate: boolean;
};

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

export default function MeetingList({
  projectId,
  workspaceSlug,
  workspaceId,
  initialMeetings,
  canCreate,
}: Props) {
  const [meetings, setMeetings] = useState(initialMeetings);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMin, setDurationMin] = useState<number>(30);
  const [location, setLocation] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showForm) setTimeout(() => titleRef.current?.focus(), 50);
  }, [showForm]);

  const resetForm = () => {
    setTitle("");
    setObjective("");
    setScheduledAt("");
    setDurationMin(30);
    setLocation("");
    setMeetingUrl("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          objective: objective.trim() || null,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          durationMin,
          location: location.trim() || null,
          meetingUrl: meetingUrl.trim() || null,
          projectId,
          workspaceId,
        }),
      });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { meeting: Meeting };
      setMeetings((prev) => [body.meeting, ...prev]);
      toast.success("Reunión creada");
      resetForm();
      setShowForm(false);
    } catch {
      toast.error("Error al crear la reunión");
    } finally {
      setSaving(false);
    }
  };

  const active = meetings.filter((m) => m.status === "draft" || m.status === "scheduled");
  const inProgress = meetings.filter((m) => m.status === "in_progress");
  const archived = meetings.filter((m) => m.status === "completed" || m.status === "cancelled");

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Reuniones</h2>
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
                <label className="text-xs font-medium text-text-muted">Título *</label>
                <input
                  ref={titleRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nombre de la reunión"
                  required
                  className="text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors placeholder:text-text-subtle"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-text-muted">Objetivo</label>
                <input
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="¿Qué se quiere lograr?"
                  className="text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors placeholder:text-text-subtle"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-text-muted">Fecha y hora</label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors text-text"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-text-muted">Duración</label>
                  <select
                    value={durationMin}
                    onChange={(e) => setDurationMin(Number(e.target.value))}
                    className="text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors text-text"
                  >
                    {DURATION_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d} min</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-text-muted">Lugar</label>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Sala, oficina..."
                    className="text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors placeholder:text-text-subtle"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-text-muted">URL de reunión</label>
                  <input
                    type="url"
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    placeholder="https://meet.google.com/..."
                    className="text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors placeholder:text-text-subtle"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving || !title.trim()}
                  className="text-sm px-4 py-1.5 bg-accent text-accent-fg rounded-lg font-medium disabled:opacity-50 transition-colors hover:bg-accent/90"
                >
                  {saving ? "Creando..." : "Crear reunión"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="text-sm px-3 py-1.5 text-text-muted hover:text-text transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {inProgress.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-400" />
            <span className="text-xs font-medium text-text-muted">En curso</span>
            <span className="text-xs text-text-subtle">({inProgress.length})</span>
          </div>
          <div className="flex flex-col gap-2">
            {inProgress.map((m) => (
              <MeetingCard key={m.id} meeting={m} workspaceSlug={workspaceSlug} projectId={projectId} />
            ))}
          </div>
        </section>
      )}

      {active.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-xs font-medium text-text-muted">Próximas</span>
            <span className="text-xs text-text-subtle">({active.length})</span>
          </div>
          <div className="flex flex-col gap-2">
            {active.map((m) => (
              <MeetingCard key={m.id} meeting={m} workspaceSlug={workspaceSlug} projectId={projectId} />
            ))}
          </div>
        </section>
      )}

      {active.length === 0 && inProgress.length === 0 && archived.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
          <p className="text-sm text-text-muted">No hay reuniones aún</p>
          {canCreate && (
            <p className="text-xs text-text-subtle">Crea la primera reunión con el botón de arriba</p>
          )}
        </div>
      )}

      {archived.length > 0 && (
        <section className="flex flex-col gap-3">
          <button
            onClick={() => setArchivedOpen((v) => !v)}
            className="flex items-center gap-2 text-left"
          >
            {archivedOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-text-subtle" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-text-subtle" />
            )}
            <div className="w-2 h-2 rounded-full bg-border" />
            <span className="text-xs font-medium text-text-muted">Archivadas</span>
            <span className="text-xs text-text-subtle">({archived.length})</span>
          </button>
          <AnimatePresence>
            {archivedOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={spring}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-2 opacity-60">
                  {archived.map((m) => (
                    <MeetingCard key={m.id} meeting={m} workspaceSlug={workspaceSlug} projectId={projectId} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}
    </div>
  );
}
