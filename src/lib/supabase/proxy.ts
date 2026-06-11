import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { bucketForPath, checkRateLimit } from "@/lib/server/rate-limit";
import { apiError } from "@/lib/server/api-error";
import { logEvent } from "@/lib/server/audit";

/**
 * Runs on every request via `src/proxy.ts` (Next 16's renamed middleware).
 *
 * Why: Supabase access tokens expire every hour. The refresh token is in a
 * cookie. We need a place that runs server-side on every request to refresh
 * the session *before* the page renders. Otherwise users see momentary
 * logged-out states or stale data.
 *
 * The pattern:
 *   1. Build a Supabase server client that reads/writes cookies on the
 *      `NextResponse` we'll return.
 *   2. Call `supabase.auth.getUser()` which transparently refreshes if needed.
 *   3. Return the response (now carrying any updated cookies).
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate limit before doing any other work (including the Supabase
  // round trip). Keyed per bucket so one noisy area cannot starve others.
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip =
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  const bucket = bucketForPath(pathname);
  const verdict = checkRateLimit(bucket + ":" + ip, bucket);
  if (!verdict.allowed) {
    logEvent("rate_limit_exceeded", { bucket, status: 429 });
    return apiError(429, "rate_limited", undefined, {
      retryAfterSeconds: verdict.retryAfterSeconds,
    });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run code between createServerClient and getUser().
  // Doing so risks the session falling out of sync.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Gate protected routes. Anyone hitting these without a user gets bounced.
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/p/") || // future: public portfolio share links
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  if (!user && !isPublic) {
    // API callers get machine-readable JSON; humans get the sign-in page.
    if (pathname.startsWith("/api")) {
      return apiError(401, "unauthorized");
    }
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
