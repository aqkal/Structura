import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

function contentSecurityPolicy(): string {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseWss = supabase.replace(/^https:/, "wss:");
  const connect = ["'self'", supabase, supabaseWss].filter(Boolean).join(" ");
  // tally.so is allowed for the beta feedback embed (see remove.md).
  const scriptSrc = isProd
    ? "script-src 'self' 'unsafe-inline' https://tally.so https://va.vercel-scripts.com"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://tally.so https://va.vercel-scripts.com";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'self' https://tally.so",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    scriptSrc,
    `connect-src ${connect}`,
  ].join("; ");
}

const nextConfig: NextConfig = {
  poweredByHeader: false,

  serverExternalPackages: ["pino", "postgres"],

  outputFileTracingIncludes: {
    "/api/session/**": ["./src/lib/server/ai/prompts/*.md"],
    "/session/**": ["./src/lib/server/ai/prompts/*.md"],
  },

  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
      },
      { key: "Content-Security-Policy", value: contentSecurityPolicy() },
    ];
    if (isProd) {
      base.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }
    return [{ source: "/:path*", headers: base }];
  },
};

export default nextConfig;
