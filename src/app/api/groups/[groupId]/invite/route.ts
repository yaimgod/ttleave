import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { isValidUUID } from "@/lib/utils/uuid";
import { serverError } from "@/lib/utils/api-error";

type GroupInviteInsert = Database["public"]["Tables"]["group_invites"]["Insert"];
type Params = { params: { groupId: string } };

// GET — fetch existing invite for this group (owner only)
export async function GET(_req: Request, { params }: Params) {
  if (!isValidUUID(params.groupId)) {
    return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("group_invites")
    .select("*")
    .eq("group_id", params.groupId)
    .limit(1);

  const rows = (data ?? []) as Array<{ token: string; [k: string]: unknown }>;
  const result = rows.map((row) => ({
    ...row,
    invite_url: `${process.env.NEXT_PUBLIC_APP_URL}/join/${row.token}`,
  }));

  return NextResponse.json(result);
}

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
  const { data: membershipData, error: membershipError } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", params.groupId)
    .eq("user_id", user.id)
    .single();

  const membership = membershipData as { role: string } | null;
  if (membership?.role !== "owner") {
    return NextResponse.json({ error: "Only group owners can manage invites" }, { status: 403 });
  }

  // Delete existing invite for this group (one active invite at a time)
  await supabase.from("group_invites").delete().eq("group_id", params.groupId);

  // Create new invite
  const invitePayload: GroupInviteInsert = { group_id: params.groupId, created_by: user.id };
  const { data, error } = await supabase
    .from("group_invites")
    .insert(invitePayload as never)
    .select()
    .single();

  if (error) return serverError(error);

  const row = data as { token: string; [k: string]: unknown } | null;
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/join/${row?.token ?? ""}`;
  return NextResponse.json({ ...row, invite_url: inviteUrl }, { status: 201 });
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

  const { data: membershipData } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", params.groupId)
    .eq("user_id", user.id)
    .single();

  const membership = membershipData as { role: string } | null;
  if (membership?.role !== "owner") {
    return NextResponse.json({ error: "Only group owners can manage invites" }, { status: 403 });
  }

  await supabase.from("group_invites").delete().eq("group_id", params.groupId);
  return new NextResponse(null, { status: 204 });
}
