"use client";

import { useState } from "react";
import { Plus, Layers } from "lucide-react";
import PortfolioCard from "./portfolio-card";
import CreatePortfolioModal from "./create-portfolio-modal";

type PortfolioSummary = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  color: string;
  createdBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  projectCount: number;
};

type Props = {
  initialPortfolios: PortfolioSummary[];
  workspaceId: string;
  workspaceSlug: string;
};

// Convert summary to card shape — no project details here, just count
function toCardShape(p: PortfolioSummary) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    color: p.color,
    projectCount: p.projectCount,
    avgCompletion: 0, // No task data at list level
    projects: [],
  };
}

export default function PortfolioList({
  initialPortfolios,
  workspaceId,
  workspaceSlug,
}: Props) {
  const [portfolios, setPortfolios] = useState(initialPortfolios);
  const [createOpen, setCreateOpen] = useState(false);

  async function refreshPortfolios() {
    try {
      const res = await fetch(`/api/portfolios?workspaceId=${workspaceId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { portfolios: PortfolioSummary[] };
      setPortfolios(data.portfolios ?? []);
    } catch {
      // ignore
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Portfolios</h1>
          <p className="text-sm text-text-subtle mt-0.5">
            Agrupa proyectos y monitorea su progreso conjunto
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-accent text-accent-fg rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Portfolio</span>
        </button>
      </div>

      {/* Grid */}
      {portfolios.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
            <Layers className="w-6 h-6 text-text-muted" />
          </div>
          <h3 className="font-medium text-text mb-1">Sin portfolios</h3>
          <p className="text-sm text-text-subtle max-w-xs mb-5">
            Crea tu primer portfolio para agrupar proyectos y ver su progreso
            desde una sola vista.
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-accent text-accent-fg rounded-lg hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Crear portfolio</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {portfolios.map((p) => (
            <PortfolioCard
              key={p.id}
              portfolio={toCardShape(p)}
              workspaceSlug={workspaceSlug}
            />
          ))}
        </div>
      )}

      {createOpen && (
        <CreatePortfolioModal
          workspaceId={workspaceId}
          onClose={() => setCreateOpen(false)}
          onCreated={() => void refreshPortfolios()}
        />
      )}
    </div>
  );
}
