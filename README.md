# Leather Fashion Catalogue

Luxury leather catalogue built with React, Vite and Supabase.

## Existing Supabase project

The website reuses the existing Supabase project, `leather_products` table and `leather-images` public Storage bucket.

The public catalogue reads only active products (`is_active = true`).

## Environment variables

Create these in your deployment environment (Cloudflare Pages):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The values are also documented in `.env.example`. Do not commit real secrets to GitHub. Never expose the Supabase service-role key in this frontend.

## Cloudflare Pages build settings

- Framework preset: **Vite**
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`

Use Node.js 22 or a Vite-supported current Node.js version.

## Development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The generated website is in the `dist` folder.


## Bhartiya Leather Fashions catalogue

The public site now has switchable Home, Leather Collections, About Bhartiya, Capabilities, Contact and Admin sections. Existing catalogue filters and image viewer controls are retained.

### Enable the extended catalogue fields and Admin area

1. Open the Supabase project connected to this website.
2. Go to **SQL Editor** and run `supabase/migrations/202611050001_bhartiya_catalogue_admin.sql`.
3. In **Authentication → Users**, create the administrator account with the email address that should manage the catalogue. Keep public sign-ups disabled.
4. Copy that user's UUID and run this SQL in the Supabase SQL Editor:

```sql
insert into public.catalogue_admins (user_id)
values ('PASTE_AUTH_USER_UUID_HERE');
```

5. Confirm the `leather-images` Storage bucket is public for image viewing. The migration adds authenticated-admin upload/update/delete policies but does not change the existing public image-read configuration.
6. Deploy the branch after reviewing it. Sign in through the website's **Admin** tab with the Supabase email and password.

The admin form supports article ID, article name, collection, animal, colour, thickness, tannage, origin, finish, grain/texture, application, description, remarks, main photo, close-up photo and public visibility.

The SQL migration adds optional metadata columns without deleting or rewriting existing article rows. Existing product filters and the gradual image zoom viewer are retained.

**Security:** never put the Supabase service-role key in the frontend or Cloudflare public environment variables. The website uses only the publishable/anon key and Supabase Auth. Administrator access is granted by adding a user UUID to `catalogue_admins`.

### Contact details shown on the site

The contact tab uses Bhartiya International's publicly disclosed registered office and corporate contact details. The email is a corporate contact address, not represented as a dedicated leather-sales mailbox. Check the company's official website for current enquiry routing.
