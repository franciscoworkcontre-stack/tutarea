"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, Folder, LayoutGrid, CheckSquare, Settings, Shield, X } from "lucide-react";
import { spring } from "@/lib/utils";
import type { InferSelectModel } from "drizzle-orm";
import type { workspaces, projects } from "@/db/schema";

type Workspace = InferSelectModel<typeof workspaces>;
type Project = InferSelectModel<typeof projects>;

type Props = {
  workspace: Workspace;
  projects: Project[];
  onClose: () => void;
};

type Item = {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ElementType;
  href: string;
};

export default function CommandPalette({ workspace, projects, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const basePath = `/app/${workspace.slug}`;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const staticItems: Item[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutGrid, href: basePath },
    { id: "my-tasks", label: "Mis tareas", icon: CheckSquare, href: `${basePath}/my-tasks` },
    { id: "settings", label: "Configuración", icon: Settings, href: `${basePath}/settings/profile` },
    { id: "admin", label: "Admin — Equipo", icon: Shield, href: `${basePath}/admin/members` },
  ];

  const projectItems: Item[] = projects.map((p) => ({
    id: p.id,
    label: p.name,
    sublabel: p.key,
    icon: Folder,
    href: `${basePath}/projects/${p.id}/board`,
  }));

  const allItems = [...staticItems, ...projectItems];

  const filtered = query
    ? allItems.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.sublabel?.toLowerCase().includes(query.toLowerCase())
      )
    : allItems;

  const handleSelect = (item: Item) => {
    router.push(item.href);
    onClose();
  };

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((v) => Math.min(v + 1, filtered.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((v) => Math.max(v - 1, 0));
      }
      if (e.key === "Enter") {
        const item = filtered[selected];
        if (item) handleSelect(item);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [filtered, selected]);

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed top-[20vh] left-1/2 -translate-x-1/2 w-full max-w-xl z-50"
        initial={{ opacity: 0, scale: 0.96, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -8 }}
        transition={spring}
      >
        <div className="bg-surface border border-border rounded-2xl shadow-3 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="w-4 h-4 text-text-subtle flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar tareas, proyectos, comandos..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-subtle"
            />
            <button
              onClick={onClose}
              className="w-6 h-6 rounded flex items-center justify-center text-text-subtle hover:text-text hover:bg-surface-2 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-text-subtle">
                Sin resultados para &ldquo;{query}&rdquo;
              </div>
            ) : (
              filtered.map((item, i) => (
                <motion.button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                    i === selected
                      ? "bg-accent/10 text-accent"
                      : "hover:bg-surface-2 text-text"
                  }`}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0 text-text-muted" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.sublabel && (
                    <span className="text-xs text-text-subtle font-mono">
                      {item.sublabel}
                    </span>
                  )}
                  {i === selected && (
                    <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
                  )}
                </motion.button>
              ))
            )}
          </div>

          <div className="border-t border-border px-4 py-2 flex items-center gap-3 text-xs text-text-subtle">
            <span><kbd className="font-mono">↑↓</kbd> navegar</span>
            <span><kbd className="font-mono">↵</kbd> abrir</span>
            <span><kbd className="font-mono">esc</kbd> cerrar</span>
          </div>
        </div>
      </motion.div>
    </>
  );
}
