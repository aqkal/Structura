import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep these packages as Node externals instead of bundling.
  // pino uses dynamic requires; postgres.js probes runtime-specific sockets.
  serverExternalPackages: ["pino", "postgres"],

  // The AI system prompts are .md files read with fs at runtime.
  // Ensure they're included in traced output for production builds.
  outputFileTracingIncludes: {
    "/api/session/**": ["./src/lib/server/ai/prompts/*.md"],
    "/session/**": ["./src/lib/server/ai/prompts/*.md"],
  },

  // Baseline security response headers. These are safe in dev and prod and
  // never alter behavior. HSTS is added only in production builds, since it
  // only makes sense over HTTPS (localhost is http). A full nonce-based CSP
  // is deferred to the deploy hardening pass; user-uploaded files already
  // carry their own restrictive CSP + nosniff on the attachment route.
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
      },
    ];
    if (process.env.NODE_ENV === "production") {
      base.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }
    return [{ source: "/:path*", headers: base }];
  },
};

export default nextConfig;
