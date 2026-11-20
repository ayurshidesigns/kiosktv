import { neon } from '@neondatabase/serverless';

let _s;
const conn = () => (_s ??= neon(process.env.DATABASE_URL || process.env.POSTGRES_URL));
// lazy wrapper so `next build` doesn't need the env var
export const sql = Object.assign((...a) => conn()(...a), {
  transaction: (...a) => conn().transaction(...a),
});

let ready;
export function init() {
  return (ready ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS playlists (id SERIAL PRIMARY KEY, name TEXT NOT NULL)`;
    await sql`CREATE TABLE IF NOT EXISTS media (
      id SERIAL PRIMARY KEY, type TEXT NOT NULL, url TEXT NOT NULL, original_name TEXT NOT NULL,
      duration INT NOT NULL DEFAULT 10, created_at TIMESTAMPTZ DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS playlist_items (
      id SERIAL PRIMARY KEY,
      playlist_id INT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      media_id INT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
      position INT NOT NULL, duration INT)`;
    await sql`CREATE TABLE IF NOT EXISTS screens (
      id SERIAL PRIMARY KEY, device_id TEXT UNIQUE NOT NULL, name TEXT NOT NULL DEFAULT '',
      paired BOOLEAN NOT NULL DEFAULT false, pairing_code CHAR(6) UNIQUE,
      aspect_ratio TEXT NOT NULL DEFAULT '16:9', fit TEXT NOT NULL DEFAULT 'contain',
      rotation INT NOT NULL DEFAULT 0,
      playlist_id INT REFERENCES playlists(id) ON DELETE SET NULL,
      last_seen TIMESTAMPTZ NOT NULL DEFAULT now())`;
    await sql`ALTER TABLE media ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'cloud'`;
    await sql`ALTER TABLE media ADD COLUMN IF NOT EXISTS local_name TEXT`;
    await sql`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`;
  })().catch((e) => { ready = null; throw e; }));
}

export async function getLocalBase() {
  const { DEFAULT_LOCAL_BASE } = await import('./local.js');
  const r = await sql`SELECT value FROM settings WHERE key='local_base'`;
  return r[0]?.value || DEFAULT_LOCAL_BASE;
}
