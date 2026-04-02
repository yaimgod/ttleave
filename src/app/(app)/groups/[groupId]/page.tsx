import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { CountdownCard } from "@/components/countdown/CountdownCard";
import { WeeklyMoodBar } from "@/components/groups/WeeklyMoodBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/EmptyState";
import { Settings, Timer, BarChart2 } from "lucide-react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type GroupRow = Database["public"]["Tables"]["groups"]["Row"];
type GroupMemberWithProfile = {
  role: string;
  notifications_enabled: boolean;
  profiles: { id: string; full_name: string | null; email: string; avatar_url: string | null } | null;
};
type GroupWithMembers = GroupRow & { group_members: GroupMemberWithProfile[] };
type EventRow = Database["public"]["Tables"]["events"]["Row"];

export async function generateMetadata({
  params,
}: {
  params: { groupId: string };
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("groups")
    .select("name")
    .eq("id", params.groupId)
    .single();
  const row = data as { name?: string } | null;
  return { title: row?.name ?? "Group" };
}

export default async function GroupDetailPage({
  params,
}: {
  params: { groupId: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: groupData } = await supabase
    .from("groups")
    .select(
      "*, group_members(role, notifications_enabled, profiles(id, full_name, email, avatar_url))"
    )
    .eq("id", params.groupId)
    .single();

  if (!groupData) notFound();

  const group = groupData as unknown as GroupWithMembers;
  const userMembership = group.group_members.find((m) => m.profiles?.id === user.id);
  if (!userMembership) notFound();

  // Fetch group events
  const { data: eventsData } = await supabase
    .from("events")
    .select("*")
    .eq("group_id", params.groupId)
    .eq("is_completed", false)
    .order("target_date");

  const events = (eventsData ?? []) as EventRow[];
  const eventIds = events.map((e) => e.id);

  // Favourites
  const { data: favData } = eventIds.length
    ? await supabase
        .from("event_favorites")
        .select("event_id")
        .eq("user_id", user.id)
        .in("event_id", eventIds)
    : { data: [] };
  const favoritedIds = new Set(
    (favData ?? []).map((f) => (f as { event_id: string }).event_id)
  );

  // Weekly mood data (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const { data: moodData } = eventIds.length
    ? await supabase
        .from("date_adjustments")
        .select("created_at, vad_v")
        .in("event_id", eventIds)
        .gte("created_at", sevenDaysAgo.toISOString())
    : { data: [] };

  const moodAdjustments = (moodData ?? []) as { created_at: string; vad_v: number | null }[];

  return (
    <div className="container max-w-4xl py-6 px-4">
      <Link
        href="/groups"
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to groups
      </Link>

      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          {group.description && (
            <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
          )}
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/groups/${group.id}/settings`} className="gap-1.5">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </Button>
      </div>

      <Separator className="mb-6" />

      {/* Weekly mood */}
      <section className="mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart2 className="h-4 w-4" />
              Team mood this week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklyMoodBar adjustments={moodAdjustments} />
          </CardContent>
        </Card>
      </section>

      {/* Shared events */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Timer className="h-4 w-4" />
          Shared countdowns
        </h2>
        {!events?.length ? (
          <EmptyState
            title="No shared countdowns"
            description="Create an event and share it with this group."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <CountdownCard
                key={event.id}
                event={{ ...event, group_name: group.name }}
                backHref={`/groups/${group.id}`}
                isFavorited={favoritedIds.has(event.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
