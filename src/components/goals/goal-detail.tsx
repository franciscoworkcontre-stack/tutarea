"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Check, Edit3 } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import KeyResultForm from "./key-result-form";
import type { InferSelectModel } from "drizzle-orm";
import type { goals, keyResults, profiles, projects, workspaceMembers } from "@/db/schema";

type Goal = InferSelectModel<typeof goals> & {
  keyResults: InferSelectModel<typeof keyResults>[];
};
type Profile = InferSelectModel<typeof profiles>;
type Project = InferSelectModel<typeof projects>;
type Member = InferSelectModel<typeof workspaceMembers> & {
  profile: Profile | null;
};

type Props = {
  goal: Goal;
  members: Member[];
  projects: Project[];
  profileMap: Record<string, Profile>;
  onClose: () => void;
  onUpdated: (goal: Goal) => void;
  onDeleted: (goalId: string) => void;
};

const STATUS_OPTIONS = [
  { value: "draft", label: "Borrador", color: "text-text-subtle" },
  { value: "active", label: "Activo", color: "text-accent" },
  { value: "at_risk", label: "En riesgo", color: "text-orange-500" },
  { value: "achieved", label: "Alcanzado", color: "text-green-500" },
  { value: "cancelled", label: "Cancelado", color: "text-red-500" },
] as const;

type GoalStatus = (typeof STATUS_OPTIONS)[number]["value"];

function InlineEdit({
  value,
  onSave,
  className,
  multiline,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  className?: string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      setDraft(value);
    }
  }, [editing, value]);

  const save = async () => {
    if (draft.trim() !== value) {
      await onSave(draft.trim());
    }
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className={cn("text-left group flex items-start gap-1 hover:text-text", className)}
      >
        <span className="flex-1">{value || <span className="text-text-subtle italic">Sin descripción</span>}</span>
        <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 mt-0.5 flex-shrink-0 text-text-subtle" />
      </button>
    );
  }

  if (multiline) {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
        }}
        rows={3}
        className={cn(
          "w-full bg-surface-2 border border-accent rounded-lg px-2 py-1 outline-none resize-none",
          className
        )}
      />
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") setEditing(false);
      }}
      className={cn(
        "w-full bg-surface-2 border border-accent rounded-lg px-2 py-1 outline-none",
        className
      )}
    />
  );
}

function KrProgressBar({ kr }: { kr: InferSelectModel<typeof keyResults> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(kr.currentValue));

  const progress =
    kr.type === "boolean"
      ? kr.currentValue >= 1
        ? 100
        : 0
      : kr.targetValue === kr.startValue
      ? 0
      : Math.round(
          Math.min(
            Math.max(
              ((kr.currentValue - kr.startValue) / (kr.targetValue - kr.startValue)) * 100,
              0
            ),
            100
          )
        );

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-text flex-1 truncate">{kr.title}</span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                // Parent handles the actual API call via onCurrentValueChange
                setEditing(false);
              }}
              className="flex items-center gap-1"
            >
              <input
                autoFocus
                type="number"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => setEditing(false)}
                className="w-16 text-xs bg-surface-2 border border-accent rounded px-1.5 py-0.5 outline-none text-text"
              />
              {kr.unit && <span className="text-xs text-text-subtle">{kr.unit}</span>}
            </form>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-text-muted hover:text-text transition-colors"
            >
              {kr.type === "boolean"
                ? kr.currentValue >= 1
                  ? "Sí"
                  : "No"
                : `${kr.currentValue}${kr.unit ? ` ${kr.unit}` : ""}`}
              {" / "}
              {kr.type === "boolean"
                ? "1"
                : `${kr.targetValue}${kr.unit ? ` ${kr.unit}` : ""}`}
            </button>
          )}
          <span className="text-xs font-medium text-text w-8 text-right">{progress}%</span>
        </div>
      </div>
      <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${progress}%`,
            backgroundColor:
              progress >= 100
                ? "#22c55e"
                : progress >= 70
                ? "#3b82f6"
                : progress >= 40
                ? "#f97316"
                : "#94a3b8",
          }}
        />
      </div>
    </div>
  );
}

export default function GoalDetail({
  goal: initialGoal,
  members,
  projects,
  profileMap,
  onClose,
  onUpdated,
  onDeleted,
}: Props) {
  const [goal, setGoal] = useState(initialGoal);
  const [showKrForm, setShowKrForm] = useState(false);
  const [krFormLoading, setKrFormLoading] = useState(false);
  const [deletingKrId, setDeletingKrId] = useState<string | null>(null);

  const patchGoal = async (patch: Record<string, unknown>) => {
    const res = await fetch(`/api/goals/${goal.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = (await res.json()) as { goal: Goal };
      setGoal((prev) => ({ ...prev, ...data.goal }));
      onUpdated({ ...goal, ...data.goal });
    }
  };

  const updateKrValue = async (krId: string, currentValue: number) => {
    const res = await fetch(`/api/goals/${goal.id}/key-results/${krId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentValue }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        keyResult: InferSelectModel<typeof keyResults>;
        goal: Goal;
      };
      setGoal((prev) => ({
        ...prev,
        progress: data.goal.progress,
        keyResults: prev.keyResults.map((kr) =>
          kr.id === krId ? data.keyResult : kr
        ),
      }));
      onUpdated({ ...goal, progress: data.goal.progress });
    }
  };

  const deleteKr = async (krId: string) => {
    setDeletingKrId(krId);
    try {
      const res = await fetch(`/api/goals/${goal.id}/key-results/${krId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const data = (await res.json()) as { goal: Goal };
        setGoal((prev) => ({
          ...prev,
          progress: data.goal.progress,
          keyResults: prev.keyResults.filter((kr) => kr.id !== krId),
        }));
        onUpdated({ ...goal, progress: data.goal.progress });
      }
    } finally {
      setDeletingKrId(null);
    }
  };

  const addKr = async (formData: {
    title: string;
    type: "number" | "percentage" | "boolean" | "task_count";
    startValue: number;
    targetValue: number;
    unit: string;
    linkedProjectId: string | null;
    ownerUserId: string | null;
    dueDate: string | null;
  }) => {
    setKrFormLoading(true);
    try {
      const res = await fetch(`/api/goals/${goal.id}/key-results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          keyResult: InferSelectModel<typeof keyResults>;
        };
        setGoal((prev) => ({
          ...prev,
          keyResults: [...prev.keyResults, data.keyResult],
        }));
        setShowKrForm(false);
      }
    } finally {
      setKrFormLoading(false);
    }
  };

  const deleteGoal = async () => {
    if (!confirm("¿Eliminar este objetivo? No se puede deshacer.")) return;
    const res = await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
    if (res.ok) {
      onDeleted(goal.id);
      onClose();
    }
  };

  const markAchieved = async () => {
    await patchGoal({ status: "achieved" });
  };

  const ownerProfile = goal.ownerUserId ? profileMap[goal.ownerUserId] : null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-start justify-end p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-black/40"
          onClick={onClose}
        />
        <motion.div
          className="relative bg-surface border border-border rounded-xl shadow-2xl w-full max-w-xl h-[calc(100vh-2rem)] flex flex-col z-10 overflow-hidden"
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 32 }}
          transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
        >
          {/* Header */}
          <div className="flex items-start gap-3 px-5 py-4 border-b border-border flex-shrink-0">
            <div className="flex-1 min-w-0">
              <InlineEdit
                value={goal.title}
                onSave={(v) => patchGoal({ title: v })}
                className="text-base font-semibold text-text w-full"
              />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <select
                value={goal.status}
                onChange={(e) => patchGoal({ status: e.target.value as GoalStatus })}
                className="text-xs bg-surface-2 border border-border rounded-md px-2 py-1 text-text outline-none focus:border-accent"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:bg-surface-2 hover:text-text transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Progress */}
            <div className="flex items-center gap-4 p-4 bg-surface-2 rounded-xl border border-border">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-text-muted font-medium uppercase tracking-wider">
                    Progreso total
                  </span>
                  <span className="text-2xl font-bold text-text">{goal.progress}%</span>
                </div>
                <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${goal.progress}%`,
                      backgroundColor:
                        goal.progress >= 100
                          ? "#22c55e"
                          : goal.progress >= 70
                          ? "#3b82f6"
                          : goal.progress >= 40
                          ? "#f97316"
                          : "#94a3b8",
                    }}
                  />
                </div>
              </div>
              {goal.progress >= 100 && goal.status !== "achieved" && (
                <button
                  onClick={markAchieved}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-500 border border-green-500/30 rounded-lg text-xs font-medium hover:bg-green-500/20 transition-colors flex-shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                  Marcar alcanzado
                </button>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
                Descripción
              </label>
              <InlineEdit
                value={goal.description ?? ""}
                onSave={(v) => patchGoal({ description: v })}
                className="text-sm text-text-muted w-full"
                multiline
              />
            </div>

            {/* Meta row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
                  Responsable
                </label>
                <select
                  value={goal.ownerUserId ?? ""}
                  onChange={(e) => patchGoal({ ownerUserId: e.target.value })}
                  className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-accent"
                >
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.profile?.fullName ?? m.userId.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
                  Proyecto
                </label>
                <select
                  value={goal.projectId ?? ""}
                  onChange={(e) =>
                    patchGoal({ projectId: e.target.value || null })
                  }
                  className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-accent"
                >
                  <option value="">Sin proyecto</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
                  Fecha inicio
                </label>
                <input
                  type="date"
                  value={
                    goal.startDate
                      ? new Date(goal.startDate).toISOString().split("T")[0]
                      : ""
                  }
                  onChange={(e) =>
                    patchGoal({ startDate: e.target.value || null })
                  }
                  className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
                  Fecha fin
                </label>
                <input
                  type="date"
                  value={
                    goal.dueDate
                      ? new Date(goal.dueDate).toISOString().split("T")[0]
                      : ""
                  }
                  onChange={(e) =>
                    patchGoal({ dueDate: e.target.value || null })
                  }
                  className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-accent"
                />
              </div>
            </div>

            {/* Key Results */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Resultados clave ({goal.keyResults.length})
                </h3>
                <button
                  onClick={() => setShowKrForm((v) => !v)}
                  className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar KR
                </button>
              </div>

              <div className="space-y-4">
                {goal.keyResults.map((kr) => (
                  <div
                    key={kr.id}
                    className="group p-3 bg-surface-2 rounded-lg border border-border hover:border-border/80 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <KrProgressBar
                          kr={kr}
                        />
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-text-subtle bg-surface px-1.5 py-0.5 rounded border border-border">
                            {kr.type === "number"
                              ? "Número"
                              : kr.type === "percentage"
                              ? "Porcentaje"
                              : kr.type === "boolean"
                              ? "Booleano"
                              : "Conteo tareas"}
                          </span>
                          {kr.dueDate && (
                            <span className="text-[10px] text-text-subtle">
                              Vence {formatDate(kr.dueDate)}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteKr(kr.id)}
                        disabled={deletingKrId === kr.id}
                        className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-text-subtle hover:text-red-500 transition-all flex-shrink-0 mt-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {goal.keyResults.length === 0 && !showKrForm && (
                  <div className="text-center py-6 text-sm text-text-subtle">
                    No hay resultados clave aún.{" "}
                    <button
                      onClick={() => setShowKrForm(true)}
                      className="text-accent hover:text-accent/80 transition-colors"
                    >
                      Agregar uno
                    </button>
                  </div>
                )}

                {showKrForm && (
                  <KeyResultForm
                    projects={projects}
                    onSubmit={addKr}
                    onCancel={() => setShowKrForm(false)}
                    loading={krFormLoading}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-border flex-shrink-0">
            <button
              onClick={deleteGoal}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar objetivo
            </button>
            <span className="text-xs text-text-subtle">
              {ownerProfile
                ? `Responsable: ${ownerProfile.fullName ?? "Sin nombre"}`
                : "Sin responsable"}
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
