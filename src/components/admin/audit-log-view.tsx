"use client";

import { motion } from "framer-motion";
import { formatDate } from "@/lib/utils";
import type { InferSelectModel } from "drizzle-orm";
import type { auditLog } from "@/db/schema";

type AuditEntry = InferSelectModel<typeof auditLog>;

type Props = {
  logs: AuditEntry[];
};

const ACTION_LABELS: Record<string, string> = {
  role_changed: "Cambio de rol",
  member_removed: "Miembro removido",
  member_added: "Miembro agregado",
};

export default function AuditLogView({ logs }: Props) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      >
        <h1 className="text-2xl font-semibold tracking-tighter mb-1">Auditoría</h1>
        <p className="text-text-muted text-sm mb-8">
          Registro de todos los cambios de membresía y permisos.
        </p>

        <div className="rounded-xl border border-border overflow-hidden">
          {logs.length === 0 ? (
            <div className="py-12 text-center text-sm text-text-subtle">
              No hay eventos de auditoría.
            </div>
          ) : (
            logs.map((log, i) => (
              <motion.div
                key={log.id}
                className="flex items-start gap-4 px-5 py-4 border-b border-border last:border-0 hover:bg-surface/50 transition-colors"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
              >
                <div className="w-2 h-2 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {log.entityType} · {log.entityId}
                  </p>
                  {log.diff != null && (
                    <p className="text-xs text-text-subtle mt-1 font-mono">
                      {JSON.stringify(log.diff as Record<string, unknown>)}
                    </p>
                  )}
                </div>
                <span className="text-xs text-text-subtle flex-shrink-0">
                  {formatDate(log.createdAt)}
                </span>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
