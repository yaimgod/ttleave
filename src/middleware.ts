import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/auth/callback",
  "/join",
  "/api/health",
  "/api/join",
];

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

// The cookie name is derived from the PUBLIC URL (what the browser uses), not the
// internal Docker URL. @supabase/ssr uses: sb-<hostname>-auth-token
// Browser sets cookies using NEXT_PUBLIC_SUPABASE_URL → sb-localhost-auth-token
// We must use the same name here so we can read the browser's session cookies.
//
// For the actual HTTP network calls to GoTrue, we use SUPABASE_URL (http://kong:8000)
// which IS reachable inside the Docker container. localhost:8001 is NOT reachable
// inside the container — it is only available on the Docker host machine.
// PUBLIC URL — @supabase/ssr derives the cookie name from this, matching the browser.
const PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// INTERNAL URL — actual HTTP calls go here (faster, stays inside Docker network).
const INTERNAL_URL = process.env.SUPABASE_URL ?? PUBLIC_URL;

function internalFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url =
    typeof input === "string"
      ? input.replace(PUBLIC_URL, INTERNAL_URL)
      : input instanceof URL
        ? new URL(input.toString().replace(PUBLIC_URL, INTERNAL_URL))
        : input;
  return fetch(url, init);
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    PUBLIC_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: internalFetch },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — do not remove, required for SSR auth to work
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  // Redirect unauthenticated users to /login
  if (!user && !isPublic && !pathname.startsWith("/_next")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*).*)",
  ],
};
