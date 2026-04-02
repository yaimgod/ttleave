import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { CountdownCard } from "@/components/countdown/CountdownCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/EmptyState";
import { Settings, Share2, Timer, Users } from "lucide-react";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GroupInviteCopy } from "./GroupInviteCopy";

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

  const isOwner = userMembership.role === "owner";

  const { data: eventsData } = await supabase
    .from("events")
    .select("*")
    .eq("group_id", params.groupId)
    .eq("is_completed", false)
    .order("target_date");

  const events = (eventsData ?? []) as EventRow[];

  // Fetch user's favourites for these events
  const eventIds = events.map((e) => e.id);
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

  const members = group.group_members;

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
            <p className="mt-1 text-sm text-muted-foreground">
              {group.description}
            </p>
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

      {/* Members */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Users className="h-4 w-4" />
          Members ({members.length})
        </h2>
        <div className="flex flex-wrap gap-3">
          {members.map((m) => {
            if (!m.profiles) return null;
            const initials = m.profiles.full_name
              ?.split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2) ?? "?";
            return (
              <div
                key={m.profiles.id}
                className="flex items-center gap-2 rounded-lg border px-3 py-2"
              >
                <Avatar className="h-7 w-7">
                  <AvatarImage src={m.profiles.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium leading-none">
                    {m.profiles.full_name ?? m.profiles.email}
                  </p>
                  {m.role === "owner" && (
                    <Badge variant="secondary" className="mt-0.5 text-[10px] px-1">
                      Owner
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Invite & share */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Share2 className="h-4 w-4" />
          Invite &amp; share
        </h2>
        <GroupInviteCopy groupId={group.id} />
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
