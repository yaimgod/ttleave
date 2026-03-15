import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

// Internal Docker URL — reachable from inside the container (kong:8000).
// NEXT_PUBLIC_SUPABASE_URL points to localhost:8001 which is NOT reachable inside
// the Docker container, so we must use the internal service name for HTTP calls.
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;

// The cookie name is always derived from the PUBLIC URL (what the browser uses).
// @supabase/ssr computes: sb-<hostname>-auth-token from the URL you pass.
// Since the browser uses NEXT_PUBLIC_SUPABASE_URL (http://localhost:8001) it sets
// cookie "sb-localhost-auth-token". We must read that same cookie name here.
function getCookieName(url: string): string {
  try {
    const hostname = new URL(url).hostname.split(".")[0];
    return `sb-${hostname}-auth-token`;
  } catch {
    return "sb-localhost-auth-token";
  }
}
const COOKIE_NAME = getCookieName(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:8001"
);

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        name: COOKIE_NAME,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from Server Component — safe to ignore
          }
        },
      },
    }
  );
}

export async function createServiceClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookieOptions: {
        name: COOKIE_NAME,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}
