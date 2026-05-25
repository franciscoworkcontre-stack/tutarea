"use client";

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pencil, Plus, GitBranch, Palette, Square, Link2, ListTodo,
  ChevronRight, Trash2, Scissors, Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ContextMenuPosition = { x: number; y: number };

type Props = {
  position: ContextMenuPosition | null;
  nodeId: string | null;
  isRoot: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onEdit: (nodeId: string) => void;
  onAddChild: (nodeId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onChangeColor: (nodeId: string, color: string) => void;
  onChangeShape: (nodeId: string, shape: 'rounded' | 'circle' | 'diamond' | 'rect') => void;
  onLinkTask: (nodeId: string) => void;
  onConvertToTask: (nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteBranch: (nodeId: string) => void;
};

const PRESET_COLORS = [
  '#94a3b8',
  '#6366f1',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#06b6d4',
  '#a78bfa',
];

const SHAPES: { value: 'rounded' | 'circle' | 'diamond' | 'rect'; label: string; icon: React.ReactNode }[] = [
  { value: 'rounded', label: 'Redondeado', icon: <Square className="w-3.5 h-3.5 opacity-70 rounded" /> },
  { value: 'circle', label: 'Círculo', icon: <div className="w-3.5 h-3.5 rounded-full border border-current opacity-70" /> },
  { value: 'diamond', label: 'Rombo', icon: <div className="w-3 h-3 border border-current opacity-70 rotate-45" /> },
  { value: 'rect', label: 'Rectángulo', icon: <Square className="w-3.5 h-3.5 opacity-70" /> },
];

export default function MindmapContextMenu({
  position,
  nodeId,
  isRoot,
  isCollapsed,
  onClose,
  onEdit,
  onAddChild,
  onAddSibling,
  onChangeColor,
  onChangeShape,
  onLinkTask,
  onConvertToTask,
  onToggleCollapse,
  onDeleteNode,
  onDeleteBranch,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!position) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [position, onClose]);

  if (!position || !nodeId) return null;

  const act = (fn: () => void) => {
    fn();
    onClose();
  };

  const Item = ({
    icon,
    label,
    onClick,
    danger,
    disabled,
  }: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    danger?: boolean;
    disabled?: boolean;
  }) => (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm rounded-md text-left',
        'transition-colors hover:bg-surface-2',
        danger ? 'text-danger hover:bg-danger/10' : 'text-text',
        disabled && 'opacity-40 cursor-not-allowed pointer-events-none'
      )}
    >
      <span className="flex-shrink-0 text-text-muted">{icon}</span>
      {label}
    </button>
  );

  const Separator = () => <div className="my-1 border-t border-border" />;

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        className="fixed z-50 bg-background border border-border rounded-xl shadow-2xl py-1.5 min-w-[200px]"
        style={{
          left: Math.min(position.x, window.innerWidth - 220),
          top: Math.min(position.y, window.innerHeight - 400),
        }}
      >
        <Item
          icon={<Pencil className="w-3.5 h-3.5" />}
          label="Editar"
          onClick={() => act(() => onEdit(nodeId))}
        />
        <Item
          icon={<Plus className="w-3.5 h-3.5" />}
          label="Agregar hijo"
          onClick={() => act(() => onAddChild(nodeId))}
        />
        <Item
          icon={<GitBranch className="w-3.5 h-3.5" />}
          label="Agregar hermano"
          onClick={() => act(() => onAddSibling(nodeId))}
          disabled={isRoot}
        />

        <Separator />

        {/* Color picker */}
        <div className="px-3 py-1.5">
          <p className="text-xs text-text-subtle mb-2 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5" />
            Color
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => act(() => onChangeColor(nodeId, color))}
                className="w-5 h-5 rounded-full border-2 border-transparent hover:border-white/50 transition-transform hover:scale-110"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>

        {/* Shape picker */}
        <div className="px-3 py-1.5">
          <p className="text-xs text-text-subtle mb-1.5 flex items-center gap-1.5">
            <Square className="w-3.5 h-3.5" />
            Forma
          </p>
          <div className="grid grid-cols-2 gap-1">
            {SHAPES.map((s) => (
              <button
                key={s.value}
                onClick={() => act(() => onChangeShape(nodeId, s.value))}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        <Item
          icon={<Link2 className="w-3.5 h-3.5" />}
          label="Linkear a tarea"
          onClick={() => act(() => onLinkTask(nodeId))}
        />
        <Item
          icon={<ListTodo className="w-3.5 h-3.5" />}
          label="Convertir a tarea"
          onClick={() => act(() => onConvertToTask(nodeId))}
        />

        <Separator />

        <Item
          icon={
            isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <Minus className="w-3.5 h-3.5" />
            )
          }
          label={isCollapsed ? 'Expandir rama' : 'Colapsar rama'}
          onClick={() => act(() => onToggleCollapse(nodeId))}
        />

        <Separator />

        <Item
          icon={<Trash2 className="w-3.5 h-3.5" />}
          label="Eliminar nodo"
          onClick={() => act(() => onDeleteNode(nodeId))}
          danger
          disabled={isRoot}
        />
        <Item
          icon={<Scissors className="w-3.5 h-3.5" />}
          label="Eliminar rama completa"
          onClick={() => act(() => onDeleteBranch(nodeId))}
          danger
          disabled={isRoot}
        />
      </motion.div>
    </AnimatePresence>
  );
}
