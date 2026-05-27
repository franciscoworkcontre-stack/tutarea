"use client";

import { useState, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  Share2, GitBranch, GitCommit,
  ZoomIn, ZoomOut, Maximize2,
  Wand2, Download, ChevronDown,
  Check, Loader2, Sparkles, FileText, Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMindmapStore } from '@/lib/mindmaps/mindmap-store';
import { applyDagreLayout, getLayoutDirection } from '@/lib/mindmaps/mindmap-layout';

type SaveStatus = 'saved' | 'saving' | 'unsaved';

type Props = {
  mindmapId: string;
  canEdit: boolean;
  saveStatus: SaveStatus;
  selectedNodeId: string | null;
  onAiAction: (action: 'expand' | 'summarize' | 'brainstorm' | 'convert-to-plan') => void;
  onExport: (format: 'png' | 'svg' | 'markdown' | 'opml') => void;
  onAddNode: (parentId: string | null) => void;
};

const THEMES = [
  { value: 'light', label: 'Light', color: '#ffffff', border: '#e2e8f0' },
  { value: 'dark', label: 'Dark', color: '#030712', border: '#374151' },
  { value: 'blueprint', label: 'Blueprint', color: '#1e3a5f', border: '#1d4ed8' },
  { value: 'sepia', label: 'Sepia', color: '#fdf6e3', border: '#c2a06a' },
] as const;

export default function MindmapToolbar({
  mindmapId: _mindmapId,
  canEdit,
  saveStatus,
  selectedNodeId,
  onAiAction,
  onExport,
  onAddNode,
}: Props) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const { nodes, edges, layoutMode, theme, setLayoutMode, setTheme, setNodes, setEdges } =
    useMindmapStore();
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const handleAutoLayout = () => {
    const dir = getLayoutDirection(layoutMode);
    const { nodes: ln, edges: le } = applyDagreLayout(nodes, edges, dir);
    setNodes(ln as typeof nodes);
    setEdges(le);
    setTimeout(() => fitView({ duration: 400, padding: 0.1 }), 50);
  };

  const SaveIndicator = () => {
    if (saveStatus === 'saving') {
      return (
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Guardando...</span>
        </div>
      );
    }
    if (saveStatus === 'saved') {
      return (
        <div className="flex items-center gap-1.5 text-xs text-text-subtle">
          <Check className="w-3 h-3 text-green-500" />
          <span>Guardado</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-500">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        <span>Sin guardar</span>
      </div>
    );
  };

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-background flex-shrink-0 flex-wrap z-10">
      {/* Layout mode */}
      <div className="flex items-center rounded-lg border border-border overflow-hidden">
        {(
          [
            { mode: 'radial', icon: Share2, label: 'Radial' },
            { mode: 'tree-h', icon: GitBranch, label: 'Tree H' },
            { mode: 'tree-v', icon: GitCommit, label: 'Tree V' },
          ] as const
        ).map(({ mode, icon: Icon, label }) => (
          <button
            key={mode}
            onClick={() => setLayoutMode(mode)}
            title={label}
            className={cn(
              'px-2.5 py-1.5 text-xs flex items-center gap-1 transition-colors',
              layoutMode === mode
                ? 'bg-accent/10 text-accent'
                : 'text-text-muted hover:text-text hover:bg-surface-2'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Theme */}
      <div className="flex items-center gap-1 ml-1">
        {THEMES.map((t) => (
          <button
            key={t.value}
            onClick={() => setTheme(t.value)}
            title={t.label}
            className={cn(
              'w-5 h-5 rounded-full border-2 transition-transform hover:scale-110',
              theme === t.value ? 'border-accent scale-110' : 'border-border'
            )}
            style={{ backgroundColor: t.color, borderColor: theme === t.value ? undefined : t.border }}
          />
        ))}
      </div>

      <div className="w-px h-4 bg-border mx-1" />

      {/* Zoom controls */}
      <button
        onClick={() => zoomIn({ duration: 200 })}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted hover:text-text transition-colors"
        title="Zoom in"
      >
        <ZoomIn className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => zoomOut({ duration: 200 })}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted hover:text-text transition-colors"
        title="Zoom out"
      >
        <ZoomOut className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => fitView({ duration: 400, padding: 0.1 })}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted hover:text-text transition-colors"
        title="Ajustar vista (Cmd+0)"
      >
        <Maximize2 className="w-3.5 h-3.5" />
      </button>

      <div className="w-px h-4 bg-border mx-1" />

      {/* Auto layout */}
      {canEdit && (
        <button
          onClick={handleAutoLayout}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
          title="Auto Layout (dagre)"
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Auto Layout</span>
        </button>
      )}

      {/* Add Node */}
      {canEdit && (
        <button
          onClick={() => onAddNode(selectedNodeId)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium bg-accent text-accent-fg hover:bg-accent/90 transition-colors"
          title={selectedNodeId ? 'Agregar nodo hijo (Tab)' : 'Agregar nodo raíz'}
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">+ Nodo</span>
        </button>
      )}

      <div className="w-px h-4 bg-border mx-1" />

      {/* Export */}
      <div className="relative" ref={exportRef}>
        <button
          onClick={() => setExportOpen((o) => !o)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export</span>
          <ChevronDown className="w-3 h-3" />
        </button>
        {exportOpen && (
          <div className="absolute top-full left-0 mt-1 bg-background border border-border rounded-lg shadow-xl py-1 min-w-[140px] z-20">
            {(
              [
                { format: 'png', label: 'PNG', icon: FileText },
                { format: 'svg', label: 'SVG', icon: FileText },
                { format: 'markdown', label: 'Markdown', icon: FileText },
                { format: 'opml', label: 'OPML', icon: FileText },
              ] as const
            ).map(({ format, label, icon: Icon }) => (
              <button
                key={format}
                onClick={() => {
                  onExport(format);
                  setExportOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Save status */}
      <div className="ml-auto">
        <SaveIndicator />
      </div>

      {/* AI Actions */}
      {canEdit && (
        <>
          <div className="w-px h-4 bg-border mx-1" />
          <div className="flex items-center gap-1">
            <button
              onClick={() => onAiAction('expand')}
              disabled={!selectedNodeId}
              className={cn(
                'flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors',
                selectedNodeId
                  ? 'text-accent hover:bg-accent/10'
                  : 'text-text-subtle cursor-not-allowed opacity-40'
              )}
              title="Expandir nodo con IA"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Expand</span>
            </button>
            <button
              onClick={() => onAiAction('summarize')}
              disabled={!selectedNodeId}
              className={cn(
                'flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors',
                selectedNodeId
                  ? 'text-accent hover:bg-accent/10'
                  : 'text-text-subtle cursor-not-allowed opacity-40'
              )}
              title="Resumir rama"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Summarize</span>
            </button>
            <button
              onClick={() => onAiAction('brainstorm')}
              className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium text-accent hover:bg-accent/10 transition-colors"
              title="Brainstorm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Brainstorm</span>
            </button>
            <button
              onClick={() => onAiAction('convert-to-plan')}
              className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium text-accent hover:bg-accent/10 transition-colors"
              title="Convertir a plan"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">To Plan</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
