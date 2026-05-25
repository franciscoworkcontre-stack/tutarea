"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  Circle,
  ArrowRight,
  FileText,
  Gavel,
  Zap,
  X,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { MeetingWithDetails, MeetingNote, AgendaItem } from "@/lib/meetings/meeting-types";

type Props = {
  meeting: MeetingWithDetails;
  currentUserId: string;
  onExit: () => void;
};

type NoteType = "note" | "decision" | "action_item";

type CaptureInputState = {
  active: boolean;
  noteType: NoteType;
  text: string;
  assignee: string;
  dueDate: string;
};

function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function getAgendaTimerColor(remainingSec: number, totalSec: number): string {
  if (totalSec === 0) return "text-text-muted";
  const ratio = remainingSec / totalSec;
  if (remainingSec < 0) return "text-red-400";
  if (ratio < 0.1) return "text-red-400";
  if (ratio < 0.5) return "text-yellow-400";
  return "text-green-400";
}

function getProgressBarColor(remainingSec: number, totalSec: number): string {
  if (totalSec === 0) return "bg-surface-3";
  const ratio = remainingSec / totalSec;
  if (remainingSec < 0) return "bg-red-500";
  if (ratio < 0.1) return "bg-red-500";
  if (ratio < 0.5) return "bg-yellow-500";
  return "bg-green-500";
}

const NOTE_TYPE_CONFIG: Record<
  NoteType,
  { label: string; shortcut: string; icon: React.ElementType; color: string }
> = {
  note: { label: "Nota", shortcut: "Cmd+N", icon: FileText, color: "text-blue-400" },
  decision: { label: "Decisión", shortcut: "Cmd+D", icon: Gavel, color: "text-orange-400" },
  action_item: { label: "Acción", shortcut: "Cmd+A", icon: Zap, color: "text-purple-400" },
};

export default function MeetingLiveView({ meeting, currentUserId, onExit }: Props) {
  const [totalSec, setTotalSec] = useState(0);
  const [currentItemIdx, setCurrentItemIdx] = useState(0);
  const [itemElapsedSec, setItemElapsedSec] = useState(0);
  const [recentNotes, setRecentNotes] = useState<MeetingNote[]>([]);
  const [capture, setCapture] = useState<CaptureInputState>({
    active: false,
    noteType: "note",
    text: "",
    assignee: "",
    dueDate: "",
  });
  const [savingNote, setSavingNote] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const captureInputRef = useRef<HTMLTextAreaElement>(null);

  const topLevelItems = meeting.agendaItems
    .filter((i) => !i.parentItemId)
    .sort((a, b) => a.orderIdx - b.orderIdx);

  const currentItem: AgendaItem | undefined = topLevelItems[currentItemIdx];
  const itemTotalSec = (currentItem?.durationMin ?? 0) * 60;
  const itemRemainingSec = itemTotalSec - itemElapsedSec;

  // Total meeting timer
  useEffect(() => {
    const id = setInterval(() => setTotalSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Per-item timer resets when item changes
  useEffect(() => {
    setItemElapsedSec(0);
  }, [currentItemIdx]);

  useEffect(() => {
    const id = setInterval(() => setItemElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [currentItemIdx]);

  // Keyboard shortcuts
  const openCapture = useCallback((noteType: NoteType) => {
    setCapture({ active: true, noteType, text: "", assignee: "", dueDate: "" });
    setTimeout(() => captureInputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "n") { e.preventDefault(); openCapture("note"); }
      if (meta && e.key === "d") { e.preventDefault(); openCapture("decision"); }
      if (meta && e.key === "a") { e.preventDefault(); openCapture("action_item"); }
      if (e.key === "Escape") {
        setCapture((c) => ({ ...c, active: false }));
        setShowExitConfirm(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openCapture]);

  async function submitNote() {
    if (!capture.text.trim()) return;
    setSavingNote(true);
    try {
      const body: Record<string, unknown> = {
        noteType: capture.noteType,
        contentMd: capture.text.trim(),
      };
      if (capture.noteType === "action_item") {
        if (capture.assignee.trim()) body.assigneeId = capture.assignee.trim();
        if (capture.dueDate) body.dueDate = capture.dueDate;
      }
      const res = await fetch(`/api/meetings/${meeting.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Error guardando nota");
      const resData = (await res.json()) as { note: MeetingNote };
      setRecentNotes((prev) => [resData.note, ...prev].slice(0, 5));
      setCapture({ active: false, noteType: "note", text: "", assignee: "", dueDate: "" });
      toast.success(`${NOTE_TYPE_CONFIG[capture.noteType].label} guardada`);
    } catch {
      toast.error("No se pudo guardar la nota");
    } finally {
      setSavingNote(false);
    }
  }

  async function endMeeting() {
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      if (!res.ok) throw new Error("Error al completar reunión");
      toast.success("Reunión completada");
      onExit();
    } catch {
      toast.error("No se pudo completar la reunión");
    }
  }

  const progressPct =
    itemTotalSec > 0
      ? Math.min(100, (itemElapsedSec / itemTotalSec) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface-1 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowExitConfirm(true)}
            className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Salir
          </button>
          <span className="text-text-subtle">|</span>
          <h1 className="text-sm font-semibold text-text truncate max-w-[400px]">
            {meeting.title}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-text-muted" />
          <span className="font-mono text-sm font-semibold text-text tabular-nums">
            {formatClock(totalSec)}
          </span>
          <button
            onClick={() => setShowExitConfirm(true)}
            className="ml-4 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium hover:bg-red-500/20 transition-colors"
          >
            Terminar reunión
          </button>
        </div>
      </header>

      {/* Main 2-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Agenda */}
        <div className="w-80 shrink-0 border-r border-border flex flex-col bg-surface-1 overflow-y-auto">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Agenda
              </span>
              {topLevelItems.length > 0 && (
                <span className="text-xs text-text-subtle">
                  {currentItemIdx + 1}/{topLevelItems.length}
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 p-3 space-y-1">
            {topLevelItems.map((item, idx) => {
              const isCurrent = idx === currentItemIdx;
              const isDone = idx < currentItemIdx;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentItemIdx(idx)}
                  className={cn(
                    "w-full text-left rounded-lg px-3 py-2.5 transition-all",
                    isCurrent
                      ? "bg-accent/10 border border-accent/30"
                      : "hover:bg-surface-2 border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {isDone ? (
                      <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    ) : isCurrent ? (
                      <ArrowRight className="w-3.5 h-3.5 text-accent shrink-0" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-text-subtle shrink-0" />
                    )}
                    <span
                      className={cn(
                        "text-xs font-medium flex-1 truncate",
                        isCurrent ? "text-accent" : isDone ? "text-text-muted" : "text-text"
                      )}
                    >
                      {item.title}
                    </span>
                    {item.durationMin != null && (
                      <span className="text-[10px] text-text-subtle shrink-0">
                        {item.durationMin}m
                      </span>
                    )}
                  </div>

                  {/* Per-item progress bar (only for current) */}
                  {isCurrent && itemTotalSec > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="h-1 rounded-full bg-surface-3 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            getProgressBarColor(itemRemainingSec, itemTotalSec)
                          )}
                          style={{ width: `${Math.min(100, progressPct)}%` }}
                        />
                      </div>
                      <div
                        className={cn(
                          "text-[10px] font-mono tabular-nums text-right",
                          getAgendaTimerColor(itemRemainingSec, itemTotalSec)
                        )}
                      >
                        {itemRemainingSec < 0
                          ? `+${formatClock(Math.abs(itemRemainingSec))}`
                          : formatClock(itemRemainingSec)}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}

            {topLevelItems.length === 0 && (
              <p className="text-xs text-text-subtle text-center py-8">
                Sin items de agenda
              </p>
            )}
          </div>

          {/* Prev / Next */}
          <div className="p-3 border-t border-border flex gap-2">
            <button
              onClick={() => setCurrentItemIdx((i) => Math.max(0, i - 1))}
              disabled={currentItemIdx === 0}
              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border border-border text-xs text-text-muted hover:bg-surface-2 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Anterior
            </button>
            <button
              onClick={() =>
                setCurrentItemIdx((i) => Math.min(topLevelItems.length - 1, i + 1))
              }
              disabled={currentItemIdx >= topLevelItems.length - 1}
              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border border-border text-xs text-text-muted hover:bg-surface-2 disabled:opacity-40 transition-colors"
            >
              Siguiente
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Notes Capture */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Capture shortcuts */}
          <div className="p-4 border-b border-border bg-surface-1 shrink-0">
            <p className="text-xs text-text-subtle mb-3 font-medium">Captura rápida</p>
            <div className="flex gap-2">
              {(["note", "decision", "action_item"] as NoteType[]).map((type) => {
                const cfg = NOTE_TYPE_CONFIG[type];
                const Icon = cfg.icon;
                return (
                  <button
                    key={type}
                    onClick={() => openCapture(type)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-2 hover:bg-surface-3 transition-colors text-xs"
                  >
                    <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
                    <span className="text-text-muted">{cfg.label}</span>
                    <kbd className="text-[10px] text-text-subtle bg-surface-3 px-1 rounded">
                      {cfg.shortcut}
                    </kbd>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Capture input */}
          <AnimatePresence>
            {capture.active && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="p-4 border-b border-border bg-surface-2 shrink-0"
              >
                <div className="flex items-center gap-2 mb-2">
                  {(() => {
                    const cfg = NOTE_TYPE_CONFIG[capture.noteType];
                    const Icon = cfg.icon;
                    return (
                      <>
                        <Icon className={cn("w-4 h-4", cfg.color)} />
                        <span className="text-sm font-medium text-text">{cfg.label}</span>
                      </>
                    );
                  })()}
                  <button
                    onClick={() => setCapture((c) => ({ ...c, active: false }))}
                    className="ml-auto text-text-subtle hover:text-text"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <textarea
                  ref={captureInputRef}
                  value={capture.text}
                  onChange={(e) => setCapture((c) => ({ ...c, text: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitNote();
                    }
                    if (e.key === "Escape") {
                      setCapture((c) => ({ ...c, active: false }));
                    }
                  }}
                  placeholder={`Escribe ${NOTE_TYPE_CONFIG[capture.noteType].label.toLowerCase()}... (Enter para guardar, Shift+Enter nueva línea)`}
                  rows={2}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-subtle resize-none focus:outline-none focus:border-accent"
                />

                {capture.noteType === "action_item" && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      placeholder="Asignar a (userId o nombre)"
                      value={capture.assignee}
                      onChange={(e) => setCapture((c) => ({ ...c, assignee: e.target.value }))}
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:border-accent"
                    />
                    <input
                      type="date"
                      value={capture.dueDate}
                      onChange={(e) => setCapture((c) => ({ ...c, dueDate: e.target.value }))}
                      className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:border-accent"
                    />
                  </div>
                )}

                <div className="flex justify-end mt-2">
                  <button
                    onClick={submitNote}
                    disabled={savingNote || !capture.text.trim()}
                    className="px-4 py-1.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
                  >
                    {savingNote ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Recent captures */}
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Capturas recientes
            </p>
            {recentNotes.length === 0 ? (
              <p className="text-sm text-text-subtle text-center py-12">
                Sin capturas aún — usa los atajos de teclado o los botones de arriba
              </p>
            ) : (
              <div className="space-y-2">
                {recentNotes.map((note) => {
                  const cfg = NOTE_TYPE_CONFIG[note.noteType as NoteType] ?? NOTE_TYPE_CONFIG.note;
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={note.id}
                      className="flex items-start gap-2.5 p-3 rounded-lg border border-border bg-surface-1"
                    >
                      <Icon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", cfg.color)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text leading-snug">{note.contentMd}</p>
                        {note.assigneeId && (
                          <p className="text-xs text-text-subtle mt-0.5">
                            Asignado: {note.assigneeId.slice(0, 8)}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-text-subtle shrink-0">
                        {new Intl.DateTimeFormat("es-CL", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(note.createdAt))}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Exit confirm modal */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center"
            onClick={() => setShowExitConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface-1 border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl"
            >
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                <h2 className="text-base font-semibold text-text">¿Terminar reunión?</h2>
              </div>
              <p className="text-sm text-text-muted mb-5">
                La reunión se marcará como completada. Podrás ver el recap con todas las notas y
                decisiones capturadas.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="px-4 py-2 rounded-lg border border-border text-sm text-text-muted hover:bg-surface-2 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={endMeeting}
                  className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
                >
                  Terminar reunión
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
