"use client";

import { useState } from "react";
import {
  Sparkles,
  ListOrdered,
  BookOpen,
  Users,
  Zap,
  FileText,
  Loader2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { MeetingWithDetails, AgendaItem } from "@/lib/meetings/meeting-types";

type Props = {
  meetingId: string;
  meeting: MeetingWithDetails;
  onAgendaGenerated: (items: AgendaItem[]) => void;
  onBriefingGenerated: (briefing: string) => void;
};

type Tab = "agenda" | "briefing" | "attendees" | "actions" | "recap";

type SuggestedAgendaItem = {
  title: string;
  durationMin: number;
  itemType: string;
  selected: boolean;
};

type SuggestedAttendee = {
  userId: string;
  reason: string;
  selected: boolean;
};

type SuggestedAction = {
  contentMd: string;
  assigneeHint: string;
  selected: boolean;
};

const TAB_CONFIG: Record<Tab, { label: string; icon: React.ElementType }> = {
  agenda: { label: "Agenda", icon: ListOrdered },
  briefing: { label: "Briefing", icon: BookOpen },
  attendees: { label: "Asistentes", icon: Users },
  actions: { label: "Acciones", icon: Zap },
  recap: { label: "Recap", icon: FileText },
};

async function streamFetch(
  url: string,
  body: Record<string, unknown>,
  onChunk: (text: string) => void
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "Error desconocido");
    throw new Error(err);
  }
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    accumulated += decoder.decode(value, { stream: true });
    onChunk(accumulated);
  }
  return accumulated;
}

function parseAgendaItems(raw: string): SuggestedAgendaItem[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item: Record<string, unknown>) => ({
        title: String(item.title ?? "Item"),
        durationMin: Number(item.durationMin ?? 10),
        itemType: String(item.itemType ?? "discussion"),
        selected: true,
      }));
    }
  } catch {
    // fallback: split by lines and parse
    const lines = raw.split("\n").filter((l) => l.trim().startsWith("•") || l.trim().startsWith("-"));
    if (lines.length > 0) {
      return lines.map((l) => ({
        title: l.replace(/^[•\-]\s*/, "").trim(),
        durationMin: 10,
        itemType: "discussion",
        selected: true,
      }));
    }
  }
  return [];
}

function parseAttendees(raw: string): SuggestedAttendee[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((a: Record<string, unknown>) => ({
        userId: String(a.userId ?? ""),
        reason: String(a.reason ?? ""),
        selected: false,
      }));
    }
  } catch {
    /* empty */
  }
  return [];
}

function parseSuggestedActions(raw: string): SuggestedAction[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((a: Record<string, unknown>) => ({
        contentMd: String(a.contentMd ?? a.text ?? ""),
        assigneeHint: String(a.assigneeHint ?? ""),
        selected: true,
      }));
    }
  } catch {
    const lines = raw.split("\n").filter((l) => l.trim().startsWith("•") || l.trim().startsWith("-"));
    return lines.map((l) => ({
      contentMd: l.replace(/^[•\-]\s*/, "").trim(),
      assigneeHint: "",
      selected: true,
    }));
  }
  return [];
}

// ─── Agenda Tab ────────────────────────────────────────────────────────────────
function AgendaTab({
  meetingId,
  meeting,
  onAgendaGenerated,
}: {
  meetingId: string;
  meeting: MeetingWithDetails;
  onAgendaGenerated: (items: AgendaItem[]) => void;
}) {
  const [objective, setObjective] = useState(meeting.objective ?? "");
  const [duration, setDuration] = useState(String(meeting.durationMin));
  const [type, setType] = useState(meeting.type);
  const [loading, setLoading] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestedAgendaItem[]>([]);
  const [applying, setApplying] = useState(false);

  async function generate() {
    setLoading(true);
    setStreamedText("");
    setSuggestions([]);
    try {
      const raw = await streamFetch(
        `/api/meetings/${meetingId}/ai/generate-agenda`,
        { objective, duration: Number(duration), type },
        setStreamedText
      );
      setSuggestions(parseAgendaItems(raw));
    } catch {
      toast.error("No se pudo generar la agenda");
    } finally {
      setLoading(false);
    }
  }

  async function applySelected() {
    const selected = suggestions.filter((s) => s.selected);
    if (selected.length === 0) return;
    setApplying(true);
    try {
      // Create items one at a time using the existing POST /agenda endpoint
      const created: AgendaItem[] = [];
      for (let idx = 0; idx < selected.length; idx++) {
        const item = selected[idx]!;
        const res = await fetch(`/api/meetings/${meetingId}/agenda`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.title,
            durationMin: item.durationMin,
            itemType: item.itemType,
          }),
        });
        if (!res.ok) throw new Error("Error aplicando agenda");
        const data = (await res.json()) as { agendaItem: AgendaItem };
        created.push(data.agendaItem);
      }
      onAgendaGenerated(created);
      toast.success(`${created.length} items de agenda aplicados`);
      setSuggestions([]);
      setStreamedText("");
    } catch {
      toast.error("No se pudo aplicar la agenda");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-text-muted block mb-1">Objetivo</label>
          <textarea
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            rows={2}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-subtle resize-none focus:outline-none focus:border-accent"
            placeholder="¿Cuál es el objetivo de esta reunión?"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-text-muted block mb-1">Duración (min)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-text-muted block mb-1">Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
            >
              {["1-on-1", "team-sync", "decision", "brainstorm", "review", "retro", "kickoff", "custom"].map(
                (t) => <option key={t} value={t}>{t}</option>
              )}
            </select>
          </div>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          Generar agenda
        </button>
      </div>

      {streamedText && suggestions.length === 0 && (
        <div className="bg-surface-2 rounded-lg p-3 text-sm text-text-muted whitespace-pre-wrap font-mono text-xs">
          {streamedText}
          {loading && <span className="animate-pulse">▌</span>}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-text-muted">Items sugeridos:</p>
          {suggestions.map((item, idx) => (
            <label
              key={idx}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface-1 cursor-pointer hover:bg-surface-2 transition-colors"
            >
              <input
                type="checkbox"
                checked={item.selected}
                onChange={(e) => {
                  const updated = [...suggestions];
                  updated[idx] = { ...item, selected: e.target.checked };
                  setSuggestions(updated);
                }}
                className="rounded border-border accent-accent"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text">{item.title}</p>
                <p className="text-xs text-text-subtle">
                  {item.durationMin}m · {item.itemType}
                </p>
              </div>
            </label>
          ))}
          <button
            onClick={applySelected}
            disabled={applying || suggestions.filter((s) => s.selected).length === 0}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            <Check className="w-4 h-4" />
            {applying ? "Aplicando..." : `Aplicar seleccionados (${suggestions.filter((s) => s.selected).length})`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Briefing Tab ───────────────────────────────────────────────────────────────
function BriefingTab({
  meetingId,
  onBriefingGenerated,
}: {
  meetingId: string;
  onBriefingGenerated: (briefing: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [briefingText, setBriefingText] = useState("");
  const [saving, setSaving] = useState(false);

  async function generate() {
    setLoading(true);
    setBriefingText("");
    try {
      await streamFetch(
        `/api/meetings/${meetingId}/ai/generate-briefing`,
        {},
        setBriefingText
      );
    } catch {
      toast.error("No se pudo generar el briefing");
    } finally {
      setLoading(false);
    }
  }

  async function saveBriefing() {
    if (!briefingText.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefingMd: briefingText }),
      });
      if (!res.ok) throw new Error("Error guardando briefing");
      onBriefingGenerated(briefingText);
      toast.success("Briefing guardado");
    } catch {
      toast.error("No se pudo guardar el briefing");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={generate}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        Generar briefing
      </button>

      {(briefingText || loading) && (
        <div className="space-y-3">
          <textarea
            value={briefingText}
            onChange={(e) => setBriefingText(e.target.value)}
            rows={10}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-subtle resize-none focus:outline-none focus:border-accent font-mono"
            placeholder="El briefing aparecerá aquí..."
          />
          {loading && (
            <p className="text-xs text-text-subtle flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Generando...
            </p>
          )}
          {briefingText && !loading && (
            <button
              onClick={saveBriefing}
              disabled={saving}
              className="w-full py-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 text-sm font-medium hover:bg-green-500/20 disabled:opacity-50 transition-colors"
            >
              {saving ? "Guardando..." : "Guardar briefing"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Attendees Tab ──────────────────────────────────────────────────────────────
function AttendeesTab({ meetingId }: { meetingId: string }) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedAttendee[]>([]);
  const [adding, setAdding] = useState(false);

  async function suggest() {
    setLoading(true);
    setStreamedText("");
    setSuggestions([]);
    try {
      // suggest-attendees returns regular JSON, not a stream
      const res = await fetch(`/api/meetings/${meetingId}/ai/suggest-attendees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Error al sugerir");
      const data = (await res.json()) as { suggestions: { userId: string; relevanceScore: number; reason: string }[] };
      setSuggestions(
        (data.suggestions ?? []).map((s) => ({
          userId: s.userId,
          reason: s.reason,
          selected: false,
        }))
      );
    } catch {
      toast.error("No se pudo sugerir asistentes");
    } finally {
      setLoading(false);
    }
  }

  async function addSelected() {
    const selected = suggestions.filter((s) => s.selected && s.userId);
    if (selected.length === 0) return;
    setAdding(true);
    try {
      // Add attendees one at a time
      let addedCount = 0;
      for (const s of selected) {
        const res = await fetch(`/api/meetings/${meetingId}/attendees`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: s.userId, role: "contributor" }),
        });
        if (res.ok) addedCount++;
      }
      toast.success(`${addedCount} asistentes agregados`);
      setSuggestions([]);
    } catch {
      toast.error("No se pudo agregar los asistentes");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={suggest}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        Sugerir asistentes
      </button>

      {loading && suggestions.length === 0 && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-text-subtle" />
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions.map((s, idx) => (
            <label
              key={idx}
              className="flex items-start gap-3 p-3 rounded-lg border border-border bg-surface-1 cursor-pointer hover:bg-surface-2 transition-colors"
            >
              <input
                type="checkbox"
                checked={s.selected}
                onChange={(e) => {
                  const updated = [...suggestions];
                  updated[idx] = { ...s, selected: e.target.checked };
                  setSuggestions(updated);
                }}
                className="mt-0.5 rounded border-border accent-accent"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text">{s.userId || "—"}</p>
                <p className="text-xs text-text-muted">{s.reason}</p>
              </div>
            </label>
          ))}
          <button
            onClick={addSelected}
            disabled={adding || suggestions.filter((s) => s.selected).length === 0}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {adding ? "Agregando..." : `Agregar seleccionados (${suggestions.filter((s) => s.selected).length})`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Actions Tab ────────────────────────────────────────────────────────────────
function ActionsTab({ meetingId }: { meetingId: string }) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedAction[]>([]);
  const [creating, setCreating] = useState(false);

  async function extract() {
    setLoading(true);
    setSuggestions([]);
    try {
      // extract-actions returns regular JSON, not a stream
      const res = await fetch(`/api/meetings/${meetingId}/ai/extract-actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Error al extraer");
      const data = (await res.json()) as { suggestions: { contentMd: string; suggestedAssignee: string | null; estimatedDueHint: string | null }[] };
      setSuggestions(
        (data.suggestions ?? []).map((s) => ({
          contentMd: s.contentMd,
          assigneeHint: s.suggestedAssignee ?? "",
          selected: true,
        }))
      );
    } catch {
      toast.error("No se pudo extraer acciones");
    } finally {
      setLoading(false);
    }
  }

  async function createSelected() {
    const selected = suggestions.filter((s) => s.selected);
    if (selected.length === 0) return;
    setCreating(true);
    try {
      await Promise.all(
        selected.map((s) =>
          fetch(`/api/meetings/${meetingId}/notes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              noteType: "action_item",
              contentMd: s.contentMd,
            }),
          })
        )
      );
      toast.success(`${selected.length} acciones creadas`);
      setSuggestions([]);
    } catch {
      toast.error("No se pudo crear las acciones");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={extract}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        Extraer acciones de notas
      </button>

      {loading && suggestions.length === 0 && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-text-subtle" />
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions.map((s, idx) => (
            <label
              key={idx}
              className="flex items-start gap-3 p-3 rounded-lg border border-border bg-surface-1 cursor-pointer hover:bg-surface-2 transition-colors"
            >
              <input
                type="checkbox"
                checked={s.selected}
                onChange={(e) => {
                  const updated = [...suggestions];
                  updated[idx] = { ...s, selected: e.target.checked };
                  setSuggestions(updated);
                }}
                className="mt-0.5 rounded border-border accent-accent"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text">{s.contentMd}</p>
                {s.assigneeHint && (
                  <p className="text-xs text-text-subtle mt-0.5">Sugerido: {s.assigneeHint}</p>
                )}
              </div>
            </label>
          ))}
          <button
            onClick={createSelected}
            disabled={creating || suggestions.filter((s) => s.selected).length === 0}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {creating ? "Creando..." : `Crear seleccionadas (${suggestions.filter((s) => s.selected).length})`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Recap Tab ──────────────────────────────────────────────────────────────────
function RecapTab({ meetingId }: { meetingId: string }) {
  const [loading, setLoading] = useState(false);
  const [recapText, setRecapText] = useState("");
  const [saving, setSaving] = useState(false);

  async function generate() {
    setLoading(true);
    setRecapText("");
    try {
      await streamFetch(
        `/api/meetings/${meetingId}/ai/post-recap`,
        {},
        setRecapText
      );
    } catch {
      toast.error("No se pudo generar el recap");
    } finally {
      setLoading(false);
    }
  }

  async function saveRecap() {
    if (!recapText.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recapMd: recapText }),
      });
      if (!res.ok) throw new Error("Error guardando recap");
      toast.success("Recap guardado");
    } catch {
      toast.error("No se pudo guardar el recap");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={generate}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        Generar recap post-meeting
      </button>

      {(recapText || loading) && (
        <div className="space-y-3">
          <textarea
            value={recapText}
            onChange={(e) => setRecapText(e.target.value)}
            rows={10}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-subtle resize-none focus:outline-none focus:border-accent font-mono"
            placeholder="El recap aparecerá aquí..."
          />
          {loading && (
            <p className="text-xs text-text-subtle flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Generando...
            </p>
          )}
          {recapText && !loading && (
            <button
              onClick={saveRecap}
              disabled={saving}
              className="w-full py-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 text-sm font-medium hover:bg-green-500/20 disabled:opacity-50 transition-colors"
            >
              {saving ? "Guardando..." : "Guardar recap"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function MeetingAiAssistant({
  meetingId,
  meeting,
  onAgendaGenerated,
  onBriefingGenerated,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("agenda");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Sparkles className="w-4 h-4 text-accent" />
        <h2 className="text-sm font-semibold text-text">Asistente AI</h2>
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-border overflow-x-auto">
        {(Object.entries(TAB_CONFIG) as [Tab, (typeof TAB_CONFIG)[Tab]][]).map(
          ([tab, cfg]) => {
            const Icon = cfg.icon;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors",
                  activeTab === tab
                    ? "border-accent text-accent"
                    : "border-transparent text-text-muted hover:text-text"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {cfg.label}
              </button>
            );
          }
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "agenda" && (
          <AgendaTab
            meetingId={meetingId}
            meeting={meeting}
            onAgendaGenerated={onAgendaGenerated}
          />
        )}
        {activeTab === "briefing" && (
          <BriefingTab meetingId={meetingId} onBriefingGenerated={onBriefingGenerated} />
        )}
        {activeTab === "attendees" && <AttendeesTab meetingId={meetingId} />}
        {activeTab === "actions" && <ActionsTab meetingId={meetingId} />}
        {activeTab === "recap" && <RecapTab meetingId={meetingId} />}
      </div>
    </div>
  );
}
