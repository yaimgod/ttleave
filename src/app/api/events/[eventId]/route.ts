import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { updateEventSchema } from "@/lib/validations/event.schema";
import { isValidUUID } from "@/lib/utils/uuid";
import { notifyGroupMembers } from "@/lib/notifications";

type EventUpdate = Database["public"]["Tables"]["events"]["Update"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];
type Params = { params: { eventId: string } };

export async function GET(_req: Request, { params }: Params) {
  if (!isValidUUID(params.eventId)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("events")
    .select(
      `*, event_chains!predecessor_id(*), event_comments(count)`
    )
    .eq("id", params.eventId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(request: Request, { params }: Params) {
  if (!isValidUUID(params.eventId)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const updatePayload: EventUpdate = { ...parsed.data, updated_at: new Date().toISOString() };
  const { data: rawData, error } = await supabase
    .from("events")
    .update(updatePayload as never)
    .eq("id", params.eventId)
    .eq("owner_id", user.id) // enforce ownership via query
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const data = rawData as EventRow;

  // Notify group members when target date changes
  if (parsed.data.target_date && data.group_id) {
    const { data: groupRaw } = await supabase
      .from("groups")
      .select("name")
      .eq("id", data.group_id)
      .single();
    const groupData = groupRaw as { name: string } | null;
    const { data: actorRaw } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();
    const actorProfile = actorRaw as { full_name: string | null; email: string } | null;
    const actorName = actorProfile?.full_name ?? actorProfile?.email ?? "Someone";
    const actorEmail = actorProfile?.email ?? "";

    notifyGroupMembers(data.group_id, user.id, {
      type: "date_change",
      actor: { name: actorName, email: actorEmail },
      groupName: groupData?.name ?? "your group",
      eventTitle: data.title,
      newDate: data.target_date,
      eventId: data.id,
    }).catch(() => {});
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: Params) {
  if (!isValidUUID(params.eventId)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", params.eventId)
    .eq("owner_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Trigger chain activation if the event was completed before deletion — no-op here
  return new NextResponse(null, { status: 204 });
}

export async function PATCH(request: Request, { params }: Params) {
  if (!isValidUUID(params.eventId)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const patchPayload: EventUpdate = { is_completed: true, updated_at: new Date().toISOString() };
  const { data: event, error: fetchError } = await supabase
    .from("events")
    .update(patchPayload as never)
    .eq("id", params.eventId)
    .eq("owner_id", user.id)
    .select()
    .single();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  // Activate linked successors via DB function (RPC not in generated types)
  // @ts-expect-error — activate_chain_successors RPC exists in DB but not in generated Database type
  await supabase.rpc("activate_chain_successors", { p_event_id: params.eventId });

  return NextResponse.json(event);
}
