"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGrid, GanttChart, List, ChevronLeft, ChevronRight } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import type { InferSelectModel } from "drizzle-orm";
import type { tasks, taskStatuses, projects, profiles } from "@/db/schema";

type Task = InferSelectModel<typeof tasks>;
type Status = InferSelectModel<typeof taskStatuses>;
type Project = InferSelectModel<typeof projects>;
type Profile = InferSelectModel<typeof profiles>;
type Member = { userId: string; role: string; profile: Profile | null };

type Props = {
  project: Project;
  statuses: Status[];
  initialTasks: Task[];
  members: Member[];
  currentUserId: string;
  workspaceSlug: string;
};

const CELL_WIDTH = 40; // px per day
const ROW_HEIGHT = 40;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function GanttView({
  project,
  statuses,
  initialTasks,
  members,
  workspaceSlug,
}: Props) {
  const tasksWithDates = initialTasks.filter((t) => t.startDate || t.dueDate);
  const tasksWithoutDates = initialTasks.filter((t) => !t.startDate && !t.dueDate);

  const today = startOfDay(new Date());

  const { rangeStart, totalDays } = useMemo(() => {
    if (tasksWithDates.length === 0) {
      return { rangeStart: addDays(today, -7), totalDays: 60 };
    }
    const dates = tasksWithDates.flatMap((t) => {
      const d: Date[] = [];
      if (t.startDate) d.push(startOfDay(new Date(t.startDate)));
      if (t.dueDate) d.push(startOfDay(new Date(t.dueDate)));
      return d;
    });
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    const start = addDays(min, -3);
    const end = addDays(max, 7);
    return { rangeStart: start, totalDays: Math.max(daysBetween(start, end), 30) };
  }, [tasksWithDates, today]);

  // Build day columns
  const days = Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i));
  const todayOffset = daysBetween(rangeStart, today);

  const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s]));

  const getTaskBar = (task: Task) => {
    const start = task.startDate ? startOfDay(new Date(task.startDate)) : null;
    const end = task.dueDate ? startOfDay(new Date(task.dueDate)) : null;

    if (!start && !end) return null;

    const barStart = start ?? end!;
    const barEnd = end ?? start!;
    const left = daysBetween(rangeStart, barStart) * CELL_WIDTH;
    const width = Math.max((daysBetween(barStart, barEnd) + 1) * CELL_WIDTH, CELL_WIDTH);
    const status = task.statusId ? statusMap[task.statusId] : null;
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && status?.type !== "done" && status?.type !== "cancelled";

    return { left, width, color: isOverdue ? "#ef4444" : (status?.color ?? project.color) };
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: project.color }}
          >
            {project.key[0]}
          </div>
          <span className="font-semibold">{project.name}</span>
          <span className="text-xs text-text-subtle px-1.5 py-0.5 rounded bg-surface-2 border border-border font-mono">
            {project.key}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {[
            { href: "board", icon: LayoutGrid, label: "Kanban" },
            { href: "list", icon: List, label: "Lista" },
            { href: "gantt", icon: GanttChart, label: "Gantt" },
          ].map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={`/app/${workspaceSlug}/projects/${project.id}/${href}`}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors",
                href === "gantt"
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-text-muted hover:text-text hover:bg-surface-2"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="flex" style={{ minWidth: `${280 + totalDays * CELL_WIDTH}px` }}>
          {/* Left panel: task names */}
          <div className="w-72 flex-shrink-0 border-r border-border bg-surface sticky left-0 z-20">
            {/* Header row */}
            <div className="h-10 flex items-center px-4 border-b border-border bg-surface-2">
              <span className="text-xs font-medium text-text-muted">Tarea</span>
            </div>

            {tasksWithDates.map((task) => {
              const assignee = members.find((m) => m.userId === task.assigneeId);
              const status = task.statusId ? statusMap[task.statusId] : null;
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-2 px-4 border-b border-border/50 hover:bg-surface-2 transition-colors"
                  style={{ height: ROW_HEIGHT }}
                >
                  {status && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: status.color }} />}
                  <Link
                    href={`/app/${workspaceSlug}/projects/${project.id}/tasks/${task.id}`}
                    className="text-sm truncate hover:text-accent transition-colors flex-1 min-w-0"
                  >
                    {task.title}
                  </Link>
                  {assignee && (
                    <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-medium text-accent flex-shrink-0">
                      {getInitials(assignee.profile?.fullName ?? "?")}
                    </div>
                  )}
                </div>
              );
            })}

            {tasksWithoutDates.length > 0 && (
              <div className="px-4 py-2 border-b border-border/30">
                <span className="text-xs text-text-subtle">Sin fechas ({tasksWithoutDates.length})</span>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-x-auto">
            {/* Month / day header */}
            <div className="h-10 flex border-b border-border bg-surface-2 sticky top-0 z-10">
              {days.map((day, i) => {
                const isFirst = i === 0 || day.getDate() === 1;
                const isToday = daysBetween(rangeStart, day) === todayOffset;
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex-shrink-0 border-r border-border/30 flex flex-col items-center justify-center",
                      isToday && "bg-accent/10"
                    )}
                    style={{ width: CELL_WIDTH }}
                  >
                    {isFirst && (
                      <span className="text-[10px] text-text-subtle absolute -translate-x-1/2 left-0">
                        {MONTH_NAMES[day.getMonth()]}
                      </span>
                    )}
                    <span className={cn("text-[10px]", isToday ? "text-accent font-bold" : "text-text-subtle")}>
                      {day.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Today line + task bars */}
            <div className="relative">
              {/* Today marker */}
              {todayOffset >= 0 && todayOffset < totalDays && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-accent/50 z-10 pointer-events-none"
                  style={{ left: todayOffset * CELL_WIDTH + CELL_WIDTH / 2 }}
                />
              )}

              {/* Grid + bars */}
              {tasksWithDates.map((task) => {
                const bar = getTaskBar(task);
                return (
                  <div
                    key={task.id}
                    className="relative border-b border-border/30 hover:bg-surface/50"
                    style={{ height: ROW_HEIGHT, width: totalDays * CELL_WIDTH }}
                  >
                    {/* Grid lines */}
                    {days.map((_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 border-r border-border/10"
                        style={{ left: i * CELL_WIDTH }}
                      />
                    ))}

                    {bar && (
                      <Link
                        href={`/app/${workspaceSlug}/projects/${project.id}/tasks/${task.id}`}
                        className="absolute top-1/2 -translate-y-1/2 rounded-md flex items-center px-2 text-xs text-white font-medium truncate hover:opacity-90 transition-opacity"
                        style={{
                          left: bar.left,
                          width: bar.width,
                          height: ROW_HEIGHT - 12,
                          backgroundColor: bar.color,
                          minWidth: 8,
                        }}
                        title={task.title}
                      >
                        {bar.width > 60 ? task.title : ""}
                      </Link>
                    )}
                  </div>
                );
              })}

              {tasksWithoutDates.length > 0 && (
                <div
                  className="border-b border-border/20"
                  style={{ height: 32, width: totalDays * CELL_WIDTH }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
