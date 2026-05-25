"use client";

import { motion } from "framer-motion";
import { Bell, CheckCheck } from "lucide-react";

type Props = {
  workspaceSlug: string;
};

export default function InboxView({ workspaceSlug: _ }: Props) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      >
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold tracking-tighter">Inbox</h1>
          <button className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors px-3 py-1.5 rounded-lg border border-border hover:bg-surface">
            <CheckCheck className="w-4 h-4" />
            Marcar todo como leído
          </button>
        </div>

        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center mx-auto mb-4">
            <Bell className="w-6 h-6 text-text-subtle" />
          </div>
          <p className="font-serif text-xl text-text-muted italic mb-2">
            &ldquo;Todo al día.&rdquo;
          </p>
          <p className="text-sm text-text-subtle">
            Cuando alguien te mencione o asigne una tarea, aparecerá aquí.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
