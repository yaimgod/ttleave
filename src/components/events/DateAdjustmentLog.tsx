"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/query/keys";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils/formatters";

interface DateAdjustmentLogProps {
  eventId: string;
}

export function DateAdjustmentLog({ eventId }: DateAdjustmentLogProps) {
  const { data: adjustments, isLoading } = useQuery({
    queryKey: queryKeys.adjustments.byEvent(eventId),
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("date_adjustments")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!adjustments?.length) {
    return (
      <p className="text-sm text-muted-foreground">No date adjustments yet.</p>
    );
  }

  return (
    <ScrollArea className="h-48">
      <div className="space-y-2 pr-3">
        {adjustments.map((adj) => (
          <div
            key={adj.id}
            className="flex items-start justify-between gap-3 rounded-md border p-2.5 text-sm"
          >
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs text-muted-foreground mb-0.5">
                {formatDate(adj.created_at)}
              </p>
              <p className="leading-snug line-clamp-2">{adj.reason_text}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge variant="destructive" className="text-xs px-1.5 py-0">
                -{adj.days_chosen}d
              </Badge>
              {adj.days_suggested !== adj.days_chosen && (
                <span className="text-[10px] text-muted-foreground">
                  suggested {adj.days_suggested}d
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
