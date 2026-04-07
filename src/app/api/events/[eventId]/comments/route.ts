import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { z } from "zod";
import { isValidUUID } from "@/lib/utils/uuid";
import { notifyGroupMembers } from "@/lib/notifications";

type CommentInsert = Database["public"]["Tables"]["event_comments"]["Insert"];

const commentSchema = z.object({
  content: z.string().min(1).max(2000),
});

type Params = { params: { eventId: string } };

export async function GET(_req: Request, { params }: Params) {
  if (!isValidUUID(params.eventId)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("event_comments")
    .select("*, profiles(id, full_name, avatar_url)")
    .eq("event_id", params.eventId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request, { params }: Params) {
  if (!isValidUUID(params.eventId)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const commentInsert: CommentInsert = { event_id: params.eventId, author_id: user.id, content: parsed.data.content };
  const { data: comment, error } = await supabase
    .from("event_comments")
    .insert(commentInsert as never)
    .select("*, profiles(id, full_name, avatar_url)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify group members (fire-and-forget — don't block the response)
  const { data: eventRaw } = await supabase
    .from("events")
    .select("title, group_id, groups(name)")
    .eq("id", params.eventId)
    .single();
  const event = eventRaw as { title: string; group_id: string | null; groups: { name: string } | null } | null;

  if (event?.group_id) {
    const groupName = event.groups?.name ?? "your group";
    const actorProfileRes = await supabase.from("profiles").select("full_name, email").eq("id", user.id).single();
    const actorProfile = actorProfileRes.data as { full_name: string | null; email: string } | null;
    const actorName = actorProfile?.full_name ?? actorProfile?.email ?? "Someone";
    const actorEmail = actorProfile?.email ?? "";

    notifyGroupMembers(event.group_id, user.id, {
      type: "comment",
      actor: { name: actorName, email: actorEmail },
      groupName,
      eventTitle: event.title,
      commentText: parsed.data.content.slice(0, 200),
      eventId: params.eventId,
    }).catch(console.error);
  }

  return NextResponse.json(comment, { status: 201 });
}
