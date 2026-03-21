import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

// PUBLIC URL — used as the first arg to createServerClient so @supabase/ssr
// derives the cookie name from it (matching what the browser client uses).
const PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// INTERNAL URL — actual HTTP calls from inside the container go here.
const INTERNAL_URL = process.env.SUPABASE_URL ?? PUBLIC_URL;

// Custom fetch that rewrites the public Supabase URL to the internal Docker URL.
function internalFetch(input: RequestInfo | URL, init?: RequestInit) {
  const urlStr = typeof input === "string" ? input : input.toString();
  const rewritten = urlStr.replace(PUBLIC_URL, INTERNAL_URL);
  if (rewritten !== urlStr) {
    console.log(`[server] fetch rewrite: ${urlStr} → ${rewritten}`);
  }
  const url =
    typeof input === "string"
      ? rewritten
      : input instanceof URL
        ? new URL(rewritten)
        : input;
  return fetch(url, init);
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    PUBLIC_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: internalFetch },
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
  // Service role client: never read user cookies — always use service_role JWT.
  // Using @supabase/ssr with cookies would cause it to fall back to the user's
  // session token when cookies are present, which defeats the purpose of the
  // service role (bypassing RLS). Empty cookie store forces service_role key usage.
  return createServerClient<Database>(
    PUBLIC_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: { fetch: internalFetch },
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
    }
  );
}
