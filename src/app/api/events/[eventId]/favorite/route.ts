import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/uuid";

type Params = { params: { eventId: string } };

export async function POST(_req: Request, { params }: Params) {
  if (!isValidUUID(params.eventId))
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify the user can actually see this event (RLS enforces access rules).
  // If the event doesn't exist or is not accessible, data will be null.
  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("id", params.eventId)
    .single();

  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const { error } = await supabase
    .from("event_favorites")
    .upsert({ user_id: user.id, event_id: params.eventId } as never, {
      onConflict: "user_id,event_id",
      ignoreDuplicates: true,
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ favorited: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  if (!isValidUUID(params.eventId))
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("event_favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("event_id", params.eventId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ favorited: false });
}
