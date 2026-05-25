"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, MapPin, Link2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn, spring } from "@/lib/utils";
import { canTransition, MEETING_STATUS_TRANSITIONS } from "@/lib/meetings/meeting-utils";
import AgendaEditor from "./agenda-editor";
import AttendeeManager from "./attendee-manager";
import type { Meeting, MeetingAttendee, AgendaItem } from "@/lib/meetings/meeting-utils";
import type { InferSelectModel } from "drizzle-orm";
import type { profiles } from "@/db/schema";

type Profile = InferSelectModel<typeof profiles>;
type Member = { userId: string; role: string; profile: Profile | null };

type FullMeeting = Meeting & { attendees: MeetingAttendee[]; agendaItems: AgendaItem[] };

type Props = {
  meeting: FullMeeting;
  members: Member[];
  workspaceSlug: string;
  currentUserId: string;
};

type Tab = "agenda" | "briefing" | "recap";

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

const STATUS_LABELS: Record<string, string> = {
  draft:       "Borrador",
  scheduled:   "Programada",
  in_progress: "En curso",
  completed:   "Completada",
  cancelled:   "Cancelada",
};

const STATUS_STYLES: Record<string, string> = {
  draft:       "bg-surface-2 text-text-muted border-border",
  scheduled:   "bg-blue-500/10 text-blue-400 border-blue-500/20",
  in_progress: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  completed:   "bg-green-500/10 text-green-400 border-green-500/20",
  cancelled:   "bg-red-500/10 text-red-400 border-red-500/20",
};

function toDatetimeLocal(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDisplay(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function MeetingDetail({ meeting: initial, members, currentUserId }: Props) {
  const [meeting, setMeeting] = useState<FullMeeting>(initial);
  const [tab, setTab] = useState<Tab>("agenda");
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setStatusOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const patchRemote = useCallback(async (patch: Partial<Meeting>) => {
    try {
      const res = await fetch(`/api/meetings/${meeting.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Error al guardar cambios");
    }
  }, [meeting.id]);

  const debounced = useCallback((patch: Partial<Meeting>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => patchRemote(patch), 800);
  }, [patchRemote]);

  const handleTextField = <K extends keyof Meeting>(key: K, value: Meeting[K]) => {
    setMeeting((prev) => ({ ...prev, [key]: value }));
    debounced({ [key]: value });
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!canTransition(meeting.status, newStatus)) return;
    setStatusOpen(false);
    const prev = meeting;
    setMeeting((m) => ({ ...m, status: newStatus as Meeting["status"] }));
    try {
      const res = await fetch(`/api/meetings/${meeting.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Estado actualizado a ${STATUS_LABELS[newStatus]}`);
    } catch {
      setMeeting(prev);
      toast.error("Error al cambiar estado");
    }
  };

  const handleScheduledAt = (value: string) => {
    const date = value ? new Date(value) : null;
    setMeeting((prev) => ({ ...prev, scheduledAt: date }));
    debounced({ scheduledAt: date });
  };

  const handleDurationChange = (value: number) => {
    setMeeting((prev) => ({ ...prev, durationMin: value }));
    debounced({ durationMin: value });
  };

  const availableTransitions = MEETING_STATUS_TRANSITIONS[meeting.status] ?? [];

  const isRecapEnabled = meeting.status === "completed";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
          <div className="p-6 border-b border-border flex flex-col gap-3">
            <input
              value={meeting.title}
              onChange={(e) => handleTextField("title", e.target.value)}
              className="text-xl font-semibold bg-transparent outline-none border-b border-transparent focus:border-accent/40 transition-colors w-full pb-0.5 placeholder:text-text-subtle"
              placeholder="Título de la reunión"
            />
            <input
              value={meeting.objective ?? ""}
              onChange={(e) => handleTextField("objective", e.target.value || null)}
              className="text-sm text-text-muted bg-transparent outline-none border-b border-transparent focus:border-accent/40 transition-colors w-full pb-0.5 placeholder:text-text-subtle"
              placeholder="Objetivo de la reunión"
            />
          </div>

          <div className="flex items-center gap-1 px-6 pt-4 border-b border-border">
            {(["agenda", "briefing", "recap"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                disabled={t === "recap" && !isRecapEnabled}
                className={cn(
                  "relative px-3 py-2 text-sm font-medium transition-colors capitalize rounded-t disabled:opacity-40 disabled:cursor-not-allowed",
                  tab === t ? "text-text" : "text-text-muted hover:text-text"
                )}
              >
                {t === "agenda" ? "Agenda" : t === "briefing" ? "Briefing" : "Recap"}
                {tab === t && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full"
                    transition={spring}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <AnimatePresence mode="wait">
              {tab === "agenda" && (
                <motion.div
                  key="agenda"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={spring}
                >
                  <AgendaEditor
                    meetingId={meeting.id}
                    initialItems={meeting.agendaItems}
                    members={members}
                    readOnly={meeting.status === "completed" || meeting.status === "cancelled"}
                  />
                </motion.div>
              )}

              {tab === "briefing" && (
                <motion.div
                  key="briefing"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={spring}
                  className="flex flex-col gap-2"
                >
                  <p className="text-xs text-text-subtle">Markdown soportado</p>
                  <textarea
                    value={meeting.briefingMd ?? ""}
                    onChange={(e) => handleTextField("briefingMd", e.target.value || null)}
                    placeholder="Escribe el briefing de la reunión aquí..."
                    rows={16}
                    className="w-full text-sm bg-surface border border-border rounded-xl px-4 py-3 outline-none focus:border-accent transition-colors resize-none font-mono placeholder:text-text-subtle"
                  />
                </motion.div>
              )}

              {tab === "recap" && (
                <motion.div
                  key="recap"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={spring}
                  className="flex flex-col gap-2"
                >
                  {!isRecapEnabled && (
                    <div className="text-xs text-text-subtle bg-surface border border-border rounded-lg px-3 py-2">
                      El recap solo está disponible cuando la reunión está completada.
                    </div>
                  )}
                  <textarea
                    value={meeting.recapMd ?? ""}
                    onChange={(e) => handleTextField("recapMd", e.target.value || null)}
                    placeholder="Escribe el recap / acta de la reunión aquí..."
                    rows={16}
                    disabled={!isRecapEnabled}
                    className="w-full text-sm bg-surface border border-border rounded-xl px-4 py-3 outline-none focus:border-accent transition-colors resize-none font-mono placeholder:text-text-subtle disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="w-72 flex-shrink-0 overflow-y-auto flex flex-col">
          <div className="p-4 border-b border-border flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-muted">Estado</span>
              <div ref={statusRef} className="relative">
                <button
                  onClick={() => setStatusOpen((v) => !v)}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
                    STATUS_STYLES[meeting.status]
                  )}
                >
                  <span className="flex-1 text-left">{STATUS_LABELS[meeting.status]}</span>
                  {availableTransitions.length > 0 && (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
                <AnimatePresence>
                  {statusOpen && availableTransitions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={spring}
                      className="absolute top-full left-0 right-0 mt-1.5 bg-surface border border-border rounded-xl shadow-3 z-50 overflow-hidden"
                    >
                      {availableTransitions.map((s) => (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(s)}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-2 transition-colors",
                          )}
                        >
                          <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", STATUS_STYLES[s])}>
                            {STATUS_LABELS[s]}
                          </span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Fecha y hora
              </label>
              <input
                type="datetime-local"
                value={toDatetimeLocal(meeting.scheduledAt)}
                onChange={(e) => handleScheduledAt(e.target.value)}
                className="text-xs bg-surface border border-border rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors text-text"
              />
              {meeting.scheduledAt && (
                <span className="text-[10px] text-text-subtle">{formatDisplay(meeting.scheduledAt)}</span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Duración
              </label>
              <select
                value={meeting.durationMin}
                onChange={(e) => handleDurationChange(Number(e.target.value))}
                className="text-xs bg-surface border border-border rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors text-text"
              >
                {DURATION_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d} min</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                Lugar
              </label>
              <input
                value={meeting.location ?? ""}
                onChange={(e) => handleTextField("location", e.target.value || null)}
                placeholder="Sala, oficina..."
                className="text-xs bg-surface border border-border rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors placeholder:text-text-subtle"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" />
                URL de reunión
              </label>
              <input
                type="url"
                value={meeting.meetingUrl ?? ""}
                onChange={(e) => handleTextField("meetingUrl", e.target.value || null)}
                placeholder="https://meet.google.com/..."
                className="text-xs bg-surface border border-border rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors placeholder:text-text-subtle"
              />
              {meeting.meetingUrl && (
                <a
                  href={meeting.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-accent hover:underline truncate"
                >
                  Abrir enlace
                </a>
              )}
            </div>
          </div>

          <div className="p-4 flex-1">
            <AttendeeManager
              meetingId={meeting.id}
              attendees={meeting.attendees}
              members={members}
              currentUserId={currentUserId}
              onUpdate={(updated) =>
                setMeeting((prev) => ({ ...prev, attendees: updated as (MeetingAttendee & { profile?: Profile | null }) [] }))
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
