"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Link2, Lock } from "lucide-react";
import { formatDate } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";

interface ChainEvent {
  id: string;
  title: string;
  target_date: string;
  color: string;
  is_completed: boolean;
  link_type?: "relative" | "absolute";
  offset_days?: number | null;
}

interface ChainVisualizerProps {
  events: ChainEvent[];
  activeIndex?: number;
}

export function ChainVisualizer({ events, activeIndex = 0 }: ChainVisualizerProps) {
  return (
    <div className="flex flex-col gap-0 overflow-x-auto">
      <div className="flex items-stretch gap-0 min-w-max">
        {events.map((event, idx) => (
          <div key={event.id} className="flex items-center">
            {/* Event node */}
            <Link
              href={`/events/${event.id}`}
              className={cn(
                "flex flex-col gap-1.5 rounded-xl border p-4 w-44 transition-shadow hover:shadow-md",
                event.is_completed
                  ? "bg-muted opacity-60"
                  : idx === activeIndex
                  ? "ring-2 ring-primary bg-card"
                  : "bg-card"
              )}
              style={{ borderLeftColor: event.color, borderLeftWidth: 3 }}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                {event.is_completed ? (
                  <Badge variant="secondary" className="text-[10px] px-1">done</Badge>
                ) : idx === activeIndex ? (
                  <Badge className="text-[10px] px-1">active</Badge>
                ) : (
                  <Lock className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
              <p className="text-sm font-medium leading-tight line-clamp-2">
                {event.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(event.target_date)}
              </p>
            </Link>

            {/* Arrow connector */}
            {idx < events.length - 1 && (
              <div className="flex flex-col items-center px-2 shrink-0">
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                {events[idx + 1].link_type && (
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-0.5">
                    <Link2 className="h-2.5 w-2.5" />
                    {events[idx + 1].link_type === "relative"
                      ? `+${events[idx + 1].offset_days ?? "?"}d`
                      : "fixed"}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
