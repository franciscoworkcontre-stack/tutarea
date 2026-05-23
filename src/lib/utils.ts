import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null, locale = "es-CL"): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatRelativeDate(
  date: Date | string | null,
  locale = "es-CL",
  now?: Date | null
): string {
  if (!date) return "";
  if (!now) return formatDate(typeof date === "string" ? new Date(date) : date, locale);
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days === -1) return "Ayer";
  if (days < 0) return `Hace ${Math.abs(days)} días`;
  return formatDate(d, locale);
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function generateProjectKey(name: string): string {
  const words = name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, "")
    .split(" ")
    .filter(Boolean);

  if (words.length === 1) {
    return (words[0] ?? "PRJ").slice(0, 4);
  }
  return words
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 4);
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase();
}

export function priorityLabel(
  priority: string
): { label: string; color: string } {
  switch (priority) {
    case "urgent":
      return { label: "Urgente", color: "text-red-500" };
    case "high":
      return { label: "Alta", color: "text-orange-500" };
    case "medium":
      return { label: "Media", color: "text-yellow-500" };
    case "low":
      return { label: "Baja", color: "text-blue-400" };
    default:
      return { label: "Sin prioridad", color: "text-text-subtle" };
  }
}

export function greetingByTime(name: string): string {
  const hour = new Date().getHours();
  if (hour < 12) return `Buenos días, ${name}.`;
  if (hour < 18) return `Buenas tardes, ${name}.`;
  return `Buenas noches, ${name}.`;
}

export const spring = {
  type: "spring" as const,
  stiffness: 380,
  damping: 32,
};

export const springFast = {
  type: "spring" as const,
  stiffness: 500,
  damping: 35,
};

export const easeOut = [0.32, 0.72, 0, 1] as const;
