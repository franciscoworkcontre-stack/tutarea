"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Search, Bell, Sun, Moon, Monitor, LogOut, User, Menu } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { spring } from "@/lib/utils";
import type { InferSelectModel } from "drizzle-orm";
import type { workspaces } from "@/db/schema";

type Workspace = InferSelectModel<typeof workspaces>;

type Props = {
  workspace: Workspace;
  onCommandOpen: () => void;
  userId: string;
  onMobileMenuOpen?: () => void;
};

export default function Topbar({ workspace, onCommandOpen, userId, onMobileMenuOpen }: Props) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    setMounted(true);
  }, []);

  const segments = mounted
    ? pathname.replace(`/app/${workspace.slug}`, "").split("/").filter(Boolean)
    : [];

  const signOut = async () => {
    await supabaseRef.current.auth.signOut();
    window.location.href = "/login";
  };

  const themeIcons = { light: Sun, dark: Moon, system: Monitor };
  const ThemeIcon = mounted ? (themeIcons[theme as keyof typeof themeIcons] ?? Monitor) : Monitor;

  return (
    <header className="h-12 border-b border-border flex items-center px-4 gap-3 bg-background flex-shrink-0 relative z-10">
      <button
        onClick={onMobileMenuOpen}
        className="md:hidden w-8 h-8 rounded-lg text-text-muted hover:text-text hover:bg-surface transition-colors flex items-center justify-center flex-shrink-0"
        aria-label="Abrir menú"
      >
        <Menu className="w-4 h-4" />
      </button>
      <nav className="flex items-center gap-1 flex-1 min-w-0">
        <Link
          href={`/app/${workspace.slug}`}
          className="text-sm text-text-muted hover:text-text transition-colors truncate max-w-32"
        >
          {workspace.name}
        </Link>
        {segments.map((segment, i) => (
          <span key={i} className="flex items-center gap-1 min-w-0">
            <span className="text-text-subtle">/</span>
            <span className="text-sm text-text truncate capitalize">
              {segment.replace(/-/g, " ")}
            </span>
          </span>
        ))}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <motion.button
          onClick={onCommandOpen}
          className="flex items-center gap-2 px-2.5 h-7 rounded-lg border border-border text-xs text-text-muted hover:text-text hover:border-border-strong hover:bg-surface transition-all"
          whileTap={{ scale: 0.97 }}
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Buscar</span>
          <kbd className="hidden sm:flex items-center gap-0.5 text-xs font-mono text-text-subtle">
            <span>⌘</span>K
          </kbd>
        </motion.button>

        <motion.button
          className="w-8 h-8 rounded-lg text-text-muted hover:text-text hover:bg-surface transition-colors flex items-center justify-center"
          whileTap={{ scale: 0.97 }}
          aria-label="Notificaciones"
        >
          <Bell className="w-4 h-4" />
        </motion.button>

        <motion.button
          onClick={() => {
            const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
            setTheme(next);
          }}
          className="w-8 h-8 rounded-lg text-text-muted hover:text-text hover:bg-surface transition-colors flex items-center justify-center"
          whileTap={{ scale: 0.97 }}
          aria-label="Cambiar tema"
        >
          <ThemeIcon className="w-4 h-4" />
        </motion.button>

        <div className="relative">
          <motion.button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-medium text-xs hover:bg-accent/30 transition-colors"
            whileTap={{ scale: 0.97 }}
          >
            U
          </motion.button>

          {userMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setUserMenuOpen(false)}
              />
              <motion.div
                className="absolute right-0 top-10 w-48 bg-surface border border-border rounded-xl shadow-3 z-50 overflow-hidden"
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={spring}
              >
                <Link
                  href={`/app/${workspace.slug}/settings/profile`}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-surface-2 transition-colors"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <User className="w-4 h-4 text-text-muted" />
                  Mi perfil
                </Link>
                <div className="h-px bg-border mx-2" />
                <button
                  onClick={signOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-danger hover:bg-danger/5 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión
                </button>
              </motion.div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
