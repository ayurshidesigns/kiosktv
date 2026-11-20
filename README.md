# TV Signage (Vercel)

Pair TVs, give each its own looping playlist of images/videos. Next.js on Vercel,
Neon Postgres for data, Vercel Blob for media.

## Deploy
1. Push this folder to a GitHub repo and import it in Vercel (framework: Next.js, no settings needed).
2. Project → **Storage**: create a **Neon** (Postgres) database and a **Blob** store, and connect both to the project.
   This adds `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` automatically.
3. Project → Settings → Environment Variables: add `ADMIN_PASSWORD` and `SESSION_SECRET` (any long random string).
4. Deploy. Tables are created automatically on first request.

## Use
- Admin: `https://YOUR-APP.vercel.app/admin`
- TV player: open `https://YOUR-APP.vercel.app/` on each TV (kiosk browser, e.g. Fully Kiosk). It shows a 6-digit code;
  enter it under Screens → Add screen.
- Per screen: aspect ratio, media fit, rotation, playlist.

## Local media mode
Prefer to keep videos on the TVs instead of the cloud? See `LOCAL-MEDIA.md`. In that mode you don't need Blob at all.

## Notes
- Files upload straight from the browser to Blob (works for large videos). Limit set to 500 MB per file in `app/api/upload/route.js`.
- `public/blob-client.js` is a pre-bundled copy of `@vercel/blob/client`. Rebuild after upgrading the package:
  `npx esbuild node_modules/@vercel/blob/dist/client.js --bundle --minify --format=iife --global-name=BlobClient --platform=browser --outfile=public/blob-client.js`
- Local dev: copy `.env.example` to `.env.local`, fill it in, run `npm run dev`.
