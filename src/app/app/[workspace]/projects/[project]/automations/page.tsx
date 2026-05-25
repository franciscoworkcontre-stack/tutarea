"use client";

import { useState, useEffect, useCallback } from "react";
import { Zap, X } from "lucide-react";
import AutomationList from "@/components/automations/automation-list";
import AutomationBuilder from "@/components/automations/automation-builder";
import AutomationRunHistory from "@/components/automations/automation-run-history";

type Automation = {
  id: string;
  name: string;
  description: string | null;
  triggerType: string;
  triggerConfigJsonb: Record<string, unknown>;
  conditionsJsonb: Array<{ field: string; operator: string; value: unknown }>;
  actionsJsonb: Array<{ type: string; config: Record<string, unknown> }>;
  isActive: boolean;
  runCount: number;
  lastRunAt: string | null;
  createdAt: string;
};

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
  params: Promise<{ workspace: string; project: string }>;
};

export default function AutomationsPage({ params }: Props) {
  const [projectId, setProjectId] = useState<string>("");
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [viewingRuns, setViewingRuns] = useState<{ automation: Automation; runs: AutomationRun[] } | null>(null);

  useEffect(() => {
    params.then(({ project }) => {
      setProjectId(project);
    });
  }, [params]);

  const fetchAutomations = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/automations`);
    if (res.ok) {
      const data = (await res.json()) as { automations: Automation[] };
      setAutomations(data.automations);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchAutomations();
  }, [fetchAutomations]);

  async function handleSave(data: {
    id?: string;
    name: string;
    description?: string;
    triggerType: string;
    triggerConfigJsonb: Record<string, unknown>;
    conditionsJsonb: Array<{ field: string; operator: string; value: unknown }>;
    actionsJsonb: Array<{ type: string; config: Record<string, unknown> }>;
  }) {
    if (data.id) {
      // Update
      await fetch(`/api/automations/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } else {
      // Create
      await fetch(`/api/projects/${projectId}/automations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }
    setShowBuilder(false);
    setEditingAutomation(null);
    await fetchAutomations();
  }

  async function handleViewRuns(automationId: string) {
    const res = await fetch(`/api/automations/${automationId}`);
    if (res.ok) {
      const data = (await res.json()) as { automation: Automation; runs: AutomationRun[] };
      setViewingRuns({ automation: data.automation, runs: data.runs });
    }
  }

  async function handleEdit(automationId: string) {
    const res = await fetch(`/api/automations/${automationId}`);
    if (res.ok) {
      const data = (await res.json()) as { automation: Automation; runs: AutomationRun[] };
      setEditingAutomation(data.automation);
      setShowBuilder(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <Zap className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-text">Automatizaciones</h1>
          <p className="text-sm text-text-muted">
            Ejecuta acciones automáticamente cuando ocurren eventos en el proyecto.
          </p>
        </div>
      </div>

      {/* Builder modal */}
      {(showBuilder || editingAutomation) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-surface rounded-2xl border border-border shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <AutomationBuilder
              projectId={projectId}
              initial={editingAutomation}
              onSave={handleSave}
              onCancel={() => {
                setShowBuilder(false);
                setEditingAutomation(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Run history modal */}
      {viewingRuns && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl bg-surface rounded-2xl border border-border shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-text">
                  Historial de ejecuciones
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  {viewingRuns.automation.name}
                </p>
              </div>
              <button
                onClick={() => setViewingRuns(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <AutomationRunHistory runs={viewingRuns.runs} />
          </div>
        </div>
      )}

      {/* Main list */}
      <AutomationList
        automations={automations}
        projectId={projectId}
        onNew={() => {
          setEditingAutomation(null);
          setShowBuilder(true);
        }}
        onEdit={handleEdit}
      />
    </div>
  );
}
