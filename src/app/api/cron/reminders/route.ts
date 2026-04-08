import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { EmailProvider } from "@/lib/notifications/email";
import type { NotificationPayload } from "@/lib/notifications/types";
import { serverError } from "@/lib/utils/api-error";

const emailProvider = new EmailProvider();

// Protect with a shared secret — set CRON_SECRET in env
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

type EventRow = {
  id: string;
  title: string;
  target_date: string;
  owner_id: string;
  group_id: string | null;
  reminder_days: number[];
};

type ProfileRow = { email: string; full_name: string | null; email_notifications: boolean };
type MemberRow = {
  user_id: string;
  notifications_enabled: boolean;
  profiles: ProfileRow | null;
};

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!emailProvider.isConfigured()) {
    return NextResponse.json({ skipped: "SMTP not configured" });
  }

  const supabase = await createServiceClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch all active events with reminders configured
  const { data: eventsRaw, error: eventsError } = await supabase
    .from("events")
    .select("id, title, target_date, owner_id, group_id, reminder_days")
    .eq("is_completed", false)
    .gt("target_date", today.toISOString());

  if (eventsError) {
    return serverError(eventsError);
  }

  const events = (eventsRaw ?? []) as EventRow[];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const sent: string[] = [];

  for (const event of events) {
    if (!event.reminder_days?.length) continue;

    const targetDate = new Date(event.target_date);
    targetDate.setHours(0, 0, 0, 0);
    const daysUntil = Math.round(
      (targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Check if today matches any reminder interval
    if (!event.reminder_days.includes(daysUntil)) continue;

    // Skip if this reminder was already sent
    const { data: alreadySent } = await supabase
      .from("event_reminders")
      .select("event_id")
      .eq("event_id", event.id)
      .eq("days_before", daysUntil)
      .maybeSingle();

    if (alreadySent) continue;

    // Fetch event owner profile
    const { data: ownerRaw } = await supabase
      .from("profiles")
      .select("email, full_name, email_notifications")
      .eq("id", event.owner_id)
      .single();
    const owner = ownerRaw as ProfileRow | null;

    const targetDateStr = targetDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const payload: Omit<NotificationPayload, "appUrl"> = {
      type: "reminder",
      actor: { name: owner?.full_name ?? "TTLeave", email: owner?.email ?? "" },
      groupName: "",
      eventTitle: event.title,
      targetDate: targetDateStr,
      daysBefore: daysUntil,
      eventId: event.id,
    };

    const recipients: string[] = [];

    // Always notify the owner (if they have email notifications on)
    if (owner?.email && owner.email_notifications !== false) {
      recipients.push(owner.email);
    }

    // Notify group members (if event is in a group)
    if (event.group_id) {
      const { data: membersRaw } = await supabase
        .from("group_members")
        .select("user_id, notifications_enabled, profiles(email, full_name, email_notifications)")
        .eq("group_id", event.group_id)
        .eq("notifications_enabled", true)
        .neq("user_id", event.owner_id); // owner already added above

      const members = (membersRaw ?? []) as MemberRow[];
      for (const m of members) {
        if (m.profiles?.email && m.profiles.email_notifications !== false) {
          recipients.push(m.profiles.email);
        }
      }
    }

    // Send to all recipients
    await Promise.allSettled(
      recipients.map((email) =>
        emailProvider.send(email, { ...payload, appUrl })
      )
    );

    // Record that this reminder was sent
    await supabase
      .from("event_reminders")
      .insert({ event_id: event.id, days_before: daysUntil } as never);

    sent.push(`${event.title} (${daysUntil}d) → ${recipients.join(", ")}`);
  }

  return NextResponse.json({ processed: sent.length, sent });
}
