"use client";

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onClose: () => void;
};

const SHORTCUTS = [
  { keys: ['Tab'], description: 'Crear nodo hijo' },
  { keys: ['Enter'], description: 'Crear nodo hermano' },
  { keys: ['Space'], description: 'Editar nodo seleccionado' },
  { keys: ['Delete', 'Backspace'], description: 'Eliminar nodo' },
  { keys: ['Escape'], description: 'Cancelar / deseleccionar' },
  { keys: ['Cmd', '0'], description: 'Ajustar vista' },
  { keys: ['Cmd', 'Z'], description: 'Deshacer' },
  { keys: ['Cmd', 'Shift', 'Z'], description: 'Rehacer' },
  { keys: ['?'], description: 'Mostrar/ocultar atajos' },
  { keys: ['Double click'], description: 'Editar label del nodo' },
  { keys: ['Click derecho'], description: 'Menú contextual' },
  { keys: ['Scroll'], description: 'Zoom in/out' },
  { keys: ['Drag canvas'], description: 'Pan (mover vista)' },
];

export default function MindmapShortcutsPanel({ open, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={cn(
              'w-full max-w-lg bg-background border border-border rounded-xl shadow-2xl',
              'overflow-hidden'
            )}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-text-muted" />
                <span className="text-sm font-semibold">Atajos de teclado</span>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-2 gap-x-8 gap-y-3">
              {SHORTCUTS.map(({ keys, description }) => (
                <div key={description} className="flex items-center justify-between gap-3">
                  <span className="text-xs text-text-muted">{description}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {keys.map((k) => (
                      <kbd
                        key={k}
                        className="text-xs bg-surface-2 border border-border rounded px-1.5 py-0.5 font-mono text-text-muted"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-border bg-surface/50">
              <p className="text-xs text-text-subtle text-center">
                Presiona <kbd className="text-xs bg-surface-2 border border-border rounded px-1 py-0.5 font-mono">?</kbd> para cerrar este panel
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
