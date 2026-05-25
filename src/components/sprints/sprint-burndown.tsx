"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

type BurndownPoint = {
  date: string;
  remaining: number;
  ideal: number;
};

type BurndownData = {
  burndown: BurndownPoint[];
  total: number;
  donePoints: number;
  totalDays: number;
  elapsedDays: number;
  isOnTrack: boolean;
};

type Props = {
  sprintId: string;
};

export default function SprintBurndown({ sprintId }: Props) {
  const [data, setData] = useState<BurndownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/sprints/${sprintId}/burndown`);
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          setError(err.error ?? "Error loading burndown");
          return;
        }
        const json = (await res.json()) as BurndownData;
        setData(json);
      } catch {
        setError("Error de red");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [sprintId]);

  if (loading) {
    return (
      <div className="h-48 flex items-center justify-center text-text-muted text-sm">
        Cargando burndown...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-48 flex items-center justify-center text-text-muted text-sm">
        {error}
      </div>
    );
  }

  if (!data) return null;

  // Filter out future days (remaining === -1) for the "Real" line
  const chartData = data.burndown.map((d) => ({
    ...d,
    remainingDisplay: d.remaining >= 0 ? d.remaining : null,
    label: d.date.slice(5), // MM-DD
  }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Burndown Chart</h3>
        <div
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full",
            data.isOnTrack
              ? "bg-green-500/10 text-green-500"
              : "bg-red-500/10 text-red-500"
          )}
        >
          {data.isOnTrack ? (
            <>
              <TrendingDown className="w-3 h-3" />
              On track
            </>
          ) : (
            <>
              <TrendingUp className="w-3 h-3" />
              Behind
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-text-muted">
        <span>Total: {data.total} pts</span>
        <span>Completado: {data.donePoints} pts</span>
        <span>
          Día {data.elapsedDays}/{data.totalDays}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" opacity={0.5} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "var(--color-text-muted, #6b7280)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--color-text-muted, #6b7280)" }}
            tickLine={false}
            axisLine={false}
            domain={[0, data.total]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface, #fff)",
              border: "1px solid var(--color-border, #e5e7eb)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "var(--color-text, #111)",
            }}
            formatter={(value, name) => {
              const numVal = typeof value === "number" ? value : null;
              if (numVal === null || numVal < 0) return ["-", String(name)];
              const label = String(name) === "remainingDisplay" ? "Real" : "Ideal";
              return [`${numVal} pts`, label];
            }}
            labelFormatter={(label: unknown) => `Día: ${String(label)}`}
          />
          <Legend
            formatter={(value: string) =>
              value === "remainingDisplay" ? "Real" : "Ideal"
            }
            iconType="line"
            wrapperStyle={{ fontSize: "12px" }}
          />
          <Line
            type="monotone"
            dataKey="ideal"
            stroke="#94a3b8"
            strokeDasharray="5 5"
            dot={false}
            strokeWidth={1.5}
            name="ideal"
          />
          <Line
            type="monotone"
            dataKey="remainingDisplay"
            stroke="var(--color-accent, #f57522)"
            dot={{ r: 3, fill: "var(--color-accent, #f57522)" }}
            strokeWidth={2}
            connectNulls={false}
            name="remainingDisplay"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
