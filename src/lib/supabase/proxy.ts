import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { bucketForPath, checkRateLimit } from "@/lib/server/rate-limit";
import { apiError } from "@/lib/server/api-error";
import { logEvent } from "@/lib/server/audit";

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip =
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  const bucket = bucketForPath(pathname);
  const verdict = await checkRateLimit(bucket + ":" + ip, bucket);
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic =
    pathname === "/" ||
    pathname === "/api/health" ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  if (!user && !isPublic) {
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
