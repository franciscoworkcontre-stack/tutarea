"use client";

import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type AutomationRun = {
  id: string;
  automationId: string;
  triggeredBy: string | null;
  triggerPayloadJsonb: Record<string, unknown> | null;
  status: string;
  errorMessage: string | null;
  actionsExecuted: number;
  runAt: string;
};

type Props = {
  runs: AutomationRun[];
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AutomationRunHistory({ runs }: Props) {
  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <Clock className="w-8 h-8 text-text-subtle mb-3" />
        <p className="text-sm text-text-muted">Sin ejecuciones aún</p>
        <p className="text-xs text-text-subtle mt-1">
          El historial aparecerá aquí cuando la automatización se ejecute.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-text-subtle uppercase tracking-wider">
            <th className="text-left py-2 pr-4 font-medium">Fecha</th>
            <th className="text-left py-2 pr-4 font-medium">Estado</th>
            <th className="text-left py-2 pr-4 font-medium">Acciones</th>
            <th className="text-left py-2 pr-4 font-medium">Disparado por</th>
            <th className="text-left py-2 font-medium">Error</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {runs.map((run) => (
            <tr key={run.id} className="hover:bg-surface-2 transition-colors">
              <td className="py-2.5 pr-4 text-text-muted whitespace-nowrap">
                {formatDate(run.runAt)}
              </td>
              <td className="py-2.5 pr-4">
                <div className="flex items-center gap-1.5">
                  {run.status === "success" ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                      <span className="text-green-700 text-xs font-medium">Exitoso</span>
                    </>
                  ) : run.status === "skipped" ? (
                    <>
                      <Clock className="w-3.5 h-3.5 text-yellow-500" />
                      <span className="text-yellow-600 text-xs font-medium">Omitido</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 text-red-600" />
                      <span className="text-red-700 text-xs font-medium">Fallido</span>
                    </>
                  )}
                </div>
              </td>
              <td className="py-2.5 pr-4">
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-medium",
                    run.actionsExecuted > 0
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-500"
                  )}
                >
                  {run.actionsExecuted} acción{run.actionsExecuted !== 1 ? "es" : ""}
                </span>
              </td>
              <td className="py-2.5 pr-4 text-text-muted font-mono text-xs">
                {run.triggeredBy ? run.triggeredBy.slice(0, 8) + "…" : "Sistema"}
              </td>
              <td className="py-2.5 text-xs text-red-600 max-w-xs truncate">
                {run.errorMessage ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
