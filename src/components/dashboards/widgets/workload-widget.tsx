"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type WorkloadData = {
  userId: string;
  fullName: string;
  taskCount: number;
  estimatedHours: number;
};

type Props = {
  data: WorkloadData[];
};

const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
];

export default function WorkloadWidget({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-subtle text-sm">
        Sin datos de carga
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.taskCount - a.taskCount);

  const formatted = sorted.map((d) => ({
    ...d,
    name: d.fullName.split(" ")[0] ?? d.fullName,
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
          dataKey="name"
          width={80}
          tick={{ fontSize: 11 }}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            value,
            name === "taskCount" ? "Tareas" : "Horas",
          ]}
        />
        <Bar dataKey="taskCount" radius={[0, 4, 4, 0]} name="taskCount">
          {formatted.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
