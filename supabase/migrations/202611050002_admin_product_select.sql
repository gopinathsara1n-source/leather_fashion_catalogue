-- Allow signed-in catalogue administrators to read all leather products.
-- Without this SELECT policy, the admin panel can sign in successfully
-- but receives an empty product list under row-level security.

drop policy if exists "Catalogue admins can read leather products" on public.leather_products;

create policy "Catalogue admins can read leather products"
  on public.leather_products
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.catalogue_admins a
      where a.user_id = auth.uid()
    )
  );
