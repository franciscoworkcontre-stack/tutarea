"use client";

import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Target,
  List,
  HelpCircle,
  FileText,
  Users,
  Paperclip,
  Clock,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { cn, spring } from "@/lib/utils";
import AgendaEditor from "./agenda-editor";
import AttendeeManager from "./attendee-manager";
import MeetingAttachments from "./meeting-attachments";
import type { MeetingWithDetails, MeetingAttachment } from "@/lib/meetings/meeting-types";
import type { InferSelectModel } from "drizzle-orm";
import type { profiles } from "@/db/schema";

type Profile = InferSelectModel<typeof profiles>;
type Member = { userId: string; role: string; profile: Profile | null };

type Props = {
  meeting: MeetingWithDetails;
  members: Member[];
  currentUserId: string;
  onMeetingUpdate: (patch: Partial<MeetingWithDetails>) => void;
};

type MobileSection =
  | "agenda"
  | "prequestions"
  | "briefing"
  | "attendees"
  | "attachments";

const MOBILE_SECTIONS: {
  key: MobileSection;
  label: string;
  icon: React.ElementType;
}[] = [
  { key: "agenda", label: "Agenda", icon: List },
  { key: "prequestions", label: "Pre-Qs", icon: HelpCircle },
  { key: "briefing", label: "Briefing", icon: FileText },
  { key: "attendees", label: "Asistentes", icon: Users },
  { key: "attachments", label: "Recursos", icon: Paperclip },
];

function ObjectiveEditor({
  value,
  onChange,
  readOnly,
}: {
  value: string | null;
  onChange: (v: string) => void;
  readOnly?: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, bulletList: false, orderedList: false, blockquote: false, codeBlock: false }),
      Placeholder.configure({ placeholder: "Define el objetivo principal de esta reunión..." }),
    ],
    content: value ?? "",
    editable: !readOnly,
    onUpdate: ({ editor }) => onChange(editor.getText()),
  });

  return (
    <div
      className={cn(
        "text-sm bg-surface border border-border rounded-xl px-4 py-3 min-h-[48px] focus-within:border-accent transition-colors",
        readOnly && "opacity-60"
      )}
    >
      <EditorContent
        editor={editor}
        className="outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-text-subtle [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none"
      />
    </div>
  );
}

function BriefingEditor({
  value,
  onChange,
  readOnly,
  onGenerateAI,
  generating,
}: {
  value: string | null;
  onChange: (v: string) => void;
  readOnly?: boolean;
  onGenerateAI?: () => void;
  generating?: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder:
          "Escribe el briefing de la reunión aquí. Puedes incluir contexto, datos relevantes, decisiones previas...",
      }),
    ],
    content: value ?? "",
    editable: !readOnly,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted">Briefing</span>
        {!readOnly && onGenerateAI && (
          <button
            onClick={onGenerateAI}
            disabled={generating}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-accent/10 text-accent border border-accent/20 rounded-lg hover:bg-accent/20 transition-colors disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            Generar con AI
          </button>
        )}
      </div>
      <div
        className={cn(
          "text-sm bg-surface border border-border rounded-xl px-4 py-3 min-h-[160px] focus-within:border-accent transition-colors",
          readOnly && "opacity-60"
        )}
      >
        <EditorContent
          editor={editor}
          className="prose prose-sm prose-invert max-w-none outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-text-subtle [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none"
        />
      </div>
    </div>
  );
}

function PreQuestionsEditor({
  meetingId,
  questions,
  onChange,
  readOnly,
}: {
  meetingId: string;
  questions: MeetingWithDetails["preQuestions"];
  onChange: (questions: MeetingWithDetails["preQuestions"]) => void;
  readOnly?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [newQ, setNewQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = async () => {
    if (!newQ.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/pre-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: newQ.trim(),
          orderIdx: questions.length,
        }),
      });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as {
        question: MeetingWithDetails["preQuestions"][0];
      };
      onChange([...questions, body.question]);
      setNewQ("");
    } catch {
      toast.error("Error al agregar pregunta");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const prev = questions;
    onChange(questions.filter((q) => q.id !== id));
    try {
      const res = await fetch(
        `/api/meetings/${meetingId}/pre-questions/${id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
    } catch {
      onChange(prev);
      toast.error("Error al eliminar pregunta");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {questions.map((q, idx) => (
        <div
          key={q.id}
          className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border"
        >
          <span className="text-xs text-text-subtle w-4 flex-shrink-0">
            {idx + 1}.
          </span>
          <span className="flex-1 text-sm">{q.questionText}</span>
          {!readOnly && (
            <button
              onClick={() => handleDelete(q.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-text-subtle hover:text-red-400 p-0.5"
            >
              ×
            </button>
          )}
        </div>
      ))}

      {!readOnly && (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={newQ}
            onChange={(e) => setNewQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            placeholder="Agrega una pregunta pre-reunión..."
            className="flex-1 text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-accent placeholder:text-text-subtle"
          />
          <button
            onClick={handleAdd}
            disabled={saving || !newQ.trim()}
            className="text-sm px-3 py-2 bg-accent text-accent-fg rounded-lg font-medium disabled:opacity-50"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

export default function MeetingPrepView({
  meeting,
  members,
  currentUserId,
  onMeetingUpdate,
}: Props) {
  const [mobileSection, setMobileSection] =
    useState<MobileSection>("agenda");
  const [generating, setGenerating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readOnly =
    meeting.status === "completed" || meeting.status === "cancelled";

  const debounced = useCallback(
    (patch: Partial<MeetingWithDetails>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
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
      }, 800);
    },
    [meeting.id]
  );

  const handleObjectiveChange = (v: string) => {
    onMeetingUpdate({ objective: v });
    debounced({ objective: v });
  };

  const handleBriefingChange = (v: string) => {
    onMeetingUpdate({ briefingMd: v });
    debounced({ briefingMd: v });
  };

  const handleGenerateAI = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/ai/generate-briefing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error();
      // Endpoint streams plain text
      const text = await res.text();
      onMeetingUpdate({ briefingMd: text });
      // Persist to DB
      debounced({ briefingMd: text });
      toast.success("Briefing generado");
    } catch {
      toast.error("Error al generar briefing");
    } finally {
      setGenerating(false);
    }
  };

  const lastMeetingOfType = null; // placeholder for context section

  // Desktop 2-column layout
  return (
    <>
      {/* Mobile tab nav */}
      <div className="md:hidden flex items-center border-b border-border overflow-x-auto">
        {MOBILE_SECTIONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setMobileSection(key)}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors",
              mobileSection === key
                ? "text-text"
                : "text-text-muted hover:text-text"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {mobileSection === key && (
              <motion.div
                layoutId="prep-mobile-tab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full"
                transition={spring}
              />
            )}
          </button>
        ))}
      </div>

      {/* Mobile content */}
      <div className="md:hidden p-4 overflow-y-auto">
        {mobileSection === "agenda" && (
          <div className="flex flex-col gap-4">
            <Section title="Objetivo" icon={Target}>
              <ObjectiveEditor
                value={meeting.objective}
                onChange={handleObjectiveChange}
                readOnly={readOnly}
              />
            </Section>
            <Section title="Agenda" icon={List}>
              <AgendaEditor
                meetingId={meeting.id}
                initialItems={meeting.agendaItems}
                members={members}
                readOnly={readOnly}
                durationMin={meeting.durationMin}
              />
            </Section>
          </div>
        )}
        {mobileSection === "prequestions" && (
          <Section title="Pre-Questions" icon={HelpCircle}>
            <PreQuestionsEditor
              meetingId={meeting.id}
              questions={meeting.preQuestions}
              onChange={(q) => onMeetingUpdate({ preQuestions: q })}
              readOnly={readOnly}
            />
          </Section>
        )}
        {mobileSection === "briefing" && (
          <BriefingEditor
            value={meeting.briefingMd}
            onChange={handleBriefingChange}
            readOnly={readOnly}
            onGenerateAI={handleGenerateAI}
            generating={generating}
          />
        )}
        {mobileSection === "attendees" && (
          <Section title="Asistentes" icon={Users}>
            <AttendeeManager
              meetingId={meeting.id}
              attendees={meeting.attendees as Parameters<typeof AttendeeManager>[0]["attendees"]}
              members={members}
              currentUserId={currentUserId}
              onUpdate={(updated) =>
                onMeetingUpdate({ attendees: updated })
              }
            />
          </Section>
        )}
        {mobileSection === "attachments" && (
          <Section title="Recursos" icon={Paperclip}>
            <MeetingAttachments
              meetingId={meeting.id}
              projectId={meeting.projectId}
              attachments={meeting.attachments}
              onUpdate={(updated) =>
                onMeetingUpdate({ attachments: updated })
              }
              readOnly={readOnly}
            />
          </Section>
        )}
      </div>

      {/* Desktop 2-column layout */}
      <div className="hidden md:flex gap-0 flex-1 overflow-hidden">
        {/* Left column (2/3) */}
        <div className="flex-1 min-w-0 overflow-y-auto p-6 flex flex-col gap-6 border-r border-border">
          <Section title="Objetivo" icon={Target}>
            <ObjectiveEditor
              value={meeting.objective}
              onChange={handleObjectiveChange}
              readOnly={readOnly}
            />
          </Section>

          <Section title="Agenda" icon={List}>
            <AgendaEditor
              meetingId={meeting.id}
              initialItems={meeting.agendaItems}
              members={members}
              readOnly={readOnly}
              durationMin={meeting.durationMin}
            />
          </Section>

          <Section title="Pre-Questions" icon={HelpCircle}>
            <PreQuestionsEditor
              meetingId={meeting.id}
              questions={meeting.preQuestions}
              onChange={(q) => onMeetingUpdate({ preQuestions: q })}
              readOnly={readOnly}
            />
          </Section>

          <BriefingEditor
            value={meeting.briefingMd}
            onChange={handleBriefingChange}
            readOnly={readOnly}
            onGenerateAI={handleGenerateAI}
            generating={generating}
          />
        </div>

        {/* Right sidebar (1/3) */}
        <div className="w-72 flex-shrink-0 overflow-y-auto p-4 flex flex-col gap-5">
          <Section title="Asistentes" icon={Users}>
            <AttendeeManager
              meetingId={meeting.id}
              attendees={meeting.attendees as Parameters<typeof AttendeeManager>[0]["attendees"]}
              members={members}
              currentUserId={currentUserId}
              onUpdate={(updated) =>
                onMeetingUpdate({ attendees: updated })
              }
            />
          </Section>

          <Section title="Recursos" icon={Paperclip}>
            <MeetingAttachments
              meetingId={meeting.id}
              projectId={meeting.projectId}
              attachments={meeting.attachments}
              onUpdate={(updated) =>
                onMeetingUpdate({ attachments: updated })
              }
              readOnly={readOnly}
            />
          </Section>

          {/* Context section */}
          <Section title="Contexto" icon={Clock}>
            <div className="text-xs text-text-subtle space-y-1.5">
              <p>
                <span className="text-text-muted">Tipo:</span>{" "}
                {meeting.type}
              </p>
              {lastMeetingOfType ? (
                <p>
                  <span className="text-text-muted">
                    Última reunión de este tipo:
                  </span>{" "}
                  {lastMeetingOfType}
                </p>
              ) : (
                <p className="italic">
                  Sin historial de reuniones de este tipo
                </p>
              )}
              <p>
                <span className="text-text-muted">Duración:</span>{" "}
                {meeting.durationMin} min
              </p>
              {meeting.timezone && (
                <p>
                  <span className="text-text-muted">Timezone:</span>{" "}
                  {meeting.timezone}
                </p>
              )}
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-text-muted" />
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}
