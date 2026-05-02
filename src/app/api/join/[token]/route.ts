import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { notifyGroupMembers } from "@/lib/notifications";

type GroupInviteRow = Database["public"]["Tables"]["group_invites"]["Row"];
type GroupInviteUpdate = Database["public"]["Tables"]["group_invites"]["Update"];
type GroupMemberInsert = Database["public"]["Tables"]["group_members"]["Insert"];
type InviteWithGroup = GroupInviteRow & { groups: { id: string; name: string; description: string | null } | null };
type Params = { params: { token: string } };

// GET — validate token, return group preview (public, no auth required)
export async function GET(_req: Request, { params }: Params) {
  const supabase = await createServiceClient();

  const { data: inviteData, error } = await supabase
    .from("group_invites")
    .select("*, groups(id, name, description)")
    .eq("token", params.token)
    .single();

  if (error || !inviteData) {
    return NextResponse.json({ error: "Invite not found or expired" }, { status: 404 });
  }

  const invite = inviteData as InviteWithGroup;

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

  const { data: inviteData, error } = await serviceSupabase
    .from("group_invites")
    .select("*, groups(default_member_permissions)")
    .eq("token", params.token)
    .single();

  if (error || !inviteData) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  type InviteWithGroupPerms = GroupInviteRow & {
    groups: { default_member_permissions: "view_only" | "view_comment" | "can_adjust" } | null;
  };
  const invite = inviteData as InviteWithGroupPerms;

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

  // Assign a calendar color that is visually distinct from existing members' colors
  const MEMBER_COLORS = [
    "#ef4444", "#f97316", "#eab308", "#22c55e",
    "#06b6d4", "#6366f1", "#a855f7", "#ec4899",
    "#14b8a6", "#f43f5e", "#84cc16", "#0ea5e9",
  ];

  const hexToRgb = (hex: string): [number, number, number] => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const colorDistance = (a: string, b: string): number => {
    const [ar, ag, ab] = hexToRgb(a);
    const [br, bg, bb] = hexToRgb(b);
    return Math.sqrt((ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2);
  };

  const { data: existingMembers } = await serviceSupabase
    .from("group_members")
    .select("member_color")
    .eq("group_id", invite.group_id);
  const existingColors = (existingMembers ?? [])
    .map((m) => m.member_color)
    .filter((c): c is string => typeof c === "string" && c.length > 0);

  // Pick the palette color with the greatest minimum distance to any existing color.
  // If the group has no members yet, fall back to a random pick.
  let chosenColor: string;
  if (existingColors.length === 0) {
    chosenColor = MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)];
  } else {
    chosenColor = MEMBER_COLORS.reduce((best, candidate) => {
      const minDist = Math.min(...existingColors.map((ec) => colorDistance(candidate, ec)));
      const bestDist = Math.min(...existingColors.map((ec) => colorDistance(best, ec)));
      return minDist > bestDist ? candidate : best;
    });
  }

  // Add member with the group's default permissions
  const defaultPermissions: "view_only" | "view_comment" | "can_adjust" =
    invite.groups?.default_member_permissions ?? "view_comment";
  const memberPayload: GroupMemberInsert = {
    group_id: invite.group_id,
    user_id: user.id,
    role: "member",
    member_permissions: defaultPermissions,
    member_color: chosenColor,
  } as GroupMemberInsert;
  const { error: insertError } = await serviceSupabase
    .from("group_members")
    .insert(memberPayload as never);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Increment use_count
  const updatePayload: GroupInviteUpdate = { use_count: invite.use_count + 1 };
  await serviceSupabase
    .from("group_invites")
    .update(updatePayload as never)
    .eq("id", invite.id);

  // Notify existing group members of the new join (fire-and-forget)
  const { data: groupRaw } = await serviceSupabase
    .from("groups")
    .select("name")
    .eq("id", invite.group_id)
    .single();
  const groupData = groupRaw as { name: string } | null;
  const { data: actorRaw } = await serviceSupabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();
  const actorProfile = actorRaw as { full_name: string | null; email: string } | null;
  const actorName = actorProfile?.full_name ?? actorProfile?.email ?? "Someone";
  const actorEmail = actorProfile?.email ?? "";
  const groupName = groupData?.name ?? "your group";

  notifyGroupMembers(invite.group_id, user.id, {
    type: "member_join",
    actor: { name: actorName, email: actorEmail },
    groupName,
  }).catch(() => {});

  return NextResponse.json({ group_id: invite.group_id }, { status: 201 });
}
