-- ============================================================
-- Content Management System — Supabase SQL Migration
-- Run this in the Supabase SQL Editor (project kgxvomfyvirkqhgabjel)
-- ============================================================

-- Content key/value store
create table if not exists content (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table content enable row level security;
create policy "public read content" on content for select using (true);
create policy "anyone can upsert content" on content for insert with check (true);
create policy "anyone can update content" on content for update using (true);

-- Gallery items (separate so reordering/filtering is trivial)
create table if not exists gallery_items (
  id bigint generated always as identity primary key,
  image_url text not null,
  caption text,
  category text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table gallery_items enable row level security;
create policy "public read gallery" on gallery_items for select using (active = true);
create policy "anyone can manage gallery" on gallery_items for all using (true) with check (true);

-- Storage bucket policy will be applied via the Supabase MCP/dashboard separately:
-- Bucket name: "images", public read, anyone can insert/update (admin-gated at app layer)
