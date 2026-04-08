import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { updateGroupSchema } from "@/lib/validations/group.schema";
import { isValidUUID } from "@/lib/utils/uuid";
import { serverError, parseJsonBody } from "@/lib/utils/api-error";

type GroupUpdate = Database["public"]["Tables"]["groups"]["Update"];
type Params = { params: { groupId: string } };

export async function GET(_req: Request, { params }: Params) {
  if (!isValidUUID(params.groupId)) {
    return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("groups")
    .select(
      `*, group_members(*, profiles(id, full_name, email, avatar_url, role))`
    )
    .eq("id", params.groupId)
    .single();

  if (error) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(request: Request, { params }: Params) {
  if (!isValidUUID(params.groupId)) {
    return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jsonResult = await parseJsonBody<unknown>(request);
  if (!jsonResult.ok) return jsonResult.response;
  const parsed = updateGroupSchema.safeParse(jsonResult.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const updatePayload: GroupUpdate = parsed.data;
  const { data, error } = await supabase
    .from("groups")
    .update(updatePayload as never)
    .eq("id", params.groupId)
    .eq("created_by", user.id)
    .select()
    .single();

  if (error) return serverError(error);
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: Params) {
  if (!isValidUUID(params.groupId)) {
    return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("groups")
    .delete()
    .eq("id", params.groupId)
    .eq("created_by", user.id);

  if (error) return serverError(error);
  return new NextResponse(null, { status: 204 });
}
