import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CountdownTimer } from "@/components/countdown/CountdownTimer";
import { CommentFeed } from "@/components/events/CommentFeed";
import { MutableEventInput } from "@/components/events/MutableEventInput";
import { DateAdjustmentLog } from "@/components/events/DateAdjustmentLog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  EVENT_TYPE_LABELS,
  PERMISSION_LABELS,
  formatDate,
} from "@/lib/utils/formatters";
import {
  ArrowLeft,
  Pencil,
  BarChart2,
  Calendar,
} from "lucide-react";
import Link from "next/link";

export async function generateMetadata({
  params,
}: {
  params: { eventId: string };
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("title")
    .eq("id", params.eventId)
    .single();
  return { title: data?.title ?? "Event" };
}

export default async function EventDetailPage({
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
    .select("*, groups(name)")
    .eq("id", params.eventId)
    .single();

  if (!event) notFound();

  const isOwner = event.owner_id === user!.id;
  const canComment =
    isOwner ||
    event.member_permissions === "view_comment" ||
    event.member_permissions === "can_adjust";
  const canAdjust = isOwner || event.member_permissions === "can_adjust";

  return (
    <div className="container max-w-3xl py-6 px-4">
      <Link
        href="/events"
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to events
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start gap-3">
        <div
          className="mt-1 h-4 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: event.color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">{event.title}</h1>
            <Badge variant="outline" className="text-xs">
              {EVENT_TYPE_LABELS[event.event_type]}
            </Badge>
            {event.is_completed && (
              <Badge variant="secondary">Completed</Badge>
            )}
          </div>
          {event.description && (
            <p className="text-muted-foreground text-sm">{event.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Target: {formatDate(event.target_date)}
            </span>
            {event.groups && (
              <span>
                Group: {(event.groups as { name: string }).name}
              </span>
            )}
            {event.group_id && (
              <span>Permissions: {PERMISSION_LABELS[event.member_permissions]}</span>
            )}
          </div>
        </div>

        {isOwner && (
          <div className="flex gap-2 shrink-0">
            {event.event_type === "mutable" && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/events/${event.id}/stats`}>
                  <BarChart2 className="h-4 w-4" />
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/events/${event.id}/edit`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Countdown */}
      {!event.is_completed && (
        <div className="mb-8 rounded-xl border bg-card p-6 flex justify-center">
          <CountdownTimer
            eventId={event.id}
            targetDate={event.target_date}
            size="lg"
          />
        </div>
      )}

      <Separator className="mb-6" />

      {/* Mutable event input */}
      {event.event_type === "mutable" && !event.is_completed && canAdjust && (
        <div className="mb-8">
          <h2 className="mb-3 font-semibold">Log a boss event</h2>
          <MutableEventInput eventId={event.id} />
        </div>
      )}

      {/* Date adjustment log (for mutable) */}
      {event.event_type === "mutable" && (
        <div className="mb-8">
          <h2 className="mb-3 font-semibold">Date adjustments</h2>
          <DateAdjustmentLog eventId={event.id} />
        </div>
      )}

      {/* Comments */}
      <CommentFeed eventId={event.id} canComment={canComment} />
    </div>
  );
}
