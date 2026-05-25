"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Clock, Users } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type TopContributor = {
  userId: string;
  totalMinutes: number;
  entryCount: number;
};

type DailyEntry = {
  date: string;
  minutes: number;
};

type ReportData = {
  totalMinutes: number;
  topContributors: TopContributor[];
  dailyBreakdown: DailyEntry[];
};

type Props = {
  workspaceId: string;
  projectId?: string;
  from?: string;
  to?: string;
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-CL", { weekday: "short", day: "numeric" });
}

export default function TimeReportWidget({ workspaceId, projectId, from, to }: Props) {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    try {
      const url = new URL(`/api/workspaces/${workspaceId}/time-report`, window.location.origin);
      if (projectId) url.searchParams.set("projectId", projectId);
      if (from) url.searchParams.set("from", from);
      if (to) url.searchParams.set("to", to);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Error");
      const json = (await res.json()) as ReportData;
      setData(json);
    } catch {
      toast.error("Error al cargar reporte de tiempo");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, projectId, from, to]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-text-subtle text-sm">
        Cargando reporte...
      </div>
    );
  }

  if (!data) return null;

  const chartData = data.dailyBreakdown.map((d) => ({
    day: formatDay(d.date),
    horas: Math.round((d.minutes / 60) * 10) / 10,
  }));

  return (
    <div className="space-y-6">
      {/* Total */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-accent/10 border border-accent/20">
        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
          <Clock className="w-4 h-4 text-accent" />
        </div>
        <div>
          <p className="text-xs text-text-muted">Tiempo total</p>
          <p className="text-xl font-semibold text-text">
            {formatDuration(data.totalMinutes)}
          </p>
        </div>
      </div>

      {/* Bar chart */}
      {chartData.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text-subtle uppercase tracking-wider mb-3">
            Por día
          </p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={16}>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "var(--color-text-subtle, #94a3b8)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--color-text-subtle, #94a3b8)" }}
                  axisLine={false}
                  tickLine={false}
                  unit="h"
                />
                <Tooltip
                  formatter={(value: number) => [`${value}h`, "Horas"]}
                  contentStyle={{
                    background: "var(--color-surface, #1e2433)",
                    border: "1px solid var(--color-border, #2d3748)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="horas" fill="var(--color-accent, #f57522)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top contributors */}
      {data.topContributors.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-text-subtle" />
            <p className="text-xs font-medium text-text-subtle uppercase tracking-wider">
              Top contribuidores
            </p>
          </div>
          <div className="space-y-2">
            {data.topContributors.slice(0, 5).map((c, i) => (
              <div
                key={c.userId}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-2"
              >
                <span className="text-xs font-mono text-text-subtle w-4">
                  #{i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-muted font-mono truncate">
                    {c.userId.slice(0, 8)}...
                  </p>
                  <p className="text-xs text-text-subtle">
                    {c.entryCount} entrada{c.entryCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <span className="text-sm font-semibold text-text">
                  {formatDuration(c.totalMinutes)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.topContributors.length === 0 && (
        <div className="text-center py-6 text-text-subtle text-sm">
          No hay datos de tiempo registrado
        </div>
      )}
    </div>
  );
}
