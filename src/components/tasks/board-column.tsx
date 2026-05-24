"use client";

import { useState, useRef, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import TaskCard from "./task-card";
import AssigneePicker from "@/components/shared/assignee-picker";
import type { InferSelectModel } from "drizzle-orm";
import type { tasks, taskStatuses, profiles } from "@/db/schema";

type Task = InferSelectModel<typeof tasks>;
type Status = InferSelectModel<typeof taskStatuses>;
type Profile = InferSelectModel<typeof profiles>;
type Member = { userId: string; role: string; profile: Profile | null };

type Props = {
  status: Status;
  tasks: Task[];
  members: Member[];
  onAddTask: (statusId: string, title: string, assigneeId?: string | null) => void;
  workspaceSlug: string;
  projectId: string;
};

export default function BoardColumn({
  status,
  tasks,
  members,
  onAddTask,
  workspaceSlug,
  projectId,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAssigneeId, setNewAssigneeId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { setNodeRef, isOver } = useDroppable({ id: status.id });

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const handleAdd = () => {
    if (newTitle.trim()) {
      onAddTask(status.id, newTitle.trim(), newAssigneeId);
      setNewTitle("");
      setNewAssigneeId(null);
    }
    setAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
    if (e.key === "Escape") {
      setNewTitle("");
      setNewAssigneeId(null);
      setAdding(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-72 rounded-xl border transition-colors",
        isOver ? "border-accent/40 bg-accent/5" : "border-border bg-surface"
      )}
      style={{ height: "calc(100vh - 160px)" }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: status.color }} />
          <span className="text-sm font-medium">{status.name}</span>
          <span className="text-xs text-text-subtle bg-surface-2 px-1.5 py-0.5 rounded-full border border-border">
            {tasks.length}
          </span>
        </div>
        <button className="w-6 h-6 rounded flex items-center justify-center text-text-subtle hover:text-text hover:bg-surface-2 transition-colors">
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tasks */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <AnimatePresence initial={false}>
          {tasks.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.035, duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            >
              <TaskCard
                task={task}
                members={members}
                workspaceSlug={workspaceSlug}
                projectId={projectId}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {tasks.length === 0 && !adding && (
          <div className="flex items-center justify-center h-24 text-xs text-text-subtle border border-dashed border-border/50 rounded-lg">
            Arrastra tareas aquí
          </div>
        )}

        <AnimatePresence initial={false}>
          {adding && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="rounded-lg border border-accent/30 bg-surface p-2.5">
                <input
                  ref={inputRef}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Título de la tarea..."
                  className="w-full text-sm bg-transparent outline-none placeholder:text-text-subtle"
                />
                {members.length > 0 && (
                  <div className="mt-2">
                    <AssigneePicker
                      members={members}
                      value={newAssigneeId}
                      onChange={setNewAssigneeId}
                      size="sm"
                    />
                  </div>
                )}
                <div className="flex gap-1.5 mt-2">
                  <button
                    onClick={handleAdd}
                    className="text-xs px-2.5 py-1 bg-accent text-accent-fg rounded font-medium"
                  >
                    Agregar
                  </button>
                  <button
                    onClick={() => { setNewTitle(""); setNewAssigneeId(null); setAdding(false); }}
                    className="text-xs px-2 py-1 text-text-muted hover:text-text"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Add task button */}
      <div className="p-2 border-t border-border flex-shrink-0">
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-text-subtle hover:text-text hover:bg-surface-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Agregar tarea</span>
        </button>
      </div>
    </div>
  );
}
