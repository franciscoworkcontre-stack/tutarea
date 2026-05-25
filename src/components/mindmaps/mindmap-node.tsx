"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type MindmapNode = {
  id: string;
  mindmapId: string;
  parentNodeId: string | null;
  label: string;
  content: string | null;
  color: string;
  positionX: number;
  positionY: number;
  nodeOrder: number;
  children?: MindmapNode[];
};

type Props = {
  node: MindmapNode;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: (id: string) => void;
  onDoubleClick: (id: string) => void;
  onLabelChange: (id: string, label: string) => void;
  onLabelBlur: (id: string) => void;
  depth: number;
};

export default function MindmapNodeComponent({
  node,
  isSelected,
  isEditing,
  onSelect,
  onDoubleClick,
  onLabelChange,
  onLabelBlur,
  depth,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const isRoot = depth === 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick(node.id);
      }}
      className={cn(
        "absolute select-none cursor-pointer rounded-xl border-2 transition-shadow",
        "flex items-center justify-center",
        isRoot ? "min-w-36 px-4 py-3 text-sm font-semibold" : "min-w-28 px-3 py-2 text-xs font-medium",
        isSelected
          ? "shadow-lg ring-2 ring-offset-1 ring-offset-background"
          : "hover:shadow-md"
      )}
      style={{
        left: node.positionX,
        top: node.positionY,
        transform: "translate(-50%, -50%)",
        borderColor: node.color,
        backgroundColor: `${node.color}18`,
        ...(isSelected ? { "--tw-ring-color": node.color } as React.CSSProperties : {}),
        boxShadow: isSelected ? `0 0 0 2px ${node.color}` : undefined,
      }}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          autoFocus
          value={node.label}
          onChange={(e) => onLabelChange(node.id, e.target.value)}
          onBlur={() => onLabelBlur(node.id)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onLabelBlur(node.id);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "bg-transparent outline-none text-center w-full",
            isRoot ? "text-sm font-semibold" : "text-xs font-medium"
          )}
          style={{ color: "inherit", minWidth: "6rem" }}
        />
      ) : (
        <span
          className={cn(
            "text-center leading-snug",
            isRoot ? "text-sm" : "text-xs"
          )}
          style={{ color: node.color === "#94a3b8" ? undefined : node.color }}
        >
          {node.label || "Sin título"}
        </span>
      )}
    </motion.div>
  );
}
