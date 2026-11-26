import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, playerFrom } from './_lib';
export default async function h(req: VercelRequest, res: VercelResponse) {
  const pid = playerFrom(req); if (!pid) return res.status(401).end();
  const { count } = await db.from('game_sessions').select('*', { count: 'exact', head: true })
    .eq('player_id', pid).gte('started_at', new Date(Date.now() - 6e4).toISOString());
  if ((count ?? 0) >= 5) return res.status(429).json({ error: 'Slow down' });
  const { data, error } = await db.from('game_sessions').insert({ player_id: pid }).select('id').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ sessionId: data.id });
}
