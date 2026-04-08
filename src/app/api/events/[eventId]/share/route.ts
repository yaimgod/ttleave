import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/uuid";
import { serverError, parseJsonBody } from "@/lib/utils/api-error";

type Params = { params: { eventId: string } };

// POST — share event with a group (always view_comment permissions)
export async function POST(request: Request, { params }: Params) {
  if (!isValidUUID(params.eventId)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jsonResult = await parseJsonBody<{ group_id?: string }>(request);
  if (!jsonResult.ok) return jsonResult.response;
  const { group_id } = jsonResult.data;
  if (!group_id || !isValidUUID(group_id)) {
    return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
  }

  // Verify user is a member of the target group
  const { data: membership } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", group_id)
    .eq("user_id", user.id)
    .single();
  if (!membership) {
    return NextResponse.json({ error: "Not a member of that group" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("events")
    .update({ group_id, member_permissions: "view_comment", updated_at: new Date().toISOString() } as never)
    .eq("id", params.eventId)
    .eq("owner_id", user.id)
    .select()
    .single();

  if (error) return serverError(error);
  return NextResponse.json(data);
}

// DELETE — unshare event (remove from group)
export async function DELETE(_req: Request, { params }: Params) {
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
    .update({ group_id: null, updated_at: new Date().toISOString() } as never)
    .eq("id", params.eventId)
    .eq("owner_id", user.id)
    .select()
    .single();

  if (error) return serverError(error);
  return NextResponse.json(data);
}
