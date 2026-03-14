import { format, parseISO } from "date-fns";

export function formatDate(date: string | Date, fmt = "PPP"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, fmt);
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "PPp");
}

export function formatShortDate(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMM d");
}

export function pluralize(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export const EVENT_TYPE_LABELS = {
  set_date: "Fixed Date",
  linked: "Linked",
  mutable: "Dynamic",
} as const;

export const PERMISSION_LABELS = {
  view_only: "View only",
  view_comment: "View & comment",
  can_adjust: "Can adjust dates",
} as const;
