"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Brain,
  CheckSquare,
  Plus,
  X,
  BookOpen,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn, spring } from "@/lib/utils";
import type { MeetingAttachment } from "@/lib/meetings/meeting-types";

type Tab = "mindmaps" | "links" | "tasks";

type MindmapItem = {
  id: string;
  title: string;
  updatedAt: string | Date | null;
};

type TaskItem = {
  id: string;
  title: string;
  status: string;
};

type Props = {
  meetingId: string;
  projectId: string;
  attachments: MeetingAttachment[];
  onUpdate: (attachments: MeetingAttachment[]) => void;
  readOnly?: boolean;
};

const SOURCE_ICONS: Record<string, React.ElementType> = {
  mindmap: Brain,
  external_link: Globe,
  task: CheckSquare,
  meeting: BookOpen,
};

export default function MeetingAttachments({
  meetingId,
  projectId,
  attachments: initialAttachments,
  onUpdate,
  readOnly,
}: Props) {
  const [tab, setTab] = useState<Tab>("mindmaps");
  const [attachments, setAttachments] =
    useState<MeetingAttachment[]>(initialAttachments);
  const [mindmaps, setMindmaps] = useState<MindmapItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [loadingMindmaps, setLoadingMindmaps] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [addingLink, setAddingLink] = useState(false);

  useEffect(() => {
    if (tab === "mindmaps" && mindmaps.length === 0) {
      setLoadingMindmaps(true);
      fetch(`/api/mindmaps?projectId=${projectId}`)
        .then((r) => r.json())
        .then((data) => setMindmaps(data.mindmaps ?? []))
        .catch(() => toast.error("Error al cargar mindmaps"))
        .finally(() => setLoadingMindmaps(false));
    }
    if (tab === "tasks" && tasks.length === 0) {
      setLoadingTasks(true);
      fetch(`/api/projects/${projectId}/tasks`)
        .then((r) => r.json())
        .then((data) => setTasks(data.tasks ?? []))
        .catch(() => toast.error("Error al cargar tareas"))
        .finally(() => setLoadingTasks(false));
    }
  }, [tab, projectId, mindmaps.length, tasks.length]);

  const isAttached = (sourceType: string, refId: string) =>
    attachments.some(
      (a) =>
        a.sourceType === sourceType &&
        (a.sourceRefId === refId || a.externalUrl === refId)
    );

  const handleAttach = async ({
    sourceType,
    sourceRefId,
    externalUrl,
    title,
  }: {
    sourceType: string;
    sourceRefId?: string;
    externalUrl?: string;
    title: string;
  }) => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType, sourceRefId, externalUrl, title }),
      });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { attachment: MeetingAttachment };
      const next = [...attachments, body.attachment];
      setAttachments(next);
      onUpdate(next);
      toast.success("Adjunto agregado");
    } catch {
      toast.error("Error al adjuntar");
    }
  };

  const handleRemove = async (id: string) => {
    const prev = attachments;
    const next = attachments.filter((a) => a.id !== id);
    setAttachments(next);
    onUpdate(next);
    try {
      const res = await fetch(
        `/api/meetings/${meetingId}/attachments/${id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
    } catch {
      setAttachments(prev);
      onUpdate(prev);
      toast.error("Error al eliminar adjunto");
    }
  };

  const handlePreReadToggle = async (id: string, preReadRequired: boolean) => {
    const prev = attachments;
    const next = attachments.map((a) =>
      a.id === id ? { ...a, preReadRequired } : a
    );
    setAttachments(next);
    onUpdate(next);
    try {
      await fetch(`/api/meetings/${meetingId}/attachments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preReadRequired }),
      });
    } catch {
      setAttachments(prev);
      onUpdate(prev);
    }
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim()) return;
    setAddingLink(true);
    try {
      await handleAttach({
        sourceType: "external_link",
        externalUrl: linkUrl.trim(),
        title: linkUrl.trim(),
      });
      setLinkUrl("");
    } finally {
      setAddingLink(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "mindmaps", label: "Mindmaps", icon: Brain },
    { key: "links", label: "Links", icon: Globe },
    { key: "tasks", label: "Tareas", icon: CheckSquare },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Tabs */}
      <div className="flex items-center border-b border-border gap-0">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
              tab === key ? "text-text" : "text-text-muted hover:text-text"
            )}
          >
            <Icon className="w-3 h-3" />
            {label}
            {tab === key && (
              <motion.div
                layoutId="attachment-tab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full"
                transition={spring}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex flex-col gap-2">
        {/* Mindmaps */}
        {tab === "mindmaps" && (
          <div className="flex flex-col gap-1.5">
            {loadingMindmaps ? (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-text-subtle" />
                <span className="text-xs text-text-subtle">Cargando...</span>
              </div>
            ) : mindmaps.length === 0 ? (
              <p className="text-xs text-text-subtle py-4 text-center">
                No hay mindmaps en este proyecto
              </p>
            ) : (
              mindmaps.map((mm) => {
                const attached = isAttached("mindmap", mm.id);
                return (
                  <div
                    key={mm.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface/50 transition-colors"
                  >
                    <Brain className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                    <span className="flex-1 text-xs truncate">{mm.title}</span>
                    {!readOnly && (
                      <button
                        onClick={() =>
                          attached
                            ? handleRemove(
                                attachments.find(
                                  (a) =>
                                    a.sourceType === "mindmap" &&
                                    a.sourceRefId === mm.id
                                )!.id
                              )
                            : handleAttach({
                                sourceType: "mindmap",
                                sourceRefId: mm.id,
                                title: mm.title,
                              })
                        }
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full border font-medium transition-colors",
                          attached
                            ? "bg-accent/10 text-accent border-accent/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
                            : "border-border text-text-subtle hover:bg-surface-2"
                        )}
                      >
                        {attached ? "Adjunto" : "+ Adjuntar"}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* External links */}
        {tab === "links" && (
          <div className="flex flex-col gap-2">
            {!readOnly && (
              <div className="flex items-center gap-2">
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddLink();
                  }}
                  placeholder="https://..."
                  className="flex-1 text-xs bg-background border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-accent placeholder:text-text-subtle"
                />
                <button
                  onClick={handleAddLink}
                  disabled={addingLink || !linkUrl.trim()}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-accent text-accent-fg rounded-lg font-medium disabled:opacity-50"
                >
                  {addingLink ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Plus className="w-3 h-3" />
                  )}
                  Agregar
                </button>
              </div>
            )}
            <div className="flex flex-col gap-1">
              {attachments
                .filter((a) => a.sourceType === "external_link")
                .map((a) => (
                  <AttachmentRow
                    key={a.id}
                    attachment={a}
                    onRemove={() => handleRemove(a.id)}
                    onTogglePreRead={(v) => handlePreReadToggle(a.id, v)}
                    readOnly={readOnly}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Tasks */}
        {tab === "tasks" && (
          <div className="flex flex-col gap-1.5">
            {loadingTasks ? (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-text-subtle" />
                <span className="text-xs text-text-subtle">Cargando...</span>
              </div>
            ) : tasks.length === 0 ? (
              <p className="text-xs text-text-subtle py-4 text-center">
                No hay tareas en este proyecto
              </p>
            ) : (
              tasks.map((task) => {
                const attached = isAttached("task", task.id);
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface/50 transition-colors"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                    <span className="flex-1 text-xs truncate">{task.title}</span>
                    <span className="text-[10px] text-text-subtle">{task.status}</span>
                    {!readOnly && (
                      <button
                        onClick={() =>
                          attached
                            ? handleRemove(
                                attachments.find(
                                  (a) =>
                                    a.sourceType === "task" &&
                                    a.sourceRefId === task.id
                                )!.id
                              )
                            : handleAttach({
                                sourceType: "task",
                                sourceRefId: task.id,
                                title: task.title,
                              })
                        }
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full border font-medium transition-colors",
                          attached
                            ? "bg-accent/10 text-accent border-accent/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
                            : "border-border text-text-subtle hover:bg-surface-2"
                        )}
                      >
                        {attached ? "Adjunto" : "+ Adjuntar"}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Current attachments summary */}
      {attachments.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="text-[10px] text-text-subtle font-medium mb-2 uppercase tracking-wide">
            Adjuntos ({attachments.length})
          </p>
          <div className="flex flex-col gap-1">
            {attachments.map((a) => (
              <AttachmentRow
                key={a.id}
                attachment={a}
                onRemove={() => handleRemove(a.id)}
                onTogglePreRead={(v) => handlePreReadToggle(a.id, v)}
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AttachmentRow({
  attachment,
  onRemove,
  onTogglePreRead,
  readOnly,
}: {
  attachment: MeetingAttachment;
  onRemove: () => void;
  onTogglePreRead: (v: boolean) => void;
  readOnly?: boolean;
}) {
  const Icon = SOURCE_ICONS[attachment.sourceType] ?? Globe;

  return (
    <div className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface/50 transition-colors">
      <Icon className="w-3.5 h-3.5 text-text-subtle flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs truncate">
          {attachment.externalUrl ? (
            <a
              href={attachment.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent transition-colors"
            >
              {attachment.title ||
                attachment.externalUrl.replace(/^https?:\/\//, "")}
            </a>
          ) : (
            attachment.title
          )}
        </p>
      </div>

      {!readOnly && (
        <button
          onClick={() => onTogglePreRead(!attachment.preReadRequired)}
          className={cn(
            "text-[10px] px-1.5 py-0.5 rounded-full border font-medium transition-colors flex-shrink-0",
            attachment.preReadRequired
              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
              : "border-border text-text-subtle hover:bg-surface-2"
          )}
          title="Pre-read requerido"
        >
          {attachment.preReadRequired ? "Pre-read" : "Pre-read?"}
        </button>
      )}

      {!readOnly && (
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-500/10 text-text-subtle hover:text-red-400 flex-shrink-0"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
