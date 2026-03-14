import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds,
  isPast,
  formatDistanceToNow,
} from "date-fns";

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isExpired: boolean;
}

/**
 * Decompose a target date into countdown parts.
 * Computed client-side on every tick.
 */
export function getCountdownParts(targetDate: Date | string): CountdownParts {
  const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate;
  const now = new Date();

  if (isPast(target)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, isExpired: true };
  }

  const totalSeconds = differenceInSeconds(target, now);
  const days = differenceInDays(target, now);
  const hours = differenceInHours(target, now) % 24;
  const minutes = differenceInMinutes(target, now) % 60;
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, totalSeconds, isExpired: false };
}

/**
 * Human-readable relative time string (e.g. "in 3 days").
 */
export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Pad a number to two digits.
 */
export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
