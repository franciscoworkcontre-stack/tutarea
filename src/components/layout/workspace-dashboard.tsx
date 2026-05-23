"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { greetingByTime, spring } from "@/lib/utils";
import { ArrowRight, MessageCircle, Plus, Zap } from "lucide-react";
import type { InferSelectModel } from "drizzle-orm";
import type { workspaces, profiles } from "@/db/schema";

type Workspace = InferSelectModel<typeof workspaces>;
type Profile = InferSelectModel<typeof profiles>;

type Props = {
  workspace: Workspace | null | undefined;
  profile: Profile | null | undefined;
  userId: string;
};

export default function WorkspaceDashboard({ workspace, profile }: Props) {
  const name = profile?.fullName?.split(" ")[0] ?? "amigo";
  const [greeting, setGreeting] = useState(`Hola, ${name}.`);

  useEffect(() => {
    setGreeting(greetingByTime(name));
  }, [name]);

  if (!workspace) return null;

  const items = [
    {
      icon: Zap,
      label: "Crear tarea rápida",
      sublabel: "Presiona C en cualquier momento",
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      icon: MessageCircle,
      label: "Vincular Telegram",
      sublabel: "Captura tareas con voz",
      color: "text-info",
      bg: "bg-info/10",
      href: `/app/${workspace.slug}/settings/telegram`,
    },
    {
      icon: Plus,
      label: "Nuevo proyecto",
      sublabel: "Organiza tu trabajo",
      color: "text-success",
      bg: "bg-success/10",
      href: `/app/${workspace.slug}/projects`,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      >
        <h1 className="font-serif text-3xl text-text-muted italic mb-1">
          {greeting}
        </h1>
        <p className="text-text-subtle text-sm mb-10">
          Workspace: <strong className="text-text">{workspace.name}</strong>
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {items.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            >
              {item.href ? (
                <Link
                  href={item.href}
                  className="group flex items-start gap-3 p-4 rounded-xl border border-border bg-surface hover:border-border-strong hover:bg-surface-2 transition-all"
                >
                  <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0`}>
                    <item.icon className={`w-4.5 h-4.5 ${item.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs text-text-muted">{item.sublabel}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-text-subtle group-hover:translate-x-0.5 transition-transform mt-2.5" />
                </Link>
              ) : (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-surface">
                  <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0`}>
                    <item.icon className={`w-4.5 h-4.5 ${item.color}`} />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs text-text-muted">{item.sublabel}</p>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Empty state illustration */}
        <div className="text-center py-12 border border-dashed border-border rounded-2xl">
          <p className="font-serif text-xl text-text-muted italic mb-2">
            &ldquo;Aún no hay tareas. Captura la primera con{" "}
            <kbd className="font-mono font-normal not-italic bg-surface-2 px-1.5 py-0.5 rounded text-sm border border-border">
              C
            </kbd>
            , o envíale un audio a tu bot.&rdquo;
          </p>
          <p className="text-sm text-text-subtle mt-3">
            Tu equipo está esperando. Empieza ahora.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
