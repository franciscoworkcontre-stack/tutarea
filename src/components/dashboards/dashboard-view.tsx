"use client";

import { useState, useCallback } from "react";
import { Plus, Edit3, Check, ChevronDown, LayoutDashboard } from "lucide-react";
import type { InferSelectModel } from "drizzle-orm";
import type { workspaces, dashboards, dashboardWidgets } from "@/db/schema";
import WidgetRenderer from "./widget-renderer";
import AddWidgetModal from "./add-widget-modal";

type Workspace = InferSelectModel<typeof workspaces>;
type Dashboard = InferSelectModel<typeof dashboards>;
type Widget = InferSelectModel<typeof dashboardWidgets>;

type WidgetType = Widget["type"];

type Props = {
  workspace: Workspace;
  dashboards: Dashboard[];
  initialDashboard: Dashboard;
  initialWidgets: Widget[];
};

export default function DashboardView({
  workspace,
  dashboards,
  initialDashboard,
  initialWidgets,
}: Props) {
  const [activeDashboard, setActiveDashboard] = useState<Dashboard>(initialDashboard);
  const [widgets, setWidgets] = useState<Widget[]>(initialWidgets);
  const [editMode, setEditMode] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showDashboardMenu, setShowDashboardMenu] = useState(false);
  const [addingWidget, setAddingWidget] = useState(false);

  const handleSelectDashboard = useCallback(
    async (dashboard: Dashboard) => {
      setShowDashboardMenu(false);
      if (dashboard.id === activeDashboard.id) return;

      setActiveDashboard(dashboard);
      try {
        const res = await fetch(`/api/dashboards/${dashboard.id}`);
        if (res.ok) {
          const data = (await res.json()) as { widgets: Widget[] };
          setWidgets(data.widgets ?? []);
        }
      } catch {
        // keep current widgets on error
      }
    },
    [activeDashboard.id]
  );

  const handleAddWidget = useCallback(
    async (type: WidgetType, title: string) => {
      setAddingWidget(true);
      try {
        const res = await fetch(`/api/dashboards/${activeDashboard.id}/widgets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, title, width: 4, height: 3 }),
        });
        if (res.ok) {
          const data = (await res.json()) as { widget: Widget };
          setWidgets((prev) => [...prev, data.widget]);
        }
      } finally {
        setAddingWidget(false);
        setShowAddWidget(false);
      }
    },
    [activeDashboard.id]
  );

  const handleDeleteWidget = useCallback(
    async (widgetId: string) => {
      try {
        await fetch(
          `/api/dashboards/${activeDashboard.id}/widgets/${widgetId}`,
          { method: "DELETE" }
        );
        setWidgets((prev) => prev.filter((w) => w.id !== widgetId));
      } catch {
        // ignore
      }
    },
    [activeDashboard.id]
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="w-5 h-5 text-accent" />
          <div className="relative">
            <button
              onClick={() => setShowDashboardMenu((v) => !v)}
              className="flex items-center gap-1.5 text-lg font-semibold text-text hover:text-text/80 transition-colors"
            >
              {activeDashboard.name}
              {dashboards.length > 1 && (
                <ChevronDown className="w-4 h-4 text-text-muted" />
              )}
            </button>

            {showDashboardMenu && dashboards.length > 1 && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowDashboardMenu(false)}
                />
                <div className="absolute top-full left-0 mt-1 w-52 bg-surface rounded-lg border border-border shadow-lg z-20 py-1">
                  {dashboards.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => void handleSelectDashboard(d)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-surface-2 transition-colors text-text"
                    >
                      <span className="truncate">{d.name}</span>
                      {d.id === activeDashboard.id && (
                        <Check className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditMode((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              editMode
                ? "bg-accent text-accent-fg"
                : "border border-border text-text-muted hover:bg-surface-2"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            {editMode ? "Listo" : "Editar"}
          </button>

          <button
            onClick={() => setShowAddWidget(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-accent text-accent-fg hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar widget
          </button>
        </div>
      </div>

      {/* Widget grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
              <LayoutDashboard className="w-8 h-8 text-accent/60" />
            </div>
            <div>
              <p className="text-base font-medium text-text">Sin widgets</p>
              <p className="text-sm text-text-subtle mt-1">
                Agrega tu primer widget para comenzar a visualizar datos
              </p>
            </div>
            <button
              onClick={() => setShowAddWidget(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-accent-fg hover:bg-accent/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agregar widget
            </button>
          </div>
        ) : (
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: "repeat(12, 1fr)",
              gridAutoRows: "120px",
            }}
          >
            {widgets.map((widget) => (
              <div
                key={widget.id}
                style={{
                  gridColumn: `span ${Math.min(widget.width * 2, 12)}`,
                  gridRow: `span ${widget.height}`,
                }}
                className={editMode ? "ring-2 ring-accent/30 rounded-xl" : ""}
              >
                <WidgetRenderer
                  widget={widget}
                  projectId={activeDashboard.projectId ?? undefined}
                  editMode={editMode}
                  onDelete={handleDeleteWidget}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add widget modal */}
      {showAddWidget && (
        <AddWidgetModal
          onAdd={handleAddWidget}
          onClose={() => setShowAddWidget(false)}
          loading={addingWidget}
        />
      )}
    </div>
  );
}
