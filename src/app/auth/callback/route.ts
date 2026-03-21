import { cookies } from "next/headers";
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
    // Log all cookie names to diagnose PKCE code verifier cookie name mismatch
    const cookieStore = await cookies();
    const allCookieNames = cookieStore.getAll().map((c) => c.name);
    console.log("[auth/callback] cookies present:", allCookieNames);

    const supabase = await createClient();
    // Log all cookies so we can verify the PKCE code verifier cookie name
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll().map((c) => c.name);
    console.log("[auth/callback] cookies present:", allCookies);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${base}${next}`);
    }
    console.error("[auth/callback] exchangeCodeForSession failed:", JSON.stringify(error));
  } else {
    console.error("[auth/callback] no code in request, params:", Object.fromEntries(searchParams));
  }

  return NextResponse.redirect(`${base}/login?error=auth_callback_failed`);
}
