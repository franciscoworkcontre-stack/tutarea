"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Loader2, Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AiPanelMode = 'expand' | 'summarize' | 'brainstorm' | 'convert-to-plan' | null;

export type AiExpandResult = {
  suggestions: { id: string; label: string; accepted: boolean }[];
};

export type AiSummarizeResult = {
  text: string;
};

export type AiConvertResult = {
  tasks: { id: string; title: string; description?: string; children?: { id: string; title: string }[] }[];
};

type Props = {
  open: boolean;
  mode: AiPanelMode;
  isLoading: boolean;
  expandResult: AiExpandResult | null;
  summarizeResult: AiSummarizeResult | null;
  convertResult: AiConvertResult | null;
  onClose: () => void;
  onAcceptExpand: (labels: string[]) => void;
  onAcceptSummarize: (text: string) => void;
  onMaterializePlan: (tasks: AiConvertResult['tasks']) => void;
};

export default function MindmapAiPanel({
  open,
  mode,
  isLoading,
  expandResult,
  summarizeResult,
  convertResult,
  onClose,
  onAcceptExpand,
  onAcceptSummarize,
  onMaterializePlan,
}: Props) {
  const [expandSelections, setExpandSelections] = useState<Record<string, boolean>>({});
  const [summaryEdit, setSummaryEdit] = useState('');

  const MODE_LABELS: Record<NonNullable<AiPanelMode>, string> = {
    expand: 'Expandir nodo',
    summarize: 'Resumir rama',
    brainstorm: 'Brainstorm',
    'convert-to-plan': 'Convertir a plan',
  };

  const handleToggleExpand = (id: string) => {
    setExpandSelections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAcceptExpand = () => {
    if (!expandResult) return;
    const accepted = expandResult.suggestions
      .filter((s) => expandSelections[s.id] !== false)
      .map((s) => s.label);
    onAcceptExpand(accepted);
    setExpandSelections({});
  };

  const handleAcceptSummarize = () => {
    onAcceptSummarize(summaryEdit || summarizeResult?.text || '');
  };

  const initSummaryEdit = () => {
    if (summarizeResult && !summaryEdit) {
      setSummaryEdit(summarizeResult.text);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className={cn(
            'absolute right-2 top-14 z-30',
            'w-72 bg-background border border-border rounded-xl shadow-xl',
            'flex flex-col overflow-hidden max-h-[calc(100vh-8rem)]'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold">
                {mode ? MODE_LABELS[mode] : 'AI Assistant'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading && (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="relative">
                  <Loader2 className="w-8 h-8 text-accent animate-spin" />
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-accent/20"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                </div>
                <p className="text-xs text-text-muted text-center">
                  Procesando con IA...
                </p>
                <div className="flex gap-1">
                  {[0, 0.2, 0.4].map((delay) => (
                    <motion.div
                      key={delay}
                      className="w-1.5 h-1.5 rounded-full bg-accent"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay }}
                    />
                  ))}
                </div>
              </div>
            )}

            {!isLoading && (mode === 'expand' || mode === 'brainstorm') && expandResult && (
              <div className="space-y-3">
                <p className="text-xs text-text-muted">
                  {mode === 'brainstorm'
                    ? 'Ideas generadas. Selecciona las que quieras agregar al mapa:'
                    : 'Selecciona los nodos que deseas agregar:'}
                </p>
                <div className="space-y-1.5">
                  {expandResult.suggestions.map((s) => {
                    const checked = expandSelections[s.id] !== false;
                    return (
                      <button
                        key={s.id}
                        onClick={() => handleToggleExpand(s.id)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm text-left',
                          'transition-all hover:border-accent/50',
                          checked
                            ? 'border-accent/30 bg-accent/5 text-text'
                            : 'border-border bg-surface text-text-muted'
                        )}
                      >
                        <div
                          className={cn(
                            'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0',
                            checked ? 'bg-accent border-accent' : 'border-border'
                          )}
                        >
                          {checked && <Check className="w-2.5 h-2.5 text-accent-fg" />}
                        </div>
                        <span>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={handleAcceptExpand}
                  className="w-full text-sm py-2 rounded-lg bg-accent text-accent-fg hover:bg-accent/90 transition-colors font-medium"
                >
                  Agregar seleccionados
                </button>
              </div>
            )}

            {!isLoading && mode === 'summarize' && summarizeResult && (
              <div className="space-y-3">
                <p className="text-xs text-text-muted">
                  Resumen generado. Edítalo antes de aplicar:
                </p>
                <textarea
                  value={summaryEdit || summarizeResult.text}
                  onChange={(e) => setSummaryEdit(e.target.value)}
                  onFocus={initSummaryEdit}
                  rows={6}
                  className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 outline-none focus:border-accent/50 resize-none transition-colors"
                />
                <button
                  onClick={handleAcceptSummarize}
                  className="w-full text-sm py-2 rounded-lg bg-accent text-accent-fg hover:bg-accent/90 transition-colors font-medium"
                >
                  Aplicar resumen
                </button>
              </div>
            )}

            {!isLoading && mode === 'convert-to-plan' && convertResult && (
              <div className="space-y-3">
                <p className="text-xs text-text-muted">
                  Estructura de tareas propuesta:
                </p>
                <div className="space-y-1.5 border border-border rounded-lg overflow-hidden divide-y divide-border">
                  {convertResult.tasks.map((task) => (
                    <div key={task.id} className="p-2.5">
                      <div className="flex items-center gap-2">
                        <ChevronRight className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                        <span className="text-sm font-medium">{task.title}</span>
                      </div>
                      {task.description && (
                        <p className="text-xs text-text-muted mt-1 ml-5.5 pl-0.5">
                          {task.description}
                        </p>
                      )}
                      {task.children && task.children.length > 0 && (
                        <div className="mt-1.5 ml-5 space-y-1">
                          {task.children.map((child) => (
                            <div key={child.id} className="flex items-center gap-1.5">
                              <div className="w-1 h-1 rounded-full bg-text-subtle flex-shrink-0" />
                              <span className="text-xs text-text-muted">{child.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => onMaterializePlan(convertResult.tasks)}
                  className="w-full text-sm py-2 rounded-lg bg-accent text-accent-fg hover:bg-accent/90 transition-colors font-medium"
                >
                  Materializar en proyecto
                </button>
              </div>
            )}

            {!isLoading && mode === 'brainstorm' && !expandResult && (
              <div className="text-sm text-text-muted py-6 text-center">
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No se generaron ideas. Intenta de nuevo.</p>
              </div>
            )}

            {!isLoading && !expandResult && !summarizeResult && !convertResult && (
              <div className="text-sm text-text-muted py-6 text-center">
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Selecciona una acción AI del toolbar</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
