"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, X } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { spring } from "@/lib/utils";
import type { InferSelectModel } from "drizzle-orm";
import type { profiles } from "@/db/schema";

type Profile = InferSelectModel<typeof profiles>;
type Member = { userId: string; role: string; profile: Profile | null };

type Props = {
  members: Member[];
  value: string | null;
  onChange: (userId: string | null) => void;
  size?: "sm" | "md";
};

export default function AssigneePicker({ members, value, onChange, size = "md" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = members.find((m) => m.userId === value);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const avatarSize = size === "sm" ? "w-5 h-5 text-[10px]" : "w-6 h-6 text-xs";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg border border-border bg-surface hover:bg-surface-2 transition-colors ${size === "sm" ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-sm"}`}
        title={selected ? `Asignado a ${selected.profile?.fullName ?? "miembro"}` : "Asignar"}
      >
        {selected ? (
          <>
            <div className={`${avatarSize} rounded-full bg-accent/20 flex items-center justify-center font-medium text-accent flex-shrink-0`}>
              {getInitials(selected.profile?.fullName ?? "?")}
            </div>
            <span className="text-text max-w-24 truncate">
              {selected.profile?.fullName?.split(" ")[0] ?? "Asignado"}
            </span>
          </>
        ) : (
          <>
            <User className={size === "sm" ? "w-3.5 h-3.5 text-text-subtle" : "w-4 h-4 text-text-subtle"} />
            <span className="text-text-muted">Asignar</span>
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute top-full left-0 mt-1.5 w-52 bg-surface border border-border rounded-xl shadow-3 z-50 overflow-hidden"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={spring}
          >
            {value && (
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-surface-2 transition-colors text-text-muted"
              >
                <X className="w-3.5 h-3.5" />
                Sin asignar
              </button>
            )}
            {value && <div className="h-px bg-border mx-2" />}
            <div className="max-h-48 overflow-y-auto">
              {members.map((m) => (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => { onChange(m.userId); setOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-surface-2 transition-colors ${m.userId === value ? "bg-accent/5 text-accent" : ""}`}
                >
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-xs font-medium text-accent flex-shrink-0">
                    {getInitials(m.profile?.fullName ?? "?")}
                  </div>
                  <span className="truncate">{m.profile?.fullName ?? m.userId.slice(0, 8)}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
