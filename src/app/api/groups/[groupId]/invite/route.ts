import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/uuid";

type Params = { params: { groupId: string } };

// POST — generate or regenerate invite token
export async function POST(_req: Request, { params }: Params) {
  if (!isValidUUID(params.groupId)) {
    return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify caller is group owner
  const { data: membership } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", params.groupId)
    .eq("user_id", user.id)
    .single();

  if (membership?.role !== "owner") {
    return NextResponse.json({ error: "Only group owners can manage invites" }, { status: 403 });
  }

  // Delete existing invite for this group (one active invite at a time)
  await supabase.from("group_invites").delete().eq("group_id", params.groupId);

  // Create new invite
  const { data, error } = await supabase
    .from("group_invites")
    .insert({ group_id: params.groupId, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/join/${data.token}`;
  return NextResponse.json({ ...data, invite_url: inviteUrl }, { status: 201 });
}

// DELETE — revoke invite
export async function DELETE(_req: Request, { params }: Params) {
  if (!isValidUUID(params.groupId)) {
    return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", params.groupId)
    .eq("user_id", user.id)
    .single();

  if (membership?.role !== "owner") {
    return NextResponse.json({ error: "Only group owners can manage invites" }, { status: 403 });
  }

  await supabase.from("group_invites").delete().eq("group_id", params.groupId);
  return new NextResponse(null, { status: 204 });
}
