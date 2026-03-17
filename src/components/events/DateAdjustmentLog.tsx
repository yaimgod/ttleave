"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { queryKeys } from "@/lib/query/keys";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils/formatters";

type DateAdjustmentRow = Database["public"]["Tables"]["date_adjustments"]["Row"];

interface DateAdjustmentLogProps {
  eventId: string;
}

export function DateAdjustmentLog({ eventId }: DateAdjustmentLogProps) {
  const { data: adjustments, isLoading } = useQuery({
    queryKey: queryKeys.adjustments.byEvent(eventId),
    queryFn: async (): Promise<DateAdjustmentRow[]> => {
      const supabase = createClient();
      const { data } = await supabase
        .from("date_adjustments")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      return (data ?? []) as DateAdjustmentRow[];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (!adjustments?.length) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No date changes yet.
      </p>
    );
  }

  return (
    <div className="space-y-2 overflow-y-auto max-h-72 pr-1">
      {adjustments.map((adj) => (
        <div
          key={adj.id}
          className="rounded-md border bg-muted/30 px-3 py-2 text-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="leading-snug line-clamp-2 flex-1 min-w-0">
              {adj.reason_text}
            </p>
            <Badge variant="destructive" className="text-xs px-1.5 shrink-0">
              -{adj.days_chosen}d
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{formatDate(adj.created_at)}</span>
            {adj.days_suggested !== adj.days_chosen && (
              <span className="opacity-70">
                · suggested {adj.days_suggested}d
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
