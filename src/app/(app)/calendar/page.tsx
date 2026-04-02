import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { CalendarView } from "@/components/calendar/CalendarView";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type CalendarEvent = Pick<
  EventRow,
  "id" | "title" | "target_date" | "color" | "event_type" | "is_completed"
> & { start_date?: string | null; group_name?: string; display_color?: string };

export const metadata = { title: "Calendar — TTLeave" };

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Own events
  const { data: eventsData } = await supabase
    .from("events")
    .select("id, title, target_date, start_date, color, event_type, is_completed")
    .eq("owner_id", user.id)
    .order("target_date");

  const ownEvents = (eventsData ?? []) as CalendarEvent[];
  const ownEventIds = ownEvents.map((e) => e.id);

  // Groups user is in + their member colors
  const { data: myMembershipsRaw } = await supabase
    .from("group_members")
    .select("group_id, member_color")
    .eq("user_id", user.id);

  const myMemberships = (myMembershipsRaw ?? []) as { group_id: string; member_color: string }[];
  const groupIds = myMemberships.map((m) => m.group_id);

  // All member colors for those groups (to color-code event owners)
  const { data: allMembersRaw } = groupIds.length
    ? await supabase
        .from("group_members")
        .select("group_id, user_id, member_color")
        .in("group_id", groupIds)
    : { data: [] };

  const memberColorMap = new Map<string, string>();
  (allMembersRaw ?? []).forEach((m: { group_id: string; user_id: string; member_color: string }) => {
    memberColorMap.set(`${m.group_id}:${m.user_id}`, m.member_color);
  });

  // Group events not owned by user
  const { data: groupEventsRaw } = groupIds.length
    ? await supabase
        .from("events")
        .select("id, title, target_date, start_date, color, event_type, is_completed, owner_id, group_id, groups(name)")
        .in("group_id", groupIds)
        .neq("owner_id", user.id)
        .eq("is_completed", false)
        .order("target_date")
    : { data: [] };

  const groupEvents: CalendarEvent[] = (groupEventsRaw ?? []).map((e: {
    id: string; title: string; target_date: string; start_date?: string | null;
    color: string; event_type: "set_date" | "linked" | "mutable"; is_completed: boolean;
    owner_id: string; group_id: string; groups: { name: string } | null;
  }) => ({
    id: e.id,
    title: e.title,
    target_date: e.target_date,
    start_date: e.start_date,
    color: e.color,
    event_type: e.event_type,
    is_completed: e.is_completed,
    group_name: e.groups?.name,
    display_color: memberColorMap.get(`${e.group_id}:${e.owner_id}`) ?? e.color,
  }));

  const allEvents = [...ownEvents, ...groupEvents];
  const allEventIds = allEvents.map((e) => e.id);

  const { data: comments } = await supabase
    .from("event_comments")
    .select("event_id, created_at")
    .in("event_id", allEventIds);

  const { data: adjustments } = await supabase
    .from("date_adjustments")
    .select("event_id, days_chosen, created_at")
    .in("event_id", ownEventIds); // adjustments only on own events

  // Legend: member name → color for the calendar
  const { data: memberProfilesRaw } = groupIds.length
    ? await supabase
        .from("group_members")
        .select("user_id, member_color, profiles(full_name, email)")
        .in("group_id", groupIds)
        .neq("user_id", user.id)
    : { data: [] };

  type MemberLegendEntry = { name: string; color: string };
  const legendMap = new Map<string, MemberLegendEntry>();
  (memberProfilesRaw ?? []).forEach((m: {
    user_id: string; member_color: string;
    profiles: { full_name: string | null; email: string } | null;
  }) => {
    if (!legendMap.has(m.user_id)) {
      legendMap.set(m.user_id, {
        color: m.member_color,
        name: m.profiles?.full_name ?? m.profiles?.email ?? "Member",
      });
    }
  });
  const legend = Array.from(legendMap.values());

  return (
    <div className="container max-w-4xl py-6 px-4">
      <h1 className="mb-6 text-2xl font-bold">Calendar</h1>
      <CalendarView
        events={allEvents}
        comments={comments ?? []}
        adjustments={adjustments ?? []}
        legend={legend}
      />
    </div>
  );
}
