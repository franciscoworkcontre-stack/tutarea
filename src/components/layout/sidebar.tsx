"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid,
  Inbox,
  CheckSquare,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  FolderOpen,
  Shield,
  Brain,
  CalendarCheck,
  ListChecks,
} from "lucide-react";
import { cn, spring } from "@/lib/utils";
import type { InferSelectModel } from "drizzle-orm";
import type { workspaces, projects } from "@/db/schema";
import NewProjectDialog from "../projects/new-project-dialog";

type Workspace = InferSelectModel<typeof workspaces>;
type Project = InferSelectModel<typeof projects>;

type Props = {
  workspace: Workspace;
  role: string;
  projects: Project[];
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
  currentPath: string;
};

export default function Sidebar({
  workspace,
  role,
  projects,
  collapsed,
  onCollapse,
  currentPath,
}: Props) {
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  const basePath = `/app/${workspace.slug}`;

  const mainNav = [
    {
      href: basePath,
      label: "Dashboard",
      icon: LayoutGrid,
      exact: true,
    },
    {
      href: `${basePath}/inbox`,
      label: "Inbox",
      icon: Inbox,
    },
    {
      href: `${basePath}/my-tasks`,
      label: "Mis tareas",
      icon: CheckSquare,
    },
  ];

  const isActive = (href: string, exact = false) => {
    if (exact) return currentPath === href;
    return currentPath.startsWith(href);
  };

  if (collapsed) {
    return (
      <motion.aside
        initial={false}
        animate={{ width: 56 }}
        transition={spring}
        className="border-r border-border flex flex-col items-center py-3 gap-1 bg-surface relative z-20"
      >
        <button
          onClick={() => onCollapse(false)}
          className="absolute -right-3 top-16 w-6 h-6 rounded-full border border-border bg-surface flex items-center justify-center hover:bg-surface-2 transition-colors z-30"
        >
          <ChevronRight className="w-3 h-3" />
        </button>
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center mb-3">
          <span className="text-accent-fg text-xs font-bold">
            {workspace.name[0]}
          </span>
        </div>
        {mainNav.map(({ href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
              isActive(href, href === basePath)
                ? "bg-accent/10 text-accent"
                : "text-text-muted hover:bg-surface-2 hover:text-text"
            )}
          >
            <Icon className="w-4 h-4" />
          </Link>
        ))}
      </motion.aside>
    );
  }

  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: 240 }}
        transition={spring}
        className="border-r border-border flex flex-col bg-surface relative z-20 overflow-hidden"
      >
        <button
          onClick={() => onCollapse(true)}
          className="absolute -right-3 top-16 w-6 h-6 rounded-full border border-border bg-surface flex items-center justify-center hover:bg-surface-2 transition-colors z-30 opacity-0 hover:opacity-100 group-hover:opacity-100"
        >
          <ChevronLeft className="w-3 h-3" />
        </button>

        {/* Workspace header */}
        <div className="flex items-center gap-2.5 px-3 h-14 border-b border-border flex-shrink-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "#f57522" }}
          >
            <span className="text-white text-xs font-bold">
              {workspace.name[0]?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate leading-tight">
              {workspace.name}
            </p>
            <p className="text-xs text-text-subtle truncate capitalize">
              {role}
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {mainNav.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors relative",
                isActive(href, exact)
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-text-muted hover:bg-surface-2 hover:text-text"
              )}
            >
              {isActive(href, exact) && (
                <div className="absolute inset-0 bg-accent/10 rounded-lg" />
              )}
              <Icon className="w-4 h-4 flex-shrink-0 relative z-10" />
              <span className="relative z-10">{label}</span>
            </Link>
          ))}

          <div className="pt-3 pb-1">
            <button
              onClick={() => setProjectsOpen((v) => !v)}
              className="w-full flex items-center justify-between px-2.5 py-1 text-xs font-medium text-text-subtle hover:text-text-muted transition-colors uppercase tracking-wider"
            >
              <span>Proyectos</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setNewProjectOpen(true);
                  }}
                  className="w-4 h-4 rounded flex items-center justify-center hover:bg-surface-2 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <ChevronDown
                  className={cn(
                    "w-3 h-3 transition-transform",
                    !projectsOpen && "-rotate-90"
                  )}
                />
              </div>
            </button>

            <AnimatePresence initial={false}>
              {projectsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-0.5 pt-1">
                    {projects.map((project) => {
                      const href = `${basePath}/projects/${project.id}`;
                      const active = isActive(href);
                      const projectSubNav = [
                        { href: `${href}/board`, icon: ListChecks, label: "Tareas" },
                        { href: `${href}/mindmaps`, icon: Brain, label: "Mindmaps" },
                        { href: `${href}/meetings`, icon: CalendarCheck, label: "Reuniones" },
                      ];
                      return (
                        <div key={project.id}>
                          <Link
                            href={`${href}/board`}
                            className={cn(
                              "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors",
                              active
                                ? "bg-accent/10 text-accent font-medium"
                                : "text-text-muted hover:bg-surface-2 hover:text-text"
                            )}
                          >
                            <div
                              className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center"
                              style={{ backgroundColor: project.color }}
                            >
                              <span className="text-white text-xs font-bold">
                                {project.key[0]}
                              </span>
                            </div>
                            <span className="truncate">{project.name}</span>
                          </Link>
                          {active && (
                            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2.5">
                              {projectSubNav.map(({ href: subHref, icon: SubIcon, label }) => (
                                <Link
                                  key={subHref}
                                  href={subHref}
                                  className={cn(
                                    "flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors",
                                    isActive(subHref)
                                      ? "text-accent font-medium"
                                      : "text-text-subtle hover:text-text hover:bg-surface-2"
                                  )}
                                >
                                  <SubIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span>{label}</span>
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {projects.length === 0 && (
                      <button
                        onClick={() => setNewProjectOpen(true)}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-text-subtle hover:text-text-muted hover:bg-surface-2 transition-colors"
                      >
                        <FolderOpen className="w-4 h-4" />
                        <span>Crear proyecto</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        {/* Footer nav */}
        <div className="border-t border-border p-2 space-y-0.5">
          {(role === "owner" || role === "admin") && (
            <Link
              href={`${basePath}/admin/members`}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors",
                isActive(`${basePath}/admin`)
                  ? "bg-accent/10 text-accent"
                  : "text-text-muted hover:bg-surface-2 hover:text-text"
              )}
            >
              <Shield className="w-4 h-4" />
              <span>Admin</span>
            </Link>
          )}
          <Link
            href={`${basePath}/settings/profile`}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors",
              isActive(`${basePath}/settings`)
                ? "bg-accent/10 text-accent"
                : "text-text-muted hover:bg-surface-2 hover:text-text"
            )}
          >
            <Settings className="w-4 h-4" />
            <span>Configuración</span>
          </Link>
        </div>
      </motion.aside>

      <AnimatePresence initial={false}>
        {newProjectOpen && (
          <NewProjectDialog
            workspaceId={workspace.id}
            workspaceSlug={workspace.slug}
            onClose={() => setNewProjectOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
