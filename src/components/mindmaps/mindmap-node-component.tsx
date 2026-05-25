"use client";

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronDown, Link2 } from 'lucide-react';
import type { MindmapNodeData } from '@/lib/mindmaps/mindmap-store';

const SHAPE_CLASSES: Record<string, string> = {
  rounded: 'rounded-lg',
  circle: 'rounded-full aspect-square',
  diamond: 'rotate-45',
  rect: 'rounded-none',
};

const ICON_MAP: Record<string, string> = {
  star: '⭐',
  fire: '🔥',
  check: '✅',
  idea: '💡',
  warning: '⚠️',
  target: '🎯',
  rocket: '🚀',
  heart: '❤️',
  bolt: '⚡',
  flag: '🚩',
};

type MindmapNodeComponentProps = NodeProps & {
  data: MindmapNodeData;
};

function MindmapNodeComponent({ id, data, selected }: MindmapNodeComponentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const [isCollapsed, setIsCollapsed] = useState(data.isCollapsed ?? false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(data.label);
  }, [data.label]);

  useEffect(() => {
    if (data.isEditing && !isEditing) {
      setIsEditing(true);
    }
  }, [data.isEditing, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditValue(data.label);
  }, [data.label]);

  const commitEdit = useCallback(() => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== data.label) {
      // Dispatch custom event for canvas to pick up
      window.dispatchEvent(
        new CustomEvent('mindmap:node-label-change', {
          detail: { nodeId: id, label: trimmed },
        })
      );
    } else {
      setEditValue(data.label);
    }
  }, [editValue, data.label, id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsEditing(false);
        setEditValue(data.label);
      }
    },
    [commitEdit, data.label]
  );

  const handleCollapseToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const next = !isCollapsed;
      setIsCollapsed(next);
      window.dispatchEvent(
        new CustomEvent('mindmap:node-collapse', {
          detail: { nodeId: id, collapsed: next },
        })
      );
    },
    [id, isCollapsed]
  );

  const isRoot = data.nodeType === 'root';
  const shape = data.styleJsonb?.shape ?? 'rounded';
  const fillColor = data.styleJsonb?.fillColor ?? data.color;
  const borderColor = data.styleJsonb?.borderColor ?? data.color ?? '#94a3b8';
  const icon = data.styleJsonb?.icon;
  // Show collapse button only when the node actually has children (not a leaf)
  const hasChildren = data.nodeType !== 'leaf';

  const shapeClass = SHAPE_CLASSES[shape] ?? SHAPE_CLASSES.rounded;

  const nodeStyle: React.CSSProperties = {
    borderColor,
    backgroundColor: fillColor ? `${fillColor}18` : undefined,
  };

  if (shape === 'diamond') {
    nodeStyle.backgroundColor = fillColor ? `${fillColor}22` : undefined;
  }

  return (
    <div
      className={cn(
        'relative select-none',
        shape === 'diamond' && 'flex items-center justify-center'
      )}
      onDoubleClick={handleDoubleClick}
    >
      {/* Handles */}
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-border !border-border-strong" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-border !border-border-strong" />
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-border !border-border-strong opacity-0 hover:opacity-100" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-border !border-border-strong opacity-0 hover:opacity-100" />

      {/* Node body */}
      <div
        className={cn(
          'border-2 transition-all duration-150',
          'flex items-center gap-1.5',
          isRoot
            ? 'px-4 py-2.5 text-base font-semibold min-w-[100px] max-w-[240px]'
            : 'px-3 py-2 text-sm min-w-[80px] max-w-[200px]',
          shapeClass,
          selected && 'ring-2 ring-blue-500 ring-offset-1',
          isCollapsed && 'opacity-70',
          isEditing && 'ring-2 ring-accent'
        )}
        style={nodeStyle}
      >
        {/* Diamond content needs counter-rotation */}
        <div className={cn('flex items-center gap-1.5 w-full', shape === 'diamond' && '-rotate-45')}>
          {icon && (
            <span className="text-sm flex-shrink-0">{ICON_MAP[icon] ?? icon}</span>
          )}

          {isEditing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'bg-transparent outline-none text-center w-full',
                isRoot ? 'text-base font-semibold' : 'text-sm'
              )}
              style={{ minWidth: '4rem', color: 'inherit' }}
            />
          ) : (
            <span
              className={cn(
                'leading-snug text-center w-full break-words',
                isRoot ? 'text-base font-semibold' : 'text-sm'
              )}
            >
              {data.label || 'Sin título'}
            </span>
          )}

          {data.linkedTaskId && (
            <Link2 className="w-3 h-3 flex-shrink-0 text-text-muted" />
          )}
        </div>
      </div>

      {/* Collapse button */}
      {hasChildren && (
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleCollapseToggle}
          className={cn(
            'absolute -right-3 top-1/2 -translate-y-1/2',
            'w-5 h-5 rounded-full bg-background border border-border',
            'flex items-center justify-center',
            'hover:bg-surface-2 transition-colors z-10',
            'text-text-muted hover:text-text'
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>
      )}
    </div>
  );
}

export default memo(MindmapNodeComponent);
