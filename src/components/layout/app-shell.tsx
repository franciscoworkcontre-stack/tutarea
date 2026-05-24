"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "./sidebar";
import Topbar from "./topbar";
import CommandPalette from "./command-palette";
import QuickAddTask from "../tasks/quick-add-task";
import type { InferSelectModel } from "drizzle-orm";
import type { workspaces, projects } from "@/db/schema";
import { spring } from "@/lib/utils";

type Workspace = InferSelectModel<typeof workspaces>;
type Project = InferSelectModel<typeof projects>;

type Props = {
  children: React.ReactNode;
  workspace: Workspace;
  role: string;
  projects: Project[];
  userId: string;
};

export default function AppShell({
  children,
  workspace,
  role,
  projects,
  userId,
}: Props) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const pathname = usePathname();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isInput =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.contentEditable === "true");

      if (isInput) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }

      if (e.key === "c" && !e.metaKey && !e.ctrlKey) {
        setQuickAddOpen(true);
      }

      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        // Show keyboard shortcuts
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        workspace={workspace}
        role={role}
        projects={projects}
        collapsed={sidebarCollapsed}
        onCollapse={setSidebarCollapsed}
        currentPath={pathname}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          workspace={workspace}
          onCommandOpen={() => setCommandOpen(true)}
          userId={userId}
        />

        <main className="flex-1 overflow-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence initial={false}>
        {commandOpen && (
          <CommandPalette
            workspace={workspace}
            projects={projects}
            onClose={() => setCommandOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {quickAddOpen && (
          <QuickAddTask
            workspace={workspace}
            projects={projects}
            onClose={() => setQuickAddOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
