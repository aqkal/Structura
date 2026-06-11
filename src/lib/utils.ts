import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes intelligently. Later classes win, but the merger
 * understands Tailwind's specificity so `cn("p-4", "p-2")` collapses to `p-2`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Build a full absolute URL for OAuth redirects, etc.
 * Reads `NEXT_PUBLIC_SITE_URL` in prod, falls back to localhost in dev.
 */
export function siteUrl(path = "") {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
