"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountdownTimer } from "./CountdownTimer";
import { FavoriteButton } from "./FavoriteButton";
import { EVENT_TYPE_LABELS, formatDate } from "@/lib/utils/formatters";
import type { Database } from "@/lib/supabase/types";
import { Users, Calendar } from "lucide-react";

type Event = Database["public"]["Tables"]["events"]["Row"] & {
  group_name?: string;
  start_date?: string | null;
};

interface CountdownCardProps {
  event: Event;
  /** If provided, appended as ?back=<backHref> so the detail page knows where to return */
  backHref?: string;
  isFavorited?: boolean;
}

const typeColors: Record<string, string> = {
  set_date: "bg-blue-500/10 text-blue-600 border-blue-200",
  linked: "bg-purple-500/10 text-purple-600 border-purple-200",
  mutable: "bg-amber-500/10 text-amber-600 border-amber-200",
};

export function CountdownCard({ event, backHref, isFavorited }: CountdownCardProps) {
  const href = backHref
    ? `/events/${event.id}?back=${encodeURIComponent(backHref)}`
    : `/events/${event.id}`;
  return (
    <Link href={href} className="block">
      <Card
        className="transition-shadow hover:shadow-md"
        style={{ borderLeftColor: event.color, borderLeftWidth: 4 }}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-tight line-clamp-2">
              {event.title}
            </CardTitle>
            <div className="flex items-center gap-1 shrink-0">
              {isFavorited !== undefined && (
                <FavoriteButton eventId={event.id} initialFavorited={isFavorited} />
              )}
              <Badge
                variant="outline"
                className={`text-xs ${typeColors[event.event_type]}`}
              >
                {EVENT_TYPE_LABELS[event.event_type]}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {event.start_date
                ? `${formatDate(event.start_date)} – ${formatDate(event.target_date)}`
                : formatDate(event.target_date)}
            </span>
            {event.group_name && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {event.group_name}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {event.is_completed ? (
            <p className="text-sm text-muted-foreground">Completed</p>
          ) : (
            <CountdownTimer
              eventId={event.id}
              targetDate={event.target_date}
              size="md"
            />
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
