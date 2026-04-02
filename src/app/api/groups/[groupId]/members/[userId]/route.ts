import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { isValidUUID } from "@/lib/utils/uuid";

type MembershipRow = { role: "owner" | "member" };

const patchSchema = z.object({
  role: z.enum(["owner", "member"]).optional(),
  member_permissions: z.enum(["view_only", "view_comment", "can_adjust"]).optional(),
  notifications_enabled: z.boolean().optional(),
});

type Params = { params: { groupId: string; userId: string } };

export async function PATCH(request: Request, { params }: Params) {
  if (!isValidUUID(params.groupId) || !isValidUUID(params.userId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only group owner can change roles/permissions
  const { data: membershipRaw } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", params.groupId)
    .eq("user_id", user.id)
    .single();
  const membership = membershipRaw as MembershipRow | null;

  if (membership?.role !== "owner") {
    return NextResponse.json(
      { error: "Only the group owner can manage members" },
      { status: 403 }
    );
  }

  // Can't modify yourself
  if (params.userId === user.id) {
    return NextResponse.json(
      { error: "Cannot change your own membership" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { data, error } = await supabase
    .from("group_members")
    .update(parsed.data as never)
    .eq("group_id", params.groupId)
    .eq("user_id", params.userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: Params) {
  if (!isValidUUID(params.groupId) || !isValidUUID(params.userId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Owner can remove any member; member can remove themselves
  const { data: membershipRaw2 } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", params.groupId)
    .eq("user_id", user.id)
    .single();
  const membership2 = membershipRaw2 as MembershipRow | null;

  const isOwner = membership2?.role === "owner";
  const isSelf = params.userId === user.id;

  if (!isOwner && !isSelf) {
    return NextResponse.json(
      { error: "Not authorized to remove this member" },
      { status: 403 }
    );
  }

  // Owner can't remove themselves if they're the only owner
  if (isSelf && isOwner) {
    const { count } = await supabase
      .from("group_members")
      .select("*", { count: "exact", head: true })
      .eq("group_id", params.groupId)
      .eq("role", "owner");
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Transfer ownership before leaving" },
        { status: 400 }
      );
    }
  }

  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", params.groupId)
    .eq("user_id", params.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
