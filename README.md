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
