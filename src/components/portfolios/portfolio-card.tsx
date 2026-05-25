"use client";

import { useRouter } from "next/navigation";

type PortfolioCardProject = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  completionPercent: number;
};

type PortfolioCardData = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  projectCount: number;
  avgCompletion: number;
  projects: PortfolioCardProject[];
};

type Props = {
  portfolio: PortfolioCardData;
  workspaceSlug: string;
};

function ProjectAvatar({ project }: { project: PortfolioCardProject }) {
  return (
    <div
      className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 border border-border/50"
      style={{ backgroundColor: project.color }}
      title={project.name}
    >
      {project.icon ? (
        <span className="text-white text-xs">{project.icon}</span>
      ) : (
        <span className="text-white text-xs font-bold">
          {project.name[0]?.toUpperCase()}
        </span>
      )}
    </div>
  );
}

export default function PortfolioCard({ portfolio, workspaceSlug }: Props) {
  const router = useRouter();

  function handleClick() {
    router.push(`/app/${workspaceSlug}/portfolios/${portfolio.id}`);
  }

  return (
    <div
      onClick={handleClick}
      className="bg-surface border border-border rounded-xl overflow-hidden hover:border-accent/40 hover:shadow-md transition-all cursor-pointer group"
    >
      {/* Color bar at top */}
      <div className="h-1.5" style={{ backgroundColor: portfolio.color }} />

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-text truncate group-hover:text-accent transition-colors">
              {portfolio.name}
            </h3>
            {portfolio.description && (
              <p className="text-xs text-text-subtle mt-0.5 line-clamp-2">
                {portfolio.description}
              </p>
            )}
          </div>
          <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-2 text-text-muted">
            {portfolio.projectCount} {portfolio.projectCount === 1 ? "proyecto" : "proyectos"}
          </span>
        </div>

        {/* Project avatars */}
        {portfolio.projects.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {portfolio.projects.slice(0, 6).map((p) => (
              <ProjectAvatar key={p.id} project={p} />
            ))}
            {portfolio.projects.length > 6 && (
              <span className="text-xs text-text-subtle ml-1">
                +{portfolio.projects.length - 6}
              </span>
            )}
          </div>
        )}

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-subtle">Progreso general</span>
            <span className="text-xs font-medium text-text-muted">
              {portfolio.avgCompletion}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${portfolio.avgCompletion}%`,
                backgroundColor: portfolio.color,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
