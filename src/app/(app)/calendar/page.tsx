import { createClient } from "@/lib/supabase/server";
import { CalendarView } from "@/components/calendar/CalendarView";

export const metadata = { title: "Calendar — TTLeave" };

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch all events with comments and adjustments for the calendar
  const { data: events } = await supabase
    .from("events")
    .select("id, title, target_date, color, event_type, is_completed")
    .eq("owner_id", user!.id)
    .order("target_date");

  const { data: comments } = await supabase
    .from("event_comments")
    .select("event_id, created_at")
    .in("event_id", (events ?? []).map((e) => e.id));

  const { data: adjustments } = await supabase
    .from("date_adjustments")
    .select("event_id, days_chosen, created_at")
    .in("event_id", (events ?? []).map((e) => e.id));

  return (
    <div className="container max-w-4xl py-6 px-4">
      <h1 className="mb-6 text-2xl font-bold">Calendar</h1>
      <CalendarView
        events={events ?? []}
        comments={comments ?? []}
        adjustments={adjustments ?? []}
      />
    </div>
  );
}
