/**
 * Prints the Storage RLS policy SQL for the chat-uploads bucket.
 *
 * Run: `npx tsx scripts/setup-storage-rls.ts`
 *
 * Supabase deliberately restricts policy changes on storage.objects to an
 * owner-level actor, so a regular database connection (and therefore this
 * project's app) CANNOT weaken storage security. That is a feature: it is
 * why we are comfortable with no master key in the running app.
 *
 * To apply these once: open the Supabase Dashboard, go to the SQL Editor,
 * paste the block below, and run it. (Or Storage > Policies > New policy.)
 *
 * Paths are "{userId}/{chatId}/{uuid}.{ext}", so folder[1] is the owner id.
 * These policies let an authenticated user read/write/delete ONLY inside
 * their own folder. The app uses each user's own session for storage, so
 * these policies are what actually gate access.
 */

const SQL = `
-- Structura: chat-uploads bucket access, scoped to each user's own folder.
-- Paste into Supabase Dashboard > SQL Editor and run once.

drop policy if exists "chat_uploads_insert" on storage.objects;
drop policy if exists "chat_uploads_select" on storage.objects;
drop policy if exists "chat_uploads_delete" on storage.objects;

create policy "chat_uploads_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-uploads'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "chat_uploads_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-uploads'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "chat_uploads_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-uploads'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
`;

console.log(SQL);
