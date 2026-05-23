"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import Link from "next/link";
import { cn, formatRelativeDate, getInitials } from "@/lib/utils";
import { useNow } from "@/lib/hooks";
import { AlertCircle, ArrowUp, ArrowDown, Minus, Calendar } from "lucide-react";
import type { InferSelectModel } from "drizzle-orm";
import type { tasks, profiles } from "@/db/schema";

type Task = InferSelectModel<typeof tasks>;
type Profile = InferSelectModel<typeof profiles>;
type Member = { userId: string; role: string; profile: Profile | null };

type Props = {
  task: Task;
  members: Member[];
  workspaceSlug: string;
  projectId: string;
  isDragging?: boolean;
};

const PriorityIcon = ({ priority }: { priority: string }) => {
  switch (priority) {
    case "urgent": return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
    case "high":   return <ArrowUp className="w-3.5 h-3.5 text-orange-500" />;
    case "medium": return <Minus className="w-3.5 h-3.5 text-yellow-500" />;
    case "low":    return <ArrowDown className="w-3.5 h-3.5 text-blue-400" />;
    default:       return null;
  }
};

export default function TaskCard({ task, members, workspaceSlug, projectId, isDragging }: Props) {
  const {
    attributes, listeners, setNodeRef, transform, transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const now = useNow();

  const style = { transform: CSS.Transform.toString(transform), transition };

  const assignee = members.find((m) => m.userId === task.assigneeId);
  // Only compute after mount so server and client render the same HTML
  const isOverdue  = now && task.dueDate ? new Date(task.dueDate) < now : false;
  const isDueToday = now && task.dueDate
    ? new Date(task.dueDate).toDateString() === now.toDateString()
    : false;

  if (isSortableDragging && !isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="h-24 rounded-lg border border-dashed border-border/50 bg-surface-2"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group rounded-lg border bg-background cursor-grab active:cursor-grabbing transition-all",
        isDragging
          ? "border-border-strong shadow-3 rotate-[1.5deg] scale-[1.02]"
          : "border-border hover:border-border-strong hover:shadow-2"
      )}
    >
      <div className="p-3">
        <div className="flex items-start gap-2 mb-2">
          <PriorityIcon priority={task.priority} />
          <Link
            href={`/app/${workspaceSlug}/projects/${projectId}/tasks/${task.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-medium leading-snug hover:text-accent transition-colors flex-1 min-w-0"
          >
            {task.title}
          </Link>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-subtle font-mono">{task.key}</span>
            {task.dueDate && (
              <div
                className={cn(
                  "flex items-center gap-1 text-xs px-1.5 py-0.5 rounded",
                  isOverdue
                    ? "bg-danger/10 text-danger"
                    : isDueToday
                    ? "bg-warn/10 text-warn"
                    : "bg-surface-2 text-text-subtle"
                )}
              >
                <Calendar className="w-3 h-3" />
                {formatRelativeDate(task.dueDate, "es-CL", now)}
              </div>
            )}
          </div>

          {assignee?.profile && (
            <motion.div
              className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-xs font-medium text-accent"
              title={assignee.profile.fullName ?? ""}
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              {getInitials(assignee.profile.fullName)}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
