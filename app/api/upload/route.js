import { handleUpload } from '@vercel/blob/client';
import { isAdmin } from '../../../lib/auth.js';

export const dynamic = 'force-dynamic';

// Issues short-lived upload tokens so the browser can send big videos straight to Blob
// (Vercel functions themselves are limited to ~4.5 MB request bodies).
export async function POST(req) {
  if (!isAdmin(req)) return Response.json({ error: 'Not logged in' }, { status: 401 });
  const body = await req.json();
  try {
    const json = await handleUpload({
      body, request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'],
        maximumSizeInBytes: 500 * 1024 * 1024,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {},
    });
    return Response.json(json);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
