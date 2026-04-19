-- ============================================================
-- Snap Hunt Schema
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

create table if not exists hunts (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists items (
  id uuid default gen_random_uuid() primary key,
  hunt_id uuid references hunts(id) on delete cascade not null,
  title text not null,
  description text,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists teams (
  id uuid default gen_random_uuid() primary key,
  hunt_id uuid references hunts(id) on delete cascade not null,
  name text not null,
  members text[] default '{}',
  created_at timestamptz default now()
);

create table if not exists submissions (
  id uuid default gen_random_uuid() primary key,
  item_id uuid references items(id) on delete cascade not null,
  team_id uuid references teams(id) on delete cascade not null,
  photo_url text not null,
  created_at timestamptz default now(),
  unique(item_id, team_id)
);

create table if not exists votes (
  id uuid default gen_random_uuid() primary key,
  submission_id uuid references submissions(id) on delete cascade not null,
  anon_user_id uuid not null,
  created_at timestamptz default now(),
  unique(submission_id, anon_user_id)
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table hunts enable row level security;
alter table items enable row level security;
alter table teams enable row level security;
alter table submissions enable row level security;
alter table votes enable row level security;

-- hunts: public read, admin write
create policy "hunts_select" on hunts for select using (true);
create policy "hunts_insert" on hunts for insert with check (auth.role() = 'authenticated');
create policy "hunts_update" on hunts for update using (auth.role() = 'authenticated');
create policy "hunts_delete" on hunts for delete using (auth.role() = 'authenticated');

-- items: public read, admin write
create policy "items_select" on items for select using (true);
create policy "items_insert" on items for insert with check (auth.role() = 'authenticated');
create policy "items_update" on items for update using (auth.role() = 'authenticated');
create policy "items_delete" on items for delete using (auth.role() = 'authenticated');

-- teams: public read, anyone can create
create policy "teams_select" on teams for select using (true);
create policy "teams_insert" on teams for insert with check (true);

-- submissions: public read, anyone can create
create policy "submissions_select" on submissions for select using (true);
create policy "submissions_insert" on submissions for insert with check (true);

-- votes: public read, user can only insert their own vote
create policy "votes_select" on votes for select using (true);
create policy "votes_insert" on votes for insert with check (auth.uid() = anon_user_id);

-- ============================================================
-- Storage
-- Run these in: Supabase Dashboard > Storage > New Bucket
-- 1. Create bucket named "photos" with Public access ON
-- 2. Then run the policy below:
-- ============================================================

-- Allow any authenticated or anonymous user to upload to photos bucket
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
on conflict do nothing;

create policy "photos_select" on storage.objects for select using (bucket_id = 'photos');
create policy "photos_insert" on storage.objects for insert with check (bucket_id = 'photos');

-- ============================================================
-- Enable Anonymous Sign-ins:
-- Supabase Dashboard > Authentication > Providers > Anonymous sign-ins > Enable
-- ============================================================
