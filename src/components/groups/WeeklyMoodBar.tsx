"use client";

import { format, subDays, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

interface MoodEntry {
  created_at: string;
  vad_v: number | null;
}

interface Props {
  adjustments: MoodEntry[];
}

export function WeeklyMoodBar({ adjustments }: Props) {
  // Build last 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = startOfDay(subDays(new Date(), 6 - i));
    const key = format(date, "yyyy-MM-dd");
    const label = format(date, "EEE");
    const entries = adjustments.filter(
      (a) =>
        a.vad_v !== null &&
        format(startOfDay(new Date(a.created_at)), "yyyy-MM-dd") === key
    );
    const avg =
      entries.length > 0
        ? entries.reduce((sum, e) => sum + (e.vad_v ?? 0), 0) / entries.length
        : null;
    return { label, avg, count: entries.length };
  });

  const hasAnyData = days.some((d) => d.avg !== null);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 h-14">
        {days.map(({ label, avg, count }, i) => {
          const isEmpty = avg === null;
          // avg in [-1, 1]; map to bar height 10-100%
          const height = isEmpty ? 20 : Math.round(((Math.abs(avg) * 0.8) + 0.1) * 100);
          // green = positive, red = negative, grey = no data
          const barColor = isEmpty
            ? "bg-muted"
            : avg > 0.1
            ? "bg-green-400"
            : avg < -0.1
            ? "bg-red-400"
            : "bg-yellow-400";

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                title={
                  isEmpty
                    ? "No data"
                    : `Avg mood: ${avg.toFixed(2)} (${count} entry${count !== 1 ? "ies" : "y"})`
                }
                className={cn(
                  "w-full rounded-t transition-all",
                  barColor
                )}
                style={{ height: `${height}%` }}
              />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          );
        })}
      </div>
      {!hasAnyData && (
        <p className="text-xs text-muted-foreground text-center">
          No mood data yet — mood adjustments on events will appear here.
        </p>
      )}
      <div className="flex items-center justify-end gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-400 inline-block" /> Positive</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-400 inline-block" /> Neutral</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400 inline-block" /> Stressed</span>
      </div>
    </div>
  );
}
