const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

function database(context) {
  return context.env?.PORTRAIT_DB;
}

async function authorized(request, secret) {
  const match = /^Bearer ([^\s]+)$/.exec(request.headers.get('Authorization') || '');
  if (!match || typeof secret !== 'string' || secret.length < 32) return false;
  const encoder = new TextEncoder();
  const [actual, expected] = await Promise.all([match[1], secret].map(value =>
    crypto.subtle.digest('SHA-256', encoder.encode(value))));
  const a = new Uint8Array(actual), b = new Uint8Array(expected);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

export async function onRequestGet(context) {
  const db = database(context);
  if (!db) return json({ error: 'Portrait database is not configured' }, 503);
  try {
    const { results } = await db.prepare(
      'SELECT rank, image_url, position, updated_at FROM portrait_settings ORDER BY rank'
    ).all();
    return json({ records: results });
  } catch {
    return json({ error: 'Portrait database is unavailable' }, 503);
  }
}

export async function onRequestPut(context) {
  const { request } = context;
  const secret = context.env?.PORTRAIT_ADMIN_TOKEN;
  if (typeof secret !== 'string' || secret.length < 32) return json({ error: 'Admin secret is not configured' }, 503);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Forbidden origin' }, 403);
  if (!await authorized(request, secret)) return json({ error: 'Unauthorized' }, 401);
  const db = database(context);
  if (!db) return json({ error: 'Portrait database is not configured' }, 503);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || ''))
    return json({ error: 'Expected JSON' }, 415);
  if (Number(request.headers.get('Content-Length')) > 2048) return json({ error: 'Request too large' }, 413);

  let input;
  try {
    const body = await request.text();
    if (body.length > 2048) return json({ error: 'Request too large' }, 413);
    input = JSON.parse(body);
  } catch { return json({ error: 'Invalid JSON' }, 400); }

  const { rank, image_url: imageURL, position } = input || {};
  let parsedURL;
  try { parsedURL = new URL(imageURL); } catch { /* Invalid URL is rejected below. */ }
  if (!Number.isInteger(rank) || rank < 1 || rank > 100 ||
      !Number.isInteger(position) || position < 0 || position > 100 ||
      typeof imageURL !== 'string' || imageURL.length > 2048 ||
      !parsedURL || !['http:', 'https:'].includes(parsedURL.protocol))
    return json({ error: 'Invalid portrait setting' }, 400);

  try {
    await db.prepare(`INSERT INTO portrait_settings (rank, image_url, position)
      VALUES (?, ?, ?)
      ON CONFLICT(rank) DO UPDATE SET image_url = excluded.image_url,
        position = excluded.position, updated_at = CURRENT_TIMESTAMP`)
      .bind(rank, imageURL, position).run();
    const record = await db.prepare(
      'SELECT rank, image_url, position, updated_at FROM portrait_settings WHERE rank = ?'
    ).bind(rank).first();
    return json({ record });
  } catch {
    return json({ error: 'Portrait database is unavailable' }, 503);
  }
}
