"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { X, Loader2 } from "lucide-react";
import { spring } from "@/lib/utils";
import AssigneePicker from "@/components/shared/assignee-picker";
import type { InferSelectModel } from "drizzle-orm";
import type { workspaces, projects, profiles } from "@/db/schema";

type Workspace = InferSelectModel<typeof workspaces>;
type Project = InferSelectModel<typeof projects>;
type Profile = InferSelectModel<typeof profiles>;
type Member = { userId: string; role: string; profile: Profile | null };

type Props = {
  workspace: Workspace;
  projects: Project[];
  onClose: () => void;
};

export default function QuickAddTask({ workspace, projects, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [selectedProject, setSelectedProject] = useState(projects[0]?.id ?? "");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    fetch(`/api/workspaces/${workspace.id}/members`)
      .then((r) => r.json())
      .then((d: { members: Member[] }) => setMembers(d.members ?? []))
      .catch(() => {});
  }, [workspace.id]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim() || !selectedProject) return;

    setLoading(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          projectId: selectedProject,
          assigneeId: assigneeId ?? undefined,
        }),
      });
      if (!res.ok) throw new Error("Error al crear tarea");
      const body = (await res.json()) as { task: { key: string } };
      toast.success(`Tarea ${body.task.key} creada`);
      onClose();
    } catch {
      toast.error("Error al crear tarea");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed top-[25vh] left-1/2 -translate-x-1/2 w-full max-w-lg z-50"
        initial={{ opacity: 0, scale: 0.96, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -8 }}
        transition={spring}
      >
        <div className="bg-surface border border-border rounded-2xl shadow-3 overflow-hidden">
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-3 px-4 py-3">
              <input
                ref={inputRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nombre de la tarea..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-subtle font-medium"
              />
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-text-subtle hover:text-text hover:bg-surface-2 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="border-t border-border px-4 py-2.5 flex items-center gap-2 flex-wrap">
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="text-xs text-text-muted bg-surface-2 border border-border rounded-lg px-2 py-1.5 outline-none focus:border-accent"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.key}: {p.name}
                  </option>
                ))}
              </select>

              {members.length > 0 && (
                <AssigneePicker
                  members={members}
                  value={assigneeId}
                  onChange={setAssigneeId}
                  size="sm"
                />
              )}

              <div className="flex items-center gap-2 ml-auto">
                <motion.button
                  type="submit"
                  disabled={loading || !title.trim()}
                  className="px-3 py-1.5 bg-accent text-accent-fg rounded-lg text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  whileTap={{ scale: 0.97 }}
                >
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Crear"}
                </motion.button>
              </div>
            </div>
          </form>
        </div>
      </motion.div>
    </>
  );
}
