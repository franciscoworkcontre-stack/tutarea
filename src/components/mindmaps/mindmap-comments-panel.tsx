"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

type NodeGroup = {
  nodeId: string;
  nodeLabel: string;
  comments: Comment[];
};

type MindmapNode = {
  id: string;
  label: string;
};

type Props = {
  mindmapId: string;
  onClose: () => void;
  onNavigateToNode?: (nodeId: string) => void;
};

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

export default function MindmapCommentsPanel({
  mindmapId,
  onClose,
  onNavigateToNode,
}: Props) {
  const [groups, setGroups] = useState<NodeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [totalCount, setTotalCount] = useState(0);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all nodes first, then comments per node
      const nodesRes = await fetch(`/api/mindmaps/${mindmapId}/nodes`);
      const nodesData = nodesRes.ok ? ((await nodesRes.json()) as { nodes: MindmapNode[] }) : { nodes: [] };
      const nodes = nodesData.nodes ?? [];

      if (nodes.length === 0) {
        setGroups([]);
        setTotalCount(0);
        return;
      }

      // Fetch comments for all nodes in parallel (limit to avoid too many requests)
      const results = await Promise.all(
        nodes.slice(0, 50).map(async (node) => {
          try {
            const res = await fetch(
              `/api/mindmaps/${mindmapId}/nodes/${node.id}/comments`
            );
            if (!res.ok) return { node, comments: [] };
            const data = (await res.json()) as { comments: Comment[] };
            return { node, comments: data.comments ?? [] };
          } catch {
            return { node, comments: [] };
          }
        })
      );

      const grouped: NodeGroup[] = results
        .filter((r) => r.comments.length > 0)
        .map((r) => ({
          nodeId: r.node.id,
          nodeLabel: r.node.label,
          comments: r.comments,
        }));

      const total = grouped.reduce((acc, g) => {
        function countComments(cs: Comment[]): number {
          return cs.reduce((a, c) => a + 1 + countComments(c.replies), 0);
        }
        return acc + countComments(g.comments);
      }, 0);

      setGroups(grouped);
      setTotalCount(total);

      // Auto-expand first group
      if (grouped.length > 0 && grouped[0]) {
        setExpandedNodeIds(new Set([grouped[0].nodeId]));
      }
    } catch {
      toast.error("No se pudieron cargar los comentarios");
    } finally {
      setLoading(false);
    }
  }, [mindmapId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const toggleGroup = (nodeId: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/30"
          onClick={onClose}
        />

        {/* Drawer */}
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="relative ml-auto z-10 w-full max-w-sm bg-background border-l border-border h-full flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold">Comentarios del mapa</span>
              {totalCount > 0 && (
                <span className="text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">
                  {totalCount}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Info note */}
          <div className="px-4 py-2 bg-surface-2/50 border-b border-border flex-shrink-0">
            <p className="text-xs text-text-muted">
              Vista de todos los comentarios agrupados por nodo. Haz clic en un nodo para navegar a él.
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-text-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Cargando comentarios...</span>
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-text-subtle">
                <MessageSquare className="w-8 h-8 opacity-30" />
                <p className="text-sm">No hay comentarios en este mapa</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {groups.map((group) => {
                  const expanded = expandedNodeIds.has(group.nodeId);
                  const commentCount = group.comments.reduce((a, c) => a + 1 + c.replies.length, 0);

                  return (
                    <div key={group.nodeId}>
                      {/* Node header */}
                      <button
                        onClick={() => toggleGroup(group.nodeId)}
                        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-surface-2 transition-colors text-left"
                      >
                        <ChevronRight
                          className={cn(
                            "w-4 h-4 text-text-muted transition-transform flex-shrink-0",
                            expanded && "rotate-90"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-text truncate block">
                            {group.nodeLabel}
                          </span>
                          <span className="text-xs text-text-muted">
                            {commentCount} comentario{commentCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {onNavigateToNode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToNode(group.nodeId);
                            }}
                            className="text-xs text-accent hover:underline flex-shrink-0"
                          >
                            Ir al nodo
                          </button>
                        )}
                      </button>

                      {/* Comments */}
                      <AnimatePresence initial={false}>
                        {expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-3 space-y-3">
                              {group.comments.map((comment) => (
                                <div key={comment.id} className="space-y-2">
                                  <CommentRow comment={comment} />
                                  {comment.replies.length > 0 && (
                                    <div className="ml-6 border-l-2 border-border pl-3 space-y-2">
                                      {comment.replies.map((reply) => (
                                        <CommentRow key={reply.id} comment={reply} />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.aside>
      </div>
    </AnimatePresence>
  );
}

function CommentRow({ comment }: { comment: Comment }) {
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
      </div>
    </div>
  );
}
