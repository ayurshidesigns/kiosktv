import { del } from '@vercel/blob';
import { sql, init, getLocalBase } from '../../../../lib/db.js';
import { isAdmin, checkPassword, makeCookie, clearCookie } from '../../../../lib/auth.js';

export const dynamic = 'force-dynamic';
const RATIOS = ['fill', '16:9', '9:16', '16:10', '4:3', '3:4', '21:9', '1:1'];
const FITS = ['contain', 'cover', 'fill'];
const J = (d, s = 200, h = {}) => Response.json(d, { status: s, headers: { 'Cache-Control': 'no-store', ...h } });
const clampSec = (v) => Math.max(1, Math.min(3600, parseInt(v, 10) || 10));

export async function POST(req, { params }) {
  const { action } = await params;
  const b = await req.json().catch(() => ({}));

  if (action === 'login') {
    if (checkPassword(b.password ?? '')) return J({ ok: 1 }, 200, { 'Set-Cookie': makeCookie() });
    await new Promise((r) => setTimeout(r, 1000));
    return J({ error: 'Wrong password' }, 403);
  }
  if (action === 'logout') return J({ ok: 1 }, 200, { 'Set-Cookie': clearCookie });
  if (!isAdmin(req)) return J({ error: 'Not logged in' }, 401);

  try {
    await init();
    switch (action) {
      case 'state': {
        const screens = await sql`SELECT id,name,aspect_ratio,fit,rotation,playlist_id,
          EXTRACT(EPOCH FROM (now()-last_seen))::int AS seen_ago FROM screens WHERE paired ORDER BY name`;
        const media = await sql`SELECT id,type,url,original_name,duration,source,local_name FROM media ORDER BY id DESC`;
        const pls = await sql`SELECT id,name FROM playlists ORDER BY name`;
        const its = await sql`SELECT playlist_id,media_id,duration FROM playlist_items ORDER BY playlist_id,position`;
        const playlists = pls.map((p) => ({
          ...p,
          items: its.filter((i) => i.playlist_id === p.id).map((i) => ({ media_id: i.media_id, duration: i.duration })),
        }));
        return J({ screens, media, playlists, local_base: await getLocalBase() });
      }
      case 'screen_pair': {
        const code = String(b.code ?? '').replace(/\D/g, '');
        const name = (String(b.name ?? '').trim() || 'Screen').slice(0, 120);
        const r = await sql`UPDATE screens SET paired=true, name=${name}, pairing_code=NULL
          WHERE pairing_code=${code} AND paired=false RETURNING id`;
        if (!r.length) return J({ error: 'Code not found. Check the number shown on the TV.' }, 404);
        return J({ ok: 1 });
      }
      case 'screen_update': {
        const ar = b.aspect_ratio ?? '16:9', fit = b.fit ?? 'contain', rot = parseInt(b.rotation ?? 0, 10);
        if (!RATIOS.includes(ar) || !FITS.includes(fit) || ![0, 90, 180, 270].includes(rot))
          return J({ error: 'Invalid setting' }, 400);
        const pl = b.playlist_id === '' || b.playlist_id == null ? null : Number(b.playlist_id);
        const name = (String(b.name ?? '').trim() || 'Screen').slice(0, 120);
        await sql`UPDATE screens SET name=${name}, aspect_ratio=${ar}, fit=${fit}, rotation=${rot}, playlist_id=${pl}
          WHERE id=${Number(b.id)} AND paired`;
        return J({ ok: 1 });
      }
      case 'screen_delete':
        await sql`DELETE FROM screens WHERE id=${Number(b.id)}`;
        return J({ ok: 1 });

      case 'media_add': {   // called after the browser has uploaded the file straight to Blob
        let host = '';
        try { host = new URL(b.url).hostname; } catch {}
        if (!host.endsWith('.blob.vercel-storage.com')) return J({ error: 'Invalid file URL' }, 400);
        const type = b.type === 'video' ? 'video' : 'image';
        await sql`INSERT INTO media(type,url,original_name,duration)
          VALUES(${type}, ${b.url}, ${String(b.original_name ?? 'file').slice(0, 255)}, 10)`;
        return J({ ok: 1 });
      }
      case 'media_add_local': {   // file names only; the files themselves are zipped onto the TVs
        const files = Array.isArray(b.files) ? b.files.slice(0, 200) : [];
        let added = 0;
        for (const f of files) {
          const name = String(f.name ?? '').trim();
          if (!name || name.length > 200 || name.startsWith('/') || name.split('/').includes('..')) continue;
          const type = f.type === 'video' ? 'video' : 'image';
          const dup = await sql`SELECT 1 FROM media WHERE source='local' AND local_name=${name}`;
          if (dup.length) continue;
          await sql`INSERT INTO media(type,url,original_name,duration,source,local_name)
            VALUES(${type}, '', ${name}, 10, 'local', ${name})`;
          added++;
        }
        return J({ added });
      }
      case 'setting_set': {   // folder address the TVs use for local files
        let v = String(b.value ?? '').trim();
        if (!v) { await sql`DELETE FROM settings WHERE key='local_base'`; return J({ ok: 1 }); }
        try { if (!/^https?:$/.test(new URL(v).protocol)) throw 0; }
        catch { return J({ error: 'Enter a full address, e.g. https://localhost/sdcard/…/media/' }, 400); }
        if (v.length > 300) return J({ error: 'Address too long' }, 400);
        if (!v.endsWith('/')) v += '/';
        await sql`INSERT INTO settings(key,value) VALUES('local_base',${v})
          ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`;
        return J({ ok: 1 });
      }
      case 'media_update':
        await sql`UPDATE media SET duration=${clampSec(b.duration)} WHERE id=${Number(b.id)}`;
        return J({ ok: 1 });
      case 'media_delete': {
        const [m] = await sql`SELECT url FROM media WHERE id=${Number(b.id)}`;
        if (m) {
          if (m.url) await del(m.url).catch(() => {});
          await sql`DELETE FROM media WHERE id=${Number(b.id)}`;
        }
        return J({ ok: 1 });
      }
      case 'playlist_create': {
        const name = (String(b.name ?? '').trim() || 'Playlist').slice(0, 120);
        const [r] = await sql`INSERT INTO playlists(name) VALUES(${name}) RETURNING id`;
        return J({ id: r.id });
      }
      case 'playlist_rename':
        await sql`UPDATE playlists SET name=${(String(b.name ?? '').trim() || 'Playlist').slice(0, 120)} WHERE id=${Number(b.id)}`;
        return J({ ok: 1 });
      case 'playlist_delete':
        await sql`DELETE FROM playlists WHERE id=${Number(b.id)}`;
        return J({ ok: 1 });
      case 'playlist_set_items': {
        const pid = Number(b.id);
        const items = Array.isArray(b.items) ? b.items : [];
        await sql.transaction([
          sql`DELETE FROM playlist_items WHERE playlist_id=${pid}`,
          ...items.map((it, pos) => {
            const d = it.duration === '' || it.duration == null ? null : clampSec(it.duration);
            return sql`INSERT INTO playlist_items(playlist_id,media_id,position,duration)
              SELECT ${pid}::int, id, ${pos}::int, ${d}::int FROM media WHERE id=${Number(it.media_id)}`;
          }),
        ]);
        return J({ ok: 1 });
      }
      default:
        return J({ error: 'Unknown action' }, 404);
    }
  } catch (e) {
    console.error(e);
    return J({ error: 'Server error' }, 500);
  }
}
