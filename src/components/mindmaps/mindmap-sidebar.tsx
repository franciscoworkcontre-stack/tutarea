"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Link2, Unlink, MessageSquare, Settings, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import TaskLinkPicker from "./task-link-picker";

type Task = {
  id: string;
  key: string;
  title: string;
  statusId: string | null;
  assigneeId: string | null;
  priority: string;
  dueDate: Date | null;
  status?: { id: string; name: string; color: string; type: string } | null;
};

type Comment = {
  id: string;
  nodeId: string;
  userId: string;
  content: string;
  parentCommentId: string | null;
  createdAt: string;
  author: { id: string; fullName: string | null; avatarUrl: string | null } | null;
  replies: Comment[];
};

type NodeData = {
  label: string;
  contentMd?: string;
  color?: string;
  linkedTaskId?: string | null;
  styleJsonb?: {
    fillColor?: string;
    borderColor?: string;
    shape?: "rounded" | "circle" | "diamond" | "rect";
    icon?: string;
  };
};

type Props = {
  nodeId: string | null;
  nodeData: NodeData | null;
  mindmapId: string;
  projectId: string;
  workspaceSlug: string;
  onClose: () => void;
  onNodeUpdate: (nodeId: string, updates: Partial<NodeData>) => void;
};

const PRESET_COLORS = [
  "#94a3b8",
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#06b6d4",
  "#a855f7",
];

const SHAPE_OPTIONS: { value: "rounded" | "circle" | "diamond" | "rect"; label: string }[] = [
  { value: "rounded", label: "Redondeado" },
  { value: "circle", label: "Círculo" },
  { value: "diamond", label: "Rombo" },
  { value: "rect", label: "Rectángulo" },
];

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  no_priority: "Sin prioridad",
};

type Tab = "properties" | "task" | "comments";

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase();
}

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

export default function MindmapSidebar({
  nodeId,
  nodeData,
  mindmapId,
  projectId,
  workspaceSlug,
  onClose,
  onNodeUpdate,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("properties");
  const [content, setContent] = useState("");
  const [icon, setIcon] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [linkedTask, setLinkedTask] = useState<Task | null>(null);
  const [linkedTaskLoading, setLinkedTaskLoading] = useState(false);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const contentDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local state when nodeId/nodeData changes
  useEffect(() => {
    if (nodeData) {
      setContent(nodeData.contentMd ?? "");
      setIcon(nodeData.styleJsonb?.icon ?? "");
    }
    setActiveTab("properties");
    setComments([]);
    setLinkedTask(null);
  }, [nodeId]);

  // Fetch linked task when nodeData changes and has linkedTaskId
  useEffect(() => {
    if (!nodeData?.linkedTaskId) {
      setLinkedTask(null);
      return;
    }
    setLinkedTaskLoading(true);
    fetch(`/api/tasks/${nodeData.linkedTaskId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.task) setLinkedTask(data.task as Task);
      })
      .catch(() => null)
      .finally(() => setLinkedTaskLoading(false));
  }, [nodeData?.linkedTaskId]);

  // Fetch comments when tab is active
  useEffect(() => {
    if (activeTab !== "comments" || !nodeId) return;
    setCommentsLoading(true);
    fetch(`/api/mindmaps/${mindmapId}/nodes/${nodeId}/comments`)
      .then((r) => (r.ok ? r.json() : { comments: [] }))
      .then((data) => setComments((data.comments ?? []) as Comment[]))
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false));
  }, [activeTab, nodeId, mindmapId]);

  const handleContentBlur = useCallback(() => {
    if (!nodeId) return;
    if (contentDebounceRef.current) clearTimeout(contentDebounceRef.current);
    const value = content;
    fetch(`/api/mindmaps/${mindmapId}/nodes/${nodeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: value || null }),
    }).catch(() => toast.error("No se pudo guardar el contenido"));
    onNodeUpdate(nodeId, { contentMd: value || undefined });
  }, [nodeId, content, mindmapId, onNodeUpdate]);

  const handleColorSelect = useCallback(
    (color: string) => {
      if (!nodeId) return;
      onNodeUpdate(nodeId, { color });
      fetch(`/api/mindmaps/${mindmapId}/nodes/${nodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color }),
      }).catch(() => toast.error("No se pudo guardar el color"));
    },
    [nodeId, mindmapId, onNodeUpdate]
  );

  const handleShapeSelect = useCallback(
    (shape: "rounded" | "circle" | "diamond" | "rect") => {
      if (!nodeId || !nodeData) return;
      const newStyle = { ...(nodeData.styleJsonb ?? {}), shape };
      onNodeUpdate(nodeId, { styleJsonb: newStyle });
      fetch(`/api/mindmaps/${mindmapId}/nodes/${nodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleJsonb: newStyle }),
      }).catch(() => toast.error("No se pudo guardar la forma"));
    },
    [nodeId, nodeData, mindmapId, onNodeUpdate]
  );

  const handleIconBlur = useCallback(() => {
    if (!nodeId || !nodeData) return;
    const newStyle = { ...(nodeData.styleJsonb ?? {}), icon: icon || undefined };
    onNodeUpdate(nodeId, { styleJsonb: newStyle });
    fetch(`/api/mindmaps/${mindmapId}/nodes/${nodeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ styleJsonb: newStyle }),
    }).catch(() => toast.error("No se pudo guardar el icono"));
  }, [nodeId, nodeData, icon, mindmapId, onNodeUpdate]);

  const handleLinkTask = useCallback(
    async (taskId: string) => {
      if (!nodeId) return;
      setShowLinkPicker(false);
      try {
        await fetch(`/api/mindmaps/${mindmapId}/nodes/${nodeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ linkedTaskId: taskId }),
        });
        onNodeUpdate(nodeId, { linkedTaskId: taskId });
        toast.success("Tarea vinculada");
      } catch {
        toast.error("No se pudo vincular la tarea");
      }
    },
    [nodeId, mindmapId, onNodeUpdate]
  );

  const handleUnlinkTask = useCallback(async () => {
    if (!nodeId) return;
    try {
      await fetch(`/api/mindmaps/${mindmapId}/nodes/${nodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedTaskId: null }),
      });
      onNodeUpdate(nodeId, { linkedTaskId: null });
      setLinkedTask(null);
      toast.success("Tarea desvinculada");
    } catch {
      toast.error("No se pudo desvincular la tarea");
    }
  }, [nodeId, mindmapId, onNodeUpdate]);

  const handleSubmitComment = useCallback(async () => {
    if (!nodeId || !newComment.trim()) return;
    setSubmittingComment(true);
    const optimisticId = crypto.randomUUID();
    const optimistic: Comment = {
      id: optimisticId,
      nodeId,
      userId: "current",
      content: newComment.trim(),
      parentCommentId: null,
      createdAt: new Date().toISOString(),
      author: { id: "current", fullName: "Tú", avatarUrl: null },
      replies: [],
    };
    setComments((prev) => [...prev, optimistic]);
    setNewComment("");
    try {
      const res = await fetch(`/api/mindmaps/${mindmapId}/nodes/${nodeId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: optimistic.content }),
      });
      if (!res.ok) throw new Error();
      const { comment } = (await res.json()) as { comment: Comment };
      setComments((prev) =>
        prev.map((c) => (c.id === optimisticId ? { ...comment, replies: [] } : c))
      );
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== optimisticId));
      setNewComment(optimistic.content);
      toast.error("No se pudo enviar el comentario");
    } finally {
      setSubmittingComment(false);
    }
  }, [nodeId, newComment, mindmapId]);

  const handleSubmitReply = useCallback(
    async (parentId: string) => {
      if (!nodeId || !replyText.trim()) return;
      const optimisticId = crypto.randomUUID();
      const optimistic: Comment = {
        id: optimisticId,
        nodeId,
        userId: "current",
        content: replyText.trim(),
        parentCommentId: parentId,
        createdAt: new Date().toISOString(),
        author: { id: "current", fullName: "Tú", avatarUrl: null },
        replies: [],
      };
      setComments((prev) =>
        prev.map((c) =>
          c.id === parentId ? { ...c, replies: [...c.replies, optimistic] } : c
        )
      );
      setReplyText("");
      setReplyingTo(null);
      try {
        const res = await fetch(`/api/mindmaps/${mindmapId}/nodes/${nodeId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: optimistic.content, parentCommentId: parentId }),
        });
        if (!res.ok) throw new Error();
        const { comment } = (await res.json()) as { comment: Comment };
        setComments((prev) =>
          prev.map((c) =>
            c.id === parentId
              ? {
                  ...c,
                  replies: c.replies.map((r) =>
                    r.id === optimisticId ? { ...comment, replies: [] } : r
                  ),
                }
              : c
          )
        );
      } catch {
        setComments((prev) =>
          prev.map((c) =>
            c.id === parentId
              ? { ...c, replies: c.replies.filter((r) => r.id !== optimisticId) }
              : c
          )
        );
        toast.error("No se pudo enviar la respuesta");
      }
    },
    [nodeId, replyText, mindmapId]
  );

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "properties", label: "Propiedades", show: true },
    { key: "task", label: "Tarea", show: !!nodeData?.linkedTaskId },
    { key: "comments", label: "Comentarios", show: true },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <span className="text-sm font-medium truncate max-w-[200px]">
          {nodeData?.label ?? "Propiedades del nodo"}
        </span>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-2 transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border flex-shrink-0">
        {tabs
          .filter((t) => t.show)
          .map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 text-xs py-2 px-2 font-medium transition-colors border-b-2",
                activeTab === tab.key
                  ? "border-accent text-accent"
                  : "border-transparent text-text-muted hover:text-text"
              )}
            >
              {tab.label}
            </button>
          ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "properties" && nodeData && nodeId && (
          <div className="p-4 space-y-5">
            {/* Content */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
                Contenido (Markdown)
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onBlur={handleContentBlur}
                rows={5}
                className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 outline-none focus:border-accent/50 placeholder:text-text-subtle transition-colors resize-none"
                placeholder="Notas, detalles en Markdown..."
              />
            </div>

            {/* Color picker */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
                Color
              </label>
              <div className="grid grid-cols-8 gap-1.5">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorSelect(color)}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 transition-transform hover:scale-110",
                      nodeData.color === color
                        ? "border-text scale-110"
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Shape */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
                Forma
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {SHAPE_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => handleShapeSelect(s.value)}
                    className={cn(
                      "text-xs px-2 py-1.5 rounded border transition-colors",
                      nodeData.styleJsonb?.shape === s.value
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-text-muted hover:border-border-strong hover:text-text"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Icon */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
                Icono (emoji)
              </label>
              <input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                onBlur={handleIconBlur}
                placeholder="📌"
                className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 outline-none focus:border-accent/50 placeholder:text-text-subtle transition-colors"
                maxLength={4}
              />
            </div>

            {/* Linked task */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
                Tarea vinculada
              </label>
              {nodeData.linkedTaskId ? (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-2 border border-border">
                  <Link2 className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                  <span className="text-xs text-text flex-1 truncate">
                    {linkedTaskLoading ? "Cargando..." : linkedTask?.title ?? nodeData.linkedTaskId}
                  </span>
                  <button
                    onClick={handleUnlinkTask}
                    className="text-text-muted hover:text-text transition-colors"
                    title="Desvincular"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowLinkPicker(true)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-dashed border-border text-text-muted hover:border-accent/50 hover:text-accent transition-colors flex items-center gap-1.5"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Vincular tarea
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === "task" && (
          <div className="p-4 space-y-4">
            {linkedTaskLoading ? (
              <div className="text-xs text-text-muted text-center py-8">Cargando tarea...</div>
            ) : linkedTask ? (
              <>
                <div className="space-y-1">
                  <p className="text-xs text-text-muted">{linkedTask.key}</p>
                  <h3 className="text-sm font-medium">{linkedTask.title}</h3>
                </div>

                {linkedTask.status && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">Estado</span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full border"
                      style={{
                        backgroundColor: linkedTask.status.color + "20",
                        borderColor: linkedTask.status.color + "50",
                        color: linkedTask.status.color,
                      }}
                    >
                      {linkedTask.status.name}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">Prioridad</span>
                  <span className="text-xs text-text">
                    {PRIORITY_LABELS[linkedTask.priority] ?? linkedTask.priority}
                  </span>
                </div>

                {linkedTask.dueDate && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">Fecha límite</span>
                    <span className="text-xs text-text">
                      {new Date(linkedTask.dueDate).toLocaleDateString("es-CL")}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <a
                    href={`/app/${workspaceSlug}/projects/${projectId}/board`}
                    className="flex items-center gap-1 text-xs text-accent hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Ver tarea en Kanban
                  </a>
                </div>

                <button
                  onClick={handleUnlinkTask}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border text-text-muted hover:border-red-500/50 hover:text-red-500 transition-colors flex items-center gap-1.5 justify-center"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  Desvincular
                </button>
              </>
            ) : (
              <div className="text-xs text-text-subtle text-center py-8">
                No se pudo cargar la tarea vinculada
              </div>
            )}
          </div>
        )}

        {activeTab === "comments" && (
          <div className="p-4 space-y-4">
            {commentsLoading ? (
              <div className="text-xs text-text-muted text-center py-8">Cargando comentarios...</div>
            ) : comments.length === 0 ? (
              <div className="text-xs text-text-subtle text-center py-8 flex flex-col items-center gap-2">
                <MessageSquare className="w-8 h-8 opacity-30" />
                <span>No hay comentarios</span>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="space-y-2">
                    <CommentItem
                      comment={comment}
                      onReply={(id) => setReplyingTo(id)}
                    />
                    {/* Replies */}
                    {comment.replies.length > 0 && (
                      <div className="ml-6 space-y-2 border-l-2 border-border pl-3">
                        {comment.replies.map((reply) => (
                          <CommentItem key={reply.id} comment={reply} isReply />
                        ))}
                      </div>
                    )}
                    {replyingTo === comment.id && (
                      <div className="ml-6 flex gap-2">
                        <input
                          autoFocus
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSubmitReply(comment.id);
                            }
                            if (e.key === "Escape") {
                              setReplyingTo(null);
                              setReplyText("");
                            }
                          }}
                          placeholder="Responder..."
                          className="flex-1 text-xs bg-surface-2 border border-border rounded px-2 py-1 outline-none focus:border-accent/50"
                        />
                        <button
                          onClick={() => handleSubmitReply(comment.id)}
                          disabled={!replyText.trim()}
                          className="text-xs px-2 py-1 rounded bg-accent text-accent-fg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Enviar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* New comment input */}
            <div className="space-y-2 pt-2 border-t border-border">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitComment();
                  }
                }}
                placeholder="Escribe un comentario..."
                rows={2}
                className="w-full text-xs bg-surface-2 border border-border rounded-lg px-3 py-2 outline-none focus:border-accent/50 placeholder:text-text-subtle resize-none"
              />
              <button
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || submittingComment}
                className="w-full text-xs px-3 py-1.5 rounded-lg bg-accent text-accent-fg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
              >
                {submittingComment ? "Enviando..." : "Comentar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <AnimatePresence>
        {nodeId && (
          <motion.aside
            key="sidebar-desktop"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={cn(
              "hidden md:flex flex-col w-[280px] flex-shrink-0",
              "border-l border-border bg-background h-full overflow-hidden"
            )}
          >
            {nodeId ? sidebarContent : <EmptyState />}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile bottom sheet */}
      <AnimatePresence>
        {nodeId && (
          <motion.div
            key="sidebar-mobile"
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className={cn(
              "fixed bottom-0 left-0 right-0 z-50 md:hidden",
              "bg-background border-t border-border rounded-t-2xl shadow-2xl",
              "h-[65vh] flex flex-col"
            )}
          >
            {nodeId ? sidebarContent : <EmptyState />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task link picker modal */}
      {showLinkPicker && nodeId && (
        <TaskLinkPicker
          projectId={projectId}
          currentLinkedTaskId={nodeData?.linkedTaskId ?? null}
          onLink={handleLinkTask}
          onUnlink={handleUnlinkTask}
          onClose={() => setShowLinkPicker(false)}
        />
      )}
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-text-subtle gap-2 p-6">
      <Settings className="w-8 h-8 opacity-30" />
      <p className="text-sm text-center">
        Selecciona un nodo para ver sus propiedades
      </p>
    </div>
  );
}

function CommentItem({
  comment,
  isReply = false,
  onReply,
}: {
  comment: Comment;
  isReply?: boolean;
  onReply?: (id: string) => void;
}) {
  return (
    <div className="flex gap-2">
      <div className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center flex-shrink-0 font-medium">
        {comment.author?.avatarUrl ? (
          <img
            src={comment.author.avatarUrl}
            alt={comment.author.fullName ?? ""}
            className="w-6 h-6 rounded-full object-cover"
          />
        ) : (
          getInitials(comment.author?.fullName)
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-text">
            {comment.author?.fullName ?? "Usuario"}
          </span>
          <span className="text-xs text-text-subtle">{formatRelative(comment.createdAt)}</span>
        </div>
        <p className="text-xs text-text-muted mt-0.5 leading-relaxed break-words">
          {comment.content}
        </p>
        {!isReply && onReply && (
          <button
            onClick={() => onReply(comment.id)}
            className="text-xs text-text-subtle hover:text-accent transition-colors mt-0.5"
          >
            Responder
          </button>
        )}
      </div>
    </div>
  );
}
