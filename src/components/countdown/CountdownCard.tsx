"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountdownTimer } from "./CountdownTimer";
import { EVENT_TYPE_LABELS, formatDate } from "@/lib/utils/formatters";
import type { Database } from "@/lib/supabase/types";
import { Users, Calendar } from "lucide-react";

type Event = Database["public"]["Tables"]["events"]["Row"] & {
  group_name?: string;
};

interface CountdownCardProps {
  event: Event;
}

const typeColors: Record<string, string> = {
  set_date: "bg-blue-500/10 text-blue-600 border-blue-200",
  linked: "bg-purple-500/10 text-purple-600 border-purple-200",
  mutable: "bg-amber-500/10 text-amber-600 border-amber-200",
};

export function CountdownCard({ event }: CountdownCardProps) {
  return (
    <Link href={`/events/${event.id}`} className="block">
      <Card
        className="transition-shadow hover:shadow-md"
        style={{ borderLeftColor: event.color, borderLeftWidth: 4 }}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-tight line-clamp-2">
              {event.title}
            </CardTitle>
            <Badge
              variant="outline"
              className={`shrink-0 text-xs ${typeColors[event.event_type]}`}
            >
              {EVENT_TYPE_LABELS[event.event_type]}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(event.target_date)}
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
