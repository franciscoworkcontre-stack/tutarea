"use client";

import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

type Assignee = {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
};

type OverdueTask = {
  id: string;
  title: string;
  dueDate: string | null;
  priority: string;
  assignee: Assignee | null;
};

type Props = {
  data: OverdueTask[];
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500/10 text-red-500",
  high: "bg-orange-500/10 text-orange-500",
  medium: "bg-yellow-500/10 text-yellow-600",
  low: "bg-green-500/10 text-green-600",
  no_priority: "bg-slate-100 text-slate-500",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  no_priority: "—",
};

export default function OverdueTasksWidget({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-subtle text-sm">
        No hay tareas vencidas
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-y-auto h-full">
      {data.map((task) => {
        const overdueText = task.dueDate
          ? formatDistanceToNow(new Date(task.dueDate), {
              addSuffix: false,
              locale: es,
            })
          : null;

        return (
          <li key={task.id} className="flex items-start gap-3 py-2 px-1">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-text">{task.title}</p>
              {overdueText && (
                <p className="text-xs text-red-500 mt-0.5">Vencida hace {overdueText}</p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${
                  PRIORITY_COLORS[task.priority] ?? "bg-slate-100 text-slate-500"
                }`}
              >
                {PRIORITY_LABELS[task.priority] ?? task.priority}
              </span>

              {task.assignee && (
                <div
                  className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-xs font-medium text-accent flex-shrink-0"
                  title={task.assignee.fullName ?? ""}
                >
                  {task.assignee.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={task.assignee.avatarUrl}
                      alt={task.assignee.fullName ?? ""}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    (task.assignee.fullName?.[0] ?? "?").toUpperCase()
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
