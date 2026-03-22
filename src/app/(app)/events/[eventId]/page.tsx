import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { CountdownTimer } from "@/components/countdown/CountdownTimer";
import { EventHistory } from "@/components/events/EventHistory";
import { MutableEventInput } from "@/components/events/MutableEventInput";
import { ShareToGroupButton } from "@/components/events/ShareToGroupButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Users,
  Lock,
} from "lucide-react";
import Link from "next/link";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type EventWithGroup = EventRow & { groups: { name: string } | null };

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
  const row = data as { title?: string } | null;
  return { title: row?.title ?? "Event" };
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

  if (!user) notFound();

  const { data: eventData } = await supabase
    .from("events")
    .select("*, groups(name)")
    .eq("id", params.eventId)
    .single();

  if (!eventData) notFound();

  const event = eventData as EventWithGroup;

  type GroupMembership = { groups: { id: string; name: string } | null };
  const { data: groupsData } = await supabase
    .from("group_members")
    .select("groups(id, name)")
    .eq("user_id", user.id);
  const userGroups = ((groupsData ?? []) as GroupMembership[])
    .map((m) => m.groups)
    .filter((g): g is { id: string; name: string } => g !== null);

  const isOwner = event.owner_id === user.id;
  const canComment =
    isOwner ||
    event.member_permissions === "view_comment" ||
    event.member_permissions === "can_adjust";
  const canAdjust = isOwner || event.member_permissions === "can_adjust";
  const isMutable = event.event_type === "mutable";

  return (
    <div className="container max-w-3xl py-4 px-4 space-y-4">

      {/* ── Back nav ── */}
      <Link
        href="/events"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Events
      </Link>

      {/* ── Header card ── */}
      <div className="rounded-xl border bg-card px-4 py-3 flex items-start gap-3">
        <div
          className="mt-1.5 h-10 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: event.color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold leading-tight">{event.title}</h1>
            <Badge variant="outline" className="text-xs">
              {EVENT_TYPE_LABELS[event.event_type]}
            </Badge>
            {event.is_completed && (
              <Badge variant="secondary" className="text-xs">Completed</Badge>
            )}
          </div>
          {event.description && (
            <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
              {event.description}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(event.target_date)}
            </span>
            {event.groups && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {(event.groups as { name: string }).name}
              </span>
            )}
            {event.group_id && (
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                {PERMISSION_LABELS[event.member_permissions]}
              </span>
            )}
          </div>
        </div>

        {isOwner && (
          <div className="flex gap-1 shrink-0">
            <ShareToGroupButton
              eventId={event.id}
              currentGroupId={event.group_id}
              currentGroupName={event.groups ? (event.groups as { name: string }).name : null}
              groups={userGroups}
            />
            {isMutable && (
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <Link href={`/events/${event.id}/stats`}>
                  <BarChart2 className="h-4 w-4" />
                </Link>
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href={`/events/${event.id}/edit`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* ── Countdown ── */}
      {!event.is_completed && (
        <div className="rounded-xl border bg-card py-5 flex justify-center">
          <CountdownTimer
            eventId={event.id}
            targetDate={event.target_date}
            size="lg"
          />
        </div>
      )}

      {/* ── Mutable: date-change request ── */}
      {isMutable && !event.is_completed && canAdjust && (
        <div className="rounded-xl border bg-card px-4 py-3">
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
            Request a date change
          </h2>
          <MutableEventInput eventId={event.id} />
        </div>
      )}

      {/* ── Unified history: date changes + comments ── */}
      <EventHistory
        eventId={event.id}
        canComment={canComment}
        isMutable={isMutable}
      />

    </div>
  );
}
