import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 renamed `middleware.ts` → `proxy.ts`.
 * The exported function must be named `proxy` (or be a default export).
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match everything except:
     * - static assets (_next/static, _next/image)
     * - favicon, robots, sitemap
     * - image files
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
