import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { CountdownCard } from "@/components/countdown/CountdownCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Timer, Plus } from "lucide-react";
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

  const { data } = await supabase
    .from("events")
    .select("*, groups(name)")
    .eq("owner_id", user.id)
    .eq("is_completed", false)
    .order("target_date", { ascending: true })
    .limit(20);

  const activeEvents = (data ?? []) as EventWithGroup[];

  return (
    <div className="container max-w-5xl py-6 px-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Your active countdowns
          </p>
        </div>
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/events/new">
            <Plus className="h-4 w-4" />
            New event
          </Link>
        </Button>
      </div>

      {activeEvents.length === 0 ? (
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
          {activeEvents.map((event) => (
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
