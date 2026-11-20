import crypto from 'node:crypto';
import { sql, init, getLocalBase } from '../../../lib/db.js';
import { localUrl } from '../../../lib/local.js';

export const dynamic = 'force-dynamic';
const J = (d, s = 200) => Response.json(d, { status: s, headers: { 'Cache-Control': 'no-store' } });

// Public endpoint used by each TV: registers it, heartbeats, and returns its playlist
export async function POST(req) {
  const { device_id: id = '' } = await req.json().catch(() => ({}));
  if (!/^[A-Za-z0-9-]{16,64}$/.test(id)) return J({ error: 'bad device' }, 400);
  try {
    return await handle(id);
  } catch (e) {
    console.error(e);
    return J({ error: 'Server error' }, 500);
  }
}

async function handle(id) {
  await init();

  let [scr] = await sql`SELECT * FROM screens WHERE device_id=${id}`;
  if (!scr) {
    await sql`DELETE FROM screens WHERE paired=false AND last_seen < now() - interval '1 day'`;
    for (let i = 0; i < 10 && !scr; i++) {
      const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
      try {
        [scr] = await sql`INSERT INTO screens(device_id,pairing_code) VALUES(${id},${code}) RETURNING *`;
      } catch (e) {
        [scr] = await sql`SELECT * FROM screens WHERE device_id=${id}`;   // lost a race with ourselves
        if (!scr && i === 9) throw e;
      }
    }
  } else {
    await sql`UPDATE screens SET last_seen=now() WHERE id=${scr.id}`;
  }

  if (!scr.paired) return J({ paired: false, code: scr.pairing_code });

  const rows = scr.playlist_id
    ? await sql`SELECT m.type, m.url, m.source, m.local_name, COALESCE(pi.duration, m.duration) AS duration
        FROM playlist_items pi JOIN media m ON m.id = pi.media_id
        WHERE pi.playlist_id=${scr.playlist_id} ORDER BY pi.position`
    : [];
  const base = rows.some((r) => r.source === 'local') ? await getLocalBase() : '';
  const items = rows.map((r) => r.source === 'local'
    ? { type: r.type, url: localUrl(base, r.local_name), duration: Number(r.duration), local: true }
    : { type: r.type, url: r.url, duration: Number(r.duration) });
  const payload = {
    paired: true, name: scr.name, aspect_ratio: scr.aspect_ratio, fit: scr.fit,
    rotation: Number(scr.rotation), items,
  };
  payload.hash = crypto.createHash('md5').update(JSON.stringify(payload)).digest('hex');
  return J(payload);
}
