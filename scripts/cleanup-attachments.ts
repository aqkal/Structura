import "dotenv/config";
import { inArray, lt } from "drizzle-orm";

import { db, schema } from "../src/lib/db";
import { getAdminClient } from "../src/lib/supabase/admin";

const BUCKET = "chat-uploads";
const BATCH = 500;
const RETENTION_DAYS = Number(process.env.ATTACHMENT_RETENTION_DAYS ?? 30);

async function main() {
  if (!Number.isFinite(RETENTION_DAYS) || RETENTION_DAYS <= 0) {
    console.log("retention disabled (ATTACHMENT_RETENTION_DAYS <= 0)");
    return;
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
  const admin = getAdminClient();
  let removed = 0;

  for (;;) {
    const batch = await db
      .select({
        id: schema.chatAttachments.id,
        storagePath: schema.chatAttachments.storagePath,
      })
      .from(schema.chatAttachments)
      .where(lt(schema.chatAttachments.createdAt, cutoff))
      .limit(BATCH);
    if (batch.length === 0) break;

    const { error } = await admin.storage
      .from(BUCKET)
      .remove(batch.map((b) => b.storagePath));
    if (error) {
      console.error("storage remove failed, stopping:", error.message);
      process.exit(1);
    }

    await db.delete(schema.chatAttachments).where(
      inArray(
        schema.chatAttachments.id,
        batch.map((b) => b.id),
      ),
    );
    removed += batch.length;
    if (batch.length < BATCH) break;
  }

  console.log(
    `removed ${removed} attachments older than ${RETENTION_DAYS} days`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
