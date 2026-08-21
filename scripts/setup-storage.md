# Supabase Storage Bucket Setup

## Create the "images" bucket via the Supabase Dashboard (recommended)

1. Go to [Supabase Dashboard](https://app.supabase.com/project/kgxvomfyvirkqhgabjel/storage/buckets)
2. Click **New bucket**
3. Name it exactly: `images`
4. Toggle **Public bucket** ON
5. Click **Create bucket**

That's it. The RLS policies for the content table (set in `content-migration.sql`) gate admin writes at the application layer.

---

## Alternative: Create via curl (REST API)

Replace `YOUR_SERVICE_ROLE_KEY` with your Supabase **service role** key (found in Project Settings → API → service_role key — keep this secret, do not use the anon key here).

```bash
# Create the images bucket (public)
curl -X POST "https://kgxvomfyvirkqhgabjel.supabase.co/storage/v1/bucket" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "images",
    "name": "images",
    "public": true,
    "file_size_limit": 10485760,
    "allowed_mime_types": ["image/jpeg","image/png","image/webp","image/gif"]
  }'
```

Expected response: `{"name":"images"}`

### Set bucket policies (public read + authenticated write via anon key)

The bucket is already public (set above). Uploads use the anon key with `x-upsert: true` — this is safe because:
- The admin UI is gated by the "fabulous" passcode
- Storage write calls are made only from within the admin Content tab

If you want to lock down writes further, add this RLS policy via the Supabase SQL Editor:

```sql
-- Allow public to read all files in the images bucket
create policy "Public read images"
  on storage.objects for select
  using ( bucket_id = 'images' );

-- Allow any anon/authenticated user to upload (gated at app layer by admin passcode)
create policy "Anyone can upload images"
  on storage.objects for insert
  with check ( bucket_id = 'images' );

-- Allow any user to update (upsert)
create policy "Anyone can upsert images"
  on storage.objects for update
  using ( bucket_id = 'images' );
```

---

## Verify the setup

After running the SQL migration and creating the bucket:

1. Open `https://yourdomain.com/#/admin`
2. Enter passcode `fabulous`
3. Click the **Content** tab
4. Expand the **Home page** section
5. Tap **Drop image or tap to upload** under Hero Image
6. Pick a photo from your camera roll
7. Wait for the upload progress — you should see **Saved ✓**
8. Reload the page and confirm the hero image has changed

If the upload fails, check:
- The `images` bucket exists and is set to **Public**
- The SQL migration ran without errors (both `content` and `gallery_items` tables exist)
