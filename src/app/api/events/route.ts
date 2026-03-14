import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createEventSchema } from "@/lib/validations/event.schema";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("group_id");
  const type = searchParams.get("type");
  const completed = searchParams.get("completed");

  let query = supabase
    .from("events")
    .select("*")
    .order("target_date", { ascending: true });

  if (groupId) query = query.eq("group_id", groupId);
  if (type) query = query.eq("event_type", type);
  if (completed !== null) query = query.eq("is_completed", completed === "true");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { data, error } = await supabase
    .from("events")
    .insert({
      ...parsed.data,
      owner_id: user.id,
      original_target_date: parsed.data.target_date,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
