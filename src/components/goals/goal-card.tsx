"use client";

import { cn, formatDate } from "@/lib/utils";
import type { InferSelectModel } from "drizzle-orm";
import type { goals, keyResults, profiles } from "@/db/schema";

type Goal = InferSelectModel<typeof goals> & {
  keyResults: InferSelectModel<typeof keyResults>[];
};
type Profile = InferSelectModel<typeof profiles>;

type Props = {
  goal: Goal;
  ownerProfile: Profile | null;
  onClick: () => void;
};

const STATUS_CONFIG = {
  draft: {
    label: "Borrador",
    bg: "bg-surface-2",
    text: "text-text-subtle",
    border: "border-border",
  },
  active: {
    label: "Activo",
    bg: "bg-accent/10",
    text: "text-accent",
    border: "border-accent/30",
  },
  at_risk: {
    label: "En riesgo",
    bg: "bg-orange-500/10",
    text: "text-orange-500",
    border: "border-orange-500/30",
  },
  achieved: {
    label: "Alcanzado",
    bg: "bg-green-500/10",
    text: "text-green-500",
    border: "border-green-500/30",
  },
  cancelled: {
    label: "Cancelado",
    bg: "bg-red-500/10",
    text: "text-red-500",
    border: "border-red-500/30",
  },
} as const;

function ProgressDonut({ progress }: { progress: number }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  const color =
    progress >= 100
      ? "#22c55e"
      : progress >= 70
      ? "#3b82f6"
      : progress >= 40
      ? "#f97316"
      : "#94a3b8";

  return (
    <div className="relative w-10 h-10 flex-shrink-0">
      <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-border"
        />
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-text">
        {progress}%
      </span>
    </div>
  );
}

function isOverdue(date: Date | string | null): boolean {
  if (!date) return false;
  return new Date(date) < new Date();
}

export default function GoalCard({ goal, ownerProfile, onClick }: Props) {
  const statusCfg = STATUS_CONFIG[goal.status];
  const overdue = isOverdue(goal.dueDate);

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 bg-surface border border-border rounded-xl hover:border-accent/40 hover:bg-surface-2/40 transition-all group"
    >
      <div className="flex items-start gap-3">
        <ProgressDonut progress={goal.progress} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="text-sm font-medium text-text truncate leading-tight">
              {goal.title}
            </h3>
            <span
              className={cn(
                "flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border",
                statusCfg.bg,
                statusCfg.text,
                statusCfg.border
              )}
            >
              {statusCfg.label}
            </span>
          </div>

          {goal.description && (
            <p className="text-xs text-text-muted line-clamp-2 mb-2">
              {goal.description}
            </p>
          )}

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${goal.progress}%`,
                backgroundColor:
                  goal.progress >= 100
                    ? "#22c55e"
                    : goal.progress >= 70
                    ? "#3b82f6"
                    : goal.progress >= 40
                    ? "#f97316"
                    : "#94a3b8",
              }}
            />
          </div>

          {/* KR mini list */}
          {goal.keyResults.length > 0 && (
            <div className="space-y-1 mb-2">
              {goal.keyResults.slice(0, 3).map((kr) => {
                const krProgress =
                  kr.type === "boolean"
                    ? kr.currentValue >= 1
                      ? 100
                      : 0
                    : kr.targetValue === kr.startValue
                    ? 0
                    : Math.round(
                        Math.min(
                          Math.max(
                            ((kr.currentValue - kr.startValue) /
                              (kr.targetValue - kr.startValue)) *
                              100,
                            0
                          ),
                          100
                        )
                      );

                return (
                  <div key={kr.id} className="flex items-center gap-2">
                    <span className="text-[10px] text-text-subtle truncate flex-1">
                      {kr.title}
                    </span>
                    <div className="w-12 h-1 bg-surface-2 rounded-full overflow-hidden flex-shrink-0">
                      <div
                        className="h-full bg-accent/60 rounded-full"
                        style={{ width: `${krProgress}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-text-subtle w-6 text-right flex-shrink-0">
                      {krProgress}%
                    </span>
                  </div>
                );
              })}
              {goal.keyResults.length > 3 && (
                <span className="text-[10px] text-text-subtle">
                  +{goal.keyResults.length - 3} más
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {ownerProfile && (
                <div className="flex items-center gap-1">
                  {ownerProfile.avatarUrl ? (
                    <img
                      src={ownerProfile.avatarUrl}
                      alt={ownerProfile.fullName ?? ""}
                      className="w-4 h-4 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-accent/20 flex items-center justify-center">
                      <span className="text-[8px] font-bold text-accent">
                        {(ownerProfile.fullName ?? "?")[0]?.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="text-[10px] text-text-subtle truncate max-w-[80px]">
                    {ownerProfile.fullName}
                  </span>
                </div>
              )}
              <span className="text-[10px] text-text-subtle">
                {goal.keyResults.length} KR
                {goal.keyResults.length !== 1 ? "s" : ""}
              </span>
            </div>

            {goal.dueDate && (
              <span
                className={cn(
                  "text-[10px] flex-shrink-0",
                  overdue ? "text-red-500" : "text-text-subtle"
                )}
              >
                {overdue ? "Vencido " : ""}
                {formatDate(goal.dueDate)}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
