"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  CheckCircle,
  Bell,
  Lightbulb,
  HelpCircle,
  Plus,
  Trash2,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { cn, spring } from "@/lib/utils";
import { getTotalAgendaDuration } from "@/lib/meetings/meeting-utils";
import type { AgendaItem } from "@/lib/meetings/meeting-utils";
import type { InferSelectModel } from "drizzle-orm";
import type { profiles } from "@/db/schema";

type Profile = InferSelectModel<typeof profiles>;
type Member = { userId: string; role: string; profile: Profile | null };

type Props = {
  meetingId: string;
  initialItems: AgendaItem[];
  members: Member[];
  readOnly?: boolean;
};

type ItemType = AgendaItem["itemType"];

const TYPE_CONFIG: Record<
  ItemType,
  { label: string; icon: React.ElementType; className: string }
> = {
  discussion: { label: "Discusión",  icon: MessageSquare, className: "text-blue-400" },
  decision:   { label: "Decisión",   icon: CheckCircle,   className: "text-green-400" },
  update:     { label: "Update",     icon: Bell,          className: "text-yellow-400" },
  brainstorm: { label: "Brainstorm", icon: Lightbulb,     className: "text-purple-400" },
  qa:         { label: "Q&A",        icon: HelpCircle,    className: "text-orange-400" },
};

function InlineEdit({
  value,
  onSave,
  readOnly,
  placeholder,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    if (draft.trim() !== value) onSave(draft.trim());
    setEditing(false);
  };

  if (readOnly || !editing) {
    return (
      <span
        className={cn("cursor-pointer hover:text-accent transition-colors", className)}
        onClick={() => !readOnly && setEditing(true)}
      >
        {value || <span className="text-text-subtle">{placeholder}</span>}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") { setDraft(value); setEditing(false); }
      }}
      className={cn(
        "bg-transparent outline-none border-b border-accent/40 pb-0.5 w-full",
        className
      )}
    />
  );
}

export default function AgendaEditor({ meetingId, initialItems, members, readOnly }: Props) {
  const [items, setItems] = useState<AgendaItem[]>(
    [...initialItems].sort((a, b) => a.orderIdx - b.orderIdx)
  );
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const newTitleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (adding) setTimeout(() => newTitleRef.current?.focus(), 50); }, [adding]);

  const updateItemRemote = async (id: string, patch: Partial<AgendaItem>) => {
    const prev = items.find((i) => i.id === id);
    if (!prev) return;
    setItems((all) => all.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    setSaving(id);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/agenda/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
    } catch {
      setItems((all) => all.map((i) => (i.id === id ? prev : i)));
      toast.error("Error al actualizar item");
    } finally {
      setSaving(null);
    }
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) { setAdding(false); return; }
    const orderIdx = items.length;
    try {
      const res = await fetch(`/api/meetings/${meetingId}/agenda`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), itemType: "discussion", durationMin: 15, orderIdx }),
      });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { agendaItem: AgendaItem };
      setItems((prev) => [...prev, body.agendaItem]);
      toast.success("Item agregado");
    } catch {
      toast.error("Error al agregar item");
    } finally {
      setNewTitle("");
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    const prev = items.find((i) => i.id === id);
    setItems((all) => all.filter((i) => i.id !== id));
    try {
      const res = await fetch(`/api/meetings/${meetingId}/agenda/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      if (prev) setItems((all) => [...all, prev].sort((a, b) => a.orderIdx - b.orderIdx));
      toast.error("Error al eliminar item");
    }
  };

  const total = getTotalAgendaDuration(items);

  return (
    <div className="flex flex-col gap-1">
      <AnimatePresence initial={false}>
        {items.map((item) => {
          const typeConf = TYPE_CONFIG[item.itemType] ?? TYPE_CONFIG.discussion;
          const Icon = typeConf.icon;
          const owner = members.find((m) => m.userId === item.ownerId);

          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={spring}
              className={cn(
                "group flex items-center gap-2 px-3 py-2.5 rounded-lg border border-transparent hover:border-border hover:bg-surface/50 transition-all",
                saving === item.id && "opacity-60"
              )}
            >
              <GripVertical className="w-3.5 h-3.5 text-text-subtle flex-shrink-0 cursor-grab" />

              <select
                disabled={readOnly}
                value={item.itemType}
                onChange={(e) => updateItemRemote(item.id, { itemType: e.target.value as ItemType })}
                className="bg-transparent outline-none text-xs border-none cursor-pointer"
                title="Tipo de item"
              >
                {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>

              <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", typeConf.className)} />

              <span className="flex-1 min-w-0 text-sm">
                <InlineEdit
                  value={item.title}
                  onSave={(v) => updateItemRemote(item.id, { title: v })}
                  readOnly={readOnly}
                  placeholder="Título del item"
                />
              </span>

              <div className="flex items-center gap-1 flex-shrink-0">
                {readOnly ? (
                  <span className="text-xs text-text-subtle w-12 text-right">{item.durationMin} min</span>
                ) : (
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={item.durationMin ?? 0}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(180, Number(e.target.value)));
                      updateItemRemote(item.id, { durationMin: v });
                    }}
                    className="w-12 text-xs text-right bg-transparent border-b border-border focus:border-accent outline-none"
                  />
                )}
                <span className="text-xs text-text-subtle">min</span>
              </div>

              {!readOnly && (
                <select
                  value={item.ownerId ?? ""}
                  onChange={(e) => updateItemRemote(item.id, { ownerId: e.target.value || null })}
                  className="text-xs bg-surface border border-border rounded px-1.5 py-0.5 outline-none focus:border-accent max-w-[100px] truncate"
                  title="Responsable"
                >
                  <option value="">—</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.profile?.fullName?.split(" ")[0] ?? m.userId.slice(0, 8)}
                    </option>
                  ))}
                </select>
              )}

              {owner && readOnly && (
                <span className="text-xs text-text-subtle max-w-[80px] truncate">
                  {owner.profile?.fullName?.split(" ")[0] ?? "—"}
                </span>
              )}

              {!readOnly && (
                <button
                  onClick={() => handleDelete(item.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/10 text-text-subtle hover:text-red-400"
                  title="Eliminar item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {!readOnly && (
        <div className="mt-1">
          {adding ? (
            <div className="flex items-center gap-2 px-3 py-2">
              <input
                ref={newTitleRef}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") { setNewTitle(""); setAdding(false); }
                }}
                placeholder="Título del item..."
                className="flex-1 text-sm bg-transparent outline-none border-b border-accent/40 pb-0.5 placeholder:text-text-subtle"
              />
              <button
                onClick={handleAdd}
                className="text-xs px-2.5 py-1 bg-accent text-accent-fg rounded font-medium"
              >
                Agregar
              </button>
              <button
                onClick={() => { setNewTitle(""); setAdding(false); }}
                className="text-xs text-text-muted hover:text-text"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 text-xs text-text-subtle hover:text-text-muted transition-colors px-3 py-2"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar item
            </button>
          )}
        </div>
      )}

      {items.length > 0 && (
        <div className="flex items-center justify-end px-3 pt-2 border-t border-border/50 mt-1">
          <span className="text-xs text-text-muted font-medium">Total: {total} min</span>
        </div>
      )}
    </div>
  );
}
