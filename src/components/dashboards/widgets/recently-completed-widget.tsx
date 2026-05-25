"use client";

import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2 } from "lucide-react";

type Assignee = {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
};

type CompletedTask = {
  id: string;
  title: string;
  completedAt: string | null;
  assignee: Assignee | null;
};

type Props = {
  data: CompletedTask[];
};

export default function RecentlyCompletedWidget({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-subtle text-sm">
        Sin tareas completadas
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-y-auto h-full">
      {data.map((task) => {
        const timeAgo = task.completedAt
          ? formatDistanceToNow(new Date(task.completedAt), {
              addSuffix: true,
              locale: es,
            })
          : null;

        return (
          <li key={task.id} className="flex items-center gap-3 py-2 px-1">
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-text">{task.title}</p>
              {timeAgo && (
                <p className="text-xs text-text-subtle mt-0.5">{timeAgo}</p>
              )}
            </div>

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
          </li>
        );
      })}
    </ul>
  );
}
