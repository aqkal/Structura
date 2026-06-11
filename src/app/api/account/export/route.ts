import { getCurrentUser } from "@/lib/auth";
import { buildAccountExport } from "@/lib/server/account";
import { apiError } from "@/lib/server/api-error";
import { errorName, logEvent } from "@/lib/server/audit";
import { checkCustomLimit } from "@/lib/server/rate-limit";

/** Exports a single user may request per hour. */
const EXPORTS_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

/**
 * GET /api/account/export
 *
 * Returns everything Structura stores about the signed-in user as a
 * pretty-printed JSON download: profile, all guided sessions (with steps,
 * hints, confidence ratings, and retrospectives), all chats (with messages
 * and attachment metadata plus one-hour signed download links), and an AI
 * usage count summary.
 *
 * Served as Content-Disposition: attachment so the browser downloads the
 * file directly from a plain anchor on the settings page.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "unauthorized");

  const limit = checkCustomLimit(
    `account-export:${user.id}`,
    EXPORTS_PER_HOUR,
    HOUR_MS,
  );
  if (!limit.allowed) {
    return apiError(
      429,
      "rate_limited",
      "You can export a few times per hour. Try again a little later.",
      { retryAfterSeconds: limit.retryAfterSeconds },
    );
  }

  try {
    const { data, counts } = await buildAccountExport(user.id);

    // Counts only, never content, per the audit redaction policy.
    logEvent("account_export", counts);

    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json",
        "content-disposition": 'attachment; filename="structura-export.json"',
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    logEvent("account_export_failed", { errorName: errorName(err) });
    return apiError(500, "export_failed");
  }
}
