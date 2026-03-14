import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CountdownCard } from "@/components/countdown/CountdownCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/EmptyState";
import { Settings, Timer, Users } from "lucide-react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
  return { title: data?.name ?? "Group" };
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

  const { data: group } = await supabase
    .from("groups")
    .select(
      "*, group_members(role, profiles(id, full_name, email, avatar_url))"
    )
    .eq("id", params.groupId)
    .single();

  if (!group) notFound();

  const userMembership = (group.group_members as Array<{
    role: string;
    profiles: { id: string } | null;
  }>).find((m) => m.profiles?.id === user!.id);

  if (!userMembership) notFound();

  const isOwner = userMembership.role === "owner";

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("group_id", params.groupId)
    .eq("is_completed", false)
    .order("target_date");

  const members = group.group_members as Array<{
    role: string;
    profiles: {
      id: string;
      full_name: string | null;
      email: string;
      avatar_url: string | null;
    } | null;
  }>;

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
        {isOwner && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/groups/${group.id}/settings`} className="gap-1.5">
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </Button>
        )}
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
              <CountdownCard key={event.id} event={{ ...event, group_name: group.name }} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
