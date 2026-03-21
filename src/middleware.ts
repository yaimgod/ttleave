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

// PUBLIC URL — @supabase/ssr derives the cookie name from this, matching the browser.
const PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// INTERNAL URL — actual HTTP calls go here (faster, stays inside Docker network).
const INTERNAL_URL = process.env.SUPABASE_URL ?? PUBLIC_URL;

function internalFetch(input: RequestInfo | URL, init?: RequestInit) {
  const urlStr = typeof input === "string" ? input : input.toString();
  const rewritten = urlStr.replace(PUBLIC_URL, INTERNAL_URL);
  if (rewritten !== urlStr) {
    console.log(`[middleware] fetch rewrite: ${urlStr} → ${rewritten}`);
  }
  const url =
    typeof input === "string"
      ? rewritten
      : input instanceof URL
        ? new URL(rewritten)
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
    error: userError,
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Log auth state for the OAuth callback path only (avoid noise on every request)
  if (pathname.startsWith("/auth/callback")) {
    console.log(
      `[middleware] /auth/callback — user: ${user?.email ?? "none"}, error: ${userError?.message ?? "none"}, cookies: [${request.cookies.getAll().map((c) => c.name).join(", ")}]`
    );
  }

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
