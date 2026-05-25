"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  CheckCircle2,
  Bell,
  Lightbulb,
  HelpCircle,
  Plus,
  Trash2,
  GripVertical,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn, spring } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getTotalAgendaDuration } from "@/lib/meetings/meeting-types";
import type { AgendaItem } from "@/lib/meetings/meeting-types";
import type { InferSelectModel } from "drizzle-orm";
import type { profiles } from "@/db/schema";

type Profile = InferSelectModel<typeof profiles>;
type Member = { userId: string; role: string; profile: Profile | null };

type ItemType = AgendaItem["itemType"];

type Props = {
  meetingId: string;
  initialItems: AgendaItem[];
  members: Member[];
  readOnly?: boolean;
  durationMin?: number;
};

const TYPE_CONFIG: Record<
  ItemType,
  { label: string; icon: React.ElementType; badgeClass: string }
> = {
  discussion: {
    label: "Discusión",
    icon: MessageSquare,
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  decision: {
    label: "Decisión",
    icon: CheckCircle2,
    badgeClass: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  },
  update: {
    label: "Update",
    icon: Bell,
    badgeClass: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  },
  brainstorm: {
    label: "Brainstorm",
    icon: Lightbulb,
    badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
  qa: {
    label: "Q&A",
    icon: HelpCircle,
    badgeClass: "bg-green-500/10 text-green-400 border-green-500/20",
  },
};

function InlineEdit({
  value,
  onSave,
  readOnly,
  placeholder,
  className,
  autoFocus,
  onEnter,
}: {
  value: string;
  onSave: (v: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
}) {
  const [editing, setEditing] = useState(autoFocus ?? false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed !== value) onSave(trimmed || value);
    setEditing(false);
  };

  if (readOnly || !editing) {
    return (
      <span
        className={cn(
          !readOnly && "cursor-pointer hover:text-accent transition-colors",
          className
        )}
        onDoubleClick={() => !readOnly && setEditing(true)}
        onClick={() => !readOnly && !editing && setEditing(true)}
      >
        {value || (
          <span className="text-text-subtle italic">{placeholder}</span>
        )}
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
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          onEnter?.();
        }
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      className={cn(
        "bg-transparent outline-none border-b border-accent/40 pb-0.5 w-full",
        className
      )}
    />
  );
}

function SortableAgendaItem({
  item,
  members,
  readOnly,
  saving,
  onUpdate,
  onDelete,
  onAddSubItem,
}: {
  item: AgendaItem;
  members: Member[];
  readOnly?: boolean;
  saving: boolean;
  onUpdate: (id: string, patch: Partial<AgendaItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddSubItem: (parentId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: readOnly });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [expanded, setExpanded] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [durationEdit, setDurationEdit] = useState(false);
  const [durationDraft, setDurationDraft] = useState(
    String(item.durationMin ?? 15)
  );
  const typeRef = useRef<HTMLDivElement>(null);
  const durationRef = useRef<HTMLInputElement>(null);

  const typeConf = TYPE_CONFIG[item.itemType] ?? TYPE_CONFIG.discussion;
  const Icon = typeConf.icon;
  const owner = members.find((m) => m.userId === item.ownerId);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) {
        setTypeOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (durationEdit) durationRef.current?.focus();
  }, [durationEdit]);

  const commitDuration = () => {
    const v = Math.max(1, Math.min(180, Number(durationDraft) || 15));
    setDurationDraft(String(v));
    setDurationEdit(false);
    if (v !== (item.durationMin ?? 15)) {
      onUpdate(item.id, { durationMin: v });
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-lg border border-transparent hover:border-border transition-all",
        isDragging && "opacity-50 bg-surface border-border",
        saving && "opacity-60",
        item.parentItemId && "ml-6"
      )}
    >
      <div className="flex items-center gap-2 px-2 py-2">
        {/* Drag handle */}
        {!readOnly && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-0.5 text-text-subtle hover:text-text-muted flex-shrink-0 touch-none"
            tabIndex={-1}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Type badge */}
        <div ref={typeRef} className="relative flex-shrink-0">
          <button
            disabled={readOnly}
            onClick={() => !readOnly && setTypeOpen((v) => !v)}
            className={cn(
              "flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border font-medium transition-colors",
              typeConf.badgeClass,
              !readOnly && "hover:opacity-80 cursor-pointer"
            )}
          >
            <Icon className="w-3 h-3" />
            <span className="hidden sm:inline">{typeConf.label}</span>
          </button>
          <AnimatePresence>
            {typeOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={spring}
                className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-xl shadow-3 z-50 overflow-hidden w-36"
              >
                {(
                  Object.entries(TYPE_CONFIG) as [
                    ItemType,
                    (typeof TYPE_CONFIG)[ItemType]
                  ][]
                ).map(([k, v]) => {
                  const TIcon = v.icon;
                  return (
                    <button
                      key={k}
                      onClick={() => {
                        onUpdate(item.id, { itemType: k });
                        setTypeOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-2 transition-colors",
                        item.itemType === k && "bg-surface-2"
                      )}
                    >
                      <TIcon className="w-3 h-3" />
                      {v.label}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Title */}
        <span className="flex-1 min-w-0 text-sm">
          <InlineEdit
            value={item.title}
            onSave={(v) => v && onUpdate(item.id, { title: v })}
            readOnly={readOnly}
            placeholder="Título del item"
          />
        </span>

        {/* Duration */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {readOnly ? (
            <span className="text-xs text-text-subtle">
              {item.durationMin ?? 15} min
            </span>
          ) : durationEdit ? (
            <input
              ref={durationRef}
              type="number"
              min={1}
              max={180}
              value={durationDraft}
              onChange={(e) => setDurationDraft(e.target.value)}
              onBlur={commitDuration}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitDuration();
                if (e.key === "Escape") {
                  setDurationDraft(String(item.durationMin ?? 15));
                  setDurationEdit(false);
                }
              }}
              className="w-12 text-xs text-right bg-transparent border-b border-accent/40 outline-none"
            />
          ) : (
            <button
              onClick={() => setDurationEdit(true)}
              className="text-xs text-text-subtle hover:text-text-muted transition-colors bg-surface-2 px-1.5 py-0.5 rounded"
            >
              {item.durationMin ?? 15} min
            </button>
          )}
        </div>

        {/* Owner */}
        {!readOnly ? (
          <select
            value={item.ownerId ?? ""}
            onChange={(e) =>
              onUpdate(item.id, { ownerId: e.target.value || null })
            }
            className="text-xs bg-surface border border-border rounded px-1.5 py-0.5 outline-none focus:border-accent max-w-[90px] truncate flex-shrink-0"
            title="Responsable"
          >
            <option value="">—</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.profile?.fullName?.split(" ")[0] ?? m.userId.slice(0, 6)}
              </option>
            ))}
          </select>
        ) : (
          owner && (
            <span className="text-xs text-text-subtle max-w-[70px] truncate flex-shrink-0">
              {owner.profile?.fullName?.split(" ")[0] ?? "—"}
            </span>
          )
        )}

        {/* Expand */}
        {!item.parentItemId && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-0.5 rounded text-text-subtle hover:text-text-muted transition-colors flex-shrink-0"
          >
            <motion.div
              animate={{ rotate: expanded ? 90 : 0 }}
              transition={spring}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </motion.div>
          </button>
        )}

        {/* Delete */}
        {!readOnly && (
          <button
            onClick={() => onDelete(item.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-500/10 text-text-subtle hover:text-red-400 flex-shrink-0"
            title="Eliminar item"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Expand panel */}
      <AnimatePresence>
        {expanded && !item.parentItemId && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring}
            className="overflow-hidden"
          >
            <div className="px-8 pb-2 flex flex-col gap-1.5">
              {!readOnly && (
                <button
                  onClick={() => onAddSubItem(item.id)}
                  className="flex items-center gap-1 text-xs text-text-subtle hover:text-text-muted transition-colors mt-1"
                >
                  <Plus className="w-3 h-3" />
                  Agregar sub-item
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AgendaEditor({
  meetingId,
  initialItems,
  members,
  readOnly,
  durationMin,
}: Props) {
  const [items, setItems] = useState<AgendaItem[]>(
    [...initialItems].sort((a, b) => a.orderIdx - b.orderIdx)
  );
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const newTitleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) setTimeout(() => newTitleRef.current?.focus(), 50);
  }, [adding]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const markSaving = (id: string, on: boolean) => {
    setSaving((prev) => {
      const next = new Set(prev);
      on ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const updateItemRemote = async (id: string, patch: Partial<AgendaItem>) => {
    const prev = items.find((i) => i.id === id);
    if (!prev) return;
    setItems((all) => all.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    markSaving(id, true);
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
      markSaving(id, false);
    }
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) {
      setAdding(false);
      return;
    }
    const orderIdx = items.filter((i) => !i.parentItemId).length;
    try {
      const res = await fetch(`/api/meetings/${meetingId}/agenda`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          itemType: "discussion",
          durationMin: 15,
          orderIdx,
        }),
      });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { agendaItem: AgendaItem };
      setItems((prev) => [...prev, body.agendaItem]);
    } catch {
      toast.error("Error al agregar item");
    } finally {
      setNewTitle("");
      setAdding(false);
    }
  };

  const handleAddSubItem = async (parentId: string) => {
    const parent = items.find((i) => i.id === parentId);
    if (!parent) return;
    const siblings = items.filter((i) => i.parentItemId === parentId);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/agenda`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Sub-item",
          itemType: "discussion",
          durationMin: 5,
          orderIdx: siblings.length,
          parentItemId: parentId,
        }),
      });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { agendaItem: AgendaItem };
      setItems((prev) => [...prev, body.agendaItem]);
    } catch {
      toast.error("Error al agregar sub-item");
    }
  };

  const handleDelete = async (id: string) => {
    const prev = items;
    setItems((all) => all.filter((i) => i.id !== id && i.parentItemId !== id));
    try {
      const res = await fetch(`/api/meetings/${meetingId}/agenda/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
    } catch {
      setItems(prev);
      toast.error("Error al eliminar item");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const rootItems = items.filter((i) => !i.parentItemId);
    const oldIndex = rootItems.findIndex((i) => i.id === active.id);
    const newIndex = rootItems.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(rootItems, oldIndex, newIndex);
    const reorderedWithIdx = reordered.map((i, idx) => ({
      ...i,
      orderIdx: idx,
    }));

    const subItems = items.filter((i) => i.parentItemId);
    setItems([...reorderedWithIdx, ...subItems]);

    // Persist reorder
    try {
      await Promise.all(
        reorderedWithIdx.map((i) =>
          fetch(`/api/meetings/${meetingId}/agenda/${i.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderIdx: i.orderIdx }),
          })
        )
      );
    } catch {
      toast.error("Error al guardar orden");
    }
  };

  const rootItems = items
    .filter((i) => !i.parentItemId)
    .sort((a, b) => a.orderIdx - b.orderIdx);

  const allDisplayItems: AgendaItem[] = [];
  for (const root of rootItems) {
    allDisplayItems.push(root);
    const subs = items
      .filter((i) => i.parentItemId === root.id)
      .sort((a, b) => a.orderIdx - b.orderIdx);
    allDisplayItems.push(...subs);
  }

  const total = getTotalAgendaDuration(items);
  const overBudget = durationMin != null && total > durationMin;

  return (
    <div className="flex flex-col gap-1">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={rootItems.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <AnimatePresence initial={false}>
            {allDisplayItems.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={spring}
              >
                <SortableAgendaItem
                  item={item}
                  members={members}
                  readOnly={readOnly}
                  saving={saving.has(item.id)}
                  onUpdate={updateItemRemote}
                  onDelete={handleDelete}
                  onAddSubItem={handleAddSubItem}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </SortableContext>
      </DndContext>

      {/* Add item */}
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
                  if (e.key === "Escape") {
                    setNewTitle("");
                    setAdding(false);
                  }
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
                onClick={() => {
                  setNewTitle("");
                  setAdding(false);
                }}
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

      {/* Footer totals */}
      {items.length > 0 && (
        <div className="flex items-center justify-end gap-2 px-3 pt-2 border-t border-border/50 mt-1">
          <span
            className={cn(
              "text-xs font-medium",
              overBudget ? "text-orange-400" : "text-text-muted"
            )}
          >
            Total: {total} min
            {durationMin != null && (
              <span className="text-text-subtle ml-1">/ {durationMin} min</span>
            )}
          </span>
          {overBudget && (
            <span className="text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded-full">
              +{total - durationMin!} min sobre tiempo
            </span>
          )}
        </div>
      )}
    </div>
  );
}
