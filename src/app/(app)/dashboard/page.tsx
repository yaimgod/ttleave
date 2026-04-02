import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { CountdownCard } from "@/components/countdown/CountdownCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Timer, Plus, Star } from "lucide-react";
import Link from "next/link";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type EventWithGroup = EventRow & { groups: { name: string } | null };

export const metadata = { title: "Dashboard — TTLeave" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch own active events
  const { data: ownData } = await supabase
    .from("events")
    .select("*, groups(name)")
    .eq("owner_id", user.id)
    .eq("is_completed", false)
    .order("target_date", { ascending: true })
    .limit(20);

  const ownEvents = (ownData ?? []) as EventWithGroup[];

  // Fetch favorited event IDs for the current user
  const { data: favData } = await supabase
    .from("event_favorites")
    .select("event_id")
    .eq("user_id", user.id);

  const favoritedIds = new Set((favData ?? []).map((f) => (f as { event_id: string }).event_id));

  // Fetch favorited group events (not owned by the user)
  const favIds = Array.from(favoritedIds);
  let favGroupEvents: EventWithGroup[] = [];
  if (favIds.length > 0) {
    const { data: favEventsData } = await supabase
      .from("events")
      .select("*, groups(name)")
      .in("id", favIds)
      .neq("owner_id", user.id)
      .eq("is_completed", false)
      .order("target_date", { ascending: true });
    favGroupEvents = (favEventsData ?? []) as EventWithGroup[];
  }

  return (
    <div className="container max-w-5xl py-6 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your active countdowns</p>
        </div>
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/events/new">
            <Plus className="h-4 w-4" />
            New event
          </Link>
        </Button>
      </div>

      {/* Favourites section */}
      {favGroupEvents.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            Favourites
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favGroupEvents.map((event) => (
              <CountdownCard
                key={event.id}
                event={{
                  ...event,
                  group_name: (event.groups as { name: string } | null)?.name,
                }}
                isFavorited={true}
              />
            ))}
          </div>
          <Separator className="mt-8" />
        </section>
      )}

      {/* Own events section */}
      <section>
        {favGroupEvents.length > 0 && (
          <h2 className="mb-3 text-base font-semibold text-muted-foreground">
            Your events
          </h2>
        )}
        {ownEvents.length === 0 ? (
          <EmptyState
            icon={Timer}
            title="No active countdowns"
            description="Create your first countdown to get started."
            action={
              <Button asChild>
                <Link href="/events/new">Create event</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ownEvents.map((event) => (
              <CountdownCard
                key={event.id}
                event={{
                  ...event,
                  group_name: (event.groups as { name: string } | null)?.name,
                }}
                isFavorited={favoritedIds.has(event.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
