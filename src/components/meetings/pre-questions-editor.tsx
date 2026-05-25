"use client";

import { useState } from "react";
import {
  GripVertical,
  Trash2,
  Plus,
  Send,
  CheckCircle2,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PreQuestion } from "@/lib/meetings/meeting-types";

type Props = {
  meetingId: string;
  questions: PreQuestion[];
  currentUserId: string;
  isOwner: boolean;
};

// ─── Owner: sortable question row ───────────────────────────────────────────────
type SortableQuestionProps = {
  question: PreQuestion;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
};

function SortableQuestion({ question, onUpdate, onDelete }: SortableQuestionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [localText, setLocalText] = useState(question.questionText);
  const [saving, setSaving] = useState(false);

  async function handleBlur() {
    if (localText.trim() === question.questionText) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/meetings/${question.meetingId}/pre-questions/${question.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionText: localText.trim() }),
        }
      );
      if (!res.ok) throw new Error("Error guardando pregunta");
      onUpdate(question.id, localText.trim());
    } catch {
      toast.error("No se pudo guardar la pregunta");
      setLocalText(question.questionText);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 rounded-xl border border-border bg-surface-1 group"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-text-subtle hover:text-text-muted shrink-0"
        aria-label="Arrastrar para reordenar"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <input
        type="text"
        value={localText}
        onChange={(e) => setLocalText(e.target.value)}
        onBlur={handleBlur}
        className={cn(
          "flex-1 bg-transparent text-sm text-text placeholder:text-text-subtle focus:outline-none",
          saving && "opacity-60"
        )}
        placeholder="Escribe una pregunta..."
      />

      <button
        onClick={() => onDelete(question.id)}
        className="shrink-0 text-text-subtle hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Eliminar pregunta"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Owner view ─────────────────────────────────────────────────────────────────
function OwnerView({
  meetingId,
  questions: initial,
}: {
  meetingId: string;
  questions: PreQuestion[];
}) {
  const [questions, setQuestions] = useState<PreQuestion[]>(
    [...initial].sort((a, b) => a.orderIdx - b.orderIdx)
  );
  const [adding, setAdding] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleUpdate(id: string, text: string) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, questionText: text } : q)));
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/pre-questions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Error eliminando");
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      toast.success("Pregunta eliminada");
    } catch {
      toast.error("No se pudo eliminar la pregunta");
    }
  }

  async function handleAdd() {
    setAdding(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/pre-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: "Nueva pregunta",
          orderIdx: questions.length,
        }),
      });
      if (!res.ok) throw new Error("Error creando pregunta");
      const body = (await res.json()) as { question: PreQuestion };
      setQuestions((prev) => [...prev, body.question]);
    } catch {
      toast.error("No se pudo agregar la pregunta");
    } finally {
      setAdding(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = questions.findIndex((q) => q.id === active.id);
    const newIdx = questions.findIndex((q) => q.id === over.id);
    const reordered = arrayMove(questions, oldIdx, newIdx).map((q, idx) => ({
      ...q,
      orderIdx: idx,
    }));
    setQuestions(reordered);

    try {
      await Promise.all(
        reordered.map((q) =>
          fetch(`/api/meetings/${meetingId}/pre-questions/${q.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderIdx: q.orderIdx }),
          })
        )
      );
    } catch {
      toast.error("No se pudo guardar el orden");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">
          Pre-questions ({questions.length})
        </h3>
        <button
          onClick={handleAdd}
          disabled={adding}
          className="flex items-center gap-1.5 text-xs text-accent hover:underline disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          Agregar pregunta
        </button>
      </div>

      {questions.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-border rounded-xl">
          <MessageSquare className="w-8 h-8 text-text-subtle mx-auto mb-2" />
          <p className="text-sm text-text-subtle">Sin pre-questions</p>
          <button
            onClick={handleAdd}
            className="mt-3 text-xs text-accent hover:underline"
          >
            Agregar la primera pregunta
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={questions.map((q) => q.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {questions.map((q) => (
                <SortableQuestion
                  key={q.id}
                  question={q}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

// ─── Attendee view ───────────────────────────────────────────────────────────────
function AttendeeView({
  meetingId,
  questions,
  currentUserId,
}: {
  meetingId: string;
  questions: PreQuestion[];
  currentUserId: string;
}) {
  const sorted = [...questions].sort((a, b) => a.orderIdx - b.orderIdx);
  const [responses, setResponses] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    sorted.forEach((q) => {
      if (q.responsesJsonb && typeof q.responsesJsonb === "object") {
        const val = (q.responsesJsonb as Record<string, string>)[currentUserId];
        if (val) init[q.id] = val;
      }
    });
    return init;
  });
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  async function submitResponse(questionId: string) {
    const text = responses[questionId];
    if (!text?.trim()) return;
    setSaving((prev) => ({ ...prev, [questionId]: true }));
    try {
      const res = await fetch(
        `/api/meetings/${meetingId}/pre-questions/${questionId}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ response: text.trim() }),
        }
      );
      if (!res.ok) throw new Error("Error guardando respuesta");
      setSaved((prev) => ({ ...prev, [questionId]: true }));
      toast.success("Respuesta enviada");
    } catch {
      toast.error("No se pudo enviar la respuesta");
    } finally {
      setSaving((prev) => ({ ...prev, [questionId]: false }));
    }
  }

  if (sorted.length === 0) {
    return (
      <div className="text-center py-10">
        <MessageSquare className="w-8 h-8 text-text-subtle mx-auto mb-2" />
        <p className="text-sm text-text-subtle">No hay pre-questions para esta reunión</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-text-muted">
        Responde las pre-questions antes de la reunión para que el equipo llegue preparado.
      </p>
      {sorted.map((q, idx) => {
        const otherResponses = Object.entries(
          (q.responsesJsonb as Record<string, string>) ?? {}
        ).filter(([uid]) => uid !== currentUserId);

        return (
          <div key={q.id} className="space-y-3">
            <div className="flex items-start gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent text-[10px] font-semibold flex items-center justify-center mt-0.5">
                {idx + 1}
              </span>
              <p className="text-sm font-medium text-text">{q.questionText}</p>
            </div>

            <div className="ml-7 space-y-2">
              <textarea
                value={responses[q.id] ?? ""}
                onChange={(e) =>
                  setResponses((prev) => ({ ...prev, [q.id]: e.target.value }))
                }
                rows={3}
                placeholder="Tu respuesta..."
                className={cn(
                  "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-subtle resize-none focus:outline-none focus:border-accent",
                  saved[q.id] && "border-green-500/40"
                )}
              />

              <div className="flex items-center justify-between">
                {saved[q.id] ? (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Respuesta enviada
                  </span>
                ) : (
                  <span />
                )}
                <button
                  onClick={() => submitResponse(q.id)}
                  disabled={saving[q.id] || !responses[q.id]?.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
                >
                  <Send className="w-3 h-3" />
                  {saving[q.id] ? "Enviando..." : "Enviar respuesta"}
                </button>
              </div>

              {/* Responses from others */}
              {otherResponses.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[10px] font-semibold text-text-subtle uppercase tracking-wider">
                    Respuestas del equipo
                  </p>
                  {otherResponses.map(([uid, resp]) => (
                    <div
                      key={uid}
                      className="flex items-start gap-2 p-2 rounded-lg bg-surface-2 border border-border"
                    >
                      <div className="w-5 h-5 rounded-full bg-surface-3 text-text-subtle text-[9px] flex items-center justify-center shrink-0">
                        {uid.slice(0, 2).toUpperCase()}
                      </div>
                      <p className="text-xs text-text-muted">{resp}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main export ────────────────────────────────────────────────────────────────
export default function PreQuestionsEditor({
  meetingId,
  questions,
  currentUserId,
  isOwner,
}: Props) {
  if (isOwner) {
    return <OwnerView meetingId={meetingId} questions={questions} />;
  }
  return (
    <AttendeeView
      meetingId={meetingId}
      questions={questions}
      currentUserId={currentUserId}
    />
  );
}
