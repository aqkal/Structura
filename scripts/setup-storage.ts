/**
 * One-off: create the private chat-uploads storage bucket.
 * Run: `npx tsx scripts/setup-storage.ts`
 *
 * Idempotent. Safe to re-run; an existing bucket is left as is. All
 * access to this bucket goes through server routes using the service
 * role, so the bucket stays private and needs no public policies.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "chat-uploads";
const ALLOWED = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing } = await supabase.storage.getBucket(BUCKET);
  if (existing) {
    console.log(`Bucket "${BUCKET}" already exists. Nothing to do.`);
    process.exit(0);
  }

  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: ALLOWED,
  });
  if (error) {
    console.error(`Failed to create bucket: ${error.message}`);
    process.exit(1);
  }

  console.log(`Created private bucket "${BUCKET}" (10MB limit, images + PDF).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
