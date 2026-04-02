import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";
import type { Database } from "@/lib/supabase/types";
import { GroupSettingsForm } from "./GroupSettingsForm";
import { MembersManager } from "./MembersManager";
import type { MemberItem } from "./MembersManager";
import { InviteManager } from "./InviteManager";
import { DeleteGroupButton } from "./DeleteGroupButton";
import { NotificationToggle } from "../NotificationToggle";
import { MemberColorPicker } from "./MemberColorPicker";

type GroupRow = Database["public"]["Tables"]["groups"]["Row"];

interface GroupMemberWithProfile {
  user_id: string;
  role: "owner" | "member";
  member_permissions: "view_only" | "view_comment" | "can_adjust";
  notifications_enabled: boolean;
  member_color: string;
  profiles: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
}

interface InviteData {
  token: string;
  invite_url: string;
  use_count: number;
  expires_at: string | null;
}

export async function generateMetadata({
  params,
}: {
  params: { groupId: string };
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("groups")
    .select("name")
    .eq("id", params.groupId)
    .single();
  const row = data as { name?: string } | null;
  return { title: row?.name ? `Settings — ${row.name}` : "Group Settings" };
}

export default async function GroupSettingsPage({
  params,
}: {
  params: { groupId: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  // Fetch group with members + profiles
  const { data: groupData } = await supabase
    .from("groups")
    .select(
      "*, group_members(user_id, role, member_permissions, notifications_enabled, member_color, profiles(id, full_name, email, avatar_url))"
    )
    .eq("id", params.groupId)
    .single();

  if (!groupData) notFound();

  const group = groupData as GroupRow & {
    group_members: GroupMemberWithProfile[];
    default_member_permissions: "view_only" | "view_comment" | "can_adjust";
  };

  // Must be a member
  const myMembership = group.group_members.find((m) => m.user_id === user.id);
  if (!myMembership) notFound();

  const isOwner = myMembership.role === "owner";

  // Fetch existing invite (owners only)
  let initialInvite: InviteData | null = null;
  if (isOwner) {
    const { data: inviteRows } = await supabase
      .from("group_invites")
      .select("token, use_count, expires_at")
      .eq("group_id", params.groupId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (inviteRows && inviteRows[0]) {
      const row = inviteRows[0] as {
        token: string;
        use_count: number;
        expires_at: string | null;
      };
      const origin =
        process.env.NEXT_PUBLIC_APP_URL ??
        (typeof globalThis !== "undefined" ? "" : "");
      initialInvite = {
        token: row.token,
        invite_url: `${origin}/join/${row.token}`,
        use_count: row.use_count,
        expires_at: row.expires_at,
      };
    }
  }

  // Shape members for client component
  const members: MemberItem[] = group.group_members
    .filter((m) => m.profiles !== null)
    .map((m) => ({
      userId: m.user_id,
      name: m.profiles!.full_name,
      email: m.profiles!.email,
      avatarUrl: m.profiles!.avatar_url,
      role: m.role,
      memberPermissions: m.member_permissions,
    }));

  return (
    <div className="container max-w-xl py-6 px-4 space-y-6">
      <div>
        <Link
          href={`/groups/${params.groupId}`}
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to group
        </Link>
        <h1 className="text-2xl font-bold">{group.name}</h1>
        <p className="text-sm text-muted-foreground">Group settings</p>
      </div>

      <Separator />

      {/* Notification preference — available to all members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationToggle
            groupId={params.groupId}
            initialEnabled={myMembership.notifications_enabled ?? true}
          />
        </CardContent>
      </Card>

      {/* Calendar color — available to all members */}
      <MemberColorPicker
        groupId={params.groupId}
        initialColor={myMembership.member_color ?? "#6366f1"}
      />

      {isOwner ? (
        <>
          {/* Edit group details + default permissions */}
          <GroupSettingsForm
            groupId={params.groupId}
            initialName={group.name}
            initialDescription={group.description}
            initialDefaultPermissions={group.default_member_permissions}
          />

          {/* Members list */}
          <MembersManager
            groupId={params.groupId}
            members={members}
            currentUserId={user.id}
            isOwner={isOwner}
          />

          {/* Invite link */}
          <InviteManager
            groupId={params.groupId}
            initialInvite={initialInvite}
          />

          {/* Danger zone */}
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <ShieldAlert className="h-4 w-4" />
                Danger zone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Deleting this group will permanently remove all members and
                associated data. This cannot be undone.
              </p>
              <DeleteGroupButton
                groupId={params.groupId}
                groupName={group.name}
              />
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* Non-owners: read-only member list */}
          <MembersManager
            groupId={params.groupId}
            members={members}
            currentUserId={user.id}
            isOwner={false}
          />
        </>
      )}
    </div>
  );
}
