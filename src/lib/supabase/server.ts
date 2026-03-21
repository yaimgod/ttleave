import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

// PUBLIC URL — used as the first arg to createServerClient so @supabase/ssr
// derives the cookie name from it (matching what the browser client uses).
const PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// INTERNAL URL — actual HTTP calls from inside the container go here.
// http://kong:8000 is reachable inside Docker; the public domain works too
// but internal avoids the round-trip through the internet.
const INTERNAL_URL = process.env.SUPABASE_URL ?? PUBLIC_URL;

// Custom fetch that rewrites the public Supabase URL to the internal Docker URL.
// This lets @supabase/ssr derive the correct cookie name from PUBLIC_URL while
// all actual network calls go to the faster internal address.
function internalFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url =
    typeof input === "string"
      ? input.replace(PUBLIC_URL, INTERNAL_URL)
      : input instanceof URL
        ? new URL(input.toString().replace(PUBLIC_URL, INTERNAL_URL))
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
  const cookieStore = await cookies();

  return createServerClient<Database>(
    PUBLIC_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
          } catch {}
        },
      },
    }
  );
}
