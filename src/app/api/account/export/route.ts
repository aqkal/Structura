import { getCurrentUser } from "@/lib/auth";
import { buildAccountExport } from "@/lib/server/account";
import { apiError } from "@/lib/server/api-error";
import { errorName, logEvent } from "@/lib/server/audit";
import { checkCustomLimit } from "@/lib/server/rate-limit";

const EXPORTS_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "unauthorized");

  const limit = await checkCustomLimit(
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
