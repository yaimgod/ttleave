import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatsCard } from "@/components/shared/StatsCard";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ArrowLeft, TrendingDown, CalendarMinus, Zap } from "lucide-react";
import Link from "next/link";
import { formatDate, formatShortDate } from "@/lib/utils/formatters";
import { differenceInDays, parseISO } from "date-fns";

export const metadata = { title: "Event Stats — TTLeave" };

export default async function EventStatsPage({
  params,
}: {
  params: { eventId: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", params.eventId)
    .eq("owner_id", user!.id)
    .single();

  if (!event || event.event_type !== "mutable") notFound();

  const { data: adjustments } = await supabase
    .from("date_adjustments")
    .select("*")
    .eq("event_id", params.eventId)
    .order("created_at", { ascending: true });

  const allAdj = adjustments ?? [];

  const totalDaysReduced = allAdj.reduce((sum, a) => sum + a.days_chosen, 0);
  const originalDuration = differenceInDays(
    parseISO(event.target_date),
    parseISO(event.created_at)
  );
  const currentDuration = differenceInDays(
    parseISO(event.target_date),
    new Date()
  );

  // Build drift chart data (running total of days reduced over time)
  let running = 0;
  const chartData = allAdj.map((a) => {
    running += a.days_chosen;
    return {
      date: formatShortDate(a.created_at),
      daysReduced: running,
      score: a.sentiment_score,
    };
  });

  return (
    <div className="container max-w-4xl py-6 px-4">
      <Link
        href={`/events/${event.id}`}
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to event
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <p className="text-sm text-muted-foreground">
          Dynamic event statistics
        </p>
      </div>

      {/* Summary stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatsCard
          title="Total days advanced"
          value={totalDaysReduced}
          icon={TrendingDown}
          description={`From ${formatDate(event.original_target_date)}`}
        />
        <StatsCard
          title="Adjustments made"
          value={allAdj.length}
          icon={CalendarMinus}
          description="Boss events logged"
        />
        <StatsCard
          title="Avg stress score"
          value={
            allAdj.length > 0
              ? Math.round(
                  allAdj.reduce((s, a) => s + a.sentiment_score, 0) /
                    allAdj.length
                )
              : "—"
          }
          icon={Zap}
          description="Out of 100"
        />
      </div>

      {/* Drift chart */}
      {chartData.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Cumulative days advanced</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="daysReduced"
                  name="Days advanced"
                  stroke="#6366f1"
                  fill="#6366f120"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Adjustment table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adjustment history</CardTitle>
        </CardHeader>
        <CardContent>
          {allAdj.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No adjustments yet.
            </p>
          ) : (
            <div className="space-y-2">
              {allAdj
                .slice()
                .reverse()
                .map((adj) => (
                  <div
                    key={adj.id}
                    className="flex items-start justify-between gap-3 rounded-md border p-3 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-0.5">
                        {formatDate(adj.created_at, "PPp")}
                      </p>
                      <p className="leading-snug">{adj.reason_text}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="destructive" className="text-xs">
                        -{adj.days_chosen}d
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        score {adj.sentiment_score}/100
                      </span>
                      {adj.days_suggested !== adj.days_chosen && (
                        <span className="text-[10px] text-muted-foreground">
                          suggested {adj.days_suggested}d
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
