import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, playerFrom } from './_lib';
export default async function h(req: VercelRequest, res: VercelResponse) {
  const pid = playerFrom(req); if (!pid) return res.status(401).end();
  const name = String(req.body?.username || '').replace(/^@/, '');
  if (!/^[A-Za-z0-9_]{3,32}$/.test(name)) return res.status(400).json({ error: '3-32 letters, numbers or _' });
  const { data, error } = await db.rpc('change_username', { p_player: pid, p_name: name });
  if (error) return res.status(error.code === '23505' ? 409 : 429).json({ error: error.code === '23505' ? 'Username taken' : 'You can change your username once every 7 days.' });
  res.json({ username: name, nextChange: new Date(new Date(data).getTime() + 7 * 864e5).toISOString() });
}
