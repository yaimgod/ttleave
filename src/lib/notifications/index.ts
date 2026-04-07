import { createServiceClient } from "@/lib/supabase/server";
import { EmailProvider } from "./email";
import type { NotificationPayload } from "./types";

const emailProvider = new EmailProvider();

/**
 * Notify all members of a group who have notifications enabled and email_notifications on.
 * Skips the actor (they don't need to be notified of their own actions).
 */
export async function notifyGroupMembers(
  groupId: string,
  actorId: string,
  payload: Omit<NotificationPayload, "appUrl">
): Promise<void> {
  if (!emailProvider.isConfigured()) {
    console.log("[notify] email not configured — skipping");
    return;
  }

  const supabase = await createServiceClient();

  type MemberWithProfile = {
    user_id: string;
    notifications_enabled: boolean;
    profiles: { email: string; email_notifications: boolean } | null;
  };

  // Fetch members with notifications enabled (global + per-group)
  const { data: membersRaw } = await supabase
    .from("group_members")
    .select("user_id, notifications_enabled, profiles(email, email_notifications)")
    .eq("group_id", groupId)
    .eq("notifications_enabled", true)
    .neq("user_id", actorId);

  const members = membersRaw as MemberWithProfile[] | null;
  console.log("[notify] members found:", members?.length ?? 0, "for group", groupId);

  if (!members?.length) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const fullPayload: NotificationPayload = { ...payload, appUrl };

  await Promise.allSettled(
    members
      .filter((m) => m.profiles?.email_notifications !== false)
      .map((m) => {
        if (!m.profiles?.email) return Promise.resolve();
        return emailProvider.send(m.profiles.email, fullPayload);
      })
  );
}
