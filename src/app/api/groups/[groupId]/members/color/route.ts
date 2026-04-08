import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { isValidUUID } from "@/lib/utils/uuid";
import { serverError, parseJsonBody } from "@/lib/utils/api-error";

const schema = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color"),
});

type Params = { params: { groupId: string } };

export async function PATCH(req: Request, { params }: Params) {
  if (!isValidUUID(params.groupId))
    return NextResponse.json({ error: "Invalid group id" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jsonResult = await parseJsonBody<unknown>(req);
  if (!jsonResult.ok) return jsonResult.response;
  const parsed = schema.safeParse(jsonResult.data);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 });

  const { error } = await supabase
    .from("group_members")
    .update({ member_color: parsed.data.color } as never)
    .eq("group_id", params.groupId)
    .eq("user_id", user.id);

  if (error) return serverError(error);
  return NextResponse.json({ color: parsed.data.color });
}
