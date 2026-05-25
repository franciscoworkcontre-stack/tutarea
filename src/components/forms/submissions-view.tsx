"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  X,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SubmissionStatus = "pending" | "approved" | "rejected";

type Submission = {
  id: string;
  formId: string;
  projectId: string;
  dataJsonb: Record<string, unknown>;
  submitterEmail: string | null;
  submitterName: string | null;
  convertedTaskId: string | null;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

type FormField = {
  id: string;
  type: string;
  label: string;
  required: boolean;
};

type Props = {
  formId: string;
  formFields: FormField[];
  workspaceSlug: string;
};

const STATUS_LABELS: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  pending: {
    label: "Pendiente",
    icon: Clock,
    className: "bg-yellow-100 text-yellow-700",
  },
  approved: {
    label: "Aprobado",
    icon: CheckCircle2,
    className: "bg-green-100 text-green-700",
  },
  rejected: {
    label: "Rechazado",
    icon: XCircle,
    className: "bg-red-100 text-red-700",
  },
};

export default function SubmissionsView({ formId, formFields }: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | "">("");
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/forms/${formId}/submissions${statusFilter ? `?status=${statusFilter}` : ""}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = (await response.json()) as { submissions: Submission[] };
        setSubmissions(data.submissions);
      }
    } finally {
      setLoading(false);
    }
  }, [formId, statusFilter]);

  useEffect(() => {
    void fetchSubmissions();
  }, [fetchSubmissions]);

  const handleUpdateStatus = useCallback(
    async (
      submissionId: string,
      status: "approved" | "rejected",
      convertToTask = false
    ) => {
      setActionLoading(true);
      try {
        const response = await fetch(
          `/api/forms/${formId}/submissions/${submissionId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status, convertToTask }),
          }
        );
        if (response.ok) {
          const data = (await response.json()) as { submission: Submission };
          setSubmissions((prev) =>
            prev.map((s) => (s.id === submissionId ? data.submission : s))
          );
          if (selectedSubmission?.id === submissionId) {
            setSelectedSubmission(data.submission);
          }
        }
      } finally {
        setActionLoading(false);
      }
    },
    [formId, selectedSubmission]
  );

  const mainFields = formFields.slice(0, 3);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filters */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as SubmissionStatus | "")}
              className="appearance-none pl-3 pr-8 py-1.5 text-sm bg-surface border border-border rounded-lg outline-none focus:border-accent text-text cursor-pointer"
            >
              <option value="">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="approved">Aprobados</option>
              <option value="rejected">Rechazados</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-subtle pointer-events-none" />
          </div>
          <span className="text-xs text-text-subtle ml-auto">
            {submissions.length} respuesta{submissions.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-text-subtle text-sm">
              Cargando…
            </div>
          ) : submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-text-subtle text-sm">
              <Clock className="w-8 h-8 mb-2 opacity-40" />
              Sin respuestas todavía
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-2 border-b border-border">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-text-subtle">
                    Fecha
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-subtle">
                    Remitente
                  </th>
                  {mainFields.map((f) => (
                    <th
                      key={f.id}
                      className="text-left px-4 py-3 text-xs font-semibold text-text-subtle hidden md:table-cell"
                    >
                      {f.label}
                    </th>
                  ))}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-subtle">
                    Estado
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {submissions.map((sub) => {
                  const status = STATUS_LABELS[sub.status] ?? STATUS_LABELS["pending"]!;
                  const StatusIcon = status.icon;
                  return (
                    <tr
                      key={sub.id}
                      onClick={() => setSelectedSubmission(sub)}
                      className={cn(
                        "cursor-pointer hover:bg-surface-2 transition-colors",
                        selectedSubmission?.id === sub.id && "bg-accent/5"
                      )}
                    >
                      <td className="px-6 py-3 text-text-muted whitespace-nowrap">
                        {format(new Date(sub.submittedAt), "d MMM HH:mm", { locale: es })}
                      </td>
                      <td className="px-4 py-3 text-text whitespace-nowrap">
                        {sub.submitterName ?? sub.submitterEmail ?? (
                          <span className="text-text-subtle italic">Anónimo</span>
                        )}
                      </td>
                      {mainFields.map((f) => (
                        <td
                          key={f.id}
                          className="px-4 py-3 text-text-muted truncate max-w-[200px] hidden md:table-cell"
                        >
                          {renderValue(sub.dataJsonb[f.id])}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                            status.className
                          )}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-text-subtle">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedSubmission && (
        <div className="w-80 flex-shrink-0 border-l border-border bg-surface overflow-y-auto flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="font-semibold text-text text-sm">Detalle de respuesta</h3>
            <button
              onClick={() => setSelectedSubmission(null)}
              className="text-text-subtle hover:text-text"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Meta */}
            <div className="space-y-2 text-sm">
              {selectedSubmission.submitterName && (
                <div>
                  <span className="text-text-subtle">Nombre: </span>
                  <span className="text-text">{selectedSubmission.submitterName}</span>
                </div>
              )}
              {selectedSubmission.submitterEmail && (
                <div>
                  <span className="text-text-subtle">Email: </span>
                  <span className="text-text">{selectedSubmission.submitterEmail}</span>
                </div>
              )}
              <div>
                <span className="text-text-subtle">Enviado: </span>
                <span className="text-text">
                  {format(
                    new Date(selectedSubmission.submittedAt),
                    "d MMM yyyy HH:mm",
                    { locale: es }
                  )}
                </span>
              </div>
              {selectedSubmission.convertedTaskId && (
                <div className="flex items-center gap-1.5 text-green-600 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Convertido a tarea
                </div>
              )}
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs font-semibold text-text-subtle uppercase tracking-wider">
                Respuestas
              </p>
              {formFields.map((field) => {
                const val = selectedSubmission.dataJsonb[field.id];
                return (
                  <div key={field.id}>
                    <p className="text-xs text-text-subtle mb-0.5">{field.label}</p>
                    <p className="text-sm text-text">
                      {renderValue(val) || (
                        <span className="italic text-text-subtle">Sin respuesta</span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          {selectedSubmission.status === "pending" && (
            <div className="border-t border-border p-4 space-y-2">
              <button
                onClick={() =>
                  void handleUpdateStatus(selectedSubmission.id, "approved", true)
                }
                disabled={actionLoading}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                Aprobar + convertir a tarea
              </button>
              <button
                onClick={() =>
                  void handleUpdateStatus(selectedSubmission.id, "approved", false)
                }
                disabled={actionLoading}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm border border-border text-text hover:bg-surface-2 disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Aprobar
              </button>
              <button
                onClick={() =>
                  void handleUpdateStatus(selectedSubmission.id, "rejected")
                }
                disabled={actionLoading}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm border border-border text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Rechazar
              </button>
            </div>
          )}

          {selectedSubmission.status !== "pending" && (
            <div className="border-t border-border p-4">
              {(() => {
                const status = STATUS_LABELS[selectedSubmission.status] ?? STATUS_LABELS["pending"]!;
                const StatusIcon = status.icon;
                return (
                  <div
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
                      status.className
                    )}
                  >
                    <StatusIcon className="w-4 h-4" />
                    <span className="font-medium">{status.label}</span>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function renderValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "boolean") return val ? "Sí" : "No";
  if (Array.isArray(val)) return val.join(", ");
  return String(val);
}
