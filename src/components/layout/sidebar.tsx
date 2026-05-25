"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid,
  LayoutDashboard,
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
  BarChart2,
  Layers,
  Zap,
  Target,
  Workflow,
  ClipboardList,
  MoreHorizontal,
  Trash2,
  Archive,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export default function Sidebar({
  workspace,
  role,
  projects,
  collapsed,
  onCollapse,
  currentPath,
  mobileOpen = false,
  onMobileClose,
}: Props) {
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  }, [currentPath]);

  const basePath = `/app/${workspace.slug}`;

  const mainNav = [
    {
      href: `${basePath}/dashboard`,
      label: "Dashboard",
      icon: LayoutDashboard,
      exact: false,
    },
    {
      href: basePath,
      label: "Inicio",
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
    {
      href: `${basePath}/portfolios`,
      label: "Portfolios",
      icon: Layers,
    },
    {
      href: `${basePath}/goals`,
      label: "Objetivos",
      icon: Target,
    },
  ];

  const isActive = (href: string, exact = false) => {
    if (exact) return currentPath === href;
    return currentPath.startsWith(href);
  };

  const sidebarContent = (
    <motion.aside
      initial={false}
      animate={{ width: 240 }}
      transition={spring}
      className="border-r border-border flex flex-col bg-surface relative z-20 overflow-hidden h-full"
    >
      {!isMobile && (
        <button
          onClick={() => onCollapse(true)}
          className="absolute -right-3 top-16 w-6 h-6 rounded-full border border-border bg-surface flex items-center justify-center hover:bg-surface-2 transition-colors z-30 opacity-0 hover:opacity-100 group-hover:opacity-100"
        >
          <ChevronLeft className="w-3 h-3" />
        </button>
      )}

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
                      { href: `${href}/sprints`, icon: Zap, label: "Sprints" },
                      { href: `${href}/mindmaps`, icon: Brain, label: "Mindmaps" },
                      { href: `${href}/meetings`, icon: CalendarCheck, label: "Reuniones" },
                      { href: `${href}/workload`, icon: BarChart2, label: "Carga de trabajo" },
                      { href: `${href}/automations`, icon: Workflow, label: "Automatizaciones" },
                      { href: `${href}/forms`, icon: ClipboardList, label: "Formularios" },
                    ];
                    return (
                      <div key={project.id}>
                        <div className="relative group">
                          <Link
                            href={`${href}/board`}
                            className={cn(
                              "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors pr-8",
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
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setProjectMenuOpen(projectMenuOpen === project.id ? null : project.id);
                            }}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-surface-2 text-text-muted hover:text-text transition-all"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                          {projectMenuOpen === project.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setProjectMenuOpen(null)} />
                              <div className="absolute left-full top-0 ml-1 z-50 w-44 bg-background border border-border rounded-lg shadow-lg py-1 text-sm">
                                <button
                                  onClick={() => {
                                    setProjectMenuOpen(null);
                                    fetch(`/api/projects/${project.id}`, {
                                      method: "PUT",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ status: "archived" }),
                                    }).then(() => router.refresh());
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-text-muted hover:bg-surface-2 hover:text-text transition-colors"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                  Archivar
                                </button>
                                <button
                                  onClick={() => {
                                    setProjectMenuOpen(null);
                                    setDeleteInput("");
                                    setDeleteConfirm({ id: project.id, name: project.name });
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-red-500 hover:bg-red-500/10 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Eliminar proyecto
                                </button>
                              </div>
                            </>
                          )}
                        </div>
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
  );

  if (isMobile) {
    return (
      <>
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                className="fixed inset-0 bg-black/50 z-40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={onMobileClose}
              />
              <motion.div
                className="fixed left-0 top-0 bottom-0 w-60 z-50 flex flex-col"
                initial={{ x: -240 }}
                animate={{ x: 0 }}
                exit={{ x: -240 }}
                transition={spring}
              >
                {sidebarContent}
              </motion.div>
            </>
          )}
        </AnimatePresence>

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

  const handleDeleteProject = async () => {
    if (!deleteConfirm || deleteInput !== deleteConfirm.name) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${deleteConfirm.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      toast.success(`Proyecto "${deleteConfirm.name}" eliminado`);
      setDeleteConfirm(null);
      setDeleteInput("");
      router.push(`/app/${workspace.slug}`);
      router.refresh();
    } catch {
      toast.error("No se pudo eliminar el proyecto");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {sidebarContent}

      <AnimatePresence initial={false}>
        {newProjectOpen && (
          <NewProjectDialog
            workspaceId={workspace.id}
            workspaceSlug={workspace.slug}
            onClose={() => setNewProjectOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Delete project confirmation modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setDeleteConfirm(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className="relative z-10 w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h2 className="font-semibold text-base">Eliminar proyecto</h2>
                  <p className="text-xs text-text-muted">Esta acción no se puede deshacer</p>
                </div>
              </div>

              <p className="text-sm text-text-muted">
                Se eliminarán permanentemente todas las tareas, mindmaps, reuniones y datos del proyecto{" "}
                <span className="font-semibold text-text">{deleteConfirm.name}</span>.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted">
                  Escribe <span className="font-semibold text-text">{deleteConfirm.name}</span> para confirmar
                </label>
                <input
                  autoFocus
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleDeleteProject()}
                  placeholder={deleteConfirm.name}
                  className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 outline-none focus:border-red-500/50 placeholder:text-text-subtle transition-colors"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 text-sm px-3 py-2 rounded-lg border border-border text-text-muted hover:text-text hover:border-border-strong transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteProject}
                  disabled={deleteInput !== deleteConfirm.name || deleting}
                  className="flex-1 text-sm px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {deleting ? "Eliminando..." : "Eliminar proyecto"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
