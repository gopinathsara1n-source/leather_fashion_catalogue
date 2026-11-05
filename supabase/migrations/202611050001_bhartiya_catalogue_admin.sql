-- Bhartiya Leather Fashions catalogue extension
-- Run this script in Supabase SQL Editor as the project owner.
-- Existing leather_products rows and existing image objects are preserved.

alter table public.leather_products
  add column if not exists collection_name text,
  add column if not exists finish text,
  add column if not exists grain text,
  add column if not exists application text,
  add column if not exists description text,
  add column if not exists remarks text;

create table if not exists public.catalogue_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.catalogue_admins enable row level security;

drop policy if exists "Admins can read their own catalogue role" on public.catalogue_admins;
create policy "Admins can read their own catalogue role" on public.catalogue_admins
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Catalogue admins can insert leather products" on public.leather_products;
create policy "Catalogue admins can insert leather products" on public.leather_products
  for insert to authenticated with check (exists (select 1 from public.catalogue_admins a where a.user_id = auth.uid()));

drop policy if exists "Catalogue admins can update leather products" on public.leather_products;
create policy "Catalogue admins can update leather products" on public.leather_products
  for update to authenticated
  using (exists (select 1 from public.catalogue_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.catalogue_admins a where a.user_id = auth.uid()));

drop policy if exists "Catalogue admins can delete leather products" on public.leather_products;
create policy "Catalogue admins can delete leather products" on public.leather_products
  for delete to authenticated using (exists (select 1 from public.catalogue_admins a where a.user_id = auth.uid()));

-- Existing public image viewing policy is left unchanged.
drop policy if exists "Catalogue admins can upload leather images" on storage.objects;
create policy "Catalogue admins can upload leather images" on storage.objects
  for insert to authenticated with check (bucket_id = 'leather-images' and exists (select 1 from public.catalogue_admins a where a.user_id = auth.uid()));

drop policy if exists "Catalogue admins can update leather images" on storage.objects;
create policy "Catalogue admins can update leather images" on storage.objects
  for update to authenticated
  using (bucket_id = 'leather-images' and exists (select 1 from public.catalogue_admins a where a.user_id = auth.uid()))
  with check (bucket_id = 'leather-images' and exists (select 1 from public.catalogue_admins a where a.user_id = auth.uid()));

drop policy if exists "Catalogue admins can delete leather images" on storage.objects;
create policy "Catalogue admins can delete leather images" on storage.objects
  for delete to authenticated using (bucket_id = 'leather-images' and exists (select 1 from public.catalogue_admins a where a.user_id = auth.uid()));

-- After creating your user in Supabase Authentication, run this as project owner:
-- insert into public.catalogue_admins (user_id)
-- select id from auth.users where email = 'YOUR_ADMIN_EMAIL';
