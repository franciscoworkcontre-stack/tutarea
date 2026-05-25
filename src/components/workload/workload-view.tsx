"use client";

import { useState, useCallback } from "react";
import { RefreshCw, Users, Calendar } from "lucide-react";
import WorkloadMemberCard from "./workload-member-card";
import type { WorkloadMember } from "@/app/api/projects/[projectId]/workload/route";

type DateRange = {
  from: string;
  to: string;
  label: string;
};

function getDateRangePresets(): DateRange[] {
  const now = new Date();
  const today = now.toISOString().split("T")[0] as string;

  // This week (Mon-Sun)
  const dayOfWeek = now.getDay();
  const daysToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  // This month
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Next 2 weeks
  const twoWeeksLater = new Date(now);
  twoWeeksLater.setDate(now.getDate() + 14);

  return [
    {
      label: "Esta semana",
      from: monday.toISOString().split("T")[0] as string,
      to: sunday.toISOString().split("T")[0] as string,
    },
    {
      label: "Este mes",
      from: firstOfMonth.toISOString().split("T")[0] as string,
      to: lastOfMonth.toISOString().split("T")[0] as string,
    },
    {
      label: "Próximas 2 semanas",
      from: today,
      to: twoWeeksLater.toISOString().split("T")[0] as string,
    },
  ];
}

interface WorkloadViewProps {
  projectId: string;
  initialMembers: WorkloadMember[];
}

export default function WorkloadView({ projectId, initialMembers }: WorkloadViewProps) {
  const presets = getDateRangePresets();
  const defaultPreset = presets[2] as DateRange;

  const [members, setMembers] = useState<WorkloadMember[]>(initialMembers);
  const [from, setFrom] = useState<string>(defaultPreset.from);
  const [to, setTo] = useState<string>(defaultPreset.to);
  const [activePreset, setActivePreset] = useState<string>(defaultPreset.label);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkload = useCallback(
    async (fromDate: string, toDate: string) => {
      setLoading(true);
      setError(null);
      try {
        const url = new URL(
          `/api/projects/${projectId}/workload`,
          window.location.origin
        );
        url.searchParams.set("from", fromDate);
        url.searchParams.set("to", toDate);
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error("Error al cargar la carga de trabajo");
        const data = (await res.json()) as { members: WorkloadMember[] };
        setMembers(data.members);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  function applyPreset(preset: DateRange) {
    setActivePreset(preset.label);
    setFrom(preset.from);
    setTo(preset.to);
    void fetchWorkload(preset.from, preset.to);
  }

  function handleFromChange(val: string) {
    setFrom(val);
    setActivePreset("");
  }

  function handleToChange(val: string) {
    setTo(val);
    setActivePreset("");
  }

  function handleRefresh() {
    void fetchWorkload(from, to);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-text-subtle" />
            <h1 className="text-lg font-semibold text-text">Carga de trabajo</h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Presets */}
            <div className="flex items-center gap-1 bg-surface-2 rounded-lg p-1">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    activePreset === preset.label
                      ? "bg-accent text-accent-fg shadow-sm"
                      : "text-text-subtle hover:text-text hover:bg-surface"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Date pickers */}
            <div className="flex items-center gap-1.5 text-xs text-text-subtle">
              <Calendar className="w-3.5 h-3.5" />
              <input
                type="date"
                value={from}
                onChange={(e) => handleFromChange(e.target.value)}
                className="bg-surface border border-border rounded-md px-2 py-1 text-xs text-text focus:outline-none focus:ring-1 focus:ring-accent/50"
              />
              <span>—</span>
              <input
                type="date"
                value={to}
                onChange={(e) => handleToChange(e.target.value)}
                className="bg-surface border border-border rounded-md px-2 py-1 text-xs text-text focus:outline-none focus:ring-1 focus:ring-accent/50"
              />
            </div>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:bg-surface-2 hover:text-text transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Actualizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {members.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center">
              <Users className="w-6 h-6 text-text-subtle" />
            </div>
            <div>
              <p className="text-sm font-medium text-text">Sin miembros asignados</p>
              <p className="text-xs text-text-subtle mt-1">
                Agrega miembros al proyecto para ver su carga de trabajo.
              </p>
            </div>
          </div>
        )}

        {members.length > 0 && (
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 transition-opacity ${
              loading ? "opacity-50 pointer-events-none" : "opacity-100"
            }`}
          >
            {members.map((member) => (
              <WorkloadMemberCard key={member.userId} member={member} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
