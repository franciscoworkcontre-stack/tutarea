"use client";

interface CapacityBarProps {
  percent: number;
  showLabel?: boolean;
}

function getCapacityColor(percent: number): string {
  if (percent >= 80) return "bg-red-500";
  if (percent >= 60) return "bg-yellow-500";
  return "bg-green-500";
}

function getCapacityTextColor(percent: number): string {
  if (percent >= 80) return "text-red-600";
  if (percent >= 60) return "text-yellow-600";
  return "text-green-600";
}

export default function CapacityBar({ percent, showLabel = true }: CapacityBarProps) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  const barColor = getCapacityColor(clamped);
  const textColor = getCapacityTextColor(clamped);

  return (
    <div className="space-y-1">
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-subtle">Capacidad</span>
          <span className={`font-medium ${textColor}`}>{Math.round(clamped)}%</span>
        </div>
      )}
      <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
