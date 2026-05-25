"use client";

import { useState } from "react";
import { Plus, Target } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import GoalCard from "./goal-card";
import GoalDetail from "./goal-detail";
import CreateGoalModal from "./create-goal-modal";
import type { InferSelectModel } from "drizzle-orm";
import type { goals, keyResults, profiles, projects, workspaceMembers } from "@/db/schema";

type Goal = InferSelectModel<typeof goals> & {
  keyResults: InferSelectModel<typeof keyResults>[];
};
type Profile = InferSelectModel<typeof profiles>;
type Project = InferSelectModel<typeof projects>;
type Member = InferSelectModel<typeof workspaceMembers> & {
  profile: Profile | null;
};

type Props = {
  workspaceId: string;
  initialGoals: Goal[];
  members: Member[];
  projects: Project[];
};

type StatusGroup = {
  key: "active" | "at_risk" | "achieved" | "draft" | "cancelled";
  label: string;
  color: string;
  dotColor: string;
};

const STATUS_GROUPS: StatusGroup[] = [
  { key: "active", label: "Activos", color: "text-accent", dotColor: "bg-accent" },
  { key: "at_risk", label: "En riesgo", color: "text-orange-500", dotColor: "bg-orange-500" },
  { key: "achieved", label: "Alcanzados", color: "text-green-500", dotColor: "bg-green-500" },
  { key: "draft", label: "Borrador", color: "text-text-muted", dotColor: "bg-border" },
  { key: "cancelled", label: "Cancelados", color: "text-red-500", dotColor: "bg-red-500" },
];

type StatusFilter = "all" | Goal["status"];

export default function GoalsList({
  workspaceId,
  initialGoals,
  members,
  projects,
}: Props) {
  const [allGoals, setAllGoals] = useState<Goal[]>(initialGoals);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");

  // Build a profile map for quick lookup
  const profileMap = members.reduce<Record<string, Profile>>((acc, m) => {
    if (m.profile) acc[m.userId] = m.profile;
    return acc;
  }, {});

  const filteredGoals = allGoals.filter((g) => {
    if (statusFilter !== "all" && g.status !== statusFilter) return false;
    if (projectFilter !== "all" && g.projectId !== projectFilter) return false;
    return true;
  });

  const handleGoalCreated = (newGoal: {
    id: string;
    title: string;
    status: string;
    progress: number;
  }) => {
    const fullGoal: Goal = {
      ...(newGoal as Goal),
      keyResults: [],
      workspaceId,
      projectId: null,
      description: null,
      ownerUserId: "",
      startDate: null,
      dueDate: null,
      createdBy: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setAllGoals((prev) => [fullGoal, ...prev]);
  };

  const handleGoalUpdated = (updatedGoal: Goal) => {
    setAllGoals((prev) =>
      prev.map((g) => (g.id === updatedGoal.id ? updatedGoal : g))
    );
    if (selectedGoal?.id === updatedGoal.id) {
      setSelectedGoal(updatedGoal);
    }
  };

  const handleGoalDeleted = (goalId: string) => {
    setAllGoals((prev) => prev.filter((g) => g.id !== goalId));
    setSelectedGoal(null);
  };

  const openGoal = (goal: Goal) => setSelectedGoal(goal);

  const hasActiveProjects = projects.length > 0;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0 gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filter */}
          <div className="flex items-center gap-1 bg-surface-2 rounded-lg p-0.5">
            <button
              onClick={() => setStatusFilter("all")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                statusFilter === "all"
                  ? "bg-surface text-text shadow-sm"
                  : "text-text-muted hover:text-text"
              )}
            >
              Todos
            </button>
            {STATUS_GROUPS.map((sg) => (
              <button
                key={sg.key}
                onClick={() => setStatusFilter(sg.key)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  statusFilter === sg.key
                    ? "bg-surface text-text shadow-sm"
                    : "text-text-muted hover:text-text"
                )}
              >
                {sg.label}
              </button>
            ))}
          </div>

          {/* Project filter */}
          {hasActiveProjects && (
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="text-xs bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-text outline-none focus:border-accent"
            >
              <option value="all">Todos los proyectos</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-accent-fg rounded-lg text-xs font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nuevo objetivo
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {filteredGoals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center mb-4">
              <Target className="w-6 h-6 text-text-subtle" />
            </div>
            <p className="text-sm font-medium text-text mb-1">
              {statusFilter !== "all" || projectFilter !== "all"
                ? "Sin objetivos con estos filtros"
                : "No hay objetivos aún"}
            </p>
            <p className="text-xs text-text-subtle mb-4">
              {statusFilter !== "all" || projectFilter !== "all"
                ? "Prueba cambiando los filtros"
                : "Crea tu primer OKR para empezar"}
            </p>
            {statusFilter === "all" && projectFilter === "all" && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent text-accent-fg rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Crear objetivo
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {STATUS_GROUPS.map((group) => {
              const groupGoals = filteredGoals.filter(
                (g) => g.status === group.key
              );
              if (groupGoals.length === 0) return null;

              return (
                <div key={group.key}>
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className={cn("w-2 h-2 rounded-full flex-shrink-0", group.dotColor)}
                    />
                    <h2 className={cn("text-xs font-semibold uppercase tracking-wider", group.color)}>
                      {group.label}
                    </h2>
                    <span className="text-xs text-text-subtle ml-1">
                      {groupGoals.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {groupGoals.map((goal) => (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        ownerProfile={
                          goal.ownerUserId ? profileMap[goal.ownerUserId] ?? null : null
                        }
                        onClick={() => openGoal(goal)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateGoalModal
            workspaceId={workspaceId}
            members={members}
            projects={projects}
            onClose={() => setShowCreateModal(false)}
            onCreated={handleGoalCreated}
          />
        )}
      </AnimatePresence>

      {/* Detail panel */}
      <AnimatePresence>
        {selectedGoal && (
          <GoalDetail
            goal={selectedGoal}
            members={members}
            projects={projects}
            profileMap={profileMap}
            onClose={() => setSelectedGoal(null)}
            onUpdated={handleGoalUpdated}
            onDeleted={handleGoalDeleted}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
