"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";

type PriorityData = {
  priority: string;
  count: number;
};

type Props = {
  data: PriorityData[];
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
  no_priority: "#94a3b8",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  no_priority: "Sin prioridad",
};

const PRIORITY_ORDER = ["urgent", "high", "medium", "low", "no_priority"];

export default function TasksByPriorityWidget({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-subtle text-sm">
        Sin datos
      </div>
    );
  }

  const sorted = [...data].sort(
    (a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
  );

  const formatted = sorted.map((d) => ({
    ...d,
    label: PRIORITY_LABELS[d.priority] ?? d.priority,
    color: PRIORITY_COLORS[d.priority] ?? "#94a3b8",
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={formatted}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      >
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="label"
          width={90}
          tick={{ fontSize: 11 }}
        />
        <Tooltip
          formatter={(value: number) => [value, "Tareas"]}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {formatted.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
