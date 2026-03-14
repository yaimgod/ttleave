import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

type Params = { params: { token: string } };

// GET — validate token, return group preview (public, no auth required)
export async function GET(_req: Request, { params }: Params) {
  const supabase = await createServiceClient();

  const { data: invite, error } = await supabase
    .from("group_invites")
    .select("*, groups(id, name, description)")
    .eq("token", params.token)
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: "Invite not found or expired" }, { status: 404 });
  }

  // Check expiry
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invite has expired" }, { status: 410 });
  }

  // Check max uses
  if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
    return NextResponse.json({ error: "This invite has reached its maximum uses" }, { status: 410 });
  }

  return NextResponse.json({
    group: invite.groups,
    token: params.token,
  });
}

// POST — authenticated user joins the group
export async function POST(_req: Request, { params }: Params) {
  const supabase = await createClient();
  const serviceSupabase = await createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: invite, error } = await serviceSupabase
    .from("group_invites")
    .select("*")
    .eq("token", params.token)
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invite has expired" }, { status: 410 });
  }

  if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
    return NextResponse.json({ error: "Invite limit reached" }, { status: 410 });
  }

  // Check if already a member
  const { data: existing } = await serviceSupabase
    .from("group_members")
    .select("id")
    .eq("group_id", invite.group_id)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    return NextResponse.json(
      { message: "Already a member", group_id: invite.group_id },
      { status: 200 }
    );
  }

  // Add member
  const { error: insertError } = await serviceSupabase
    .from("group_members")
    .insert({ group_id: invite.group_id, user_id: user.id, role: "member" });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Increment use_count
  await serviceSupabase
    .from("group_invites")
    .update({ use_count: invite.use_count + 1 })
    .eq("id", invite.id);

  return NextResponse.json({ group_id: invite.group_id }, { status: 201 });
}
