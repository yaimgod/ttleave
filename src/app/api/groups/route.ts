import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { createGroupSchema } from "@/lib/validations/group.schema";
import { serverError, parseJsonBody } from "@/lib/utils/api-error";

type GroupInsert = Database["public"]["Tables"]["groups"]["Insert"];

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("groups")
    .select("*, group_members!inner(role)")
    .eq("group_members.user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return serverError(error);
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jsonResult = await parseJsonBody<unknown>(request);
  if (!jsonResult.ok) return jsonResult.response;
  const parsed = createGroupSchema.safeParse(jsonResult.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const insertPayload: GroupInsert = { ...parsed.data, created_by: user.id };
  const { data, error } = await supabase
    .from("groups")
    .insert(insertPayload as never)
    .select()
    .single();

  if (error) return serverError(error);

  // Trigger on_group_created adds user as owner automatically
  return NextResponse.json(data, { status: 201 });
}
