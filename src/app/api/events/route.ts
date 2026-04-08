import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { createEventSchema } from "@/lib/validations/event.schema";
import { notifyGroupMembers } from "@/lib/notifications";
import { serverError, parseJsonBody } from "@/lib/utils/api-error";

type EventInsert = Database["public"]["Tables"]["events"]["Insert"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("group_id");
  const type = searchParams.get("type");
  const completed = searchParams.get("completed");

  let query = supabase
    .from("events")
    .select("*")
    .order("target_date", { ascending: true });

  if (groupId) query = query.eq("group_id", groupId);
  if (type) query = query.eq("event_type", type);
  if (completed !== null) query = query.eq("is_completed", completed === "true");

  const { data, error } = await query;
  if (error) return serverError(error);
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jsonResult = await parseJsonBody<unknown>(request);
  if (!jsonResult.ok) return jsonResult.response;
  const parsed = createEventSchema.safeParse(jsonResult.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const insertPayload: EventInsert = {
    ...parsed.data,
    owner_id: user.id,
    original_target_date: parsed.data.target_date,
  };
  const { data: rawData, error } = await supabase
    .from("events")
    .insert(insertPayload as never)
    .select()
    .single();
  const data = rawData as unknown as EventRow;

  if (error) return serverError(error);

  // Notify group members when an event is shared to a group
  if (data.group_id) {
    const serviceClient = await createServiceClient();
    const { data: actorProfileRaw } = await serviceClient
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();
    const actorProfile = actorProfileRaw as { full_name: string | null; email: string } | null;

    const { data: groupRaw } = await serviceClient
      .from("groups")
      .select("name")
      .eq("id", data.group_id)
      .single();
    const group = groupRaw as { name: string } | null;

    if (actorProfile && group) {
      notifyGroupMembers(data.group_id, user.id, {
        type: "new_event",
        actor: {
          name: actorProfile.full_name ?? actorProfile.email,
          email: actorProfile.email,
        },
        groupName: group.name,
        eventTitle: data.title,
        eventId: data.id,
      }).catch(console.error);
    }
  }

  return NextResponse.json(data, { status: 201 });
}
