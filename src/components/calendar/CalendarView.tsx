"use client";

import { useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import {
  isSameDay,
  parseISO,
  format,
} from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  title: string;
  target_date: string;
  color: string;
  event_type: string;
  is_completed: boolean;
}

interface CalendarComment {
  event_id: string;
  created_at: string;
}

interface CalendarAdjustment {
  event_id: string;
  days_chosen: number;
  created_at: string;
}

interface CalendarViewProps {
  events: CalendarEvent[];
  comments: CalendarComment[];
  adjustments: CalendarAdjustment[];
}

export function CalendarView({
  events,
  comments,
  adjustments,
}: CalendarViewProps) {
  const [month, setMonth] = useState(new Date());

  // Build day-level maps
  const eventsByDay = new Map<string, CalendarEvent[]>();
  const commentsByDay = new Map<string, number>();
  const adjustmentsByDay = new Map<string, number>();

  events.forEach((e) => {
    const key = format(parseISO(e.target_date), "yyyy-MM-dd");
    if (!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key)!.push(e);
  });

  comments.forEach((c) => {
    const key = format(parseISO(c.created_at), "yyyy-MM-dd");
    commentsByDay.set(key, (commentsByDay.get(key) ?? 0) + 1);
  });

  adjustments.forEach((a) => {
    const key = format(parseISO(a.created_at), "yyyy-MM-dd");
    adjustmentsByDay.set(key, (adjustmentsByDay.get(key) ?? 0) + a.days_chosen);
  });

  return (
    <div className="rounded-xl border bg-card p-4">
      <DayPicker
        mode="single"
        month={month}
        onMonthChange={setMonth}
        showOutsideDays
        className="w-full"
        classNames={{
          months: "w-full",
          month: "w-full",
          month_grid: "w-full border-collapse",
          weekdays: "flex",
          weekday: "flex-1 text-center text-xs text-muted-foreground font-medium py-2",
          week: "flex w-full",
          day: "flex-1 text-center relative p-0",
          day_button: "w-full h-16 text-sm p-1 flex flex-col items-center gap-0.5 rounded-md hover:bg-muted cursor-pointer",
          today: "bg-accent",
          outside: "opacity-40",
          selected: "bg-primary text-primary-foreground",
        }}
        components={{
          Day: ({ day }) => {
            const date = day.date;
            const key = format(date, "yyyy-MM-dd");
            const dayEvents = eventsByDay.get(key) ?? [];
            const commentCount = commentsByDay.get(key) ?? 0;
            const daysAdj = adjustmentsByDay.get(key) ?? 0;
            const isCurrentMonth = !day.outside;

            const cell = (
              <div
                className={cn(
                  "w-full h-16 text-sm p-1 flex flex-col items-start gap-0.5 rounded-md hover:bg-muted cursor-default",
                  !isCurrentMonth && "opacity-40",
                  isSameDay(date, new Date()) && "bg-accent"
                )}
              >
                <span className="text-xs font-medium self-center">
                  {format(date, "d")}
                </span>
                {/* Event dots */}
                <div className="flex flex-wrap gap-0.5 justify-center w-full">
                  {dayEvents.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: e.color }}
                    />
                  ))}
                </div>
                {/* Adjustment marker */}
                {daysAdj > 0 && (
                  <span className="text-[9px] text-destructive font-medium self-center">
                    -{daysAdj}d
                  </span>
                )}
                {/* Comment count */}
                {commentCount > 0 && (
                  <span className="text-[9px] text-muted-foreground self-center">
                    {commentCount} 💬
                  </span>
                )}
              </div>
            );

            if (dayEvents.length === 0 && commentCount === 0 && daysAdj === 0) {
              return cell;
            }

            return (
              <Popover>
                <PopoverTrigger asChild>{cell}</PopoverTrigger>
                <PopoverContent className="w-64 p-3 space-y-2" align="center">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {format(date, "MMMM d, yyyy")}
                  </p>
                  {dayEvents.map((e) => (
                    <a
                      key={e.id}
                      href={`/events/${e.id}`}
                      className="flex items-center gap-2 text-sm hover:underline"
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: e.color }}
                      />
                      {e.title}
                      {e.is_completed && (
                        <Badge variant="secondary" className="ml-auto text-[10px] px-1">done</Badge>
                      )}
                    </a>
                  ))}
                  {commentCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {commentCount} comment{commentCount > 1 ? "s" : ""}
                    </p>
                  )}
                  {daysAdj > 0 && (
                    <p className="text-xs text-destructive font-medium">
                      -{daysAdj} days advanced
                    </p>
                  )}
                </PopoverContent>
              </Popover>
            );
          },
        }}
      />
    </div>
  );
}
