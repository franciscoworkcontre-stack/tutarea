"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { cn, getInitials, spring } from "@/lib/utils";
import type { MeetingAttendee } from "@/lib/meetings/meeting-utils";
import type { InferSelectModel } from "drizzle-orm";
import type { profiles } from "@/db/schema";

type Profile = InferSelectModel<typeof profiles>;
type Member = { userId: string; role: string; profile: Profile | null };

type AttendeeRole = MeetingAttendee["role"];
type AttendeeRsvp = MeetingAttendee["rsvp"];

type AttendeeWithProfile = MeetingAttendee & { profile?: Member["profile"] };

type Props = {
  meetingId: string;
  attendees: AttendeeWithProfile[];
  members: Member[];
  currentUserId: string;
  onUpdate: (attendees: MeetingAttendee[]) => void;
};

const ROLE_LABELS: Record<AttendeeRole, string> = {
  facilitator:    "Facilitador",
  scribe:         "Secretario",
  decision_maker: "Decisor",
  contributor:    "Contribuidor",
  optional:       "Opcional",
};

const RSVP_STYLES: Record<AttendeeRsvp, string> = {
  pending:   "bg-surface-2 text-text-subtle border-border",
  accepted:  "bg-green-500/10 text-green-400 border-green-500/20",
  declined:  "bg-red-500/10 text-red-400 border-red-500/20",
  tentative: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

const RSVP_LABELS: Record<AttendeeRsvp, string> = {
  pending:   "Pendiente",
  accepted:  "Aceptado",
  declined:  "Rechazado",
  tentative: "Tentativo",
};

export default function AttendeeManager({
  meetingId,
  attendees: initialAttendees,
  members,
  currentUserId,
  onUpdate,
}: Props) {
  const [attendees, setAttendees] = useState<AttendeeWithProfile[]>(initialAttendees);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const attendeeUserIds = new Set(attendees.map((a) => a.userId));
  const available = members.filter((m) => !attendeeUserIds.has(m.userId));

  const handleAdd = async (member: Member) => {
    setShowPicker(false);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/attendees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.userId, role: "contributor" }),
      });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { attendee: MeetingAttendee };
      const enriched: AttendeeWithProfile = { ...body.attendee, profile: member.profile };
      const next = [...attendees, enriched];
      setAttendees(next);
      onUpdate(next);
      toast.success(`${member.profile?.fullName ?? "Usuario"} agregado`);
    } catch {
      toast.error("Error al agregar asistente");
    }
  };

  const handleRoleChange = async (attendeeId: string, role: AttendeeRole) => {
    const prev = attendees.find((a) => a.id === attendeeId);
    if (!prev) return;
    const next = attendees.map((a) => (a.id === attendeeId ? { ...a, role } : a));
    setAttendees(next);
    onUpdate(next);
    setSaving(attendeeId);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/attendees/${attendeeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error();
    } catch {
      const reverted = attendees.map((a) => (a.id === attendeeId ? prev : a));
      setAttendees(reverted);
      onUpdate(reverted);
      toast.error("Error al actualizar rol");
    } finally {
      setSaving(null);
    }
  };

  const handleRemove = async (attendeeId: string) => {
    const prev = attendees;
    const next = attendees.filter((a) => a.id !== attendeeId);
    setAttendees(next);
    onUpdate(next);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/attendees/${attendeeId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
    } catch {
      setAttendees(prev);
      onUpdate(prev);
      toast.error("Error al remover asistente");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted">
          Asistentes ({attendees.length})
        </span>
        <div ref={pickerRef} className="relative">
          <button
            onClick={() => setShowPicker((v) => !v)}
            disabled={available.length === 0}
            className="flex items-center gap-1 text-xs text-text-subtle hover:text-text-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Agregar
          </button>
          <AnimatePresence>
            {showPicker && available.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={spring}
                className="absolute top-full right-0 mt-1.5 w-52 bg-surface border border-border rounded-xl shadow-3 z-50 overflow-hidden"
              >
                <div className="max-h-48 overflow-y-auto">
                  {available.map((m) => (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() => handleAdd(m)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-surface-2 transition-colors"
                    >
                      <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-xs font-medium text-accent flex-shrink-0">
                        {getInitials(m.profile?.fullName ?? "?")}
                      </div>
                      <span className="truncate">{m.profile?.fullName ?? m.userId.slice(0, 8)}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <AnimatePresence initial={false}>
          {attendees.map((a) => {
            const isCurrentUser = a.userId === currentUserId;
            const name = a.profile?.fullName ?? a.userId.slice(0, 8);

            return (
              <motion.div
                key={a.id}
                layout
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={spring}
                className={cn(
                  "group flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-surface/50 transition-colors",
                  saving === a.id && "opacity-60"
                )}
              >
                <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-xs font-medium text-accent flex-shrink-0">
                  {getInitials(name)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{name}</p>
                  <select
                    value={a.role}
                    onChange={(e) => handleRoleChange(a.id, e.target.value as AttendeeRole)}
                    className="text-[10px] text-text-muted bg-transparent outline-none cursor-pointer border-none"
                  >
                    {(Object.entries(ROLE_LABELS) as [AttendeeRole, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full border font-medium flex-shrink-0",
                    RSVP_STYLES[a.rsvp]
                  )}
                >
                  {RSVP_LABELS[a.rsvp]}
                </span>

                {!isCurrentUser && (
                  <button
                    onClick={() => handleRemove(a.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-500/10 text-text-subtle hover:text-red-400 flex-shrink-0"
                    title="Remover asistente"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {attendees.length === 0 && (
          <p className="text-xs text-text-subtle px-2 py-3 text-center">
            No hay asistentes aún
          </p>
        )}
      </div>
    </div>
  );
}
