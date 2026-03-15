import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { EventForm } from "@/components/events/EventForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type GroupMembershipWithGroup = { groups: { id: string; name: string } | null };

export const metadata = { title: "Edit Event — TTLeave" };

export default async function EditEventPage({
  params,
}: {
  params: { eventId: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: eventData } = await supabase
    .from("events")
    .select("*")
    .eq("id", params.eventId)
    .eq("owner_id", user.id)
    .single();

  if (!eventData) notFound();

  const event = eventData as EventRow;

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
        href={`/events/${event.id}`}
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to event
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Edit Event</h1>
      <EventForm
        eventId={event.id}
        groups={groups}
        defaultValues={{
          title: event.title,
          description: event.description ?? "",
          target_date: event.target_date,
          group_id: event.group_id,
          is_public: event.is_public,
          member_permissions: event.member_permissions,
          color: event.color,
        }}
      />
    </div>
  );
}
