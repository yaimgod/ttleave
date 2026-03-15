import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { CalendarView } from "@/components/calendar/CalendarView";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type CalendarEvent = Pick<
  EventRow,
  "id" | "title" | "target_date" | "color" | "event_type" | "is_completed"
>;

export const metadata = { title: "Calendar — TTLeave" };

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: eventsData } = await supabase
    .from("events")
    .select("id, title, target_date, color, event_type, is_completed")
    .eq("owner_id", user.id)
    .order("target_date");

  const events = (eventsData ?? []) as CalendarEvent[];
  const eventIds = events.map((e) => e.id);

  const { data: comments } = await supabase
    .from("event_comments")
    .select("event_id, created_at")
    .in("event_id", eventIds);

  const { data: adjustments } = await supabase
    .from("date_adjustments")
    .select("event_id, days_chosen, created_at")
    .in("event_id", eventIds);

  return (
    <div className="container max-w-4xl py-6 px-4">
      <h1 className="mb-6 text-2xl font-bold">Calendar</h1>
      <CalendarView
        events={events}
        comments={comments ?? []}
        adjustments={adjustments ?? []}
      />
    </div>
  );
}
