"use client";

import { X } from "lucide-react";
import {
  PieChart,
  Users,
  Flag,
  AlertCircle,
  CheckCircle2,
  BarChart2,
  Activity,
  Target,
  Zap,
  TrendingDown,
} from "lucide-react";

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

type WidgetDef = {
  type: WidgetType;
  title: string;
  description: string;
  icon: React.ElementType;
};

const WIDGET_DEFINITIONS: WidgetDef[] = [
  {
    type: "tasks_by_status",
    title: "Tareas por estado",
    description: "Distribución circular de tareas según su estado actual.",
    icon: PieChart,
  },
  {
    type: "tasks_by_assignee",
    title: "Tareas por asignado",
    description: "Cantidad de tareas asignadas a cada miembro del equipo.",
    icon: Users,
  },
  {
    type: "tasks_by_priority",
    title: "Tareas por prioridad",
    description: "Distribución de tareas según nivel de prioridad.",
    icon: Flag,
  },
  {
    type: "overdue_tasks",
    title: "Tareas vencidas",
    description: "Lista de las tareas con fecha límite ya pasada.",
    icon: AlertCircle,
  },
  {
    type: "recently_completed",
    title: "Completadas recientemente",
    description: "Últimas 10 tareas marcadas como completadas.",
    icon: CheckCircle2,
  },
  {
    type: "workload",
    title: "Carga de trabajo",
    description: "Tareas activas por persona para balancear el equipo.",
    icon: BarChart2,
  },
  {
    type: "burndown_chart",
    title: "Burndown chart",
    description: "Progreso de trabajo restante a lo largo del sprint.",
    icon: TrendingDown,
  },
  {
    type: "velocity_chart",
    title: "Velocidad del equipo",
    description: "Velocidad histórica del equipo por sprint.",
    icon: Activity,
  },
  {
    type: "sprint_progress",
    title: "Progreso del sprint",
    description: "Estado actual del sprint activo.",
    icon: Zap,
  },
  {
    type: "goal_progress",
    title: "Progreso de objetivos",
    description: "Avance hacia los OKRs del workspace.",
    icon: Target,
  },
];

type Props = {
  onAdd: (type: WidgetType, title: string) => void;
  onClose: () => void;
  loading?: boolean;
};

export default function AddWidgetModal({ onAdd, onClose, loading = false }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      <div className="relative bg-surface rounded-xl shadow-xl border border-border w-full max-w-2xl max-h-[80vh] flex flex-col z-10">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-text">Agregar widget</h2>
            <p className="text-sm text-text-subtle mt-0.5">
              Selecciona el tipo de widget para agregar al dashboard
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors text-text-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 grid grid-cols-2 gap-3">
          {WIDGET_DEFINITIONS.map(({ type, title, description, icon: Icon }) => (
            <button
              key={type}
              onClick={() => onAdd(type, title)}
              disabled={loading}
              className="flex items-start gap-3 p-3 rounded-xl border border-border hover:border-accent/50 hover:bg-accent/5 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/20 transition-colors">
                <Icon className="w-4.5 h-4.5 text-accent" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text">{title}</p>
                <p className="text-xs text-text-subtle mt-0.5 leading-relaxed">
                  {description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
