"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, RefreshCw, AlertCircle } from "lucide-react";
import TasksByStatusWidget from "./widgets/tasks-by-status-widget";
import TasksByPriorityWidget from "./widgets/tasks-by-priority-widget";
import OverdueTasksWidget from "./widgets/overdue-tasks-widget";
import RecentlyCompletedWidget from "./widgets/recently-completed-widget";
import WorkloadWidget from "./widgets/workload-widget";

type WidgetType =
  | "tasks_by_status"
  | "tasks_by_assignee"
  | "tasks_by_priority"
  | "burndown_chart"
  | "velocity_chart"
  | "overdue_tasks"
  | "recently_completed"
  | "workload"
  | "sprint_progress"
  | "goal_progress";

type Widget = {
  id: string;
  dashboardId: string;
  type: WidgetType;
  title: string;
  configJsonb: Record<string, unknown>;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
};

type Props = {
  widget: Widget;
  projectId?: string;
  editMode: boolean;
  onDelete: (widgetId: string) => void;
};

// Widget types that need data from the API
const DATA_WIDGETS: WidgetType[] = [
  "tasks_by_status",
  "tasks_by_assignee",
  "tasks_by_priority",
  "overdue_tasks",
  "recently_completed",
  "workload",
];

export default function WidgetRenderer({ widget, projectId, editMode, onDelete }: Props) {
  const [data, setData] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!DATA_WIDGETS.includes(widget.type)) return;

    setLoading(true);
    setError(null);
    try {
      const url = new URL(
        `/api/dashboards/${widget.dashboardId}/data`,
        window.location.origin
      );
      url.searchParams.set("widgetType", widget.type);
      if (projectId) url.searchParams.set("projectId", projectId);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Error al cargar datos");
      const json = (await res.json()) as { data: unknown[] };
      setData(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [widget.dashboardId, widget.type, projectId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full gap-2 text-text-subtle text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Cargando...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-red-500 text-sm">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button
            onClick={() => void fetchData()}
            className="text-xs underline text-text-subtle hover:text-text"
          >
            Reintentar
          </button>
        </div>
      );
    }

    switch (widget.type) {
      case "tasks_by_status":
        return (
          <TasksByStatusWidget
            data={data as { statusName: string; count: number; color: string }[]}
          />
        );
      case "tasks_by_priority":
        return (
          <TasksByPriorityWidget
            data={data as { priority: string; count: number }[]}
          />
        );
      case "overdue_tasks":
        return (
          <OverdueTasksWidget
            data={
              data as {
                id: string;
                title: string;
                dueDate: string | null;
                priority: string;
                assignee: {
                  id: string;
                  fullName: string | null;
                  avatarUrl: string | null;
                } | null;
              }[]
            }
          />
        );
      case "recently_completed":
        return (
          <RecentlyCompletedWidget
            data={
              data as {
                id: string;
                title: string;
                completedAt: string | null;
                assignee: {
                  id: string;
                  fullName: string | null;
                  avatarUrl: string | null;
                } | null;
              }[]
            }
          />
        );
      case "workload":
        return (
          <WorkloadWidget
            data={
              data as {
                userId: string;
                fullName: string;
                taskCount: number;
                estimatedHours: number;
              }[]
            }
          />
        );
      default:
        return (
          <div className="flex items-center justify-center h-full text-text-subtle text-sm">
            Widget en construccion
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
        <h3 className="text-sm font-medium text-text truncate">{widget.title}</h3>
        <div className="flex items-center gap-1">
          {!loading && !error && DATA_WIDGETS.includes(widget.type) && (
            <button
              onClick={() => void fetchData()}
              className="p-1 rounded hover:bg-surface-2 transition-colors text-text-muted"
              title="Actualizar"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {editMode && (
            <button
              onClick={() => onDelete(widget.id)}
              className="p-1 rounded hover:bg-red-500/10 transition-colors text-text-muted hover:text-red-500"
              title="Eliminar widget"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 p-2 min-h-0">{renderContent()}</div>
    </div>
  );
}
