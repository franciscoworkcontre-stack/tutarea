"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Send, MessageCircle, Trash2 } from "lucide-react";
import { formatDate, getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Author = {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
} | null;

type Comment = {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  author: Author;
};

type Props = {
  taskId: string;
  currentUserId: string;
};

export default function TaskComments({ taskId, currentUserId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`/api/tasks/${taskId}/comments`)
      .then((r) => r.json())
      .then((d: { comments: Comment[] }) => setComments(d.comments ?? []))
      .catch(() => toast.error("No se pudieron cargar los comentarios"))
      .finally(() => setLoading(false));
  }, [taskId]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      if (!res.ok) throw new Error();
      const { comment } = (await res.json()) as { comment: Comment };
      setComments((prev) => [comment, ...prev]);
      setText("");
      textareaRef.current?.focus();
    } catch {
      toast.error("No se pudo enviar el comentario");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDelete = async (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    try {
      await fetch(`/api/tasks/${taskId}/comments/${commentId}`, { method: "DELETE" });
    } catch {
      toast.error("No se pudo eliminar el comentario");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Input */}
      <div className="flex gap-3 items-start">
        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-accent mt-0.5">
          Tú
        </div>
        <div className="flex-1 border border-border rounded-xl overflow-hidden focus-within:border-accent/60 transition-colors bg-surface">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un comentario... (⌘Enter para enviar)"
            rows={2}
            className="w-full px-3 py-2.5 text-sm bg-transparent outline-none resize-none"
          />
          <div className="flex justify-end px-3 pb-2">
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                text.trim() && !sending
                  ? "bg-accent text-accent-fg hover:bg-accent/90"
                  : "bg-surface-2 text-text-subtle cursor-not-allowed"
              )}
            >
              <Send className="w-3 h-3" />
              {sending ? "Enviando..." : "Comentar"}
            </button>
          </div>
        </div>
      </div>

      {/* Comments list */}
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-text-subtle">
          <MessageCircle className="w-8 h-8 opacity-30" />
          <p className="text-sm">Sin comentarios aún. ¡Sé el primero!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => {
            const isOwn = comment.authorId === currentUserId;
            const name = comment.author?.fullName ?? "Usuario";
            const initials = getInitials(name);

            return (
              <div key={comment.id} className="flex gap-3 group">
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-surface-2 border border-border flex items-center justify-center flex-shrink-0 text-xs font-semibold text-text-muted mt-0.5">
                  {comment.author?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={comment.author.avatarUrl}
                      alt={name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-sm font-medium">{name}</span>
                    <span className="text-xs text-text-subtle">
                      {formatDate(comment.createdAt)}
                    </span>
                    {comment.editedAt && (
                      <span className="text-xs text-text-subtle italic">(editado)</span>
                    )}
                  </div>
                  <div className="text-sm text-text whitespace-pre-wrap bg-surface rounded-xl px-3 py-2 border border-border">
                    {comment.body}
                  </div>
                </div>

                {/* Delete button (own comments only) */}
                {isOwn && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded text-text-subtle hover:text-red-400 hover:bg-red-400/10 transition-all mt-1 flex-shrink-0"
                    title="Eliminar comentario"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
