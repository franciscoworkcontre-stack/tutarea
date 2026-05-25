"use client";

import {
  PieChart,
  Pie,
  Tooltip,
  Legend,
  Cell,
  ResponsiveContainer,
} from "recharts";

type StatusData = {
  statusName: string;
  count: number;
  color: string;
};

type Props = {
  data: StatusData[];
};

export default function TasksByStatusWidget({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-subtle text-sm">
        Sin datos
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="statusName"
          cx="50%"
          cy="50%"
          outerRadius="70%"
          label={({ statusName, percent }) =>
            `${statusName} ${((percent ?? 0) * 100).toFixed(0)}%`
          }
          labelLine={false}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => [value, "Tareas"]}
        />
        <Legend
          formatter={(value) => (
            <span className="text-xs text-text">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
