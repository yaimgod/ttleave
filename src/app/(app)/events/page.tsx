import { createClient } from "@/lib/supabase/server";
import { CountdownCard } from "@/components/countdown/CountdownCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { List, Plus } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Events — TTLeave" };

export default async function EventsPage({
  searchParams,
}: {
  searchParams: { type?: string; completed?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("events")
    .select("*, groups(name)")
    .eq("owner_id", user!.id)
    .order("target_date", { ascending: true });

  if (searchParams.type) query = query.eq("event_type", searchParams.type);
  if (searchParams.completed !== undefined) {
    query = query.eq("is_completed", searchParams.completed === "true");
  }

  const { data: events } = await query;
  const allEvents = events ?? [];

  return (
    <div className="container max-w-5xl py-6 px-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Events</h1>
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/events/new">
            <Plus className="h-4 w-4" />
            New event
          </Link>
        </Button>
      </div>

      {/* Filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/events">
          <Badge
            variant={!searchParams.type && !searchParams.completed ? "default" : "outline"}
          >
            All
          </Badge>
        </Link>
        <Link href="/events?type=set_date">
          <Badge variant={searchParams.type === "set_date" ? "default" : "outline"}>
            Fixed Date
          </Badge>
        </Link>
        <Link href="/events?type=mutable">
          <Badge variant={searchParams.type === "mutable" ? "default" : "outline"}>
            Dynamic
          </Badge>
        </Link>
        <Link href="/events?type=linked">
          <Badge variant={searchParams.type === "linked" ? "default" : "outline"}>
            Linked
          </Badge>
        </Link>
        <Link href="/events?completed=true">
          <Badge variant={searchParams.completed === "true" ? "default" : "outline"}>
            Completed
          </Badge>
        </Link>
      </div>

      {allEvents.length === 0 ? (
        <EmptyState
          icon={List}
          title="No events found"
          description="Create a countdown to get started."
          action={
            <Button asChild>
              <Link href="/events/new">Create event</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allEvents.map((event) => (
            <CountdownCard
              key={event.id}
              event={{
                ...event,
                group_name: (event.groups as { name: string } | null)?.name,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
