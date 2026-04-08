import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serverError } from "@/lib/utils/api-error";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("avatar") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  // Validate file type and size
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "File must be under 2 MB" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"];
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }
  const path = `${user.id}/avatar.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError) return serverError(uploadError);

  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);

  // Update profile with new avatar URL
  await supabase.from("profiles").update({ avatar_url: publicUrl } as never).eq("id", user.id);

  return NextResponse.json({ avatar_url: publicUrl });
}
