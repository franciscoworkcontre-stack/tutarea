"use client";

import { Gavel, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { MeetingNote } from "@/lib/meetings/meeting-types";

type Props = {
  notes: MeetingNote[];
};

function formatTimestamp(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-CL", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function DecisionCard({ note }: { note: MeetingNote }) {
  const [copied, setCopied] = useState(false);

  function copyDecision() {
    navigator.clipboard.writeText(note.contentMd).then(() => {
      setCopied(true);
      toast.success("Decisión copiada al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="group flex items-start gap-3 p-4 rounded-xl border border-border bg-surface-1 hover:border-border-strong transition-colors">
      {/* Icon */}
      <div className="shrink-0 w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mt-0.5">
        <Gavel className="w-4 h-4 text-orange-400" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text leading-relaxed">{note.contentMd}</p>
        <p className="text-xs text-text-subtle mt-1.5">
          {formatTimestamp(note.createdAt)}
        </p>
      </div>

      {/* Share button */}
      <button
        onClick={copyDecision}
        title="Copiar decisión"
        className={cn(
          "shrink-0 p-1.5 rounded-lg border transition-all",
          copied
            ? "text-green-400 border-green-500/20 bg-green-500/10"
            : "text-text-subtle border-transparent hover:border-border hover:bg-surface-2 opacity-0 group-hover:opacity-100"
        )}
      >
        {copied ? (
          <CheckCircle2 className="w-3.5 h-3.5" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

export default function DecisionsList({ notes }: Props) {
  const decisions = notes.filter((n) => n.noteType === "decision");

  if (decisions.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-border rounded-xl">
        <Gavel className="w-8 h-8 text-text-subtle mx-auto mb-2" />
        <p className="text-sm text-text-subtle">Sin decisiones registradas</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Gavel className="w-4 h-4 text-orange-400" />
        <h3 className="text-sm font-semibold text-text">
          Decisiones ({decisions.length})
        </h3>
      </div>
      {decisions.map((note) => (
        <DecisionCard key={note.id} note={note} />
      ))}
    </div>
  );
}
