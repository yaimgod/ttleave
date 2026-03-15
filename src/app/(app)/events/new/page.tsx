import { createClient } from "@/lib/supabase/server";
import { EventForm } from "@/components/events/EventForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

type GroupMembershipWithGroup = { groups: { id: string; name: string } | null };

export const metadata = { title: "New Event — TTLeave" };

export default async function NewEventPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: groupMembershipsData } = await supabase
    .from("group_members")
    .select("groups(id, name)")
    .eq("user_id", user.id);

  const groupMemberships = (groupMembershipsData ?? []) as GroupMembershipWithGroup[];
  const groups = groupMemberships
    .map((m) => m.groups)
    .filter(Boolean) as Array<{ id: string; name: string }>;

  return (
    <div className="container max-w-2xl py-6 px-4">
      <Link
        href="/events"
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to events
      </Link>
      <h1 className="mb-6 text-2xl font-bold">New Event</h1>
      <EventForm groups={groups} />
    </div>
  );
}
