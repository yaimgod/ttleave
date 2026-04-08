import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/utils/safeRedirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = getSafeRedirectPath(searchParams.get("next"));

  // Behind a reverse proxy (e.g. Traefik/Coolify) request.url origin is the
  // internal container address (0.0.0.0:3000). Use the public app URL instead.
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${base}${next}`);
    }
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
  } else {
    console.error("[auth/callback] no code present in request");
  }

  return NextResponse.redirect(`${base}/login?error=auth_callback_failed`);
}
