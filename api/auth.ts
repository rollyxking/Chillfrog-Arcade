import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, createHmac } from 'crypto';
import { db, makeToken } from './_lib';
// Verifies Telegram Login Widget payload (HMAC with SHA256(bot_token)) => proves account ownership.
export default async function h(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const d = req.body || {}; const { hash, ...rest } = d;
  const str = Object.keys(rest).sort().map(k => `${k}=${rest[k]}`).join('\n');
  const key = createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN!).digest();
  if (!hash || createHmac('sha256', key).update(str).digest('hex') !== hash) return res.status(401).json({ error: 'bad_signature' });
  if (Date.now() / 1000 - Number(rest.auth_date) > 86400) return res.status(401).json({ error: 'expired' });
  if (!rest.username) return res.status(400).json({ error: 'Set a Telegram @username first (Telegram Settings).' });
  let { data: p } = await db.from('players').select('id,username,username_changed_at').eq('telegram_id', rest.id).maybeSingle();
  if (!p) {
    const ins = await db.from('players').insert({ telegram_id: rest.id, username: rest.username }).select('id,username,username_changed_at').single();
    if (ins.error) return res.status(409).json({ error: ins.error.code === '23505' ? 'Username already taken by another player.' : ins.error.message });
    p = ins.data; await db.from('player_stats').insert({ player_id: p!.id });
  }
  res.json({ token: makeToken(p!.id), player: p });
}
