"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MindmapNode } from "./mindmap-node";

type Props = {
  node: MindmapNode | null;
  onUpdate: (id: string, updates: Partial<MindmapNode>) => void;
  onClose: () => void;
};

const PRESET_COLORS = [
  "#94a3b8",
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
];

export default function MindmapSidebar({ node, onUpdate, onClose }: Props) {
  const [label, setLabel] = useState("");
  const [content, setContent] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (node) {
      setLabel(node.label);
      setContent(node.content ?? "");
    }
  }, [node?.id]);

  const handleLabelBlur = useCallback(() => {
    if (!node) return;
    if (label !== node.label) {
      onUpdate(node.id, { label });
    }
  }, [node, label, onUpdate]);

  const handleContentChange = useCallback(
    (value: string) => {
      setContent(value);
      if (!node) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onUpdate(node.id, { content: value || null });
      }, 500);
    },
    [node, onUpdate]
  );

  const handleColorSelect = useCallback(
    (color: string) => {
      if (!node) return;
      onUpdate(node.id, { color });
    },
    [node, onUpdate]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          key={node.id}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50 max-h-[60vh] flex flex-col",
            "border-t border-border bg-background rounded-t-xl shadow-lg",
            "md:static md:bottom-auto md:left-auto md:right-auto md:z-auto",
            "md:max-h-full md:w-64 md:flex-shrink-0 md:border-l md:border-t-0",
            "md:border-border md:rounded-none md:shadow-none md:h-full"
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <span className="text-sm font-medium">Propiedades del nodo</span>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
                Etiqueta
              </label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onBlur={handleLabelBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 outline-none focus:border-accent/50 placeholder:text-text-subtle transition-colors"
                placeholder="Nombre del nodo..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
                Contenido
              </label>
              <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                rows={4}
                className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 outline-none focus:border-accent/50 placeholder:text-text-subtle transition-colors resize-none"
                placeholder="Notas, detalles..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
                Color
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorSelect(color)}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 transition-transform hover:scale-110",
                      node.color === color ? "border-text scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wide flex items-center gap-1.5">
                <MapPin className="w-3 h-3" />
                Posición
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface-2 border border-border rounded-lg px-3 py-2">
                  <span className="text-xs text-text-subtle block">X</span>
                  <span className="text-sm font-mono text-text-muted">
                    {Math.round(node.positionX)}
                  </span>
                </div>
                <div className="bg-surface-2 border border-border rounded-lg px-3 py-2">
                  <span className="text-xs text-text-subtle block">Y</span>
                  <span className="text-sm font-mono text-text-muted">
                    {Math.round(node.positionY)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
