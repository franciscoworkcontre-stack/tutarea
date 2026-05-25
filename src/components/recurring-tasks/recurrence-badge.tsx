"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type Frequency = "daily" | "weekly" | "monthly" | "yearly";

const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: "Diaria",
  weekly: "Semanal",
  monthly: "Mensual",
  yearly: "Anual",
};

type Props = {
  frequency: Frequency;
  nextOccurrenceAt?: Date | string | null;
  isActive?: boolean;
};

export default function RecurrenceBadge({
  frequency,
  nextOccurrenceAt,
  isActive = true,
}: Props) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!isActive) return null;

  const nextDate = nextOccurrenceAt ? new Date(nextOccurrenceAt) : null;

  const tooltipText = nextDate
    ? `Próxima ocurrencia: ${format(nextDate, "d MMM yyyy", { locale: es })}`
    : "Tarea recurrente";

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20 cursor-default select-none">
        <RefreshCw className="w-3 h-3" aria-hidden="true" />
        {FREQUENCY_LABELS[frequency]}
      </span>

      {showTooltip && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded-md whitespace-nowrap shadow-lg pointer-events-none"
        >
          {tooltipText}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}
