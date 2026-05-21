"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { CheckSquare, Calendar, Flag } from "lucide-react";
import { formatRelativeDate, priorityLabel } from "@/lib/utils";
import type { InferSelectModel } from "drizzle-orm";
import type { tasks, taskStatuses } from "@/db/schema";

type Task = InferSelectModel<typeof tasks> & { status: InferSelectModel<typeof taskStatuses> | null };

type Props = {
  tasks: Task[];
  workspaceSlug: string;
};

export default function MyTasksView({ tasks, workspaceSlug }: Props) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      >
        <h1 className="text-2xl font-semibold tracking-tighter mb-1">Mis tareas</h1>
        <p className="text-text-muted text-sm mb-8">
          {tasks.length} tarea{tasks.length !== 1 ? "s" : ""} asignadas a ti.
        </p>

        {tasks.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-2xl">
            <CheckSquare className="w-10 h-10 text-text-subtle mx-auto mb-3" />
            <p className="font-serif text-xl text-text-muted italic mb-2">
              &ldquo;Sin tareas pendientes.&rdquo;
            </p>
            <p className="text-sm text-text-subtle">
              Cuando te asignen tareas, aparecerán aquí.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task, i) => (
              <motion.div
                key={task.id}
                className="flex items-center gap-4 px-4 py-3 rounded-xl border border-border bg-surface hover:border-border-strong hover:bg-surface-2 transition-all"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: task.status?.color ?? "#94a3b8" }}
                />
                <Link
                  href={`/app/${workspaceSlug}/projects/${task.projectId}/tasks/${task.id}`}
                  className="flex-1 text-sm font-medium hover:text-accent transition-colors truncate"
                >
                  {task.title}
                </Link>
                <span className="text-xs font-mono text-text-subtle">{task.key}</span>
                {task.dueDate && (
                  <div className="flex items-center gap-1 text-xs text-text-muted">
                    <Calendar className="w-3 h-3" />
                    {formatRelativeDate(task.dueDate)}
                  </div>
                )}
                {task.priority !== "no_priority" && (
                  <span className={`text-xs ${priorityLabel(task.priority).color}`}>
                    {priorityLabel(task.priority).label}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
